window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {
  liveCatalogUrl: '',
  fallbackCatalogUrl: 'data/catalog.sample.json',
  apiBaseUrl: ''
};

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
      return { payload, source: url, errors };
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }
  throw new Error(errors.join('\n'));
}

function moneyZarFromCents(cents) {
  const n = Number(cents || 0);
  if (!n) return 'Price not set';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR'
  }).format(n / 100);
}

function itemSku(item) { return String(item.sku || item.SKU || ''); }
function itemType(item) { return String(item.bundle_type || item.Bundle_Type || item.type || 'Bundle'); }
function itemGrade(item) { return String(item.grade || item.Grade || '').trim(); }
function itemSubject(item) { return String(item.subject_or_all || item.Subject_Name || 'ALL'); }
function itemYear(item) { return String(item.year_or_range || item.Year || ''); }
function itemProvince(item) { return String(item.province || item.province_filter || item.Province_Filter || 'ALL'); }

function itemPapers(item) {
  if (
    item.paper_count !== undefined &&
    item.paper_count !== null &&
    String(item.paper_count) !== ''
  ) return Number(item.paper_count);

  if (
    item.papers !== undefined &&
    item.papers !== null &&
    String(item.papers) !== ''
  ) return Number(item.papers);

  const fileCount = Number(
    item.file_count ??
    item.Included_File_Count ??
    item.included_file_count ??
    0
  );

  return fileCount > 0 ? Math.max(1, Math.round(fileCount / 2)) : 0;
}

function buyNow(sku) {
  window.location.href = `checkout.html?sku=${encodeURIComponent(sku)}`;
}

const metaEl = document.getElementById('catalogMeta');
const cardsRoot = document.getElementById('packageCards');
const featuredRoot = document.getElementById('featuredCards');
const filterType = document.getElementById('filterType');
const filterProvince = document.getElementById('filterProvince');
const filterSubject = document.getElementById('filterSubject');
const sortBy = document.getElementById('sortBy');
const clearFilters = document.getElementById('clearFilters');
const searchInput = document.getElementById('searchInput');

let catalogItems = [];

function uniqueSorted(list) {
  return [...new Set((list || []).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)));
}

function formatCard(item, featured = false) {
  const sku = itemSku(item);
  const grade = itemGrade(item);
  const subject = itemSubject(item);
  const year = itemYear(item);
  const papers = itemPapers(item);
  const price = moneyZarFromCents(item.price_cents || item.Price_Cents);
  const tag = featured ? 'Featured bundle' : itemType(item);

  const firstLine =
    String(item.description || '')
      .split('\n')[0] ||
    'Exam paper bundle with official memos included.';

  return `
    <article class="${featured ? 'featured-card ' : ''}card-surface">
      <span class="card-tag">${tag}</span>
      <h3>${sku}</h3>
      <div class="badge-row">
        ${grade ? `<span class="badge">Grade ${grade}</span>` : ''}
        <span class="badge">${subject}</span>
        ${year ? `<span class="badge">${year}</span>` : ''}
      </div>
      <p>${firstLine}</p>
      <ul>
        <li>Papers included: ${papers}</li>
        <li>Each paper includes the question paper and memo</li>
      </ul>
      <div class="price-chip">${price}</div>
      <div class="card-actions">
        <a class="btn btn-secondary" href="package.html?sku=${encodeURIComponent(sku)}">View details</a>
        <button class="btn btn-primary" onclick="buyNow('${sku.replace(/'/g, "\\'")}')">Buy</button>
      </div>
    </article>
  `;
}

async function loadCatalog() {
  try {
    const { payload, source } = await fetchStudyHubCatalog();
    catalogItems = payload.items || payload.packages || [];

    if (metaEl) {
      metaEl.textContent = `Loaded ${catalogItems.length} bundles.`;
      metaEl.classList.add('status-ok');
    }

    if (featuredRoot) {
      featuredRoot.innerHTML = catalogItems
        .slice(0, 3)
        .map(i => formatCard(i, true))
        .join('');
    }

    if (cardsRoot) {
      cardsRoot.innerHTML = catalogItems
        .map(i => formatCard(i))
        .join('');
    }
  } catch (err) {
    console.error(err);
    if (metaEl) metaEl.textContent = 'Catalog could not be loaded.';
  }
}

loadCatalog();
