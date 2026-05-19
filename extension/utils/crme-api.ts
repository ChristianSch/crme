import type { CrmeCompany, CrmePerson, ExtensionSettings, LinkedInCompanyData, LinkedInCompanyExperience, LinkedInProfileData } from '../types';

export class CrmeApiClient {
  private baseUrl: string;
  private apiToken: string;

  constructor(settings: ExtensionSettings) {
    this.baseUrl = settings.crmeUrl.replace(/\/$/, '');
    this.apiToken = settings.apiToken;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.apiToken) throw new Error('CRME token is not configured');
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiToken}`,
        ...init.headers,
      },
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<T>;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request<CrmePerson[]>('/people?limit=1');
      return true;
    } catch {
      return false;
    }
  }

  async findPersonByLinkedInUrl(linkedinUrl: string): Promise<CrmePerson | null> {
    const people = await this.peopleSearch(linkedinUrl, 10);
    return people.find((person) => normalizeUrl(person.linkedin_url) === normalizeUrl(linkedinUrl)) ?? null;
  }

  async findPersonByName(firstName: string, lastName: string): Promise<CrmePerson | null> {
    const q = [firstName, lastName].filter(Boolean).join(' ');
    if (!q) return null;
    const people = await this.peopleSearch(q, 10);
    const target = `${firstName} ${lastName}`.trim().toLowerCase();
    return people.find((person) => `${person.first_name} ${person.last_name}`.trim().toLowerCase() === target) ?? null;
  }

  async findCompanyByLinkedInUrl(_linkedinUrl: string): Promise<CrmeCompany | null> {
    // CRME does not have company LinkedIn fields yet.
    return null;
  }

  async findCompanyByName(name: string): Promise<CrmeCompany | null> {
    if (!name) return null;
    const companies = await this.companySearch(name, 10);
    return companies.find((company) => company.name.trim().toLowerCase() === name.trim().toLowerCase()) ?? null;
  }

  async createPerson(data: LinkedInProfileData): Promise<CrmePerson> {
    const person = await this.request<CrmePerson>('/people', {
      method: 'POST',
      body: JSON.stringify({
        first_name: data.firstName,
        last_name: data.lastName,
        title: data.headline ?? '',
        linkedin_url: data.linkedinUrl,
        city: data.location ?? '',
        source: 'linkedin',
      }),
    });

    await this.ensurePersonCompanyLink(person.id, data);

    return person;
  }

  async updatePerson(id: string, data: LinkedInProfileData): Promise<CrmePerson> {
    const person = await this.request<CrmePerson>(`/people/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        first_name: data.firstName,
        last_name: data.lastName,
        title: data.headline ?? '',
        linkedin_url: data.linkedinUrl,
        city: data.location ?? '',
        source: 'linkedin',
      }),
    });
    await this.ensurePersonCompanyLink(id, data);
    return person;
  }

  async createCompany(data: LinkedInCompanyData): Promise<CrmeCompany> {
    return this.request<CrmeCompany>('/companies', {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        domain: domainFromUrl(data.website ?? ''),
      }),
    });
  }

  async updateCompany(id: string, data: LinkedInCompanyData): Promise<CrmeCompany> {
    return this.request<CrmeCompany>(`/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: data.name, domain: domainFromUrl(data.website ?? '') }),
    });
  }

  async searchPeople(query: string): Promise<CrmePerson[]> {
    return this.peopleSearch(query, 10);
  }

  async searchCompanies(query: string): Promise<CrmeCompany[]> {
    return this.companySearch(query, 10);
  }

  private async peopleSearch(query: string, limit: number): Promise<CrmePerson[]> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return (await this.request<CrmePerson[] | null>(`/people?${params.toString()}`)) ?? [];
  }

  private async companySearch(query: string, limit: number): Promise<CrmeCompany[]> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return (await this.request<CrmeCompany[] | null>(`/companies?${params.toString()}`)) ?? [];
  }

  async linkPersonCompany(personId: string, companyId: string, role: string): Promise<void> {
    await this.request('/relationships/person-company', {
      method: 'POST',
      body: JSON.stringify({ person_id: personId, company_id: companyId, role }),
    });
  }

  private async ensurePersonCompanyLink(personId: string, data: LinkedInProfileData): Promise<void> {
    const experiences = profileCompanyExperiences(data);
    if (experiences.length === 0) {
      console.log('[CRME] No current companies found in LinkedIn data; skipping company links', data);
      return;
    }

    console.log('[CRME] Ensuring company links', { personId, experiences });
    for (const experience of experiences) {
      const companyName = cleanCompanyName(experience.name);
      if (!companyName) continue;

      const company = await this.findCompanyByName(companyName) ?? await this.createCompany({
        type: 'company',
        linkedinUrl: experience.linkedinUrl ?? '',
        name: companyName,
      });
      await this.linkPersonCompany(personId, company.id, experience.role ?? '');
    }
  }
}

function normalizeUrl(url: string) {
  return url.trim().replace(/\/$/, '').toLowerCase();
}

function domainFromUrl(url: string) {
  if (!url) return '';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  }
}

function profileCompanyExperiences(data: LinkedInProfileData): LinkedInCompanyExperience[] {
  const experiences: LinkedInCompanyExperience[] = [];

  for (const experience of data.companies ?? []) {
    const name = cleanCompanyName(experience.name);
    if (!name) continue;
    experiences.push({ ...experience, name, role: (experience.role ?? '').trim() });
  }

  const fallbackName = cleanCompanyName(data.currentCompany ?? '');
  if (fallbackName && data.currentCompanyLinkedInUrl) {
    experiences.push({
      name: fallbackName,
      linkedinUrl: data.currentCompanyLinkedInUrl,
      role: roleFromHeadline(data.headline ?? '', fallbackName),
      current: true,
    });
  }

  const out: LinkedInCompanyExperience[] = [];
  const seen = new Set<string>();
  for (const experience of experiences) {
    if (!experience.linkedinUrl) continue;
    const key = experience.name.toLowerCase();
    if (seen.has(key)) {
      const existing = out.find((item) => item.name.toLowerCase() === key);
      if (existing && !existing.role && experience.role) existing.role = experience.role;
      if (existing && !existing.linkedinUrl && experience.linkedinUrl) existing.linkedinUrl = experience.linkedinUrl;
      continue;
    }
    seen.add(key);
    out.push(experience);
  }
  return out;
}

function cleanCompanyName(name: string): string {
  const cleaned = name
    .replace(/\s+/g, ' ')
    .replace(/^(current company|aktuelles unternehmen|entreprise actuelle|empresa actual)\s*:?\s*/i, '')
    .replace(/\s*(company page|unternehmensseite|page entreprise).*$/i, '')
    .trim();

  if (/\b(skill|skills|full-time|part-time|self-employed|remote|hybrid|on-site)\b/i.test(cleaned)) return '';
  if (/\b(berlin|hamburg|munich|münchen|cologne|köln|frankfurt|london|paris|deutschland|germany|area|metropolitan)\b/i.test(cleaned)) return '';
  return cleaned;
}

function roleFromHeadline(headline: string, companyName: string): string {
  const cleanHeadline = headline.replace(/\s+/g, ' ').trim();
  if (!cleanHeadline) return '';

  const escapedCompany = companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`^(.+?)\\s+(?:at|@|for)\\s+${escapedCompany}(?:\\s*[|•-].*)?$`, 'i'),
    new RegExp(`^(.+?)\\s+(?:bei)\\s+${escapedCompany}(?:\\s*[|•-].*)?$`, 'i'),
    new RegExp(`^(.+?)\\s+(?:chez|à)\\s+${escapedCompany}(?:\\s*[|•-].*)?$`, 'i'),
    new RegExp(`^(.+?)\\s+(?:en)\\s+${escapedCompany}(?:\\s*[|•-].*)?$`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = cleanHeadline.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  const separators = [' at ', ' @ ', ' for ', ' bei ', ' chez ', ' à ', ' en '];
  for (const separator of separators) {
    const index = cleanHeadline.toLowerCase().indexOf(separator.trim().startsWith('@') ? ' @ ' : separator);
    if (index > 0) return cleanHeadline.slice(0, index).trim();
  }

  return cleanHeadline;
}
