export type LinkedInCompanyExperience = {
  name: string;
  linkedinUrl?: string;
  role?: string;
  current?: boolean;
};

export type LinkedInProfileData = {
  type: 'person';
  linkedinUrl: string;
  firstName: string;
  lastName: string;
  headline?: string;
  currentCompany?: string;
  currentCompanyLinkedInUrl?: string;
  companies?: LinkedInCompanyExperience[];
  profileImageUrl?: string;
  location?: string;
};

export type LinkedInCompanyData = {
  type: 'company';
  linkedinUrl: string;
  name: string;
  website?: string;
  industry?: string;
  employeeCount?: string;
  logoUrl?: string;
  description?: string;
};

export type LinkedInData = LinkedInProfileData | LinkedInCompanyData;

export type CrmePerson = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  title: string;
  linkedin_url: string;
  city: string;
};

export type CrmeCompany = {
  id: string;
  name: string;
  domain: string;
};

export type CaptureStatus = 'idle' | 'loading' | 'exists' | 'ready' | 'saving' | 'saved' | 'error';

export type CaptureState = {
  status: CaptureStatus;
  existingRecord?: { id: string; type: 'person' | 'company' };
  error?: string;
  data?: LinkedInData;
};

export type MessageType =
  | 'CHECK_DUPLICATE'
  | 'CREATE_RECORD'
  | 'UPDATE_RECORD'
  | 'SEARCH_RECORDS'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'TEST_CONNECTION'
  | 'GET_RECENT_CAPTURES'
  | 'SCRAPE_PAGE';

export type ExtensionMessage = {
  type: MessageType;
  payload?: unknown;
};

export type ExtensionResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type ExtensionSettings = {
  crmeUrl: string;
  apiToken: string;
  appUrl: string;
  instance: string;
};
