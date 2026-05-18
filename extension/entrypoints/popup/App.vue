<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import type { ExtensionResponse } from '../../types';

const crmeUrl = ref('http://localhost:8080');
const sessionId = ref('');
const isConnected = ref(false);
const isLoading = ref(true);
const isSaving = ref(false);
const isTesting = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);
const recentCaptures = ref<Array<{ linkedinUrl: string; name: string; type: 'person' | 'company'; capturedAt: number; crmeId: string }>>([]);

const isConfigured = computed(() => Boolean(crmeUrl.value && sessionId.value));
const statusText = computed(() => !crmeUrl.value ? 'Not configured' : !sessionId.value ? 'No session' : isConnected.value ? 'Connected' : 'Disconnected');
const statusClass = computed(() => isConnected.value ? 'status--connected' : sessionId.value ? 'status--warning' : 'status--error');

onMounted(async () => {
  await loadSettings();
  await loadRecentCaptures();
});

async function loadSettings() {
  isLoading.value = true;
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' }) as ExtensionResponse<{ crmeUrl: string; sessionId: string }>;
    if (response.success && response.data) {
      crmeUrl.value = response.data.crmeUrl || 'http://localhost:8080';
      sessionId.value = response.data.sessionId || '';
      if (sessionId.value) await testConnection();
    }
  } catch {
    error.value = 'Failed to load settings';
  } finally {
    isLoading.value = false;
  }
}

async function loadRecentCaptures() {
  const response = await browser.runtime.sendMessage({ type: 'GET_RECENT_CAPTURES' }) as ExtensionResponse<typeof recentCaptures.value>;
  if (response.success && response.data) recentCaptures.value = response.data;
}

async function saveSettings() {
  let url = crmeUrl.value.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;
  url = url.replace(/\/$/, '');
  crmeUrl.value = url;
  isSaving.value = true;
  error.value = null;
  success.value = null;
  try {
    const response = await browser.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: { crmeUrl: url, sessionId: sessionId.value.trim() } }) as ExtensionResponse;
    if (!response.success) throw new Error(response.error || 'Failed to save settings');
    success.value = 'Settings saved';
    await testConnection();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save settings';
  } finally {
    isSaving.value = false;
    setTimeout(() => { success.value = null; }, 3000);
  }
}

async function testConnection() {
  isTesting.value = true;
  error.value = null;
  try {
    const response = await browser.runtime.sendMessage({ type: 'TEST_CONNECTION' }) as ExtensionResponse<{ connected: boolean }>;
    isConnected.value = response.success && response.data?.connected === true;
    if (!isConnected.value) error.value = response.error || 'Connection test failed';
  } catch {
    isConnected.value = false;
    error.value = 'Connection test failed';
  } finally {
    isTesting.value = false;
  }
}

function openCrme() {
  browser.tabs.create({ url: crmeUrl.value || 'http://localhost:8080' });
}

function formatDate(timestamp: number) {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}
</script>

<template>
  <div class="popup">
    <header class="header">
      <div class="header__logo">
        <svg width="24" height="24" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="8" fill="#111827"/><path d="M12 14h16v3H12zM12 20h12v3H12zM12 26h8v3H12z" fill="white"/></svg>
        <span class="header__title">CRME</span>
      </div>
      <div :class="['status-badge', statusClass]"><span class="status-dot"></span>{{ statusText }}</div>
    </header>

    <div v-if="isLoading" class="loading"><div class="spinner"></div><span>Loading...</span></div>

    <main v-else class="content">
      <section class="section">
        <h2 class="section__title">Settings</h2>
        <div class="form-group">
          <label class="label" for="crmeUrl">CRME API URL</label>
          <input id="crmeUrl" v-model="crmeUrl" type="url" class="input" placeholder="http://localhost:8080" @keyup.enter="saveSettings" />
          <p class="hint">Your CRME API, local or deployed.</p>
        </div>
        <div class="form-group">
          <label class="label" for="sessionId">Session ID</label>
          <input id="sessionId" v-model="sessionId" type="password" class="input" placeholder="crm session id" @keyup.enter="saveSettings" />
          <p class="hint">Use the session_id from your CRME magic-link login.</p>
        </div>
        <div class="button-group">
          <button class="btn btn--primary" :disabled="isSaving" @click="saveSettings">{{ isSaving ? 'Saving...' : 'Save' }}</button>
          <button class="btn btn--secondary" :disabled="isTesting || !isConfigured" @click="testConnection">{{ isTesting ? 'Testing...' : 'Test' }}</button>
        </div>
        <div v-if="error" class="message message--error">{{ error }}</div>
        <div v-if="success" class="message message--success">{{ success }}</div>
      </section>

      <section v-if="!sessionId" class="section section--warning">
        <p class="warning-text">Sign in to CRME and paste your session id here.</p>
        <button class="btn btn--primary" @click="openCrme">Open CRME</button>
      </section>

      <section v-if="recentCaptures.length" class="section">
        <h2 class="section__title">Recent captures</h2>
        <ul class="captures-list">
          <li v-for="capture in recentCaptures" :key="capture.crmeId" class="capture-item">
            <div class="capture-item__info">
              <span class="capture-item__name">{{ capture.name }}</span>
              <span class="capture-item__time">{{ formatDate(capture.capturedAt) }}</span>
            </div>
          </li>
        </ul>
      </section>

      <section class="section section--muted">
        <h2 class="section__title">How to use</h2>
        <ol class="instructions">
          <li>Set CRME URL and session id</li>
          <li>Open a LinkedIn profile or company page</li>
          <li>Use the CRME button in the lower left</li>
        </ol>
      </section>
    </main>
  </div>
</template>
