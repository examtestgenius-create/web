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

  function postPayFast(url, payload) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    Object.entries(payload || {}).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value == null ? '' : String(value);
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  }

  const params = new URL(window.location.href).searchParams;
  const sku = params.get('sku') || '';
  const titleEl = document.getElementById('checkoutTitle');
  const introEl = document.getElementById('checkoutIntro');
  const skuField = document.getElementById('skuField');
  const priceEl = document.getElementById('checkoutPrice');
  const badgesEl = document.getElementById('checkoutBadges');
  const fromMeta = document.getElementById('fromYearMeta');
  const toMeta = document.getElementById('toYearMeta');
  const filesMeta = document.getElementById('filesMeta');
  const form = document.getElementById('checkoutForm');
  const statusEl = document.getElementById('checkoutStatus');
  let currentItem = null;

  if (!sku) {
    titleEl.textContent = 'Missing package';
    introEl.textContent = 'Open checkout with ?sku=YOUR_SKU';
    form.style.display = 'none';
    return;
  }
  skuField.value = sku;

  fetchCatalog().then(payload => {
    currentItem = (payload.items || []).find(v => String(v.sku) === sku);
    if (!currentItem) {
      titleEl.textContent = 'Package not found';
      introEl.textContent = `No package with SKU ${sku} was found.`;
      form.style.display = 'none';
      return;
    }
    titleEl.textContent = currentItem.title || currentItem.sku;
    introEl.textContent = 'Secure checkout. When PayFast is configured, this form creates the order and redirects to PayFast automatically.';
    priceEl.textContent = moneyZar(currentItem.price_cents);
    badgesEl.innerHTML = `<span class="badge">Grade ${currentItem.grade}</span><span class="badge">${currentItem.subject_or_all || 'ALL'}</span><span class="badge">${currentItem.bundle_type}</span>`;
    const range = String(currentItem.year_or_range || '2022-2026').split('-');
    fromMeta.textContent = range[0] || '2022';
    toMeta.textContent = range[1] || range[0] || '2026';
    filesMeta.textContent = currentItem.file_count || 0;
  }).catch(err => {
    console.error(err);
    titleEl.textContent = 'Catalog unavailable';
    introEl.textContent = 'The package could not be loaded.';
    form.style.display = 'none';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.className = 'product-note';
    statusEl.textContent = 'Creating order…';
    const data = Object.fromEntries(new FormData(form).entries());

    if (!window.STUDYHUB_CONFIG.apiBaseUrl) {
      const fake = 'ORD-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      window.location.href = `order-created.html?order=${encodeURIComponent(fake)}&sku=${encodeURIComponent(sku)}`;
      return;
    }

    try {
      const res = await fetch(window.STUDYHUB_CONFIG.apiBaseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createCheckout', sku, ...data })
      });
      const out = await res.json();
      if (!res.ok || out.ok === false) throw new Error(out.error || 'Checkout failed');
      if (out.payfast_url && out.payfast_payload) {
        postPayFast(out.payfast_url, out.payfast_payload);
        return;
      }
      const orderId = out.order_id || out.orderId || 'ORDER';
      window.location.href = `order-created.html?order=${encodeURIComponent(orderId)}&sku=${encodeURIComponent(sku)}`;
    } catch (err) {
      console.error(err);
      statusEl.textContent = err.message || 'Checkout failed.';
      statusEl.classList.add('status-error');
    }
  });
})();
