<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import type { ExtensionResponse } from '../../types';

const crmeUrl = ref('http://localhost:8080');
const apiToken = ref('');
const setupCode = ref('');
const appUrl = ref('');
const instance = ref('');
const showSetup = ref(false);
const isConnected = ref(false);
const isLoading = ref(true);
const isTesting = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);
const recentCaptures = ref<Array<{ linkedinUrl: string; name: string; type: 'person' | 'company'; capturedAt: number; crmeId: string }>>([]);

const isConfigured = computed(() => Boolean(crmeUrl.value && apiToken.value));
const instanceLabel = computed(() => instance.value || appUrl.value || crmeUrl.value.replace(/^https?:\/\//, '').replace(/\/api$/, ''));
const statusText = computed(() => !crmeUrl.value ? 'Not configured' : !apiToken.value ? 'No token' : isConnected.value ? 'Connected' : 'Disconnected');
const statusClass = computed(() => isConnected.value ? 'status--connected' : apiToken.value ? 'status--warning' : 'status--error');

onMounted(async () => {
  await loadSettings();
  await loadRecentCaptures();
});

async function loadSettings() {
  isLoading.value = true;
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' }) as ExtensionResponse<{ crmeUrl: string; apiToken: string; appUrl: string; instance: string }>;
    if (response.success && response.data) {
      crmeUrl.value = response.data.crmeUrl || 'http://localhost:8080';
      apiToken.value = response.data.apiToken || '';
      appUrl.value = response.data.appUrl || '';
      instance.value = response.data.instance || '';
      showSetup.value = !apiToken.value;
      if (apiToken.value) await testConnection(false, false);
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

function normalizedSettings() {
  let url = crmeUrl.value.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;
  url = url.replace(/\/$/, '');
  return { crmeUrl: url, apiToken: apiToken.value.trim(), appUrl: appUrl.value.trim(), instance: instance.value.trim() };
}

async function persistSettings() {
  const settings = normalizedSettings();
  crmeUrl.value = settings.crmeUrl;
  apiToken.value = settings.apiToken;
  appUrl.value = settings.appUrl;
  instance.value = settings.instance;
  const response = await browser.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: settings }) as ExtensionResponse;
  if (!response.success) throw new Error(response.error || 'Failed to save settings');
}

function clearInstanceMetadata() {
  appUrl.value = '';
  instance.value = '';
}

function parseSetupCode(value: string) {
  const parsed = JSON.parse(value.trim()) as { crmeUrl?: unknown; apiToken?: unknown; appUrl?: unknown; instance?: unknown; url?: unknown; token?: unknown };
  const url = typeof parsed.crmeUrl === 'string' ? parsed.crmeUrl : typeof parsed.url === 'string' ? parsed.url : '';
  const token = typeof parsed.apiToken === 'string' ? parsed.apiToken : typeof parsed.token === 'string' ? parsed.token : '';
  if (!url || !token) throw new Error('Setup code must include crmeUrl and apiToken');
  crmeUrl.value = url;
  apiToken.value = token;
  appUrl.value = typeof parsed.appUrl === 'string' ? parsed.appUrl : '';
  instance.value = typeof parsed.instance === 'string' ? parsed.instance : '';
}

async function applySetupCode() {
  error.value = null;
  success.value = null;
  try {
    parseSetupCode(setupCode.value);
    await testConnection(true, true);
    showSetup.value = false;
  } catch (err) {
    isConnected.value = false;
    error.value = err instanceof Error ? err.message : 'Could not apply setup code';
  }
}

async function testConnection(saveFirst = true, showSuccess = true) {
  isTesting.value = true;
  error.value = null;
  success.value = null;
  try {
    if (saveFirst) await persistSettings();
    const response = await browser.runtime.sendMessage({ type: 'TEST_CONNECTION' }) as ExtensionResponse<{ connected: boolean }>;
    isConnected.value = response.success && response.data?.connected === true;
    if (isConnected.value) {
      if (showSuccess) success.value = 'Connection works';
    } else {
      error.value = response.error || 'Connection test failed';
    }
  } catch (err) {
    isConnected.value = false;
    error.value = err instanceof Error ? err.message : 'Connection test failed';
  } finally {
    isTesting.value = false;
  }
}

function openCrme() {
  browser.tabs.create({ url: appUrl.value || crmeUrl.value || 'http://localhost:8080' });
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
        <img class="header__icon" src="/icon/32.png" alt="" />
        <span class="header__title">CRME</span>
      </div>
      <div :class="['status-badge', statusClass]"><span class="status-dot"></span>{{ statusText }}</div>
    </header>

    <div v-if="isLoading" class="loading"><div class="spinner"></div><span>Loading...</span></div>

    <main v-else class="content">
      <section v-if="isConnected && !showSetup" class="section">
        <h2 class="section__title">Connected instance</h2>
        <div class="instance-card">
          <img class="instance-card__icon" src="/icon/32.png" alt="" />
          <div class="instance-card__body">
            <div class="instance-card__name">{{ instanceLabel }}</div>
            <div class="instance-card__url">{{ crmeUrl }}</div>
          </div>
        </div>
        <div class="button-group">
          <button class="btn btn--primary" @click="openCrme">Open CRME</button>
          <button class="btn btn--secondary" :disabled="isTesting" @click="() => testConnection()">{{ isTesting ? 'Testing...' : 'Test connection' }}</button>
          <button class="btn btn--secondary" @click="showSetup = true">Change setup</button>
        </div>
        <div v-if="error" class="message message--error">{{ error }}</div>
        <div v-if="success" class="message message--success">{{ success }}</div>
      </section>

      <section v-else class="section">
        <h2 class="section__title">Extension setup</h2>
        <div class="form-group">
          <label class="label" for="setupCode">Setup code</label>
          <textarea id="setupCode" v-model="setupCode" class="textarea" placeholder='Paste the setup code from CRME settings' @keyup.meta.enter="applySetupCode" @keyup.ctrl.enter="applySetupCode"></textarea>
          <p class="hint">Copy one setup code from CRME settings. It contains the server URL and token.</p>
        </div>
        <div class="button-group">
          <button class="btn btn--primary" :disabled="isTesting || !setupCode.trim()" @click="applySetupCode">{{ isTesting ? 'Testing...' : 'Apply and test' }}</button>
          <button v-if="apiToken" class="btn btn--secondary" @click="showSetup = false">Cancel</button>
        </div>
        <details class="manual-settings">
          <summary>Manual setup</summary>
          <div class="manual-settings__body">
            <div class="form-group">
              <label class="label" for="crmeUrl">Server URL</label>
              <input id="crmeUrl" v-model="crmeUrl" type="url" class="input" placeholder="http://localhost:8080" @input="clearInstanceMetadata" @keyup.enter="() => testConnection()" />
              <p class="hint">Your CRME API, local or deployed.</p>
            </div>
            <div class="form-group">
              <label class="label" for="apiToken">Token</label>
              <input id="apiToken" v-model="apiToken" type="password" class="input" placeholder="Paste extension token" @input="clearInstanceMetadata" @keyup.enter="() => testConnection()" />
            </div>
            <div class="button-group">
              <button class="btn btn--secondary" :disabled="isTesting || !isConfigured" @click="() => testConnection()">{{ isTesting ? 'Testing...' : 'Test manual settings' }}</button>
            </div>
          </div>
        </details>
        <div v-if="error" class="message message--error">{{ error }}</div>
        <div v-if="success" class="message message--success">{{ success }}</div>
      </section>

      <section v-if="!apiToken" class="section section--warning">
        <p class="warning-text">Open CRME settings, set up the browser extension, then paste the setup code here.</p>
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
          <li>Create a browser extension token in CRME settings</li>
          <li>Paste the setup code here</li>
          <li>Open a LinkedIn profile or company page</li>
          <li>Use the CRME button in the lower left</li>
        </ol>
      </section>
    </main>
  </div>
</template>
