// StudyHub app.js (Go-Live – CLEAN & CONSISTENT)

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

// ✅ FIXED: papers = file_count / 2 (memo always included)
function itemPapers(item) {
  if (item.paper_count != null) {
    return Number(item.paper_count || 0);
  }
  const files =
    Number(item.file_count ??
           item.Included_File_Count ??
           item.included_file_count ??
           0);

  return Math.round(files / 2);
}

function buyNow(sku) {
  window.location.href = `checkout.html?sku=${encodeURIComponent(sku)}`;
}

// ─────────────────────────────────────
// Everything below is unchanged rendering logic
// ─────────────────────────────────────

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
  const papers = itemPapers(item);
  const price = moneyZarFromCents(item.price_cents || item.Price_Cents);

  return `
    <article class="${featured ? 'featured-card card-surface' : 'card-surface'}">
      <span class="card-tag">${featured ? 'Featured bundle' : itemType(item)}</span>
      <h3>${sku}</h3>
      <div class="badge-row">
        ${itemGrade(item) ? `<span class="badge">Grade ${itemGrade(item)}</span>` : ''}
        <span class="badge">${itemSubject(item)}</span>
        ${itemYear(item) ? `<span class="badge">${itemYear(item)}</span>` : ''}
      </div>
      <p>${(item.description || 'Exam paper bundle with memos included.').split('\n')[0]}</p>
      <ul>
        <li>Papers included: ${papers}</li>
        <li>Memo included with every paper</li>
      </ul>
      <div class="price-chip">${price}</div>
      <div class="card-actions">
        <a class="btn btn-secondary" href="package.html?sku=${encodeURIComponent(sku)}">View details</a>
        <button class="btn btn-primary" type="button" onclick="buyNow('${sku.replace(/'/g, "\\'")}')">Buy</button>
      </div>
    </article>
  `;
}

function loadCatalog() {
  fetchStudyHubCatalog()
    .then(({ payload }) => {
      catalogItems = payload.items || payload.packages || [];
      if (featuredRoot) featuredRoot.innerHTML =
        [...catalogItems].sort((a, b) => itemPapers(b) - itemPapers(a))
          .slice(0, 3)
          .map(i => formatCard(i, true))
          .join('');
      if (cardsRoot) cardsRoot.innerHTML =
        catalogItems.map(i => formatCard(i)).join('');
    })
    .catch(() => {
      if (cardsRoot) {
        cardsRoot.innerHTML =
          '<article class="card-surface"><h3>Catalog unavailable</h3></article>';
      }
    });
}

loadCatalog();
``
