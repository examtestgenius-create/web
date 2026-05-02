// StudyHub Frontend Config (Go-Live)
// webappUrl: Apps Script Web App URL (/exec)
// siteBaseUrl: your GitHub Pages base URL (no trailing slash)
window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {};
window.STUDYHUB_CONFIG.webappUrl = 'https://script.google.com/macros/s/AKfycbyrGxdt2HhRklPLlpYq_1P-dGh1NfkXAXw-ZJkHmWZ5SJy5vCOHuSakr4LBXwqgz0gV8Q/exec';
window.STUDYHUB_CONFIG.siteBaseUrl = '__PASTE_GITHUB_PAGES_BASE_URL__';
window.STUDYHUB_CONFIG.liveCatalogUrl = window.STUDYHUB_CONFIG.webappUrl ? (window.STUDYHUB_CONFIG.webappUrl + '?action=catalog') : '';
window.STUDYHUB_CONFIG.apiBaseUrl = window.STUDYHUB_CONFIG.webappUrl || '';
window.STUDYHUB_CONFIG.fallbackCatalogUrl = 'data/catalog.sample.json';
