window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || { liveCatalogUrl: '', fallbackCatalogUrl: 'data/catalog.sample.json' };

async function fetchStudyHubCatalog() {
  const tryUrls = [];
  if (window.STUDYHUB_CONFIG.liveCatalogUrl) tryUrls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
  tryUrls.push(window.STUDYHUB_CONFIG.fallbackCatalogUrl);
  for (const url of tryUrls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return { payload: await res.json(), source: url };
    } catch (e) {}
  }
  throw new Error('Catalog not available');
}

function moneyZarFromCents(cents){
  const n = Number(cents || 0);
  if (!n) return 'Price not set';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n / 100);
}

function papersCount(item){
  if (item.paper_count !== undefined && item.paper_count !== null && String(item.paper_count) !== '') return Number(item.paper_count || 0);
  if (item.papers !== undefined && item.papers !== null && String(item.papers) !== '') return Number(item.papers || 0);
  const fileCount = Number(item.file_count ?? item.Included_File_Count ?? item.included_file_count ?? 0);
  return fileCount > 0 ? Math.max(1, Math.round(fileCount / 2)) : 0;
}

const detailStatus = document.getElementById('detailStatus');
const detailRoot = document.getElementById('packageDetailRoot');
function getSkuFromUrl(){ return new URL(window.location.href).searchParams.get('sku') || ''; }

function render(item){
  const sku = String(item.sku || item.SKU || '');
  const type = String(item.bundle_type || item.Bundle_Type || 'Bundle');
  const grade = String(item.grade || '').trim();
  const subject = String(item.subject_or_all || 'ALL');
  const year = String(item.year_or_range || '');
  const price = moneyZarFromCents(item.price_cents || item.Price_Cents);
  const papers = papersCount(item);
  const desc = String(item.description || '').split('
').filter(Boolean);
  return `
    <div class="detail-layout">
      <section class="detail-panel card-surface">
        <span class="eyebrow">Bundle</span>
        <h2>${sku}</h2>
        <p>${desc[0] || 'Exam paper bundle with official memos included.'}</p>
        <div class="badge-row">
          ${grade ? `<span class="badge">Grade ${grade}</span>` : ''}
          <span class="badge">${subject}</span>
          ${year ? `<span class="badge">${year}</span>` : ''}
          <span class="badge">${type}</span>
        </div>
        <p class="product-note">Important: each paper includes the question paper and its official memo.</p>
        <div class="detail-actions">
          <a class="btn btn-primary" href="checkout.html?sku=${encodeURIComponent(sku)}">Buy via PayFast</a>
          <a class="btn btn-secondary" href="index.html#packages">Back to bundles</a>
        </div>
      </section>
      <aside class="detail-panel card-surface product-sidebar">
        <h3>Summary</h3>
        <div class="product-price">${price}</div>
        <div class="detail-meta-list">
          <div class="detail-meta-item"><strong>Papers included</strong><span>${papers}</span></div>
          <div class="detail-meta-item"><strong>Memo</strong><span>Included with every paper</span></div>
          <div class="detail-meta-item"><strong>Delivery</strong><span>Instant ZIP after payment</span></div>
        </div>
      </aside>
    </div>
  `;
}

async function loadPackageDetail(){
  const sku = getSkuFromUrl();
  if (!sku){
    detailStatus.innerHTML = '<span class="eyebrow">Package detail</span><h2>Missing bundle SKU</h2><p>Open this page with <code>?sku=YOUR_SKU</code>.</p>';
    return;
  }
  try {
    const { payload } = await fetchStudyHubCatalog();
    const items = payload.items || payload.packages || [];
    const item = items.find(v => String(v.sku || v.SKU || '') === sku);
    if (!item){
      detailStatus.innerHTML = `<span class="eyebrow">Package detail</span><h2>Bundle not found</h2><p>No bundle with SKU <code>${sku}</code> was found.</p>`;
      return;
    }
    detailStatus.innerHTML = `<span class="eyebrow">Package detail</span><h2>${sku}</h2><p>Ready for PayFast checkout.</p>`;
    detailRoot.innerHTML = render(item);
  } catch(err){
    console.error(err);
    detailStatus.innerHTML = '<span class="eyebrow">Package detail</span><h2>Catalog unavailable</h2><p>Please try again later.</p>';
  }
}

loadPackageDetail();
