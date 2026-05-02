// StudyHub app.js (FIXED – no HTML entities, JSONP-safe)
(function () {
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

  function moneyZar(cents) {
    const n = Number(cents || 0);
    if (!n) return 'Price not set';
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(n / 100);
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c]);
  }

  function uniqueSorted(list) {
    return Array.from(
      new Set((list || []).filter(Boolean).map(String))
    ).sort((a, b) => a.localeCompare(b));
  }

  // JSONP helper (bypasses CORS for Apps Script)
  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cb = '__shcb' + Math.random().toString(36).slice(2);
      const full = url + (url.includes('?') ? '&' : '?') + 'callback=' + cb;

      const script = document.createElement('script');
      script.src = full;
      script.async = true;

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('JSONP timeout'));
      }, 15000);

      function cleanup() {
        clearTimeout(timeout);
        delete window[cb];
        script.remove();
      }

      window[cb] = data => {
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('JSONP failed'));
      };

      document.head.appendChild(script);
    });
  }

  async function fetchCatalog() {
    const urls = [];
    if (window.STUDYHUB_CONFIG.liveCatalogUrl) {
      urls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
    }
    urls.push(window.STUDYHUB_CONFIG.fallbackCatalogUrl);

    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) return await res.json();
      } catch (_) {}
    }

    if (window.STUDYHUB_CONFIG.webappUrl) {
      return await jsonp(window.STUDYHUB_CONFIG.webappUrl + '?action=catalog');
    }

    throw new Error('Catalog unavailable');
  }

  function getField(item, ...keys) {
    for (const k of keys) {
      if (item && item[k] !== undefined && item[k] !== null) {
        return item[k];
      }
    }
    return '';
  }

  function cardMarkup(item, featured) {
    const sku = String(getField(item, 'sku', 'SKU'));
    const type = String(getField(item, 'bundle_type', 'type') || 'Bundle');
    const subject = String(getField(item, 'subject_or_all') || 'ALL');
    const grade = String(getField(item, 'grade') || '');
    const years = String(getField(item, 'year_or_range') || '');
    const papers = Number(getField(item, 'file_count') || 0);
    const price = moneyZar(getField(item, 'price_cents'));
    const desc = String(getField(item, 'description') || '');

    return `
      <article class="card-surface ${featured ? 'featured-card' : ''}">
        <span class="card-tag">${esc(featured ? 'Featured' : type)}</span>
        <h3>${esc(sku)}</h3>
        <div class="badge-row">
          ${grade ? `<span class="badge">Grade ${esc(grade)}</span>` : ''}
          <span class="badge">${esc(subject)}</span>
          ${years ? `<span class="badge">${esc(years)}</span>` : ''}
        </div>
        <p>${esc(desc)}</p>
        <ul><li>Papers included: ${papers}</li></ul>
        <div class="price-chip">${price}</div>
        <div class="card-actions">
          <a class="btn btn-secondary" href="package.html?sku=${encodeURIComponent(sku)}">View details</a>
          <a class="btn btn-primary" href="checkout.html?sku=${encodeURIComponent(sku)}">Buy package</a>
        </div>
      </article>`;
  }

  function applyFilters() {
    const type = filterType?.value || 'ALL';
    const subject = filterSubject?.value || 'ALL';
    const term = (searchInput?.value || '').toLowerCase();

    const filtered = catalogItems.filter(i => {
      const t = String(getField(i, 'bundle_type') || 'Bundle');
      const s = String(getField(i, 'subject_or_all') || 'ALL');
      const blob = (t + ' ' + s + ' ' + getField(i, 'sku') + ' ' + getField(i, 'description')).toLowerCase();
      return (type === 'ALL' || t === type)
        && (subject === 'ALL' || s === subject)
        && (!term || blob.includes(term));
    });

    cardsRoot.innerHTML = filtered.length
      ? filtered.map(i => cardMarkup(i, false)).join('')
      : '<article class="card-surface"><h3>No matches</h3></article>';
  }

  async function load() {
    try {
      const data = await fetchCatalog();
      catalogItems = data.items || [];

      metaEl.textContent = `Loaded ${catalogItems.length} bundles`;
      metaEl.classList.add('status-ok');

      cardsRoot.innerHTML = catalogItems.map(i => cardMarkup(i, false)).join('');

      filterType?.addEventListener('change', applyFilters);
      filterSubject?.addEventListener('change', applyFilters);
      sortBy?.addEventListener('change', applyFilters);
      searchInput?.addEventListener('input', applyFilters);

    } catch (e) {
      metaEl.textContent = 'Catalog could not be loaded';
      metaEl.classList.add('status-error');
    }
  }

  load();
})();
