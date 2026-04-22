
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

function moneyZar(item) {
  const cents = Number(item.Price_Cents || item.price_cents || 0);
  if (!cents) return 'Price not set';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(cents / 100);
}

function buyPlaceholder(sku) {
  const target = `checkout.html?sku=${encodeURIComponent(sku)}`;
  window.location.href = target;
}

function downloadPlaceholder(sku) {
  alert(`Download placeholder for ${sku}. Connect final delivery/download logic here later.`);
}

const detailStatus = document.getElementById('detailStatus');
const detailRoot = document.getElementById('packageDetailRoot');
function getSkuFromUrl() { return new URL(window.location.href).searchParams.get('sku') || ''; }
function detailMarkup(item) {
  const sku = item.sku;
  const title = item.title || sku;
  const type = item.bundle_type || 'Bundle';
  const grade = item.grade || '';
  const subject = item.subject_or_all || '';
  const yearRange = item.year_or_range || '';
  const files = item.file_count || 0;
  const price = moneyZar(item);

  return `
    <h1>${title}</h1>

    <div class="detail-grid">
      <p><strong>SKU:</strong> ${sku}</p>
      <p><strong>Bundle type:</strong> ${type}</p>
      <p><strong>Grade:</strong> ${grade}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Coverage:</strong> ${yearRange}</p>
      <p><strong>Included files:</strong> ${files}</p>
    </div>

    <div class="price-chip">${price}</div>

    <div class="detail-actions">
      <a class="btn btn-primary" href="checkout.html?sku=${encodeURIComponent(sku)}">
        Buy package
      </a>

      <a class="btn btn-secondary" href="${item.deliveryUrl || item.driveUrl}" target="_blank">
        Download later
      </a>

      <a class="btn btn-ghost" href="index.html#packages">
        Back to catalog
      </a>
    </div>
  `;
}
async function loadPackageDetail() {
  const sku = getSkuFromUrl();
  if (!sku) { detailStatus.innerHTML = '<span class="eyebrow">Package detail</span><h2>Missing package SKU</h2><p>Add <code>?sku=YOUR_SKU</code> to the URL.</p>'; return; }
  try {
    const { payload, source } = await fetchStudyHubCatalog();
    const items = payload.items || payload.packages || [];
    const item = items.find(v => String(v.sku) === sku);
    if (!item) { detailStatus.innerHTML = `<span class="eyebrow">Package detail</span><h2>Package not found</h2><p>No package with SKU <code>${sku}</code> was found.</p>`; return; }
    const sourceLabel = source === window.STUDYHUB_CONFIG.fallbackCatalogUrl ? 'fallback sample data' : 'live catalog';
    detailStatus.innerHTML = `<span class="eyebrow">Package detail</span><h2>${sku}</h2><p>Loaded from ${sourceLabel}.</p>`;
    detailRoot.innerHTML = detailMarkup(item);
  } catch (err) {
    detailStatus.innerHTML = '<span class="eyebrow">Package detail</span><h2>Catalog unavailable</h2><p>The package detail could not be loaded.</p>';
    console.error(err);
  }
}
loadPackageDetail();
