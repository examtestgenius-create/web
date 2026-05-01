// StudyHub Frontend Config (Go-Live)
// Paste your deployed Apps Script Web App URL (ends with /exec)
window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {};
window.STUDYHUB_CONFIG.webappUrl = 'https://script.google.com/macros/s/AKfycbzP1FMuDC92FKnQ0T-DJrMah3b7vsO1rADn4IYq5kjXzu79C4hdu1fyo1vGhxs9K5Vy/exec';
window.STUDYHUB_CONFIG.siteBaseUrl = '__PASTE_GITHUB_PAGES_BASE_URL__';
window.STUDYHUB_CONFIG.liveCatalogUrl = window.STUDYHUB_CONFIG.webappUrl ? (window.STUDYHUB_CONFIG.webappUrl + '?action=catalog') : '';
window.STUDYHUB_CONFIG.apiBaseUrl = window.STUDYHUB_CONFIG.webappUrl || '';
window.STUDYHUB_CONFIG.fallbackCatalogUrl = 'data/catalog.sample.json';
