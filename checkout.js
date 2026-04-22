// ------------------------------
// StudyHub – Checkout Page
// ------------------------------

window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {};

if (!window.STUDYHUB_CONFIG.liveCatalogUrl) {
  window.STUDYHUB_CONFIG.webappUrl =
    'https://script.google.com/macros/s/AKfycbzP1FMuDC92FKnQ0T-DJrMah3b7vsO1rADn4IYq5kjXzu79C4hdu1fyo1vGhxs9K5Vy/exec';

  window.STUDYHUB_CONFIG.liveCatalogUrl =
    window.STUDYHUB_CONFIG.webappUrl + '?action=catalog';

  window.STUDYHUB_CONFIG.fallbackCatalogUrl =
    'data/catalog.sample.json';
}

async function fetchStudyHubCatalog() {
  const res = await fetch(window.STUDYHUB_CONFIG.liveCatalogUrl, {
    cache: 'no-store'
  });
  if (!res.ok) throw new Error('Catalog unavailable');
  return res.json();
}

// ✅ Papers, not files
function paperCount(item) {
  const files = Number(item.file_count || 0);
  return Math.floor(files / 2);
}

function moneyZar(item) {
  const cents = Number(item.price_cents || 0);
  if (!cents) return 'Price not set';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR'
  }).format(cents / 100);
}

// ------------------------------
// DOM Elements
// ------------------------------

const sku = new URL(window.location.href).searchParams.get('sku') || '';

const titleEl = document.getElementById('checkoutTitle');
const introEl = document.getElementById('checkoutIntro');
const skuField = document.getElementById('skuField');
const priceEl = document.getElementById('checkoutPrice');

const fromYearMeta = document.getElementById('fromYearMeta');
const toYearMeta = document.getElementById('toYearMeta');
const filesMeta = document.getElementById('filesMeta');

async function loadCheckout() {
  if (!sku) {
    titleEl.textContent = 'Missing package';
    return;
  }

  skuField.value = sku;

  try {
    const payload = await fetchStudyHubCatalog();
    const items = payload.items || [];

    const item = items.find(v => v.sku === sku);
    if (!item) {
      titleEl.textContent = 'Package not found';
      introEl.textContent = `No package with SKU ${sku} was found.`;
      return;
    }

    titleEl.textContent = item.title || sku;
    introEl.textContent = 'Review your order before proceeding.';
    priceEl.textContent = moneyZar(item);

    // ✅ Correct, honest summary
    fromYearMeta.textContent = item.year_or_range || '-';
    toYearMeta.textContent = item.year_or_range || '-';
    filesMeta.textContent = `${paperCount(item)} paper(s)`;

  } catch (err) {
    titleEl.textContent = 'Catalog unavailable';
    console.error(err);
  }
}

loadCheckout();
