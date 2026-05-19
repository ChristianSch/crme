# CRME LinkedIn Capture Extension

Browser extension based on [`JhumanJ/twenty-crm-extension`](https://github.com/JhumanJ/twenty-crm-extension), adapted for CRME's REST API. See [`../THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).

## What it does

- Adds a floating CRME button on LinkedIn profile/company pages.
- Scrapes profile/company data from the current LinkedIn page.
- Checks CRME for existing people by LinkedIn URL or name.
- Checks CRME for existing companies by name.
- Creates people/companies in CRME.
- Updates/link existing records from the page menu.
- Stores recent captures locally in extension storage.

## Setup

```bash
cd extension
npm install
npm run build
```

Then load the unpacked extension from:

```txt
extension/dist/chrome-mv3
```

Or use the generated zip:

```txt
extension/dist/crme-linkedin-extension-chrome.zip
```

In CRME settings, use **Set up extension** to create a browser extension token. Copy the setup code and paste it into the extension popup. Manual server URL and token fields are available in the popup if needed.

## CRME requirements

The API server must be running and the token must be valid. The extension sends it as `Authorization: Bearer <token>`.

For mutating requests, the API must allow the extension origin. The bundled Chrome extension has a stable origin:

```txt
chrome-extension://kkfpdeggkbniiaajibbejcfcicbbilmn
```

This is included in the server default `CRME_ALLOWED_ORIGINS`; if you override that env var, include this origin.

## Notes

CRME currently has `linkedin_url` on people, but not companies. Company duplicate checks use name/domain until company LinkedIn support is added.
