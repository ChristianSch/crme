import { CrmeApiClient } from '../utils/crme-api';
import { getSettings, saveSettings, addToRecentCaptures, getRecentCaptures } from '../utils/storage';
import type { ExtensionMessage, ExtensionResponse, LinkedInProfileData, LinkedInCompanyData } from '../types';

async function getApiClient(): Promise<CrmeApiClient> {
  const settings = await getSettings();
  if (!settings.crmeUrl) throw new Error('CRME URL not configured');
  if (!settings.sessionId) throw new Error('CRME session id not configured');
  return new CrmeApiClient(settings);
}

async function checkDuplicate(
  linkedinUrl: string,
  pageType: 'person' | 'company',
  scrapedData?: LinkedInProfileData | LinkedInCompanyData,
): Promise<{ exists: boolean; record?: { id: string; type: 'person' | 'company' }; matchedBy?: string }> {
  const client = await getApiClient();
  if (pageType === 'person') {
    const personData = scrapedData as LinkedInProfileData | undefined;
    const byLinkedIn = await client.findPersonByLinkedInUrl(linkedinUrl);
    if (byLinkedIn) return { exists: true, record: { id: byLinkedIn.id, type: 'person' }, matchedBy: 'linkedin' };
    if (personData?.firstName || personData?.lastName) {
      const byName = await client.findPersonByName(personData.firstName, personData.lastName);
      if (byName) return { exists: true, record: { id: byName.id, type: 'person' }, matchedBy: 'name' };
    }
  } else {
    const companyData = scrapedData as LinkedInCompanyData | undefined;
    if (companyData?.name) {
      const byName = await client.findCompanyByName(companyData.name);
      if (byName) return { exists: true, record: { id: byName.id, type: 'company' }, matchedBy: 'name' };
    }
  }
  return { exists: false };
}

async function createRecord(data: LinkedInProfileData | LinkedInCompanyData): Promise<{ id: string }> {
  console.log('[CRME] Background create record', data);
  const client = await getApiClient();
  if (data.type === 'person') {
    const person = await client.createPerson(data);
    await addToRecentCaptures({ linkedinUrl: data.linkedinUrl, name: `${data.firstName} ${data.lastName}`.trim(), type: 'person', crmeId: person.id });
    return { id: person.id };
  }
  const company = await client.createCompany(data);
  await addToRecentCaptures({ linkedinUrl: data.linkedinUrl, name: data.name, type: 'company', crmeId: company.id });
  return { id: company.id };
}

async function updateRecord(id: string, data: LinkedInProfileData | LinkedInCompanyData): Promise<{ id: string }> {
  console.log('[CRME] Background update record', { id, data });
  const client = await getApiClient();
  if (data.type === 'person') {
    await client.updatePerson(id, data);
  } else {
    await client.updateCompany(id, data);
  }
  return { id };
}

async function handleMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  try {
    switch (message.type) {
      case 'CHECK_DUPLICATE': {
        const { linkedinUrl, pageType, scrapedData } = message.payload as {
          linkedinUrl: string;
          pageType: 'person' | 'company';
          scrapedData?: LinkedInProfileData | LinkedInCompanyData;
        };
        return { success: true, data: await checkDuplicate(linkedinUrl, pageType, scrapedData) };
      }
      case 'CREATE_RECORD': {
        return { success: true, data: await createRecord(message.payload as LinkedInProfileData | LinkedInCompanyData) };
      }
      case 'UPDATE_RECORD': {
        const { id, data } = message.payload as { id: string; data: LinkedInProfileData | LinkedInCompanyData };
        return { success: true, data: await updateRecord(id, data) };
      }
      case 'SEARCH_RECORDS': {
        const { query, type } = message.payload as { query: string; type: 'person' | 'company' };
        const client = await getApiClient();
        if (type === 'person') {
          const people = await client.searchPeople(query);
          return { success: true, data: people.map((person) => ({ id: person.id, type: 'person', name: `${person.first_name} ${person.last_name}`.trim() || person.email || 'Unnamed person', subtitle: person.email || person.title || '' })) };
        }
        const companies = await client.searchCompanies(query);
        return { success: true, data: companies.map((company) => ({ id: company.id, type: 'company', name: company.name || 'Unnamed company', subtitle: company.domain || '' })) };
      }
      case 'GET_SETTINGS': {
        const settings = await getSettings();
        return { success: true, data: { ...settings, hasSession: Boolean(settings.sessionId) } };
      }
      case 'SAVE_SETTINGS': {
        await saveSettings(message.payload as { crmeUrl?: string; sessionId?: string });
        return { success: true };
      }
      case 'TEST_CONNECTION': {
        const client = await getApiClient();
        return { success: true, data: { connected: await client.testConnection() } };
      }
      case 'GET_RECENT_CAPTURES': {
        return { success: true, data: await getRecentCaptures() };
      }
      default:
        return { success: false, error: `Unknown message type: ${message.type}` };
    }
  } catch (error) {
    console.error('[CRME] Background error', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true;
  });

  console.log('CRME LinkedIn extension background loaded');
});
