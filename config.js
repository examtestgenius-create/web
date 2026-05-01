// config.js — SINGLE SOURCE OF TRUTH (DO NOT MERGE)

window.STUDYHUB_CONFIG = {
  // ✅ ONLY valid Apps Script Web App endpoint
  webappUrl: "https://script.google.com/macros/s/AKfycbyrGxdt2HhRklPLlpYq_1P-dGh1NfkXAXw-ZJkHmWZ5SJy5vCOHuSakr4LBXwqgz0gV8Q/exec",

  // ✅ Live site
  siteBaseUrl: "https://examtestpaper.co.za",

  // ✅ Catalog URL (derived once, not recomputed elsewhere)
  liveCatalogUrl:
    "https://script.google.com/macros/s/AKfycbyrGxdt2HhRklPLlpYq_1P-dGh1NfkXAXw-ZJkHmWZ5SJy5vCOHuSakr4LBXwqgz0gV8Q/exec?action=catalog",

  // ✅ Fallback only
  fallbackCatalogUrl: "data/catalog.sample.json",

  // ✅ Build stamp to FORCE cache bust
  build: "2026-05-01-2"
};
