window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {};
window.STUDYHUB_CONFIG.webappUrl = 'https://script.google.com/macros/s/AKfycbzP1FMuDC92FKnQ0T-DJrMah3b7vsO1rADn4IYq5kjXzu79C4hdu1fyo1vGhxs9K5Vy/exec';
window.STUDYHUB_CONFIG.siteBaseUrl = 'https://examtestgenius-create.github.io/web';
window.STUDYHUB_CONFIG.liveCatalogUrl = window.STUDYHUB_CONFIG.webappUrl
  ? (window.STUDYHUB_CONFIG.webappUrl + '?action=catalog')
  : '';
window.STUDYHUB_CONFIG.apiBaseUrl = window.STUDYHUB_CONFIG.webappUrl || '';
window.STUDYHUB_CONFIG.fallbackCatalogUrl = 'data/catalog.sample.json';
window.STUDYHUB_CONFIG.contactMode = 'live';
window.STUDYHUB_CONFIG.catalogTimeoutMs = 8000;
