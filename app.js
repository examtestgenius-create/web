window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {
  liveCatalogUrl: '',
  fallbackCatalogUrl: 'data/catalog.sample.json',
  apiBaseUrl: '',
  contactMode: 'placeholder'
};

async function fetchStudyHubCatalog() {
  const tryUrls = [];
  if (window.STUDYHUB_CONFIG.liveCatalogUrl) tryUrls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
  tryUrls.push(window.STUDYHUB_CONFIG.fallbackCatalogUrl);

  for (const url of tryUrls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      return { payload, source: url };
    } catch {}
  }
  throw new Error('Catalog unavailable');
}

function moneyZar(item) {
  const cents = Number(item.price_cents || 0);
  if (!cents) return 'Price not set';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR'
  }).format(cents / 100);
}

// ✅ NEW helper — papers, not files
function paperCount(item) {
  const files = Number(item.file_count || 0);
  return Math.floor(files / 2);
}

function buyPlaceholder(sku) {
  window.location.href = `checkout.html?sku=${encodeURIComponent(sku)}`;
}

function downloadPlaceholder(sku) {
  alert(`Download placeholder for ${sku}`);
}

const metaEl = document.getElementById('catalogMeta');
const cardsRoot = document.getElementById('packageCards');
const featuredRoot = document.getElementById('featuredCards');

function formatCard(item, featured = false) {
  const papers = paperCount(item);
  const sku = item.sku || '';
  const subject = item.subject_or_all || 'ALL';
  const type = item.bundle_type || 'Bundle';
  const wrapperClass = featured ? 'featured-card card-surface' : 'card-surface';

  return `
    <article class="${wrapperClass}">
      <span class="card-tag">${featured ? 'Featured bundle' : type}</span>
      <h3>${item.title || sku}</h3>

      <div class="badge-row">
        <span class="badge">Grade ${item.grade}</span>
        <span class="badge">${subject}</span>
      </div>

      <ul>
        <li>Coverage: ${item.year_or_range}</li>
        <li><strong>Available papers:</strong> ${papers}</li>
      </ul>

      <div class="price-chip">${moneyZar(item)}</div>

      <div class="card-actions">
        <a class="btn btn-secondary" href="package.html?sku=${encodeURIComponent(sku)}">View details</a>
        <button class="btn btn-primary" onclick="buyPlaceholder('${sku}')">Buy</button>
        <button class="btn btn-ghost" onclick="downloadPlaceholder('${sku}')">Download later</button>
      </div>
    </article>
  `;
}

function renderFeatured(items) {
  const allowed = ['Ultimate Bundle', 'Master Bundle'];
  const featured = items
    .filter(i => allowed.includes(i.bundle_type))
    .sort((a, b) => Number(a.grade) - Number(b.grade))
    .slice(0, 3);

  featuredRoot.innerHTML = featured.map(i => formatCard(i, true)).join('');
}

async function loadCatalog() {
  try {
    const { payload, source } = await fetchStudyHubCatalog();
    const items = payload.items || [];

    metaEl.textContent =
      source === window.STUDYHUB_CONFIG.fallbackCatalogUrl
        ? 'Loaded from fallback data'
        : `Loaded ${items.length} bundles from live catalog`;

    renderFeatured(items);
    cardsRoot.innerHTML = items.map(i => formatCard(i)).join('');
  } catch {
    metaEl.textContent = 'Catalog unavailable';
  }
}

loadCatalog();
