import { storage } from '#imports';
import type { ExtensionSettings } from '../types';

export const crmeUrlStorage = storage.defineItem<string>('sync:crmeUrl', {
  fallback: 'http://localhost:8080',
});

export const sessionIdStorage = storage.defineItem<string>('local:sessionId', {
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
  const [crmeUrl, sessionId] = await Promise.all([
    crmeUrlStorage.getValue(),
    sessionIdStorage.getValue(),
  ]);
  return { crmeUrl, sessionId };
}

export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
  if (settings.crmeUrl !== undefined) await crmeUrlStorage.setValue(settings.crmeUrl);
  if (settings.sessionId !== undefined) await sessionIdStorage.setValue(settings.sessionId);
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
