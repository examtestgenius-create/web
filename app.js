// StudyHub app.js (aligned + robust)
(function(){
  window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {
    webappUrl: '',
    liveCatalogUrl: '',
    fallbackCatalogUrl: 'data/catalog.sample.json',
    apiBaseUrl: ''
  };

  const metaEl = document.getElementById('catalogMeta');
  const cardsRoot = document.getElementById('packageCards');
  const featuredRoot = document.getElementById('featuredCards');
  const filterType = document.getElementById('filterType');
  const filterProvince = document.getElementById('filterProvince');
  const filterSubject = document.getElementById('filterSubject');
  const sortBy = document.getElementById('sortBy');
  const clearFilters = document.getElementById('clearFilters');
  const searchInput = document.getElementById('searchInput');

  let catalogItems = [];

  function moneyZar(cents){
    const n = Number(cents || 0);
    if (!n) return 'Price not set';
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n/100);
  }

  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function uniqueSorted(list){
    return Array.from(new Set((list || []).filter(Boolean).map(String))).sort((a,b)=>a.localeCompare(b));
  }

  function jsonp(url){
    return new Promise((resolve, reject) => {
      const cbName = '__shcb' + Math.random().toString(36).slice(2);
      const sep = url.indexOf('?') >= 0 ? '&' : '?';
      const full = url + sep + 'callback=' + encodeURIComponent(cbName);

      const script = document.createElement('script');
      script.src = full;
      script.async = true;

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('JSONP timeout'));
      }, 15000);

      function cleanup(){
        clearTimeout(timeout);
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[cbName] = (data) => {
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('JSONP load failed'));
      };

      document.head.appendChild(script);
    });
  }

  async function fetchCatalog(){
    const tryUrls = [];
    if (window.STUDYHUB_CONFIG.liveCatalogUrl) tryUrls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
    tryUrls.push(window.STUDYHUB_CONFIG.fallbackCatalogUrl);

    const errors = [];
    for (const url of tryUrls){
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } catch (e){
        errors.push(url + ': ' + (e.message || e));
      }
    }

    // JSONP fallback for Apps Script (fixes CORS issues)
    if (window.STUDYHUB_CONFIG.webappUrl){
      try {
        return await jsonp(window.STUDYHUB_CONFIG.webappUrl + '?action=catalog');
      } catch (e2){
        errors.push('jsonp: ' + (e2.message || e2));
      }
    }

    throw new Error(errors.join('
'));
  }

  function getField(item, ...keys){
    for (const k of keys){
      if (item && item[k] !== undefined && item[k] !== null) return item[k];
    }
    return '';
  }

  function cardMarkup(item, featured){
    const sku = String(getField(item,'sku','SKU'));
    const type = String(getField(item,'bundle_type','Bundle_Type','type') || 'Bundle');
    const subject = String(getField(item,'subject_or_all','Subject_Name') || 'ALL');
    const grade = String(getField(item,'grade','Grade') || '');
    const years = String(getField(item,'year_or_range','Coverage_To_Year') || '');
    const papers = Number(getField(item,'file_count','Included_File_Count') || 0);
    const price = moneyZar(Number(getField(item,'price_cents','Price_Cents') || 0));
    const desc = String(getField(item,'description','Notes') || 'Metadata-driven bundle generated from the StudyHub library.');

    const tag = featured ? 'Featured' : type;
    const wrapper = featured ? 'featured-card card-surface' : 'card-surface';

    return `
      <article class="${wrapper}">
        <span class="card-tag">${esc(tag)}</span>
        <h3>${esc(sku || type)}</h3>
        <div class="badge-row">
          ${grade ? `<span class="badge">Grade ${esc(grade)}</span>` : ''}
          <span class="badge">${esc(subject)}</span>
          ${years ? `<span class="badge">${esc(years)}</span>` : ''}
        </div>
        <p>${esc(desc)}</p>
        <ul>
          <li>Papers included: ${isNaN(papers) ? 0 : papers}</li>
        </ul>
        <div class="price-chip">${esc(price)}</div>
        <div class="card-actions">
          <a class="btn btn-secondary" href="package.html?sku=${encodeURIComponent(sku)}">View details</a>
          <a class="btn btn-primary" href="checkout.html?sku=${encodeURIComponent(sku)}">Buy package</a>
        </div>
      </article>
    `;
  }

  function populateFilters(items){
    if (!filterType || !filterProvince || !filterSubject) return;

    const types = uniqueSorted(items.map(i => getField(i,'bundle_type','Bundle_Type','type')));
    const subjects = uniqueSorted(items.map(i => getField(i,'subject_or_all','Subject_Name')));

    filterType.innerHTML = '<option value="ALL">All types</option>' + types.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    filterProvince.innerHTML = '<option value="ALL">All provinces</option><option value="ALL">ALL</option>';
    filterSubject.innerHTML = '<option value="ALL">All subjects</option>' + subjects.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  }

  function applyFilters(){
    if (!cardsRoot) return;
    const type = filterType ? filterType.value : 'ALL';
    const subject = filterSubject ? filterSubject.value : 'ALL';
    const term = (searchInput ? searchInput.value : '').trim().toLowerCase();

    let filtered = catalogItems.filter(item => {
      const itemType = String(getField(item,'bundle_type','Bundle_Type','type') || 'Bundle');
      const itemSubject = String(getField(item,'subject_or_all','Subject_Name') || 'ALL');
      const sku = String(getField(item,'sku','SKU') || '');
      const blob = (sku + ' ' + itemType + ' ' + itemSubject + ' ' + String(getField(item,'description','Notes')||'')).toLowerCase();

      if (type !== 'ALL' && itemType !== type) return false;
      if (subject !== 'ALL' && itemSubject !== subject) return false;
      if (term && !blob.includes(term)) return false;
      return true;
    });

    if (sortBy && sortBy.value === 'priceAsc') filtered.sort((a,b)=>Number(getField(a,'price_cents','Price_Cents')||0)-Number(getField(b,'price_cents','Price_Cents')||0));
    else if (sortBy && sortBy.value === 'priceDesc') filtered.sort((a,b)=>Number(getField(b,'price_cents','Price_Cents')||0)-Number(getField(a,'price_cents','Price_Cents')||0));

    cardsRoot.innerHTML = filtered.length ? filtered.map(i => cardMarkup(i,false)).join('') : (
      '<article class="card-surface"><h3>No matches</h3><p>Try a different search or filter combination.</p></article>'
    );
  }

  function renderFeatured(items){
    if (!featuredRoot) return;
    const top = items.slice(0,3);
    featuredRoot.innerHTML = top.map(i => cardMarkup(i,true)).join('');
  }

  async function load(){
    try {
      const payload = await fetchCatalog();
      catalogItems = payload.items || payload.packages || [];
      const generated = payload.generated_at || payload.generatedAt || 'Unknown';

      if (metaEl){
        metaEl.textContent = `Loaded ${catalogItems.length} bundles. Generated: ${generated}`;
        metaEl.classList.add('status-ok');
      }

      populateFilters(catalogItems);
      renderFeatured(catalogItems);
      applyFilters();

      [filterType, filterProvince, filterSubject, sortBy].forEach(el => el && el.addEventListener('change', applyFilters));
      if (searchInput) searchInput.addEventListener('input', applyFilters);
      if (clearFilters) clearFilters.addEventListener('click', () => {
        if (filterType) filterType.value = 'ALL';
        if (filterProvince) filterProvince.value = 'ALL';
        if (filterSubject) filterSubject.value = 'ALL';
        if (sortBy) sortBy.value = 'featured';
        if (searchInput) searchInput.value = '';
        applyFilters();
      });

    } catch (err){
      console.error(err);
      if (metaEl){
        metaEl.textContent = 'Catalog could not be loaded.';
        metaEl.classList.add('status-error');
      }
      if (cardsRoot){
        cardsRoot.innerHTML = '<article class="card-surface"><h3>Catalog unavailable</h3><p>Check your Apps Script deployment and config.js settings.</p></article>';
      }
      if (featuredRoot) featuredRoot.innerHTML = '';
    }
  }

  load();
})();
