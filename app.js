
window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {
  liveCatalogUrl: '',
  fallbackCatalogUrl: 'data/catalog.sample.json',
  apiBaseUrl: '',
  contactMode: 'placeholder'
};

async function fetchStudyHubCatalog() {
  const tryUrls = [];
  if (window.STUDYHUB_CONFIG.liveCatalogUrl) tryUrls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
  tryUrls.push(window.STUDYHUB_CONFIG.fallbackCatalogUrl);
  const errors = [];
  for (const url of tryUrls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      return { payload, source: url, errors };
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }
  throw new Error(errors.join('\n'));
}

function moneyZar(item) {
  const cents = Number(item.Price_Cents || item.price_cents || 0);
  if (!cents) return 'Price not set';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(cents / 100);
}

function buyPlaceholder(sku) {
  const target = `checkout.html?sku=${encodeURIComponent(sku)}`;
  window.location.href = target;
}

function addToBasket(sku) {
  try { if (window.StudyHubCart) StudyHubCart.add(sku); } catch(e) {}
  alert('Added to basket');
}

function downloadPlaceholder(sku) {
  alert(`Download placeholder for ${sku}. Connect final delivery/download logic here later.`);
}

const metaEl = document.getElementById('catalogMeta');
const cardsRoot = document.getElementById('packageCards');
const featuredRoot = document.getElementById('featuredCards');
const filterType = document.getElementById('filterType');
const filterProvince = document.getElementById('filterProvince');
const filterSubject = document.getElementById('filterSubject');
const sortBy = document.getElementById('sortBy');
const clearFilters = document.getElementById('clearFilters');
const searchInput = document.getElementById('searchInput');
const contactForm = document.getElementById('contactForm');
let catalogItems = [];

function numericValue(v) { return Number(v || 0); }
function featuredScore(item) {
  const sku = String(item.SKU || item.sku || '');
  const type = String(item.Bundle_Type || item.bundle_type || '');
  const files = numericValue(item.Included_File_Count || item.included_file_count || 0);
  let score = files;
  if (type === 'Full Package') score += 1000;
  if (type === 'Subject Package') score += 200;
  if (sku.includes('WC') || sku.includes('ENG')) score += 50;
  return score;
}

function formatCard(item, featured=false) {
  const count = item.Included_File_Count || item.included_file_count || 0;
  const province = item.Province_Filter || item.province_filter || 'ALL';
  const subject = item.Subject_Name || item.subject_name || 'ALL';
  const type = item.Bundle_Type || item.bundle_type || item.type || 'Package';
  const sku = item.SKU || item.sku || '';
  const notes = item.Notes || item.notes || '';
  const tag = featured ? 'Featured package' : type;
  const wrapperClass = featured ? 'featured-card card-surface' : 'card-surface';
  return `
    <article class="${wrapperClass}">
      <span class="card-tag">${tag}</span>
      <h3>${sku || type}</h3>
      <div class="badge-row">
        <span class="badge">${subject}</span>
        <span class="badge">${province}</span>
      </div>
      <p>${notes || 'Metadata-driven package generated from the StudyHub library.'}</p>
      <ul>
        <li>From year: ${item.Coverage_From_Year || item.coverage_from_year || 2022}</li>
        <li>To year: ${item.Coverage_To_Year || item.coverage_to_year || 'Onward'}</li>
        <li>Files counted: ${count}</li>
      </ul>
      <div class="price-chip">${moneyZar(item)}</div>
      <div class="card-actions">
        <a class="btn btn-secondary" href="package.html?sku=${encodeURIComponent(sku)}">View details</a>
        <button class="btn btn-primary" type="button" onclick="buyPlaceholder('${sku.replace(/'/g, "&#39;")}')">Buy package</button>
        <button class="btn btn-secondary" type="button" onclick="addToBasket('${sku.replace(/'/g, "&#39;")}')">Add to basket</button>
        <button class="btn btn-ghost" type="button" onclick="downloadPlaceholder('${sku.replace(/'/g, "&#39;")}')">Download later</button>
      </div>
    </article>
  `;
}

function uniqueSorted(list) { return [...new Set(list.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))); }
function populateFilters(items) {
  const types = uniqueSorted(items.map(i => i.Bundle_Type || i.bundle_type || i.type));
  const provinces = uniqueSorted(items.map(i => i.Province_Filter || i.province_filter || 'ALL'));
  const subjects = uniqueSorted(items.map(i => i.Subject_Name || i.subject_name || 'ALL'));
  filterType.innerHTML = '<option value="ALL">All types</option>' + types.map(v => `<option value="${v}">${v}</option>`).join('');
  filterProvince.innerHTML = '<option value="ALL">All provinces</option>' + provinces.map(v => `<option value="${v}">${v}</option>`).join('');
  filterSubject.innerHTML = '<option value="ALL">All subjects</option>' + subjects.map(v => `<option value="${v}">${v}</option>`).join('');
}
function sortItems(items) {
  const mode = sortBy.value;
  const copy = [...items];
  if (mode === 'priceAsc') copy.sort((a, b) => numericValue(a.Price_Cents) - numericValue(b.Price_Cents));
  else if (mode === 'priceDesc') copy.sort((a, b) => numericValue(b.Price_Cents) - numericValue(a.Price_Cents));
  else if (mode === 'filesDesc') copy.sort((a, b) => numericValue(b.Included_File_Count) - numericValue(a.Included_File_Count));
  else if (mode === 'nameAsc') copy.sort((a, b) => String(a.SKU || '').localeCompare(String(b.SKU || '')));
  else copy.sort((a, b) => featuredScore(b) - featuredScore(a));
  return copy;
}
function renderFeatured(items) {
  const featured = [...items].sort((a, b) => featuredScore(b) - featuredScore(a)).slice(0, 3);
  featuredRoot.innerHTML = featured.map(item => formatCard(item, true)).join('');
}
function applyFilters() {
  const type = filterType.value;
  const province = filterProvince.value;
  const subject = filterSubject.value;
  const term = (searchInput.value || '').trim().toLowerCase();
  let filtered = catalogItems.filter(item => {
    const itemType = item.Bundle_Type || item.bundle_type || item.type || 'Package';
    const itemProvince = item.Province_Filter || item.province_filter || 'ALL';
    const itemSubject = item.Subject_Name || item.subject_name || 'ALL';
    const textBlob = [item.SKU || item.sku || '', itemSubject, itemProvince, itemType, item.Notes || item.notes || ''].join(' ').toLowerCase();
    if (type !== 'ALL' && itemType !== type) return false;
    if (province !== 'ALL' && itemProvince !== province) return false;
    if (subject !== 'ALL' && itemSubject !== subject) return false;
    if (term && !textBlob.includes(term)) return false;
    return true;
  });
  filtered = sortItems(filtered);
  cardsRoot.innerHTML = filtered.length ? filtered.map(item => formatCard(item, false)).join('') : '<article class="card-surface"><h3>No matches</h3><p>Try a different search, sort, or filter combination.</p></article>';
}
async function loadCatalog() {
  try {
    const { payload, source } = await fetchStudyHubCatalog();
    catalogItems = payload.items || payload.packages || [];
    const generated = payload.generatedAt || payload.generated_at || 'Unknown';
    const sourceLabel = source === window.STUDYHUB_CONFIG.fallbackCatalogUrl ? 'fallback sample data' : 'live catalog';
    metaEl.textContent = `Loaded ${catalogItems.length} package rows from ${sourceLabel}. Generated: ${generated}`;
    metaEl.classList.add('status-ok');
    populateFilters(catalogItems);
    renderFeatured(catalogItems);
    applyFilters();
  } catch (err) {
    metaEl.textContent = 'Catalog could not be loaded.';
    metaEl.classList.add('status-error');
    cardsRoot.innerHTML = '<article class="card-surface"><h3>Catalog unavailable</h3><p>Check the live URL or fallback JSON file.</p></article>';
    featuredRoot.innerHTML = '';
    console.error(err);
  }
}
[filterType, filterProvince, filterSubject, sortBy].forEach(el => el && el.addEventListener('change', applyFilters));
if (searchInput) searchInput.addEventListener('input', applyFilters);
if (clearFilters) clearFilters.addEventListener('click', () => {
  filterType.value = 'ALL'; filterProvince.value = 'ALL'; filterSubject.value = 'ALL'; sortBy.value = 'featured'; searchInput.value = ''; applyFilters();
});
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(contactForm).entries());
    if (!window.STUDYHUB_CONFIG.apiBaseUrl) {
      alert('Contact placeholder captured locally. Set apiBaseUrl to activate backend contact logging later.');
      return;
    }
    try {
      const res = await fetch(window.STUDYHUB_CONFIG.apiBaseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'contact', ...data }) });
      if (!res.ok) throw new Error('Request failed');
      alert('Message sent.');
      contactForm.reset();
    } catch {
      alert('Contact endpoint is not active yet.');
    }
  });
}
loadCatalog();


// Quick-pick buttons (grade + subject chips)
try {
  document.querySelectorAll('[data-search]').forEach(btn => {
    btn.addEventListener('click', () => {
      const term = btn.getAttribute('data-search') || '';
      const input = document.getElementById('searchInput');
      if (input) {
        input.value = term;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const target = document.getElementById('packages');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
} catch(e) {}
