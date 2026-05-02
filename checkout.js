// StudyHub checkout.js (aligned)
    (function(){
      window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {
        webappUrl: '',
        siteBaseUrl: '',
        liveCatalogUrl: '',
        fallbackCatalogUrl: 'data/catalog.sample.json',
        apiBaseUrl: ''
      };

      async function fetchStudyHubCatalog(){
        const tryUrls = [];
        if (window.STUDYHUB_CONFIG.liveCatalogUrl) tryUrls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
        tryUrls.push(window.STUDYHUB_CONFIG.fallbackCatalogUrl);
        const errors=[];
        for (const url of tryUrls){
          try{
            const res = await fetch(url, {cache:'no-store'});
            if(!res.ok) throw new Error(`HTTP ${res.status}`);
            const payload = await res.json();
            return {payload, source:url, errors};
          }catch(e){ errors.push(`${url}: ${e.message}`); }
        }
        throw new Error(errors.join('
'));
      }

      function moneyZar(item){
        const cents = Number(item.price_cents ?? item.Price_Cents ?? 0);
        if(!cents) return 'Price not set';
        return new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(cents/100);
      }

      function buildAndSubmitPayfastForm(payfastUrl, payload){
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = payfastUrl;
        Object.keys(payload || {}).forEach(k => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = k;
          input.value = String(payload[k]);
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
      }

      const sku = new URL(window.location.href).searchParams.get('sku') || '';
      const titleEl = document.getElementById('checkoutTitle');
      const introEl = document.getElementById('checkoutIntro');
      const skuField = document.getElementById('skuField');
      const priceEl = document.getElementById('checkoutPrice');
      const badgesEl = document.getElementById('checkoutBadges');
      const fromYearMeta = document.getElementById('fromYearMeta');
      const toYearMeta = document.getElementById('toYearMeta');
      const filesMeta = document.getElementById('filesMeta');
      const checkoutForm = document.getElementById('checkoutForm');
      const checkoutStatus = document.getElementById('checkoutStatus');
      const payLaterBtn = document.getElementById('payLaterBtn');

      let currentItem = null;

      async function loadCheckout(){
        if(!sku){
          titleEl.textContent = 'Missing package';
          introEl.textContent = 'Open checkout with ?sku=YOUR_SKU';
          return;
        }
        skuField.value = sku;
        try{
          const {payload} = await fetchStudyHubCatalog();
          const items = payload.items || payload.packages || [];
          currentItem = items.find(v => String(v.sku ?? v.SKU ?? '') === sku);
          if(!currentItem){
            titleEl.textContent = 'Package not found';
            introEl.textContent = `No package with SKU ${sku} was found.`;
            return;
          }
          titleEl.textContent = `Checkout — ${sku}`;
          introEl.textContent = 'Pay securely with PayFast. After confirmation, your ZIP delivery link will appear on the success page.';
          priceEl.textContent = moneyZar(currentItem);
          badgesEl.innerHTML = `<span class="badge">${currentItem.subject_or_all ?? currentItem.Subject_Name ?? 'ALL'}</span><span class="badge">${currentItem.bundle_type ?? currentItem.Bundle_Type ?? 'Bundle'}</span>`;
          fromYearMeta.textContent = (currentItem.year_or_range ?? '').split('-')[0] || '—';
          toYearMeta.textContent = (currentItem.year_or_range ?? '').split('-')[1] || (currentItem.year_or_range ?? '—');
          filesMeta.textContent = String(currentItem.file_count ?? currentItem.Included_File_Count ?? 0) + ' papers';
        }catch(err){
          console.error(err);
          titleEl.textContent = 'Catalog unavailable';
          introEl.textContent = 'The package could not be loaded.';
        }
      }

      if(payLaterBtn){
        payLaterBtn.addEventListener('click', () => alert('Pay-later placeholder removed for go-live. Please use PayFast checkout.'));
      }

      if(checkoutForm){
        checkoutForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          checkoutStatus.textContent = '';
          checkoutStatus.classList.remove('notice');

          const data = Object.fromEntries(new FormData(checkoutForm).entries());
          const email = data.customer_email || data.email || '';

          const api = window.STUDYHUB_CONFIG.apiBaseUrl || window.STUDYHUB_CONFIG.webappUrl || '';
          if(!api){
            checkoutStatus.textContent = 'Backend is not configured. Set webappUrl in config.js.';
            checkoutStatus.classList.add('notice');
            return;
          }

          try{
            // Create PayFast checkout
            const res = await fetch(api, {
              method: 'POST',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({ action:'createCheckout', sku: sku, email: email, customer_email: email, customer_name: data.customer_name || '' })
            });
            if(!res.ok) throw new Error('Checkout request failed');
            const out = await res.json();
            if(!out.ok) throw new Error(out.error || 'Checkout failed');

            // Store order id for success page polling
            if(out.order_id) localStorage.setItem('studyhub_last_order_id', out.order_id);

            // Redirect to PayFast
            buildAndSubmitPayfastForm(out.payfast_url, out.payfast_payload);
          }catch(err){
            console.error(err);
            checkoutStatus.textContent = 'Could not start PayFast checkout: ' + (err.message || err);
            checkoutStatus.classList.add('notice');
          }
        });
      }

      loadCheckout();
    })();
