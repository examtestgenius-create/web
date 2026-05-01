/* ===============================
   StudyHub Catalog App (CLEAN)
   =============================== */

window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {
  liveCatalogUrl: '',
  fallbackCatalogUrl: 'data/catalog.sample.json',
  apiBaseUrl: ''
};

/* ---------- helpers ---------- */

function getField(item, ...keys) {
  for (const k of keys) {
    const v = item && item[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

function getNumber(item, ...keys) {
  const n = Number(getField(item, ...keys));
  return Number.isFinite(n) ? n : 0;
}

function moneyZar(item) {
  const cents = getNumber(item, 'price_cents', 'Price_Cents', 'price');
  if (!cents) return 'Price not set';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR'
  }).format(cents / 100);
}

function normalizeType(item) {
  return getField(item, 'bundle_type', 'Bundle_Type', 'type') || 'Package';
}

function formatIncludedLabel(item) {
  const total = getNumber(item, 'file_count', 'Included_File_Count');
  if (!total) return 'Includes: —';
  if (total % 2 === 0) {
    return `Includes: ${total / 2} Papers + ${total / 2} Memos (${total} PDFs)`;
  }
  return `Includes: ${total} PDFs`;
}

/* ---------- fetch ---------- */

async function fetchStudyHubCatalog() {
  const tryUrls = [];
  if (window.STUDYHUB_CONFIG.liveCatalogUrl) {
    tryUrls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
  }
  tryUrls.push(window.STUDYHUB_CONFIG.fallbackCatalogUrl);

  const errors = [];

  for (const url of tryUrls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      return { payload, source: url };
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }

  throw new Error(errors.join('\n'));
}

/* ---------- DOM ---------- */

const metaEl = document.getElementById('catalogMeta');
const cardsRoot = document.getElementById('packageCards');
const featuredRoot = document.getElementById('featuredCards');

const filterType = document.getElementById('filterType');
const filterProvince = document.getElementById('filterProvince');
const filterSubject = document.getElementById('filterSubject');
const sortBy = document.getElementById('sortBy');
const searchInput = document.getElementById('searchInput');
const clearFilters = document.getElementById('clearFilters');

let catalogItems = [];

/* ---------- scoring ---------- */

function featuredScore(item) {
  const files = getNumber(item, 'file_count');
  const type = normalizeType(item);
  let score = files;

  if (type === 'Ultimate Bundle') score += 1000;
  if (type === 'Master Bundle') score += 500;
  if (type === 'Single Year') score += 250;
  if (type === 'Single Subject') score += 150;

  return score;
}

/* ---------- cards ---------- */

function formatCard(item, featured = false) {
  const sku = getField(item, 'sku', 'SKU');
  const type = normalizeType(item);
  const title = getField(item, 'title') || sku || type;
  const subject = getField(item, 'subject_or_all', 'subject_name') || 'ALL';
  const province = getField(item, 'province_filter') || 'ALL';
  const yearRange = getField(item, 'year_or_range') || '';
  const notes = getField(item, 'description') || 'StudyHub content bundle.';
  const tag = featured ? 'Featured bundle' : type;

  return `
    <article class="card-surface">
      <span class="card-tag">${tag}</span>
      <h3>${title}</h3>

      <div class="badge-row">
        <span class="badge">${subject}</span>
        <span class="badge">${province}</span>
      </div>

      <p>${notes}</p>

      <ul>
        <li>Years: ${yearRange || '—'}</li>
        <li>${formatIncludedLabel(item)}</li>
      </ul>

      <div class="price-chip">${moneyZar(item)}</div>

      <div class="card-actions">
        <a class="btn btn-secondary" href="package.html?sku=${encodeURIComponent(sku)}">
          View details
        </a>
        <button
          class="btn btn-primary"
          onclick="location.href='checkout.html?sku=${encodeURIComponent(sku)}function populateFilters(items) {
  if (!filterType || !filterProvince || !filterSubject) return;

  const unique = arr => [...new Set(arr.filter(Boolean))].sort();

  const types = unique(items.map(normalizeType));
  const provinces = unique(items.map(i => getField(i, 'province_filter') || 'ALL'));
  const subjects = unique(items.map(i => getField(i, 'subject_or_all') || 'ALL'));

  filterType.innerHTML =
    '<option value="ALL">All types</option>' +
    types.map(t => `<option value="${t}">${t}</option>`).join('');

  filterProvince.innerHTML =
    '<option value="ALL">All provinces</option>' +
    provinces.map(p => `<option value="${p}">${p}</option>`).join('');

  filterSubject.innerHTML =
    '<option value="ALL">All subjects</option>' +
    subjects.map(s => `<option value="${s}">${s}</option>`).join('');
}

function applyFilters() {
  if (!cardsRoot) return;

  const type = filterType?.value || 'ALL';
  const province = filterProvince?.value || 'ALL';
  const subject = filterSubject?.value || 'ALL';
  const term = (searchInput?.value || '').toLowerCase();

  let filtered = catalogItems.filter(item => {
    if (type !== 'ALL' && normalizeType(item) !== type) return false;
    if (province !== 'ALL' && getField(item, 'province_filter') !== province) return false;
    if (subject !== 'ALL' && getField(item, 'subject_or_all') !== subject) return false;
    if (term && !JSON.stringify(item).toLowerCase().includes(term)) return false;
    return true;
  });

  cardsRoot.innerHTML = filtered.length
    ? filtered.map(i => formatCard(i)).join('')
    : `<article class="card-surface"><h3>No matches</h3></article>`;
}

/* ---------- render ---------- */

function renderFeatured(items) {
  if (!featuredRoot) return;
  const top = [...items].sort((a, b) => featuredScore(b) - featuredScore(a)).slice(0, 3);
  featuredRoot.innerHTML = top.map(i => formatCard(i, true)).join('');
}

async function loadCatalog() {
  try {
    const { payload, source } = await fetchStudyHubCatalog();
    catalogItems = payload.items || payload.packages || [];

    if (metaEl) {
      metaEl.textContent = `Loaded ${catalogItems.length} bundles from ${
        source.includes('sample') ? 'fallback data' : 'live catalog'
      }`;
      metaEl.className = 'status-ok';
    }

    populateFilters(catalogItems);
    renderFeatured(catalogItems);
    applyFilters();

  } catch (err) {
    console.error(err);
    if (metaEl) metaEl.textContent = 'Catalog could not be loaded.';
    if (cardsRoot) cardsRoot.innerHTML =
      `<article class="card-surface"><h3>Catalog unavailable</h3></article>`;
  }
}

/* ---------- events ---------- */

[filterType, filterProvince, filterSubject, sortBy].forEach(el =>
  el && el.addEventListener('change', applyFilters)
);

searchInput && searchInput.addEventListener('input', applyFilters);
clearFilters && clearFilters.addEventListener('click', () => {
  filterType.value = filterProvince.value = filterSubject.value = 'ALL';
  if (searchInput) searchInput.value = '';
  applyFilters();
});

/* ---------- boot ---------- */

loadCatalog();
