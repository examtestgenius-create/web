(function () {
  async function fetchCatalog() {
    const tryUrls = [];
    if (window.STUDYHUB_CONFIG.liveCatalogUrl) tryUrls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
    tryUrls.push(window.STUDYHUB_CONFIG.fallbackCatalogUrl);
    for (const url of tryUrls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } catch (e) {}
    }
    throw new Error('Catalog unavailable');
  }

  function moneyZar(cents) {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format((Number(cents || 0) / 100));
  }

  function getSku() {
    return new URL(window.location.href).searchParams.get('sku') || '';
  }

  function detailMarkup(item) {
    const notes = (item.description || '').split('
').map(line => `<li>${line}</li>`).join('');
    return `
      <div class="detail-layout">
        <section class="detail-panel card-surface">
          <span class="eyebrow">${item.bundle_type}</span>
          <h2>${item.title || item.sku}</h2>
          <div class="badge-row">
            <span class="badge">Grade ${item.grade}</span>
            <span class="badge">${item.subject_or_all || 'ALL'}</span>
            <span class="badge">${item.year_or_range || '2022-2026'}</span>
          </div>
          <p class="product-note">${(item.description || '').split('
')[0] || 'Bundle built from complete paper + memo pairs.'}</p>
          <h3>Included</h3>
          <ul>${notes}</ul>
          <div class="detail-actions">
            <a class="btn btn-primary" href="checkout.html?sku=${encodeURIComponent(item.sku)}">Buy bundle</a>
            <a class="btn btn-secondary" href="index.html#packages">Back to catalog</a>
          </div>
        </section>
        <aside class="detail-panel card-surface product-sidebar">
          <h3>Bundle summary</h3>
          <div class="product-price">${moneyZar(item.price_cents)}</div>
          <div class="detail-meta-list">
            <div class="detail-meta-item"><strong>SKU</strong><span>${item.sku}</span></div>
            <div class="detail-meta-item"><strong>File count</strong><span>${item.file_count || 0}</span></div>
            <div class="detail-meta-item"><strong>Last updated</strong><span>${item.last_updated || '-'}</span></div>
            <div class="detail-meta-item"><strong>Delivery</strong><span>Instant after payment confirmation</span></div>
          </div>
        </aside>
      </div>
    `;
  }

  const detailStatus = document.getElementById('detailStatus');
  const detailRoot = document.getElementById('packageDetailRoot');
  const sku = getSku();
  if (!sku) {
    detailStatus.innerHTML = '<span class="eyebrow">Package detail</span><h2>Missing package SKU</h2><p>Open this page with ?sku=YOUR_SKU.</p>';
    return;
  }

  fetchCatalog().then(payload => {
    const item = (payload.items || []).find(v => String(v.sku) === sku);
    if (!item) {
      detailStatus.innerHTML = `<span class="eyebrow">Package detail</span><h2>Package not found</h2><p>No package with SKU <code>${sku}</code> was found.</p>`;
      return;
    }
    detailStatus.innerHTML = `<span class="eyebrow">Package detail</span><h2>${item.title || item.sku}</h2><p>Review the bundle and continue to secure checkout.</p>`;
    detailRoot.innerHTML = detailMarkup(item);
  }).catch(err => {
    console.error(err);
    detailStatus.innerHTML = '<span class="eyebrow">Package detail</span><h2>Catalog unavailable</h2><p>The package detail could not be loaded.</p>';
  });
})();
