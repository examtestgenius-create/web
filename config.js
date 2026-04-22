// StudyHub Frontend Config (Go-Live)
// Paste your deployed Apps Script Web App URL (ends with /exec)

window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {};

// ✅ Apps Script backend
window.STUDYHUB_CONFIG.webappUrl =
  'https://script.google.com/macros/s/AKfycbzP1FMuDC92FKnQ0T-DJrMah3b7vsO1rADn4IYq5kjXzu79C4hdu1fyo1vGhxs9K5Vy/exec';

// ✅ GitHub Pages site
window.STUDYHUB_CONFIG.siteBaseUrl =
  'https://examtestgenius-create.github.io/web';

// ✅ Derived URLs (do not edit)
window.STUDYHUB_CONFIG.liveCatalogUrl =
  window.STUDYHUB_CONFIG.webappUrl + '?action=catalog';

window.STUDYHUB_CONFIG.apiBaseUrl =
  window.STUDYHUB_CONFIG.webappUrl;

// ✅ Optional fallback
window.STUDYHUB_CONFIG.fallbackCatalogUrl =
  'data/catalog.sample.json';
