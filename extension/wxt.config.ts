import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'CRME LinkedIn Capture',
    short_name: 'CRME Capture',
    description: 'Capture LinkedIn profiles and companies to CRME',
    version: '0.1.0',
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtb8P0J7go2K8N+S0xHveVLqecm4ZPUkA+YOGvWejzN8b7ubzYvZ+GcjvYcE5vPgsm9A0b5aL3xvBc1U3vp8Vt+gxE83x/Fioz0JpMlLMlvdyg0wNuvcQXMD93aIypUjoFgghMtHTknodgwzqXdcmTYKk2NDEK3pX5HoVm84krs44W7o4KIo4FLtePe+BCFTJMXxv6YUPJQ6SxkT/ggIqHHkOJuwSwmUkqjy45CZDSITaHj4hcyQtn8W3xAjRJWjtt2qHn7h3zov6swcHyAOEpwT3J05/Juv+nmH6mQLMLUpWULAKgOXyZgAKkKPvCjslFuK3xZA/jxjERQIDAQAB',
    permissions: ['storage', 'activeTab'],
    host_permissions: ['*://*.linkedin.com/*', 'http://localhost:8080/*', 'https://*/*'],
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  },
});
