// StudyHub checkout.js (PayFast live)
(function(){
  window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || { liveCatalogUrl:'', fallbackCatalogUrl:'data/catalog.sample.json', apiBaseUrl:'' };

  async function fetchCatalog(){
    const urls = [];
    if (window.STUDYHUB_CONFIG.liveCatalogUrl) urls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
    urls.push(window.STUDYHUB_CONFIG.fallbackCatalogUrl);
    let lastErr = null;
    for (const url of urls){
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } catch (e){ lastErr = e; }
    }
    throw lastErr || new Error('Catalog unavailable');
  }

  function moneyZar(cents){
    const n = Number(cents || 0);
    if (!n) return 'Price not set';
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n/100);
  }

  function submitPayfast(payfastUrl, fields){
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = payfastUrl;
    Object.keys(fields||{}).forEach(k => {
      const i = document.createElement('input');
      i.type = 'hidden';
      i.name = k;
      i.value = String(fields[k]);
      form.appendChild(i);
    });
    document.body.appendChild(form);
    form.submit();
  }

  const sku = new URL(window.location.href).searchParams.get('sku') || '';
  const titleEl = document.getElementById('checkoutTitle');
  const introEl = document.getElementById('checkoutIntro');
  const skuField = document.getElementById('skuField');
  const priceEl = document.getElementById('checkoutPrice');
  const fromYearMeta = document.getElementById('fromYearMeta');
  const toYearMeta = document.getElementById('toYearMeta');
  const filesMeta = document.getElementById('filesMeta');
  const badgesEl = document.getElementById('checkoutBadges');
  const form = document.getElementById('checkoutForm');
  const statusEl = document.getElementById('checkoutStatus');

  let item = null;

  async function init(){
    if (!sku){
      titleEl.textContent = 'Missing package';
      introEl.textContent = 'Open checkout with ?sku=YOUR_SKU';
      return;
    }
    skuField.value = sku;
    const payload = await fetchCatalog();
    const items = payload.items || [];
    item = items.find(x => String(x.sku||'') === sku);
    if (!item){
      titleEl.textContent = 'Package not found';
      introEl.textContent = 'No package with SKU ' + sku + ' was found.';
      return;
    }

    titleEl.textContent = 'Checkout — ' + sku;
    introEl.textContent = 'Pay securely with PayFast. After confirmation, your ZIP download will appear on the success page.';
    priceEl.textContent = moneyZar(item.price_cents);
    badgesEl.innerHTML = '<span class="badge">' + (item.subject_or_all || 'ALL') + '</span>' +
                        '<span class="badge">' + (item.bundle_type || 'Bundle') + '</span>';

    const yr = String(item.year_or_range || '');
    const parts = yr.split('-');
    fromYearMeta.textContent = parts[0] || '—';
    toYearMeta.textContent = parts[1] || yr || '—';
    filesMeta.textContent = String(item.file_count || 0) + ' papers';
  }

  if (form){
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      statusEl.textContent = '';
      const data = Object.fromEntries(new FormData(form).entries());
      const email = String(data.customer_email || '').trim();
      if (!email){
        statusEl.textContent = 'Email is required.';
        statusEl.classList.add('notice');
        return;
      }

      const api = window.STUDYHUB_CONFIG.apiBaseUrl || '';
      if (!api){
        statusEl.textContent = 'Backend not configured. Set webappUrl in config.js.';
        statusEl.classList.add('notice');
        return;
      }

      try {
        const res = await fetch(api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'createCheckout',
            sku: sku,
            email: email,
            customer_email: email,
            customer_name: data.customer_name || ''
          })
        });
        if (!res.ok) throw new Error('Checkout request failed');
        const out = await res.json();
        if (!out.ok) throw new Error(out.error || 'Checkout failed');

        if (out.order_id) localStorage.setItem('studyhub_last_order_id', out.order_id);
        submitPayfast(out.payfast_url, out.payfast_payload);
      } catch (err){
        statusEl.textContent = 'Could not start PayFast checkout: ' + (err.message || err);
        statusEl.classList.add('notice');
      }
    });
  }

  init().catch(err => {
    console.error(err);
    titleEl.textContent = 'Catalog unavailable';
    introEl.textContent = 'The package could not be loaded.';
  });
})();
