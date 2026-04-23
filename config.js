// StudyHub Frontend Config (Go-Live)

window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {};

// ✅ Live Apps Script Web App
window.STUDYHUB_CONFIG.webappUrl =
  'https://script.google.com/macros/s/AKfycbzP1FMuDC92FKnQ0T-DJrMah3b7vsO1rADn4IYq5kjXzu79C4hdu1fyo1vGhxs9K5Vy/exec';

// ✅ GitHub Pages site base URL
window.STUDYHUB_CONFIG.siteBaseUrl =
  'https://examtestgenius-create.github.io/web';

// ✅ Live catalog endpoint
window.STUDYHUB_CONFIG.liveCatalogUrl =
  window.STUDYHUB_CONFIG.webappUrl + '?action=catalog';

// ✅ API base for checkout / order status / contact
window.STUDYHUB_CONFIG.apiBaseUrl =
  window.STUDYHUB_CONFIG.webappUrl;

// ✅ Fallback JSON if backend is temporarily unavailable
window.STUDYHUB_CONFIG.fallbackCatalogUrl =
  'data/catalog.sample.json';

// ✅ Avoid endless waiting if backend hangs
window.STUDYHUB_CONFIG.catalogTimeoutMs = 8000;

// ✅ Optional mode flag
window.STUDYHUB_CONFIG.contactMode = 'live';
