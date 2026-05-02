// StudyHub package.js (aligned)
    (function(){
      window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || { liveCatalogUrl:'', fallbackCatalogUrl:'data/catalog.sample.json', apiBaseUrl:'' };

      async function fetchStudyHubCatalog(){
        const tryUrls = [];
        if (window.STUDYHUB_CONFIG.liveCatalogUrl) tryUrls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
        tryUrls.push(window.STUDYHUB_CONFIG.fallbackCatalogUrl);
        const errors=[];
        for (const url of tryUrls){
          try{
            const res = await fetch(url,{cache:'no-store'});
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

      function getSku(){ return new URL(window.location.href).searchParams.get('sku') || ''; }

      const detailStatus = document.getElementById('detailStatus');
      const detailRoot = document.getElementById('packageDetailRoot');

      function esc(s){ return String(s||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",""":"&quot;","'":"&#39;"}[c])); }

      function renderDetail(item){
        const sku = String(item.sku ?? item.SKU ?? '');
        const type = String(item.bundle_type ?? item.Bundle_Type ?? 'Package');
        const grade = String(item.grade ?? item.Grade ?? '');
        const subject = String(item.subject_or_all ?? item.Subject_Name ?? 'ALL');
        const years = String(item.year_or_range ?? item.Coverage_To_Year ?? '');
        const papers = Number(item.file_count ?? item.Included_File_Count ?? 0);
        const province = String(item.province_filter ?? item.Province_Filter ?? 'ALL');
        const desc = String(item.description ?? item.Notes ?? '');
        const price = moneyZar(item);

        return `
          <section class="detail-panel card-surface">
            <span class="eyebrow">${esc(type)}</span>
            <h2>${esc(item.title ?? sku)}</h2>
            <p class="product-note">${esc(desc || 'Metadata-driven bundle generated from the StudyHub library.')}</p>
            <div class="badge-row">
              <span class="badge">Grade ${esc(grade)}</span>
              <span class="badge">${esc(subject)}</span>
              <span class="badge">${esc(province)}</span>
            </div>
            <div class="detail-meta-list">
              <div class="detail-meta-item"><strong>Year range</strong><span>${esc(years)}</span></div>
              <div class="detail-meta-item"><strong>Papers included</strong><span>${isNaN(papers)?'—':papers}</span></div>
            </div>
            <div class="detail-actions">
              <a class="btn btn-primary" href="checkout.html?sku=${encodeURIComponent(sku)}">Buy with PayFast</a>
              <a class="btn btn-secondary" href="index.html#packages">Back to bundles</a>
            </div>
          </section>
          <aside class="detail-panel card-surface product-sidebar">
            <h3>Price</h3>
            <div class="product-price">${esc(price)}</div>
            <p class="product-note">You are buying <strong>papers</strong> (each paper includes the exam paper + memo). ZIP delivery after payment confirmation.</p>
          </aside>
        `;
      }

      async function main(){
        const sku = getSku();
        if(!sku){
          detailStatus.innerHTML = '<span class="eyebrow">Package detail</span><h2>Missing package SKU</h2><p>Open this page with <code>?sku=YOUR_SKU</code>.</p>';
          return;
        }
        try{
          const {payload, source} = await fetchStudyHubCatalog();
          const items = payload.items || payload.packages || [];
          const item = items.find(v => String(v.sku ?? v.SKU ?? '') === sku);
          if(!item){
            detailStatus.innerHTML = `<span class="eyebrow">Package detail</span><h2>Package not found</h2><p>No package with SKU <code>${esc(sku)}</code> was found.</p>`;
            return;
          }
          const sourceLabel = (source === window.STUDYHUB_CONFIG.fallbackCatalogUrl) ? 'fallback sample data' : 'live catalog';
          detailStatus.innerHTML = `<span class="eyebrow">Package detail</span><h2>${esc(sku)}</h2><p class="product-note">Loaded from ${esc(sourceLabel)}.</p>`;
          detailRoot.innerHTML = `<div class="detail-layout">${renderDetail(item)}</div>`;
        }catch(err){
          console.error(err);
          detailStatus.innerHTML = '<span class="eyebrow">Package detail</span><h2>Catalog unavailable</h2><p class="product-note">The package detail could not be loaded.</p>';
        }
      }

      main();
    })();
