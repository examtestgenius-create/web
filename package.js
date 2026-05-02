// StudyHub package.js
(function(){
  window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || { liveCatalogUrl:'', fallbackCatalogUrl:'data/catalog.sample.json' };

  async function fetchCatalog(){
    const urls=[];
    if (window.STUDYHUB_CONFIG.liveCatalogUrl) urls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
    urls.push(window.STUDYHUB_CONFIG.fallbackCatalogUrl);
    let lastErr=null;
    for (const url of urls){
      try{
        const res = await fetch(url, { cache:'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      }catch(e){ lastErr=e; }
    }
    throw lastErr || new Error('Catalog unavailable');
  }

  function moneyZar(cents){
    const n = Number(cents||0);
    if(!n) return 'Price not set';
    return new Intl.NumberFormat('en-ZA', { style:'currency', currency:'ZAR' }).format(n/100);
  }

  const detailStatus=document.getElementById('detailStatus');
  const detailRoot=document.getElementById('packageDetailRoot');
  const sku=new URL(window.location.href).searchParams.get('sku') || '';

  function esc(s){ return String(s||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",""":"&quot;","'":"&#39;"}[c])); }

  function render(item){
    return `
      <div class="detail-layout">
        <section class="detail-panel card-surface">
          <span class="eyebrow">${esc(item.bundle_type||'Bundle')}</span>
          <h2>${esc(item.title||item.sku)}</h2>
          <p class="product-note">${esc(item.description||'Bundle generated from the StudyHub library.')}</p>
          <div class="badge-row">
            <span class="badge">Grade ${esc(item.grade)}</span>
            <span class="badge">${esc(item.subject_or_all||'ALL')}</span>
            <span class="badge">${esc(item.year_or_range||'')}</span>
          </div>
          <div class="detail-actions">
            <a class="btn btn-primary" href="checkout.html?sku=${encodeURIComponent(item.sku)}">Buy with PayFast</a>
            <a class="btn btn-secondary" href="index.html#packages">Back to bundles</a>
          </div>
        </section>
        <aside class="detail-panel card-surface product-sidebar">
          <h3>Order summary</h3>
          <div class="product-price">${esc(moneyZar(item.price_cents))}</div>
          <div class="detail-meta-list">
            <div class="detail-meta-item"><strong>Papers included</strong><span>${Number(item.file_count||0)}</span></div>
            <div class="detail-meta-item"><strong>Delivery</strong><span>ZIP after PayFast confirmation</span></div>
          </div>
        </aside>
      </div>
    `;
  }

  async function init(){
    if(!sku){
      detailStatus.innerHTML = '<span class="eyebrow">Package detail</span><h2>Missing package SKU</h2><p>Open with <code>?sku=YOUR_SKU</code>.</p>';
      return;
    }
    const payload = await fetchCatalog();
    const items = payload.items || [];
    const item = items.find(x => String(x.sku||'') === sku);
    if(!item){
      detailStatus.innerHTML = '<span class="eyebrow">Package detail</span><h2>Package not found</h2><p>No package with SKU <code>' + esc(sku) + '</code>.</p>';
      return;
    }
    detailStatus.innerHTML = '<span class="eyebrow">Package detail</span><h2>' + esc(sku) + '</h2><p class="product-note">Loaded from live catalog.</p>';
    detailRoot.innerHTML = render(item);
  }

  init().catch(err => {
    console.error(err);
    detailStatus.innerHTML = '<span class="eyebrow">Package detail</span><h2>Catalog unavailable</h2><p class="product-note">Could not load package detail.</p>';
  });
})();
