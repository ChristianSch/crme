import { storage } from '#imports';
import type { ExtensionSettings } from '../types';

export const crmeUrlStorage = storage.defineItem<string>('sync:crmeUrl', {
  fallback: 'http://localhost:8080',
});

export const apiTokenStorage = storage.defineItem<string>('local:apiToken', {
  fallback: '',
});

export const appUrlStorage = storage.defineItem<string>('sync:appUrl', {
  fallback: '',
});

export const instanceStorage = storage.defineItem<string>('sync:instance', {
  fallback: '',
});

export const lastCapturedStorage = storage.defineItem<Array<{
  linkedinUrl: string;
  name: string;
  type: 'person' | 'company';
  capturedAt: number;
  crmeId: string;
}>>('local:lastCaptured', {
  fallback: [],
});

export async function getSettings(): Promise<ExtensionSettings> {
  const [crmeUrl, apiToken, appUrl, instance] = await Promise.all([
    crmeUrlStorage.getValue(),
    apiTokenStorage.getValue(),
    appUrlStorage.getValue(),
    instanceStorage.getValue(),
  ]);
  return { crmeUrl, apiToken, appUrl, instance };
}

export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
  if (settings.crmeUrl !== undefined) await crmeUrlStorage.setValue(settings.crmeUrl);
  if (settings.apiToken !== undefined) await apiTokenStorage.setValue(settings.apiToken);
  if (settings.appUrl !== undefined) await appUrlStorage.setValue(settings.appUrl);
  if (settings.instance !== undefined) await instanceStorage.setValue(settings.instance);
}

export async function addToRecentCaptures(capture: {
  linkedinUrl: string;
  name: string;
  type: 'person' | 'company';
  crmeId: string;
}): Promise<void> {
  const current = await lastCapturedStorage.getValue();
  const newCapture = { ...capture, capturedAt: Date.now() };
  const filtered = current.filter((c) => c.linkedinUrl !== capture.linkedinUrl);
  await lastCapturedStorage.setValue([newCapture, ...filtered].slice(0, 10));
}

export async function getRecentCaptures() {
  return lastCapturedStorage.getValue();
}
