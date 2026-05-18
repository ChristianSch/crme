import { scrapeCurrentPage, getLinkedInPageType } from '../utils/linkedin-scraper';
import type { CaptureState, LinkedInData, ExtensionResponse, CrmePerson, CrmeCompany } from '../types';

// Content script CSS
const FLOATING_BUTTON_STYLES = `
  .crme-capture-container {
    position: fixed;
    bottom: 24px;
    left: 24px;
    z-index: 99999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  }
  
  .crme-btn-group {
    display: flex;
    align-items: stretch;
    border-radius: 24px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  .crme-btn-group .crme-capture-btn {
    border-radius: 24px;
  }
  
  .crme-btn-group.has-menu .crme-capture-btn {
    border-radius: 24px 0 0 24px;
  }
  
  .crme-capture-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border: none;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .crme-btn-group:hover {
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }
  
  .crme-capture-btn--loading,
  .crme-capture-btn--ready,
  .crme-capture-btn--idle {
    background: oklch(0.19 0.006 255);
    color: oklch(0.985 0.004 255);
  }
  
  .crme-capture-btn--exists,
  .crme-capture-btn--saved {
    background: oklch(0.42 0.1 155);
    color: oklch(0.985 0.004 155);
  }
  
  .crme-capture-btn--saving {
    background: oklch(0.55 0.11 78);
    color: oklch(0.985 0.004 78);
    pointer-events: none;
  }
  
  .crme-capture-btn--error {
    background: oklch(0.52 0.16 25);
    color: oklch(0.985 0.004 25);
  }
  
  .crme-menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 12px;
    border: none;
    border-left: 1px solid rgba(255,255,255,0.25);
    background: oklch(0.25 0.006 255);
    color: oklch(0.985 0.004 255);
    cursor: pointer;
    font-size: 12px;
    font-weight: bold;
    letter-spacing: 1px;
    transition: filter 0.2s;
    border-radius: 0 24px 24px 0;
  }
  
  .crme-menu-btn--exists {
    background: oklch(0.34 0.1 155);
  }
  
  .crme-menu-btn:hover {
    filter: brightness(0.9);
  }
  
  .crme-capture-icon {
    width: 18px;
    height: 18px;
  }
  
  .crme-capture-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: crme-spin 0.8s linear infinite;
  }
  
  @keyframes crme-spin {
    to { transform: rotate(360deg); }
  }
  
  .crme-capture-toast {
    position: fixed;
    bottom: 80px;
    left: 24px;
    background: #1f2937;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 100000;
    animation: crme-toast-in 0.3s ease;
  }
  
  @keyframes crme-toast-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  /* Menu Dropdown */
  .crme-menu-dropdown {
    position: absolute;
    bottom: 100%;
    left: 0;
    margin-bottom: 8px;
    background: white;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    min-width: 180px;
    overflow: hidden;
    animation: crme-panel-in 0.15s ease;
  }
  
  .crme-menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border: none;
    background: none;
    width: 100%;
    text-align: left;
    font-size: 13px;
    color: #374151;
    cursor: pointer;
    transition: background 0.15s;
  }
  
  .crme-menu-item:hover {
    background: #f3f4f6;
  }
  
  .crme-menu-item svg {
    width: 16px;
    height: 16px;
    color: #6b7280;
  }

  /* Search Panel */
  .crme-search-panel {
    position: fixed;
    bottom: 80px;
    left: 24px;
    width: 320px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    z-index: 100001;
    overflow: hidden;
    animation: crme-panel-in 0.2s ease;
  }
  
  @keyframes crme-panel-in {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  
  .crme-search-header {
    padding: 12px 16px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .crme-search-title {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
  }
  
  .crme-search-close {
    background: none;
    border: none;
    cursor: pointer;
    color: #9ca3af;
    padding: 4px;
    display: flex;
  }
  
  .crme-search-close:hover {
    color: #6b7280;
  }
  
  .crme-search-input-wrap {
    padding: 12px 16px;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .crme-search-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
  }
  
  .crme-search-input:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
  
  .crme-search-results {
    max-height: 240px;
    overflow-y: auto;
  }
  
  .crme-search-result {
    padding: 12px 16px;
    cursor: pointer;
    border-bottom: 1px solid #f3f4f6;
    transition: background 0.15s;
  }
  
  .crme-search-result:hover {
    background: #f9fafb;
  }
  
  .crme-search-result:last-child {
    border-bottom: none;
  }
  
  .crme-search-result-name {
    font-size: 14px;
    font-weight: 500;
    color: #1f2937;
  }
  
  .crme-search-result-sub {
    font-size: 12px;
    color: #6b7280;
    margin-top: 2px;
  }
  
  .crme-search-empty {
    padding: 24px 16px;
    text-align: center;
    color: #9ca3af;
    font-size: 13px;
  }
  
  .crme-search-loading {
    padding: 24px 16px;
    text-align: center;
    color: #6b7280;
    font-size: 13px;
  }
`;

// SVG Icons
const ICONS = {
  add: `<svg class="crme-capture-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>`,
  check: `<svg class="crme-capture-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
  link: `<svg class="crme-capture-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>`,
  error: `<svg class="crme-capture-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`,
  close: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  menu: `•••`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`,
};

type SearchResult = {
  id: string;
  name: string;
  subtitle?: string;
  type: 'person' | 'company';
};

export default defineContentScript({
  matches: ['*://*.linkedin.com/in/*', '*://*.linkedin.com/company/*'],
  runAt: 'document_idle',
  
  main(ctx) {
    console.log('CRME CRM content script loaded on:', window.location.href);
    
    // State
    let state: CaptureState = {
      status: 'idle',
      data: undefined,
      existingRecord: undefined,
      error: undefined,
    };
    let toastMessage: string | null = null;
    let toastTimeout: ReturnType<typeof setTimeout> | null = null;
    let showMenuDropdown = false;
    let showSearchPanel = false;
    let searchQuery = '';
    let searchResults: SearchResult[] = [];
    let isSearching = false;
    let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    
    // DOM elements
    let container: HTMLDivElement | null = null;
    let styleEl: HTMLStyleElement | null = null;
    
    // Initialize
    function init() {
      // Inject styles
      styleEl = document.createElement('style');
      styleEl.textContent = FLOATING_BUTTON_STYLES;
      document.head.appendChild(styleEl);
      
      // Create container for floating button
      container = document.createElement('div');
      container.id = 'crme-capture-root';
      document.body.appendChild(container);
      
      // Initial render
      render();
      
      // Check for existing record after a short delay
      setTimeout(checkExisting, 1500);
    }
    
    // Check for existing record
    async function checkExisting() {
      const pageType = getLinkedInPageType(window.location.href);
      console.log('Checking page type:', pageType, 'URL:', window.location.href);
      
      if (!pageType) {
        console.log('Not a profile or company page');
        return;
      }
      
      setState({ status: 'loading' });
      
      // Scrape page data first for better duplicate matching
      const scrapedData = scrapeCurrentPage();
      console.log('Scraped data for duplicate check:', scrapedData);
      
      try {
        const response = await browser.runtime.sendMessage({
          type: 'CHECK_DUPLICATE',
          payload: {
            linkedinUrl: window.location.href.split('?')[0],
            pageType,
            scrapedData,
          },
        }) as ExtensionResponse<{ exists: boolean; record?: { id: string; type: string }; matchedBy?: string }>;
        
        console.log('Check duplicate response:', response);
        
        if (!response.success) {
          if (response.error?.includes('not configured') || response.error?.includes('No authentication')) {
            setState({ status: 'idle', error: 'Configure CRME URL in extension popup' });
          } else {
            setState({ status: 'error', error: response.error });
          }
          return;
        }
        
        if (response.data?.exists && response.data.record) {
          console.log('Found existing record, matched by:', response.data.matchedBy);
          setState({
            status: 'exists',
            existingRecord: {
              id: response.data.record.id,
              type: response.data.record.type as 'person' | 'company',
            },
          });
        } else {
          console.log('No duplicate found, ready to add');
          setState({
            status: 'ready',
            data: scrapedData || undefined,
          });
        }
      } catch (error) {
        console.error('Error checking existing:', error);
        setState({ status: 'error', error: 'Failed to check CRM' });
      }
    }
    
    // Handle capture button click
    async function handleCapture() {
      if (state.status !== 'ready') return;
      console.log('[CRME] Capture requested');
      
      const data = await scrapeFreshPageData() || state.data;
      console.log('[CRME] Capture scraped data', data);
      if (!data) {
        showToast('Could not extract profile data');
        return;
      }
      
      setState({ status: 'saving', data });
      
      try {
        const response = await browser.runtime.sendMessage({
          type: 'CREATE_RECORD',
          payload: data,
        }) as ExtensionResponse<{ id: string }>;
        
        console.log('Create record response:', response);
        
        if (!response.success) {
          setState({ status: 'error', error: response.error, data });
          showToast(response.error || 'Failed to save');
          return;
        }
        
        setState({
          status: 'saved',
          existingRecord: {
            id: response.data!.id,
            type: data.type,
          },
          data,
        });
        showToast('Added to CRME CRM!');
        
        setTimeout(() => {
          if (state.status === 'saved') {
            setState({ ...state, status: 'exists' });
          }
        }, 2000);
      } catch (error) {
        console.error('Error creating record:', error);
        setState({ status: 'error', error: 'Failed to save', data });
      }
    }
    
    async function scrapeFreshPageData(): Promise<LinkedInData | null> {
      console.log('[CRME] Scraping LinkedIn page', window.location.href);
      let data = scrapeCurrentPage();
      console.log('[CRME] Initial scrape result', data);
      if (data?.type === 'person' && !data.currentCompany && (!data.companies || data.companies.length === 0)) {
        const experienceAnchor = document.querySelector('#experience');
        if (experienceAnchor) {
          console.log('[CRME] No company in initial scrape; scrolling to experience and retrying');
          experienceAnchor.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'center' });
          await new Promise((resolve) => setTimeout(resolve, 1200));
          data = scrapeCurrentPage();
          console.log('[CRME] Retry scrape result', data);
        }
      }
      return data;
    }
    
    // Open record in CRME
    async function openInCRME() {
      if (!state.existingRecord) return;
      
      try {
        const response = await browser.runtime.sendMessage({
          type: 'GET_SETTINGS',
        }) as ExtensionResponse<{ crmeUrl: string }>;
        
        if (response.success && response.data?.crmeUrl) {
          const { id, type } = state.existingRecord;
          const url = `${response.data.crmeUrl}/?${type}_id=${encodeURIComponent(id)}`;
          window.open(url, '_blank');
        }
      } catch (error) {
        console.error('Error opening in CRME:', error);
      }
    }
    
    // Search CRM for contacts
    async function searchCRM(query: string) {
      if (!query.trim()) {
        searchResults = [];
        render();
        return;
      }
      
      isSearching = true;
      render();
      
      try {
        const pageType = getLinkedInPageType(window.location.href);
        const response = await browser.runtime.sendMessage({
          type: 'SEARCH_RECORDS',
          payload: { query, type: pageType },
        }) as ExtensionResponse<SearchResult[]>;
        
        if (response.success && response.data) {
          searchResults = response.data;
        } else {
          searchResults = [];
        }
      } catch (error) {
        console.error('Error searching:', error);
        searchResults = [];
      }
      
      isSearching = false;
      render();
    }
    
    // Link to existing record and update it
    async function linkToRecord(record: SearchResult) {
      console.log('[CRME] Link to existing record requested', record);
      const data = await scrapeFreshPageData() || state.data;
      console.log('[CRME] Link/update scraped data', data);
      if (!data) {
        showToast('Could not extract profile data');
        return;
      }
      
      showSearchPanel = false;
      setState({ status: 'saving', data });
      
      try {
        const response = await browser.runtime.sendMessage({
          type: 'UPDATE_RECORD',
          payload: {
            id: record.id,
            type: record.type,
            data,
          },
        }) as ExtensionResponse<{ id: string }>;
        
        if (!response.success) {
          setState({ status: 'error', error: response.error, data });
          showToast(response.error || 'Failed to update');
          return;
        }
        
        setState({
          status: 'saved',
          existingRecord: {
            id: record.id,
            type: record.type,
          },
          data,
        });
        showToast(`Linked & updated ${record.name}!`);
        
        setTimeout(() => {
          if (state.status === 'saved') {
            setState({ ...state, status: 'exists' });
          }
        }, 2000);
      } catch (error) {
        console.error('Error updating record:', error);
        setState({ status: 'error', error: 'Failed to update', data });
      }
    }
    
    // Update state and re-render
    function setState(newState: Partial<CaptureState>) {
      state = { ...state, ...newState };
      render();
    }
    
    // Show toast notification
    function showToast(message: string) {
      toastMessage = message;
      render();
      
      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        toastMessage = null;
        render();
      }, 3000);
    }
    
    // Get button text based on state
    function getButtonText(): string {
      switch (state.status) {
        case 'loading': return 'Checking...';
        case 'ready': return 'Add to CRME';
        case 'exists': return 'Open in CRME';
        case 'saving': return 'Saving...';
        case 'saved': return 'Saved!';
        case 'error': return state.error || 'Error';
        case 'idle': 
        default: return 'CRME';
      }
    }
    
    // Get button icon
    function getButtonIcon(): string {
      switch (state.status) {
        case 'loading':
        case 'saving':
          return '<div class="crme-capture-spinner"></div>';
        case 'ready': return ICONS.add;
        case 'exists': return ICONS.link;
        case 'saved': return ICONS.check;
        case 'error': return ICONS.error;
        default: return ICONS.add;
      }
    }
    
    // Handle button click
    function handleClick() {
      console.log('Button clicked, current state:', state.status);
      if (state.status === 'ready') {
        handleCapture();
      } else if (state.status === 'exists' || state.status === 'saved') {
        openInCRME();
      } else if (state.status === 'error' || state.status === 'idle') {
        checkExisting();
      }
    }
    
    // Handle menu button click
    function handleMenuClick(e: Event) {
      e.stopPropagation();
      showMenuDropdown = !showMenuDropdown;
      showSearchPanel = false;
      render();
    }
    
    // Handle menu option selection
    function handleMenuOption(option: 'update' | 'link') {
      showMenuDropdown = false;
      
      if (option === 'update') {
        updateExistingRecord();
      } else if (option === 'link') {
        showSearchPanel = true;
        searchQuery = '';
        searchResults = [];
        render();
      }
    }
    
    // Update existing record with fresh LinkedIn data
    async function updateExistingRecord() {
      if (!state.existingRecord) return;
      console.log('[CRME] Update existing record requested', state.existingRecord);
      
      const data = await scrapeFreshPageData() || state.data;
      console.log('[CRME] Update scraped data', data);
      if (!data) {
        showToast('Could not extract profile data');
        return;
      }
      
      const previousStatus = state.status;
      setState({ status: 'saving', data });
      
      try {
        const response = await browser.runtime.sendMessage({
          type: 'UPDATE_RECORD',
          payload: {
            id: state.existingRecord.id,
            type: state.existingRecord.type,
            data,
          },
        }) as ExtensionResponse<{ id: string }>;
        
        if (!response.success) {
          setState({ status: previousStatus, error: response.error, data });
          showToast(response.error || 'Failed to update');
          return;
        }
        
        setState({
          status: 'saved',
          existingRecord: state.existingRecord,
          data,
        });
        showToast('Updated from LinkedIn!');
        
        setTimeout(() => {
          if (state.status === 'saved') {
            setState({ ...state, status: 'exists' });
          }
        }, 2000);
      } catch (error) {
        console.error('Error updating record:', error);
        setState({ status: previousStatus, error: 'Failed to update', data });
      }
    }
    
    // Handle search input
    function handleSearchInput(e: Event) {
      const input = e.target as HTMLInputElement;
      searchQuery = input.value;
      
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        searchCRM(searchQuery);
      }, 300);
    }
    
    // Render function
    function render() {
      if (!container) return;
      
      const wrapper = document.createElement('div');
      wrapper.className = 'crme-capture-container';
      
      // Button group - show menu for 'ready' (link to existing) and 'exists' (update from LinkedIn)
      const hasMenu = state.status === 'ready' || state.status === 'exists';
      const btnGroup = document.createElement('div');
      btnGroup.className = `crme-btn-group${hasMenu ? ' has-menu' : ''}`;
      
      // Main button
      const btn = document.createElement('button');
      btn.className = `crme-capture-btn crme-capture-btn--${state.status}`;
      btn.innerHTML = getButtonIcon();
      const btnLabel = document.createElement('span');
      btnLabel.textContent = getButtonText();
      btn.appendChild(btnLabel);
      btn.addEventListener('click', handleClick);
      btnGroup.appendChild(btn);
      
      // Menu button
      if (hasMenu) {
        const menuBtn = document.createElement('button');
        menuBtn.className = `crme-menu-btn crme-menu-btn--${state.status}`;
        menuBtn.textContent = ICONS.menu;
        menuBtn.title = 'More options';
        menuBtn.addEventListener('click', handleMenuClick);
        btnGroup.appendChild(menuBtn);
      }
      
      wrapper.appendChild(btnGroup);
      
      // Menu dropdown
      if (showMenuDropdown) {
        const dropdown = document.createElement('div');
        dropdown.className = 'crme-menu-dropdown';
        
        if (state.status === 'exists') {
          // Update option when record exists
          const updateItem = document.createElement('button');
          updateItem.className = 'crme-menu-item';
          updateItem.innerHTML = `${ICONS.refresh}<span>Update from LinkedIn</span>`;
          updateItem.addEventListener('click', () => handleMenuOption('update'));
          dropdown.appendChild(updateItem);
        }
        
        if (state.status === 'ready') {
          // Link to existing option when ready to add
          const linkItem = document.createElement('button');
          linkItem.className = 'crme-menu-item';
          linkItem.innerHTML = `${ICONS.search}<span>Link to existing contact</span>`;
          linkItem.addEventListener('click', () => handleMenuOption('link'));
          dropdown.appendChild(linkItem);
        }
        
        wrapper.appendChild(dropdown);
      }
      
      // Search panel
      if (showSearchPanel) {
        const panel = document.createElement('div');
        panel.className = 'crme-search-panel';
        
        // Header
        const header = document.createElement('div');
        header.className = 'crme-search-header';
        header.innerHTML = `
          <span class="crme-search-title">Link to existing contact</span>
        `;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'crme-search-close';
        closeBtn.innerHTML = ICONS.close;
        closeBtn.addEventListener('click', () => {
          showSearchPanel = false;
          render();
        });
        header.appendChild(closeBtn);
        panel.appendChild(header);
        
        // Search input
        const inputWrap = document.createElement('div');
        inputWrap.className = 'crme-search-input-wrap';
        const input = document.createElement('input');
        input.className = 'crme-search-input';
        input.type = 'text';
        input.placeholder = 'Search by name...';
        input.value = searchQuery;
        input.addEventListener('input', handleSearchInput);
        inputWrap.appendChild(input);
        panel.appendChild(inputWrap);
        
        // Results
        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'crme-search-results';
        
        if (isSearching) {
          resultsDiv.innerHTML = '<div class="crme-search-loading">Searching...</div>';
        } else if (searchQuery && searchResults.length === 0) {
          resultsDiv.innerHTML = '<div class="crme-search-empty">No contacts found</div>';
        } else if (searchResults.length > 0) {
          searchResults.forEach((result) => {
            const item = document.createElement('div');
            item.className = 'crme-search-result';
            const name = document.createElement('div');
            name.className = 'crme-search-result-name';
            name.textContent = result.name;
            item.appendChild(name);
            if (result.subtitle) {
              const subtitle = document.createElement('div');
              subtitle.className = 'crme-search-result-sub';
              subtitle.textContent = result.subtitle;
              item.appendChild(subtitle);
            }
            item.addEventListener('click', () => linkToRecord(result));
            resultsDiv.appendChild(item);
          });
        } else {
          resultsDiv.innerHTML = '<div class="crme-search-empty">Type to search...</div>';
        }
        
        panel.appendChild(resultsDiv);
        wrapper.appendChild(panel);
        
        // Focus input after render
        setTimeout(() => input.focus(), 50);
      }
      
      // Toast
      if (toastMessage) {
        const toastEl = document.createElement('div');
        toastEl.className = 'crme-capture-toast';
        toastEl.textContent = toastMessage;
        wrapper.appendChild(toastEl);
      }
      
      container.innerHTML = '';
      container.appendChild(wrapper);
    }
    
    // Watch for URL changes (LinkedIn SPA navigation)
    let lastUrl = window.location.href;
    const urlObserver = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('URL changed to:', lastUrl);
        const pageType = getLinkedInPageType(lastUrl);
        if (pageType) {
          state = { status: 'idle', data: undefined, existingRecord: undefined, error: undefined };
          showMenuDropdown = false;
          showSearchPanel = false;
          render();
          setTimeout(checkExisting, 1500);
        }
      }
    });
    
    // Close dropdown when clicking outside
    function handleDocumentClick(e: Event) {
      const target = e.target as HTMLElement;
      if (!target.closest('.crme-capture-container')) {
        if (showMenuDropdown) {
          showMenuDropdown = false;
          render();
        }
      }
    }
    
    // Initialize on load
    init();
    document.addEventListener('click', handleDocumentClick);
    
    // Start observing URL changes
    urlObserver.observe(document.body, { childList: true, subtree: true });
    
    // Cleanup on context invalidation
    ctx.onInvalidated(() => {
      console.log('Content script invalidated, cleaning up');
      urlObserver.disconnect();
      document.removeEventListener('click', handleDocumentClick);
      container?.remove();
      styleEl?.remove();
    });
  },
});
