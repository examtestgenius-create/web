(function () {
  async function fetchCatalog() {
    const tryUrls = [];
    if (window.STUDYHUB_CONFIG.liveCatalogUrl) tryUrls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
    tryUrls.push(window.STUDYHUB_CONFIG.fallbackCatalogUrl);
    const errors = [];
    for (const url of tryUrls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const payload = await res.json();
        return { payload, source: url };
      } catch (err) {
        errors.push(url + ': ' + err.message);
      }
    }
    throw new Error(errors.join('
'));
  }

  function moneyZar(cents) {
    const v = Number(cents || 0);
    if (!v) return 'Price on request';
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v / 100);
  }

  function featuredScore(item) {
    let score = Number(item.file_count || 0);
    if (item.bundle_type === 'Ultimate Bundle') score += 1000;
    if (item.bundle_type === 'Master Bundle') score += 500;
    if (item.bundle_type === 'Single Year') score += 250;
    return score;
  }

  function cardMarkup(item, featured) {
    const wrapper = featured ? 'featured-card card-surface' : 'card-surface';
    return `
      <article class="${wrapper}">
        <span class="card-tag">${featured ? 'Featured bundle' : item.bundle_type}</span>
        <h3>${item.title || item.sku}</h3>
        <div class="badge-row">
          <span class="badge">Grade ${item.grade}</span>
          <span class="badge">${item.subject_or_all || 'ALL'}</span>
          <span class="badge">${item.year_or_range || '2022-2026'}</span>
        </div>
        <p>${(item.description || '').split('
')[0] || 'CAPS-aligned exam papers and memos packed for fast study prep.'}</p>
        <div class="price-chip">${moneyZar(item.price_cents)}</div>
        <div class="card-actions">
          <a class="btn btn-secondary" href="package.html?sku=${encodeURIComponent(item.sku)}">View details</a>
          <a class="btn btn-primary" href="checkout.html?sku=${encodeURIComponent(item.sku)}">Buy bundle</a>
        </div>
      </article>
    `;
  }

  const metaEl = document.getElementById('catalogMeta');
  const cardsRoot = document.getElementById('packageCards');
  const featuredRoot = document.getElementById('featuredCards');
  const filterType = document.getElementById('filterType');
  const filterGrade = document.getElementById('filterGrade');
  const filterSubject = document.getElementById('filterSubject');
  const sortBy = document.getElementById('sortBy');
  const clearFilters = document.getElementById('clearFilters');
  const searchInput = document.getElementById('searchInput');
  const contactForm = document.getElementById('contactForm');

  let catalogItems = [];

  function uniqueSorted(list) {
    return [...new Set(list.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  }

  function populateFilters(items) {
    const types = uniqueSorted(items.map(i => i.bundle_type));
    const grades = uniqueSorted(items.map(i => i.grade));
    const subjects = uniqueSorted(items.map(i => i.subject_or_all));
    filterType.innerHTML = '<option value="ALL">All bundle types</option>' + types.map(v => `<option value="${v}">${v}</option>`).join('');
    filterGrade.innerHTML = '<option value="ALL">All grades</option>' + grades.map(v => `<option value="${v}">Grade ${v}</option>`).join('');
    filterSubject.innerHTML = '<option value="ALL">All subjects</option>' + subjects.map(v => `<option value="${v}">${v}</option>`).join('');
  }

  function sortItems(items) {
    const copy = [...items];
    const mode = sortBy.value;
    if (mode === 'priceAsc') copy.sort((a, b) => Number(a.price_cents || 0) - Number(b.price_cents || 0));
    else if (mode === 'priceDesc') copy.sort((a, b) => Number(b.price_cents || 0) - Number(a.price_cents || 0));
    else if (mode === 'filesDesc') copy.sort((a, b) => Number(b.file_count || 0) - Number(a.file_count || 0));
    else if (mode === 'nameAsc') copy.sort((a, b) => String(a.title || a.sku).localeCompare(String(b.title || b.sku)));
    else copy.sort((a, b) => featuredScore(b) - featuredScore(a));
    return copy;
  }

  function renderFeatured(items) {
    const featured = [...items].sort((a, b) => featuredScore(b) - featuredScore(a)).slice(0, 3);
    featuredRoot.innerHTML = featured.map(item => cardMarkup(item, true)).join('');
  }

  function applyFilters() {
    const type = filterType.value;
    const grade = filterGrade.value;
    const subject = filterSubject.value;
    const term = (searchInput.value || '').trim().toLowerCase();
    let filtered = catalogItems.filter(item => {
      const blob = [item.sku, item.title, item.bundle_type, item.grade, item.year_or_range, item.subject_or_all, item.description].join(' ').toLowerCase();
      if (type !== 'ALL' && item.bundle_type !== type) return false;
      if (grade !== 'ALL' && String(item.grade) !== String(grade)) return false;
      if (subject !== 'ALL' && String(item.subject_or_all) !== String(subject)) return false;
      if (term && !blob.includes(term)) return false;
      return true;
    });
    filtered = sortItems(filtered);
    cardsRoot.innerHTML = filtered.length ? filtered.map(i => cardMarkup(i, false)).join('') : '<article class="card-surface"><h3>No matches</h3><p>Try a different search, filter, or sort.</p></article>';
  }

  async function loadCatalog() {
    try {
      const { payload, source } = await fetchCatalog();
      catalogItems = payload.items || [];
      const sourceLabel = source === window.STUDYHUB_CONFIG.fallbackCatalogUrl ? 'fallback sample catalog' : 'live Apps Script catalog';
      metaEl.textContent = `Loaded ${catalogItems.length} products from ${sourceLabel}. Generated: ${payload.generated_at || payload.generatedAt || 'Unknown'}`;
      metaEl.classList.add('status-ok');
      populateFilters(catalogItems);
      renderFeatured(catalogItems);
      applyFilters();
    } catch (err) {
      metaEl.textContent = 'Catalog could not be loaded.';
      metaEl.classList.add('status-error');
      cardsRoot.innerHTML = '<article class="card-surface"><h3>Catalog unavailable</h3><p>Check config.js and your sample catalog file.</p></article>';
      featuredRoot.innerHTML = '';
      console.error(err);
    }
  }

  [filterType, filterGrade, filterSubject, sortBy].forEach(el => el && el.addEventListener('change', applyFilters));
  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (clearFilters) clearFilters.addEventListener('click', () => {
    filterType.value = 'ALL';
    filterGrade.value = 'ALL';
    filterSubject.value = 'ALL';
    sortBy.value = 'featured';
    searchInput.value = '';
    applyFilters();
  });

  document.querySelectorAll('[data-search]').forEach(btn => {
    btn.addEventListener('click', () => {
      searchInput.value = btn.getAttribute('data-search') || '';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('packages').scrollIntoView({ behavior: 'smooth' });
    });
  });

  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(contactForm).entries());
      if (!window.STUDYHUB_CONFIG.apiBaseUrl || window.STUDYHUB_CONFIG.contactMode !== 'api') {
        const body = encodeURIComponent(`Name: ${data.name}
Email: ${data.email}

${data.message || ''}`);
        window.location.href = `mailto:${window.STUDYHUB_CONFIG.supportEmail}?subject=StudyHub enquiry&body=${body}`;
        return;
      }
      try {
        const res = await fetch(window.STUDYHUB_CONFIG.apiBaseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'contact', ...data })
        });
        const out = await res.json();
        if (!res.ok || out.ok === false) throw new Error(out.error || 'Request failed');
        alert('Message sent.');
        contactForm.reset();
      } catch (err) {
        alert('Contact request failed. Falling back to email.');
        const body = encodeURIComponent(`Name: ${data.name}
Email: ${data.email}

${data.message || ''}`);
        window.location.href = `mailto:${window.STUDYHUB_CONFIG.supportEmail}?subject=StudyHub enquiry&body=${body}`;
      }
    });
  }

  loadCatalog();
})();
