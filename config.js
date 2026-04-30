window.STUDYHUB_CONFIG = {
  // GitHub Pages base URL, e.g. https://USERNAME.github.io/REPO
  siteBaseUrl: '',
  // Apps Script Web App URL ending with /exec
  webappUrl: '',
  // Fallback catalog file for offline/static testing
  fallbackCatalogUrl: 'data/catalog.sample.json',
  // Contact mode: 'api' or 'mailto'
  contactMode: 'api',
  supportEmail: 'support@example.com',
  // Derived URLs (leave as-is)
  get liveCatalogUrl() {
    return this.webappUrl ? this.webappUrl + '?action=catalog' : '';
  },
  get apiBaseUrl() {
    return this.webappUrl || '';
  }
};
