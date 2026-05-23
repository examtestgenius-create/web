/* StudyHub FINAL checkout.js — FREE DOWNLOAD MODE support */
(function(){
  const CFG = window.STUDYHUB_CONFIG || {};
  const $ = id => document.getElementById(id);
  let product = null;

  const money = c => new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR'
  }).format((Number(c) || 0) / 100);

  function webAppUrl(){
    return String(CFG.WEBAPP_URL || CFG.webappUrl || CFG.apiBaseUrl || '').trim();
  }

  function jsonp(action, params = {}){
    return new Promise((resolve, reject) => {
      const base = webAppUrl();
      if(!base){
        reject(new Error('Web App URL missing in config.js'));
        return;
      }

      const cb = 'StudyHub_checkout_cb_' + Math.random().toString(36).slice(2) + Date.now();
      const qs = new URLSearchParams(Object.assign({}, params, {
        action,
        callback: cb,
        _ts: Date.now()
      }));

      const s = document.createElement('script');
      let done = false;
      const timer = setTimeout(() => {
        if(!done){
          cleanup();
          reject(new Error('Request timed out: ' + action));
        }
      }, 30000);

      function cleanup(){
        done = true;
        clearTimeout(timer);
        try { delete window[cb]; } catch(e) { window[cb] = undefined; }
        if(s.parentNode) s.remove();
      }

      window[cb] = data => {
        cleanup();
        resolve(data);
      };

      s.onerror = () => {
        cleanup();
        reject(new Error('Network/API error: ' + action));
      };

      s.src = base + '?' + qs.toString();
      document.body.appendChild(s);
    });
  }

  async function fetchJson(url){
    const r = await fetch(url, { cache: 'no-store' });
    if(!r.ok) throw new Error('HTTP ' + r.status + ' loading ' + url);
    return await r.json();
  }

  async function getCatalog(){
    try{
      const j = await jsonp('catalogJsonp');
      if(j && j.ok) return j;
    }catch(e){
      console.warn(e);
    }

    const urls = [
      CFG.liveCatalogUrl,
      webAppUrl() ? webAppUrl() + '?action=catalog' : '',
      CFG.fallbackCatalogUrl
    ].filter(Boolean);

    for(const u of urls){
      try{
        return await fetchJson(u);
      }catch(e){
        console.warn(e);
      }
    }

    throw new Error('Catalogue unavailable');
  }

  function getSku(){
    return new URLSearchParams(location.search).get('sku') || '';
  }

  function setStatus(msg, cls = ''){
    const node = $('checkoutStatus');
    if(node){
      node.textContent = msg;
      node.className = 'notice ' + cls;
    }
  }

  function removeOldFreeBlock(){
    const old = document.getElementById('freeDownloadResultBlock');
    if(old) old.remove();
  }

  function showFreeDownload(res){
    removeOldFreeBlock();

    setStatus('Free download mode is ON. No PayFast payment required. A download email was sent if email delivery is configured.', 'ok');

    const url = res.download_url || res.zip_url || res.url || '#';
    const title = res.title || product?.title || 'StudyHub bundle';
    const order = res.order_id ? ('Order: ' + res.order_id) : '';

    const box = document.createElement('div');
    box.id = 'freeDownloadResultBlock';
    box.className = 'delivery-block';
    box.style.display = 'flex';
    box.style.gap = '12px';
    box.style.flexWrap = 'wrap';
    box.style.marginTop = '18px';
    box.innerHTML = `
      <div style="width:100%;margin-bottom:6px;color:#dffbff;font-weight:900;">${escapeHtml(title)} is ready. ${escapeHtml(order)}</div>
      <a class="btn btn-primary" href="${escapeAttr(url)}" target="_blank" rel="noopener">Download now</a>
      <a class="btn btn-secondary" href="index.html#bundles">Back to bundles</a>
    `;

    const status = $('checkoutStatus');
    if(status && status.parentNode){
      status.parentNode.insertBefore(box, status.nextSibling);
    }else{
      document.body.appendChild(box);
    }
  }

  function escapeHtml(v){
    return String(v || '').replace(/[&<>'"]/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[ch]));
  }

  function escapeAttr(v){
    return escapeHtml(v).replace(/`/g, '&#96;');
  }

  async function init(){
    const sku = getSku();
    if($('skuField')) $('skuField').value = sku;

    if(!sku){
      setStatus('No SKU specified. Go back to bundles.', 'bad');
      return;
    }

    try{
      const cat = await getCatalog();
      const items = (cat.items || cat.packages || []);
      product = items.find(x => String(x.sku) === String(sku));

      if(!product) throw new Error('Product not found: ' + sku);
      if(String(product.zip_status || 'READY').toUpperCase() !== 'READY'){
        throw new Error('Product not ready for delivery.');
      }

      if($('checkoutTitle')) $('checkoutTitle').textContent = product.title || product.sku;
      if($('checkoutIntro')) $('checkoutIntro').textContent = product.description || 'Your bundle will be delivered after payment confirmation.';
      if($('checkoutPrice')) $('checkoutPrice').textContent = money(product.price_cents);
      if($('checkoutBadges')) $('checkoutBadges').textContent = `Grade ${product.grade} • ${product.subject_or_all} • ${product.year_or_range} • ${product.bundle_type}`;
      if($('filesMeta')) $('filesMeta').textContent = String(product.file_count || 0);

      setStatus('Ready for checkout. If free download mode is ON, no payment will be required.', 'ok');
    }catch(e){
      setStatus(e.message, 'bad');
    }
  }

  function submitPayFast(endpoint, fields){
    if(!endpoint || !fields){
      throw new Error('PayFast checkout response missing endpoint or fields');
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = endpoint;

    Object.keys(fields || {}).forEach(k => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = fields[k];
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  }

  async function onSubmit(e){
    e.preventDefault();

    if(!product){
      setStatus('Product not loaded yet.', 'bad');
      return;
    }

    const fd = new FormData(e.target);

    if(!fd.get('accept_terms')){
      setStatus('Please accept the Terms and Refund Policy.', 'bad');
      return;
    }

    const email = String(fd.get('customer_email') || '').trim();
    if(!email || !email.includes('@')){
      setStatus('Enter a valid email address.', 'bad');
      return;
    }

    removeOldFreeBlock();
    setStatus('Creating checkout...', '');

    try{
      const res = await jsonp('createCheckoutJsonp', {
        sku: product.sku,
        email: email,
        customer_name: String(fd.get('customer_name') || ''),
        customer_phone: String(fd.get('customer_phone') || '')
      });

      if(!res || !res.ok){
        throw new Error((res && res.error) || 'Checkout failed');
      }

      if(res.order_id){
        sessionStorage.setItem('lastStudyHubOrder', res.order_id);
      }

      // FREE DOWNLOAD MODE: backend returns free_download:true and a download_url.
      if(res.free_download){
        showFreeDownload(res);
        return;
      }

      setStatus('Redirecting to PayFast...', 'ok');
      submitPayFast(res.endpoint, res.fields);

    }catch(err){
      setStatus('Could not create checkout: ' + err.message, 'bad');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('checkoutForm')?.addEventListener('submit', onSubmit);
    init();
  });
})();
