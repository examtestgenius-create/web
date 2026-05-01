/* ===============================
   StudyHub Catalog App
   =============================== */

async function fetchStudyHubCatalog() {
  const urls = [];
  if (window.STUDYHUB_CONFIG.liveCatalogUrl) {
    urls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
  }
  urls.push(window.STUDYHUB_CONFIG.fallbackCatalogUrl);

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      return await res.json();
    } catch (e) {}
  }
  throw new Error('Catalog unavailable');
}

function priceZAR(cents) {
  return cents
    ? new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(cents / 100)
    : 'Price not set';
}

function renderBundles(items) {
  const root = document.getElementById('packageCards');
  if (!root) return;

  root.innerHTML = items.map(item => `
    <article class="card-surface">
      <h3>${item.title || item.sku}</h3>
      <p>${item.description || ''}</p>
      <div class="price-chip">${priceZAR(item.price_cents)}</div>
      <button class="btn btn-primary"
        onclick="location.href='checkout.html?sku=${encodeURIComponent`).join('');
}

async function loadCatalog() {
  try {
    const data = await fetchStudyHubCatalog();
    renderBundles(data.items || []);
    const meta = document.getElementById('catalogMeta');
    if (meta) meta.textContent = `Loaded ${data.items.length} bundles`;
  } catch (err) {
    const root = document.getElementById('packageCards');
    if (root) root.innerHTML = '<p>Catalog unavailable</p>';
  }
}

loadCatalog();
