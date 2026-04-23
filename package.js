window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {};
window.STUDYHUB_CONFIG.fallbackCatalogUrl = window.STUDYHUB_CONFIG.fallbackCatalogUrl || 'data/catalog.sample.json';
window.STUDYHUB_CONFIG.liveCatalogUrl = window.STUDYHUB_CONFIG.liveCatalogUrl || '';
window.STUDYHUB_CONFIG.apiBaseUrl = window.STUDYHUB_CONFIG.apiBaseUrl || '';

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
  throw new Error(errors.join('
'));
}

function inferGradeFromSku(sku) {
  const m = String(sku || '').match(/SH-G(\d{1,2})-/i);
  return m && m[1] ? m[1] : '';
}

function normalizeCatalogItem(item) {
  const sku = item.SKU || item.sku || '';
  const title = item.Title || item.title || sku || 'Package';
  const type = item.Bundle_Type || item.bundle_type || item.type || 'Package';
  const subject = item.Subject_Name || item.subject_name || item.subject_or_all || 'ALL';
  const province = item.Province_Filter || item.province_filter || item.province || 'ALL';
  const yearRange = item.year_or_range || item.Year_Range || '';
  const fileCount = Number(item.Included_File_Count || item.included_file_count || item.file_count || 0);
  const priceCents = Number(item.Price_Cents || item.price_cents || 0);
  const notes = item.Notes || item.notes || item.description || '';
  let fromYear = item.Coverage_From_Year || item.coverage_from_year || '';
  let toYear = item.Coverage_To_Year || item.coverage_to_year || '';
  if ((!fromYear || !toYear) && /^\d{4}-\d{4}$/.test(String(yearRange))) {
    const parts = String(yearRange).split('-');
    fromYear = fromYear || parts[0];
    toYear = toYear || parts[1];
  }
  if (!fromYear && /^\d{4}$/.test(String(yearRange))) fromYear = yearRange;
  if (!toYear && /^\d{4}$/.test(String(yearRange))) toYear = yearRange;
  return { sku, title, type, subject, province, yearRange, fromYear: fromYear || '—', toYear: toYear || '—', fileCount, priceCents, notes, grade: inferGradeFromSku(sku) };
}

function moneyZar(cents) {
  const value = Number(cents || 0);
  if (!value) return 'Price not set';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(value / 100);
}

const detailStatus = document.getElementById('detailStatus');
const detailRoot = document.getElementById('packageDetailRoot');

function getSkuFromUrl() {
  return new URL(window.location.href).searchParams.get('sku') || '';
}

function detailMarkup(item) {
  return `
    <div class="detail-layout">
      <section class="detail-panel card-surface">
        <span class="eyebrow">${item.type}</span>
        <h2>${item.title}</h2>
        <p class="product-note">${item.sku}</p>
        <div class="badge-row">
          <span class="badge">Grade ${item.grade || '—'}</span>
          <span class="badge">${item.subject}</span>
          <span class="badge">${item.province}</span>
        </div>
        <p>${item.notes || 'StudyHub package from the live catalog.'}</p>
        <div class="detail-actions">
          <a class="btn btn-primary" href="checkout.html?sku=${encodeURIComponent(item.sku)}">Buy package</a>
          <a class="btn btn-secondary" href="index.html#packages">Back to catalog</a>
        </div>
      </section>
      <aside class="detail-panel card-surface product-sidebar">
        <div class="product-price">${moneyZar(item.priceCents)}</div>
        <div class="detail-meta-list">
          <div class="detail-meta-item"><strong>From year</strong><span>${item.fromYear}</span></div>
          <div class="detail-meta-item"><strong>To year</strong><span>${item.toYear}</span></div>
          <div class="detail-meta-item"><strong>Included files</strong><span>${item.fileCount}</span></div>
          <div class="detail-meta-item"><strong>Subject</strong><span>${item.subject}</span></div>
          <div class="detail-meta-item"><strong>Bundle type</strong><span>${item.type}</span></div>
        </div>
      </aside>
    </div>`;
}

async function loadPackageDetail() {
  const sku = getSkuFromUrl();
  if (!sku) {
    detailStatus.innerHTML = '<span class="eyebrow">Package detail</span><h2>Missing package SKU</h2><p>Add <code>?sku=YOUR_SKU</code> to the URL.</p>';
    return;
  }
  try {
    const { payload, source } = await fetchStudyHubCatalog();
    const items = (payload.items || payload.packages || []).map(normalizeCatalogItem);
    const item = items.find(v => String(v.sku) === sku);
    if (!item) {
      detailStatus.innerHTML = `<span class="eyebrow">Package detail</span><h2>Package not found</h2><p>No package with SKU <code>${sku}</code> was found.</p>`;
      return;
    }
    const sourceLabel = source === window.STUDYHUB_CONFIG.fallbackCatalogUrl ? 'fallback sample data' : 'live catalog';
    detailStatus.innerHTML = `<span class="eyebrow">Package detail</span><h2>${item.title}</h2><p>Loaded from ${sourceLabel}.</p>`;
    detailRoot.innerHTML = detailMarkup(item);
  } catch (err) {
    detailStatus.innerHTML = '<span class="eyebrow">Package detail</span><h2>Catalog unavailable</h2><p>The package detail could not be loaded.</p>';
    console.error(err);
  }
}

loadPackageDetail();
