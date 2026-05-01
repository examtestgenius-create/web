// StudyHub package.js (Go-Live)
// Requires config.js to be loaded before this file. [1](https://arcelormittal-my.sharepoint.com/personal/10005739_arcelormittalsa_com/Documents/Microsoft%20Copilot%20Chat%20Files/index.html)
window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {
  liveCatalogUrl: '',
  fallbackCatalogUrl: 'data/catalog.sample.json'
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

function moneyZarFromCents(cents) {
  const n = Number(cents || 0);
  if (!n) return 'Price not set';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n / 100);
}

function getSkuFromUrl() {
  return new URL(window.location.href).searchParams.get('sku') || '';
}

function itemSku(item) { return String(item.sku || item.SKU || ''); }
function itemType(item) { return String(item.bundle_type || item.Bundle_Type || item.type || 'Bundle'); }
function itemGrade(item) { return String(item.grade || item.Grade || '').trim(); }
function itemSubject(item) { return String(item.subject_or_all || item.Subject_Name || 'ALL'); }
function itemYear(item) { return String(item.year_or_range || item.Year || ''); }

// ✅ FIXED: convert file_count (paper+memo files) into paper count
function itemPapers(item) {
  // Prefer true paper_count if backend ever provides it
  const paperCount = item.paper_count ?? item.papers;
  if (paperCount !== undefined && paperCount !== null && String(paperCount).trim() !== '') {
    return Number(paperCount || 0);
  }

  // Fallback to file count; memos are ALWAYS included => 2 files per paper
  // Backend counts paper_url + memo_url as file_count. [1](https://arcelormittal-my.sharepoint.com/personal/10005739_arcelormittalsa_com/Documents/Microsoft%20Copilot%20Chat%20Files/index.html)
  const fileCount = item.file_count ?? item.Included_File_Count ?? item.included_file_count;
  const n = Number(fileCount || 0);
  return Math.round(n / 2);
}

function firstLine(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  return s.split('\n')[0].trim();
}

function renderDetail(item) {
  const sku = itemSku(item);
  const type = itemType(item);
  const grade = itemGrade(item);
  const subject = itemSubject(item);
  const year = itemYear(item);

  const papers = itemPapers(item);
  const price = moneyZarFromCents(item.price_cents || item.Price_Cents);

  const desc = firstLine(item.description) || 'Exam paper bundle with memos included.';
  const delivery = item.deliveryUrl || item.delivery_url || item.driveUrl || item.drive_url || '';

  return `
    <div class="detail-layout">
      <section class="detail-panel card-surface">
        <span class="eyebrow">Bundle</span>
        <h2>${sku}</h2>
        <p class="product-note">${desc}</p>

        <div class="badge-row">
          ${grade ? `<span class="badge">Grade ${grade}</span>` : ''}
          <span class="badge">${subject}</span>
          ${year ? `<span class="badge">${year}</span>` : ''}
          <span class="badge">${type}</span>
        </div>

        <p class="product-note"><strong>Important:</strong> One exam paper includes both the question paper and its official memo.</p>

        <div class="detail-actions">
          <a class="btn btn-primary" href="checkout.html?sku=${encodeURIComponent(sku)}">Buy via PayFast</a>
          <a class="btn btn-secondary" href="index.html#packages">Back to bundles</a>
          ${delivery ? `<a class="btn btn-ghost" href="${delivery}" target="_blank" rel="noopener">View bundle folder</a>` : ''}
        </div>
      </section>

      <aside class="detail-panel card-surface product-sidebar">
        <h3>Summary</h3>
        <div class="product-price">${price}</div>

        <div class="detail-meta-list">
          <div class="detail-meta-item">
            <strong>Papers included</strong>
            <span>${papers}</span>
          </div>
          <div class="detail-meta-item">
            <strong>Memo</strong>
            <span>Included with every paper</span>
          </div>
          <div class="detail-meta-item">
            <strong>Delivery</strong>
            <span>Instant ZIP after payment</span>
          </div>
        </div>
      </aside>
    </div>
  `;
}

async function loadPackageDetail() {
  const detailStatus = document.getElementById('detailStatus');
  const detailRoot = document.getElementById('packageDetailRoot');

  const sku = getSkuFromUrl();
  if (!sku) {
    if (detailStatus) {
      detailStatus.innerHTML = `
        <span class="eyebrow">Package detail</span>
        <h2>Missing bundle SKU</h2>
        <p class="product-note">Open this page with <code>?sku=YOUR_SKU</code>.</p>
      `;
    }
    return;
  }

  try {
    const { payload, source } = await fetchStudyHubCatalog();
    const items = payload.items || payload.packages || [];

    const item = items.find(v => String(v.sku || v.SKU || '') === sku);
    if (!item) {
      if (detailStatus) {
        detailStatus.innerHTML = `
          <span class="eyebrow">Package detail</span>
          <h2>Bundle not found</h2>
          <p class="product-note">No bundle with SKU <code>${sku}</code> was found.</p>
        `;
      }
      return;
    }

    const sourceLabel =
      source === window.STUDYHUB_CONFIG.fallbackCatalogUrl ? 'fallback sample data' : 'live catalog';

    if (detailStatus) {
      detailStatus.innerHTML = `
        <span class="eyebrow">Package detail</span>
        <h2>${sku}</h2>
        <p class="product-note">Loaded from ${sourceLabel}. Ready for PayFast checkout.</p>
      `;
    }

    if (detailRoot) detailRoot.innerHTML = renderDetail(item);
  } catch (err) {
    console.error(err);
    if (detailStatus) {
      detailStatus.innerHTML = `
        <span class="eyebrow">Package detail</span>
        <h2>Catalog unavailable</h2>
        <p class="product-note">Please try again later.</p>
      `;
    }
  }
}

loadPackageDetail();
