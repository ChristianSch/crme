import type { LinkedInProfileData, LinkedInCompanyData, LinkedInData, LinkedInCompanyExperience } from '../types';

// Detect page type from URL
export function getLinkedInPageType(url: string): 'person' | 'company' | null {
  if (url.includes('linkedin.com/in/')) {
    return 'person';
  }
  if (url.includes('linkedin.com/company/')) {
    return 'company';
  }
  return null;
}

// Extract LinkedIn profile identifier from URL
export function getLinkedInIdentifier(url: string): string | null {
  const personMatch = url.match(/linkedin\.com\/in\/([^/?]+)/);
  if (personMatch) return personMatch[1];
  
  const companyMatch = url.match(/linkedin\.com\/company\/([^/?]+)/);
  if (companyMatch) return companyMatch[1];
  
  return null;
}

// Scrape person profile data from LinkedIn page
export function scrapePersonProfile(): LinkedInProfileData | null {
  try {
    const linkedinUrl = window.location.href.split('?')[0];
    
    // Get name - LinkedIn uses h1 for the profile name with various class combinations
    // Try multiple selectors as LinkedIn frequently changes their DOM
    const nameElement = 
      document.querySelector('h1.text-heading-xlarge') ||  // Old format
      document.querySelector('h1.inline.t-24') ||          // New format (2024+)
      document.querySelector('h1.t-24.v-align-middle') ||  // Another variant
      document.querySelector('.pv-top-card h1') ||         // Fallback: h1 in top card
      document.querySelector('h1[class*="break-words"]');  // Generic fallback
    
    const fullName = cleanText(nameElement?.textContent) || scrapePersonNameFromMetadata();
    if (!fullName) {
      console.warn('Could not find profile name', collectLinkedInDebugInfo());
      return null;
    }
    
    console.log('Scraped name:', fullName);
    const nameParts = parseFullName(fullName);
    
    // Get headline/title - div with text-body-medium class that has job title
    // Use data-generated-suggestion-target attribute as it's more reliable
    const headlineElement = 
      document.querySelector('div[data-generated-suggestion-target]') ||
      document.querySelector('div.text-body-medium.break-words');
    const headline = cleanText(headlineElement?.textContent) || scrapeHeadlineFromMetadata(fullName) || scrapeHeadlineFromDescription(fullName);
    console.log('Scraped headline:', headline);
    
    // Get current company info
    const topCardCompanies = scrapeTopCardCompanyExperiences(headline);
    const companyData = topCardCompanies[0] ? { name: topCardCompanies[0].name, linkedinUrl: topCardCompanies[0].linkedinUrl } : scrapeCurrentCompanyFromProfile();
    const currentCompany = companyData?.name || extractCompanyFromHeadline(headline);
    const companies = scrapeCurrentCompanyExperiences(headline, topCardCompanies, companyData);
    console.log('Scraped company data:', companyData);
    console.log('Current company:', currentCompany);
    console.log('Scraped current company experiences:', companies);
    if (companies.length === 0) console.warn('No companies scraped from LinkedIn profile', collectCompanyDebugInfo());
    
    // Get profile image - try to get high quality version
    const profileImageUrl = scrapeProfileImage();
    
    // Get location - span with location info
    const locationElement = 
      document.querySelector('span.text-body-small.inline.t-black--light.break-words') ||
      document.querySelector('.text-body-small.inline.t-black--light.break-words') ||
      document.querySelector('.pv-top-card--list-bullet li:last-child');
    const location = cleanText(locationElement?.textContent);
    console.log('Scraped location:', location);
    
    const result = {
      type: 'person' as const,
      linkedinUrl,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      headline,
      currentCompany,
      currentCompanyLinkedInUrl: companyData?.linkedinUrl,
      companies,
      profileImageUrl: profileImageUrl || undefined,
      location: location || undefined,
    };
    
    console.log('Scraped profile data:', {
      fullName,
      firstName: result.firstName,
      lastName: result.lastName,
      headline: result.headline,
    });
    
    return result;
  } catch (error) {
    console.error('Error scraping person profile:', error);
    return null;
  }
}

// Scrape profile image
function scrapeProfileImage(): string {
  // Try multiple selectors - LinkedIn changes DOM frequently
  const selectors = [
    '.pv-top-card-profile-picture__container img',  // New format with button wrapper
    '.pv-top-card-profile-picture__image',          // Old format
    'img.profile-photo-edit__preview',
    '.pv-top-card__photo img',
    'button[aria-label*="image"] img',              // Button with image label
    '.EntityPhoto-circle-9 img',                    // Entity photo class
    'img[title]',                                   // Fallback: img with title (usually name)
  ];
  
  for (const selector of selectors) {
    const img = document.querySelector(selector) as HTMLImageElement;
    if (img?.src && !img.src.includes('ghost') && img.src.includes('profile')) {
      // Use the URL as-is - LinkedIn URLs have signed params that break if modified
      console.log('Scraped profile image:', img.src);
      return img.src;
    }
  }
  
  return '';
}

function scrapeCurrentCompanyExperiences(
  headline: string,
  topCardCompanies: LinkedInCompanyExperience[],
  legacyTopCardCompany: { name: string; linkedinUrl?: string; logoUrl?: string } | null,
): LinkedInCompanyExperience[] {
  const experiences: LinkedInCompanyExperience[] = [...topCardCompanies];

  if (legacyTopCardCompany?.name && legacyTopCardCompany.linkedinUrl) {
    experiences.push({
      name: legacyTopCardCompany.name,
      linkedinUrl: legacyTopCardCompany.linkedinUrl,
      role: roleFromHeadline(headline, legacyTopCardCompany.name),
      current: true,
    });
  }

  for (const item of findExperienceItems()) {
    const text = cleanText(item.textContent);
    if (!looksCurrentExperience(text)) continue;

    const companyLink = item.querySelector<HTMLAnchorElement>('a[href*="/company/"]');
    const linkedinUrl = companyLink ? absoluteLinkedInUrl(companyLink.getAttribute('href') || '') : undefined;
    const role = scrapeExperienceRole(item);
    const companyNames = scrapeExperienceCompanyNames(item, companyLink);

    for (const companyName of companyNames) {
      experiences.push({ name: companyName, linkedinUrl, role, current: true });
    }
  }

  return dedupeCompanyExperiences(experiences);
}

function scrapeTopCardCompanyExperiences(headline: string): LinkedInCompanyExperience[] {
  const experiences: LinkedInCompanyExperience[] = [];
  const containers = Array.from(document.querySelectorAll('.pv-text-details__right-panel, .pv-top-card'));
  const currentLabelPattern = /(current company|aktuelles unternehmen|entreprise actuelle|empresa actual|empresa atual|azienda attuale)\s*:?\s*([^.]*)/i;

  for (const container of containers) {
    for (const element of Array.from(container.querySelectorAll('[aria-label]'))) {
      const label = cleanText(element.getAttribute('aria-label'));
      const match = label.match(currentLabelPattern);
      if (!match) continue;
      const link = element.closest('a[href*="/company/"]') || element.querySelector('a[href*="/company/"]');
      const linkedinUrl = absoluteLinkedInUrl(link?.getAttribute('href') || '');
      const name = linkedinUrl ? stripLinkedInNoise(match[2] || '') : '';
      if (name) experiences.push({ name, linkedinUrl, role: roleFromHeadline(headline, name), current: true });
    }
  }

  for (const link of Array.from(document.querySelectorAll<HTMLAnchorElement>('.pv-text-details__right-panel a[href*="/company/"], .pv-top-card a[href*="/company/"]'))) {
    const name = companyNameFromLink(link);
    if (name) experiences.push({ name, linkedinUrl: absoluteLinkedInUrl(link.getAttribute('href') || ''), role: roleFromHeadline(headline, name), current: true });
  }

  return dedupeCompanyExperiences(experiences);
}

function findExperienceItems(): Element[] {
  const experienceAnchor = document.querySelector('#experience');
  const section = findProfileSection(experienceAnchor);
  const roots = [section, document.querySelector('main'), document.body].filter(Boolean) as Element[];

  for (const root of roots) {
    const explicitItems = Array.from(root.querySelectorAll('[componentkey^="entity-collection-item"], li.artdeco-list__item, li.pvs-list__paged-list-item, [data-view-name="profile-component-entity"]'));
    const currentExplicitItems = explicitItems.filter((item) => item.querySelector('a[href*="/company/"]') && looksCurrentExperience(cleanText(item.textContent)));
    if (currentExplicitItems.length > 0) {
      console.log('[CRME] LinkedIn experience items found', currentExplicitItems.map((item) => cleanText(item.textContent).slice(0, 180)));
      return currentExplicitItems;
    }
  }

  const byCompanyLink = new Set<Element>();
  const searchRoot = section || document.querySelector('main') || document.body;
  for (const link of Array.from(searchRoot.querySelectorAll<HTMLAnchorElement>('a[href*="/company/"]'))) {
    const item = closestExperienceItem(link, searchRoot);
    if (item && looksCurrentExperience(cleanText(item.textContent))) byCompanyLink.add(item);
  }
  const items = Array.from(byCompanyLink);
  if (items.length > 0) console.log('[CRME] LinkedIn experience items found from company links', items.map((item) => cleanText(item.textContent).slice(0, 180)));
  return items;
}

function closestExperienceItem(link: Element, section: Element): Element | null {
  let node: Element | null = link;
  while (node && node !== section) {
    const componentKey = node.getAttribute('componentkey') || '';
    if (componentKey.startsWith('entity-collection-item')) return node;
    if (node.matches('li.artdeco-list__item, li.pvs-list__paged-list-item, [data-view-name="profile-component-entity"]')) return node;
    node = node.parentElement;
  }
  return link.closest('li') || null;
}

function findProfileSection(anchor: Element | null): Element | null {
  if (!anchor) return null;
  let node: Element | null = anchor;
  for (let i = 0; i < 6 && node; i += 1) {
    if (node.matches('section')) return node;
    const section = node.querySelector?.('section');
    if (section) return section;
    node = node.parentElement;
  }
  return anchor.closest('section') || anchor.parentElement;
}

function looksCurrentExperience(text: string): boolean {
  return /\b(present|gegenwart|heute|aujourd’hui|aujourd'hui|actualidad|presente|current)\b/i.test(text);
}

function scrapeExperienceRole(item: Element): string {
  const role =
    cleanText(item.querySelector('.t-bold span[aria-hidden="true"]')?.textContent) ||
    cleanText(item.querySelector('[class*="hoverable-link-text"] span[aria-hidden="true"]')?.textContent);
  if (role) return stripLinkedInNoise(role);

  const detailLink = Array.from(item.querySelectorAll<HTMLAnchorElement>('a[href*="/company/"]')).find((link) => cleanText(link.textContent));
  const lines = visibleLines(detailLink || item);
  const companyIndex = lines.findIndex((line) => looksLikeCompanyLine(line));
  if (companyIndex > 0) return stripLinkedInNoise(lines[companyIndex - 1]);
  return '';
}

function scrapeExperienceCompanyNames(item: Element, companyLink: HTMLAnchorElement | null): string[] {
  const names: string[] = [];

  // Only accept companies with an explicit LinkedIn /company/ URL. This avoids
  // locations, skills, employment type, descriptions, and unlinked free text.
  for (const link of Array.from(item.querySelectorAll<HTMLAnchorElement>('a[href*="/company/"]'))) {
    if (!absoluteLinkedInUrl(link.getAttribute('href') || '')) continue;
    const imgName = companyNameFromImageAlt(link) || companyNameFromEmploymentLine(link) || companyNameFromLink(link);
    if (imgName) names.push(imgName);
  }

  if (companyLink && absoluteLinkedInUrl(companyLink.getAttribute('href') || '')) {
    const fallback = companyNameFromImageAlt(companyLink) || companyNameFromEmploymentLine(companyLink) || companyNameFromLink(companyLink);
    if (fallback) names.push(fallback);
  }

  return Array.from(new Set(names.map(stripLinkedInNoise).filter(isPlausibleCompanyName)));
}

function visibleLines(root: Element | null): string[] {
  if (!root) return [];
  const paragraphLines = Array.from(root.querySelectorAll('p, span[aria-hidden="true"]'))
    .map((el) => cleanText(el.textContent))
    .filter(Boolean);
  if (paragraphLines.length > 0) return Array.from(new Set(paragraphLines));
  return cleanText(root.textContent).split(/\n+/).map(cleanText).filter(Boolean);
}

function looksLikeCompanyLine(line: string): boolean {
  const clean = cleanText(line);
  if (!clean || looksLikeDateOrLocation(clean)) return false;
  if (/\b(full-time|part-time|self-employed|freelance|contract|internship)\b/i.test(clean)) return true;
  return !looksLikeRoleOrDescription(clean) && clean.length <= 80;
}

function looksLikeRoleOrDescription(line: string): boolean {
  return /\b(founder|ceo|advisor|advisory|member|board|strategic|manager|director|partner|consultant|engineer|developer|sales|marketing|operations|software|security|immigration|accounting|focused|suche|your one-stop)\b/i.test(line);
}

function companyNameFromLink(link?: HTMLAnchorElement | null): string {
  // Do not use full link text here. LinkedIn wraps roles, dates, locations,
  // skills and descriptions in the same link/container, which caused false
  // companies like “Berlin, Deutschland”. Logo alt/aria-label is the reliable
  // company-specific signal.
  return companyNameFromImageAlt(link);
}

function companyNameFromImageAlt(link?: HTMLAnchorElement | null): string {
  if (!link) return '';
  const logo = link.querySelector('img[alt], svg[aria-label]');
  return companyNameFromLogoElement(logo);
}

function companyNameFromLogoElement(logo?: Element | null): string {
  if (!logo) return '';
  const raw = cleanText(logo.getAttribute('alt')) || cleanText(logo.getAttribute('aria-label'));
  return stripLinkedInNoise(raw).replace(/\s+logo$/i, '').trim();
}

function companyNameFromEmploymentLine(item: Element): string {
  for (const line of visibleLines(item)) {
    if (!/\b(full-time|part-time|self-employed|freelance|contract|internship)\b/i.test(line)) continue;
    return stripLinkedInNoise(line.split('·')[0] || '');
  }
  return '';
}

function isPlausibleCompanyName(name: string): boolean {
  const clean = cleanText(name);
  if (!clean || clean.length > 90) return false;
  if (looksLikeDateOrLocation(clean) || looksLikeRoleOrDescription(clean)) return false;
  if (/\b(skill|skills|strategy consulting|investment analysis|portfolio development|full-time|part-time|self-employed)\b/i.test(clean)) return false;
  if (/\b(berlin|hamburg|munich|münchen|cologne|köln|frankfurt|london|paris|remote|hybrid|on-site|deutschland|germany|area|metropolitan)\b/i.test(clean)) return false;
  return true;
}

function looksLikeDateOrLocation(value: string): boolean {
  return /\b(present|gegenwart|aujourd|actualidad|presente|yr|yrs|mo|mos|year|years|month|months|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(value);
}

function stripLinkedInNoise(value: string): string {
  return cleanText(value)
    .replace(/^company logo\s*/i, '')
    .replace(/\s+logo$/i, '')
    .replace(/\s*·\s*(full-time|part-time|self-employed|freelance|contract).*$/i, '')
    .trim();
}

function absoluteLinkedInUrl(href: string): string | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href, 'https://www.linkedin.com');
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

function dedupeCompanyExperiences(experiences: LinkedInCompanyExperience[]): LinkedInCompanyExperience[] {
  const out: LinkedInCompanyExperience[] = [];
  const seen = new Set<string>();

  for (const experience of experiences) {
    const name = cleanText(experience.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) {
      const existing = out.find((item) => item.name.toLowerCase() === key);
      if (existing && !existing.role && experience.role) existing.role = experience.role;
      if (existing && !existing.linkedinUrl && experience.linkedinUrl) existing.linkedinUrl = experience.linkedinUrl;
      continue;
    }
    seen.add(key);
    out.push({ ...experience, name, role: cleanText(experience.role) });
  }

  return out.slice(0, 8);
}

function roleFromHeadline(headline: string, companyName: string): string {
  const cleanHeadline = cleanText(headline);
  if (!cleanHeadline) return '';
  const escapedCompany = companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = cleanHeadline.match(new RegExp(`^(.+?)\\s+(?:at|@|for|bei|chez|à|en)\\s+${escapedCompany}(?:\\s*[|•-].*)?$`, 'i'));
  return cleanText(match?.[1]) || '';
}

// Scrape company info from current profile page
function scrapeCurrentCompanyFromProfile(): { name: string; linkedinUrl?: string; logoUrl?: string } | null {
  try {
    // Best method: Find button with aria-label containing "Entreprise actuelle" or "Current company"
    // This button contains company name, logo, and links to company page
    const companyButton = 
      document.querySelector('button[aria-label*="Entreprise actuelle"]') ||
      document.querySelector('button[aria-label*="Current company"]') ||
      document.querySelector('button[aria-label*="Empresa actual"]') ||  // Spanish
      document.querySelector('button[aria-label*="Aktuelles Unternehmen"]');  // German
    
    if (companyButton) {
      // Extract company name from aria-label (format: "Entreprise actuelle: CompanyName. ...")
      const ariaLabel = companyButton.getAttribute('aria-label') || '';
      const nameMatch = ariaLabel.match(/:\s*([^.]+)/);
      const name = nameMatch ? nameMatch[1].trim() : '';
      
      // Get company logo URL
      const logoImg = companyButton.querySelector('img');
      const logoUrl = logoImg?.src || undefined;
      
      // Try to get company LinkedIn URL from nearby link or page navigation
      // The button itself doesn't have the URL, but we can try to find it elsewhere
      let linkedinUrl: string | undefined;
      
      if (name) {
        console.log('Found company from button:', { name, logoUrl });
        return { name, linkedinUrl, logoUrl };
      }
    }
    
    // Fallback: Try to find company link in the experience section or top card
    const companyLink = 
      document.querySelector('.pv-text-details__right-panel-item-text a[href*="/company/"]') ||
      document.querySelector('a[data-field="experience_company_logo"]') ||
      document.querySelector('.experience-item a[href*="/company/"]');
    
    if (companyLink) {
      const href = companyLink.getAttribute('href') || '';
      const match = href.match(/\/company\/([^/?]+)/);
      const linkedinUrl = match ? `https://www.linkedin.com/company/${match[1]}/` : undefined;
      
      const name = companyLink.textContent?.trim() || 
        companyLink.closest('.pv-text-details__right-panel-item-text')?.textContent?.trim() ||
        '';
      
      if (name) {
        return { name, linkedinUrl };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error scraping company from profile:', error);
    return null;
  }
}

// Scrape company page data from LinkedIn
export function scrapeCompanyPage(): LinkedInCompanyData | null {
  try {
    const linkedinUrl = window.location.href.split('?')[0];
    
    // Company name
    const nameElement = 
      document.querySelector('h1.org-top-card-summary__title') ||
      document.querySelector('.org-top-card-summary-info-list__info-item') ||
      document.querySelector('h1[title]');
    
    const name = cleanText(nameElement?.textContent) || scrapeCompanyNameFromMetadata();
    if (!name) {
      console.warn('Could not find company name element', collectLinkedInDebugInfo());
      return null;
    }
    
    // Industry
    const industryElement = document.querySelector('.org-top-card-summary-info-list__info-item');
    const industry = cleanText(industryElement?.textContent);
    
    // Employee count
    const employeeElements = document.querySelectorAll('.org-top-card-summary-info-list__info-item');
    let employeeCount = '';
    employeeElements.forEach((el) => {
      const text = el.textContent || '';
      if (text.includes('employees') || text.includes('employee')) {
        employeeCount = cleanText(text);
      }
    });
    
    // Website - look in the about section or sidebar
    const websiteElement = 
      document.querySelector('a[data-control-name="top_card_link_website"]') ||
      document.querySelector('.link-without-visited-state.org-top-card-primary-actions__action');
    const website = websiteElement?.getAttribute('href') || '';
    
    // Logo
    const logoElement = document.querySelector('.org-top-card-primary-content__logo');
    const logoUrl = logoElement?.getAttribute('src') || '';
    
    // Description/tagline
    const descElement = document.querySelector('.org-top-card-summary__tagline');
    const description = cleanText(descElement?.textContent) || getMetaContent('description');
    
    return {
      type: 'company',
      linkedinUrl,
      name,
      website: website || undefined,
      industry: industry || undefined,
      employeeCount: employeeCount || undefined,
      logoUrl: logoUrl || undefined,
      description: description || undefined,
    };
  } catch (error) {
    console.error('Error scraping company page:', error);
    return null;
  }
}

// Main scraper function that detects page type and scrapes accordingly
export function scrapeCurrentPage(): LinkedInData | null {
  const pageType = getLinkedInPageType(window.location.href);
  
  if (pageType === 'person') {
    return scrapePersonProfile();
  }
  
  if (pageType === 'company') {
    return scrapeCompanyPage();
  }
  
  return null;
}

function cleanText(value?: string | null): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function getMetaContent(name: string): string {
  const selector = `meta[property="${name}"], meta[name="${name}"]`;
  return cleanText(document.querySelector<HTMLMetaElement>(selector)?.content);
}

function scrapePersonNameFromMetadata(): string {
  const title = getMetaContent('og:title') || document.title;
  return cleanText(
    title
      .replace(/\s*\|\s*LinkedIn.*$/i, '')
      .replace(/\s*-\s*LinkedIn.*$/i, '')
      .replace(/\s*LinkedIn\s*$/i, '')
      .split(' - ')[0],
  );
}

function scrapeHeadlineFromMetadata(fullName: string): string {
  const title = getMetaContent('og:title') || document.title;
  const withoutLinkedIn = title.replace(/\s*\|\s*LinkedIn.*$/i, '').replace(/\s*-\s*LinkedIn.*$/i, '');
  const prefix = `${fullName} - `;
  if (withoutLinkedIn.startsWith(prefix)) return cleanText(withoutLinkedIn.slice(prefix.length));
  return '';
}

function scrapeHeadlineFromDescription(fullName: string): string {
  const description = getMetaContent('description') || getMetaContent('og:description');
  if (!description) return '';
  const escapedName = fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`${escapedName}[^.]*? is ([^.]+?)(?:\\.|$)`, 'i'),
    new RegExp(`${escapedName}[^.]*? - ([^.]+?)(?:\\.|$)`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match?.[1]) return cleanText(match[1]);
  }
  return '';
}

function extractCompanyFromDescription(): string {
  const description = getMetaContent('description') || getMetaContent('og:description');
  if (!description) return '';
  return extractCompanyFromHeadline(description);
}

function scrapeCompanyNameFromMetadata(): string {
  const title = getMetaContent('og:title') || document.title;
  return cleanText(
    title
      .replace(/\s*\|\s*LinkedIn.*$/i, '')
      .replace(/\s*-\s*LinkedIn.*$/i, '')
      .replace(/\s*LinkedIn\s*$/i, ''),
  );
}

function collectLinkedInDebugInfo() {
  return {
    url: window.location.href,
    title: document.title,
    ogTitle: getMetaContent('og:title'),
    h1Count: document.querySelectorAll('h1').length,
    h1Texts: Array.from(document.querySelectorAll('h1')).slice(0, 5).map((el) => cleanText(el.textContent)),
  };
}

function collectCompanyDebugInfo() {
  const experienceAnchor = document.querySelector('#experience');
  const section = findProfileSection(experienceAnchor);
  return {
    topCardCompanyLinks: Array.from(document.querySelectorAll<HTMLAnchorElement>('.pv-text-details__right-panel a[href*="/company/"], .pv-top-card a[href*="/company/"]')).map((link) => ({ text: cleanText(link.textContent), href: link.href, alt: cleanText(link.querySelector('img')?.getAttribute('alt')) })),
    ariaCurrentCompany: Array.from(document.querySelectorAll('[aria-label]')).map((el) => cleanText(el.getAttribute('aria-label'))).filter((label) => /current company|aktuelles unternehmen|entreprise actuelle|empresa actual/i.test(label)).slice(0, 10),
    hasExperienceAnchor: Boolean(experienceAnchor),
    experienceText: cleanText(section?.textContent).slice(0, 1000),
    companyLinks: Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/company/"]')).slice(0, 20).map((link) => ({ text: cleanText(link.textContent), href: link.href, alt: cleanText(link.querySelector('img')?.getAttribute('alt')) })),
  };
}

// Helper to parse full name into first and last name
function parseFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }
  
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  
  // Handle cases like "John van der Berg" - take first as firstName, rest as lastName
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  
  return { firstName, lastName };
}

// Try to extract company name from headline like "Software Engineer at Google"
function extractCompanyFromHeadline(headline: string): string {
  // Match various patterns: "at Company", "chez Company" (French), "@ Company", "for Company"
  const patterns = [
    /\bat\s+(.+?)(?:\s*\||$)/i,           // English: "at Company"
    /\bchez\s+(.+?)(?:\s*\||$)/i,         // French: "chez Company"
    /\bbei\s+(.+?)(?:\s*\||$)/i,          // German: "bei Company"
    /\b@\s*(.+?)(?:\s*\||$)/i,            // Symbol: "@ Company" or "@Company"
    /\bfor\s+(.+?)(?:\s*\||$)/i,          // English: "for Company"
    /\bà\s+(.+?)(?:\s*\||$)/i,            // French: "à Company"
    /\ben\s+(.+?)(?:\s*\||$)/i,           // Spanish: "en Company"
  ];
  
  for (const pattern of patterns) {
    const match = headline.match(pattern);
    if (match) {
      const company = match[1].trim();
      console.log('Extracted company from headline:', company, 'using pattern:', pattern);
      return company;
    }
  }
  
  return '';
}

