// app.js – FIXED catalog loader
console.log('app.js READY');

const statusEl = document.getElementById('catalogMeta') ||
                 document.querySelector('[data-catalog-status]');
const cardsRoot = document.getElementById('packageCards');

async function fetchCatalog() {
  const url = window.STUDYHUB_CONFIG.liveCatalogUrl ||
              window.STUDYHUB_CONFIG.fallbackCatalogUrl;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Catalog fetch failed');
  return res.json();
}

function money(cents) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR'
  }).format((Number(cents || 0)) / 100);
}

function renderCards(items) {
  cardsRoot.innerHTML = items.map(item => `
    <article class="card-surface">
      <span class="card-tag">Bundle</span>
      <h3>${item.sku}</h3>
      <p>${item.description || 'Exam paper bundle with memos included.'}</p>
      <ul>
        <li>Papers: ${item.file_count || item.paper_count || 0}</li>
        <li>Includes question paper + memo</li>
      </ul>
      <div class="price-chip">${money(item.price_cents)}</div>
      <div class="card-actions">
        <button
          class="btn btn-primary"
          onclick="location.href='checkout    </div>
    </article>
  `).join('');
}

async function loadCatalog() {
  try {
    if (statusEl) statusEl.textContent = 'Loading catalog…';

    const data = await fetchCatalog();
    const items = data.items || data.packages || [];

    if (!items.length) {
      statusEl.textContent = 'No bundles available.';
      return;
    }

    if (statusEl) statusEl.textContent = `Loaded ${items.length} bundles`;
    renderCards(items);

  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = 'Catalog could not be loaded.';
    cardsRoot.innerHTML = `
      <article class="card-surface">
        <h3>Error</h3>
        <p>Unable to load catalog. Please try again later.</p>
      </article>
    `;
  }
}

loadCatalog();
