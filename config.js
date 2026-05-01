// config.js — SINGLE SOURCE OF TRUTH (DO NOT MERGE)

window.STUDYHUB_CONFIG = {
  // ✅ ONLY valid Apps Script Web App endpoint
  webappUrl: "https://script.google.com/macros/s/AKfycbzP1FMuDC92FKnQ0T-DJrMah3b7vsO1rADn4IYq5kjXzu79C4hdu1fyo1vGhxs9K5Vy/exec",

  // ✅ Live site
  siteBaseUrl: "https://examtestpaper.co.za",

  // ✅ Catalog URL (derived once, not recomputed elsewhere)
  liveCatalogUrl:
    "https://script.google.com/macros/s/AKfycbzP1FMuDC92FKnQ0T-DJrMah3b7vsO1rADn4IYq5kjXzu79C4hdu1fyo1vGhxs9K5Vy/exec?action=catalog",

  // ✅ Fallback only
  fallbackCatalogUrl: "data/catalog.sample.json",

  // ✅ Build stamp to FORCE cache bust
  build: "2026-05-01-2"
};
