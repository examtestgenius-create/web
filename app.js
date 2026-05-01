// StudyHub app.js (Go-Live)
window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {
  liveCatalogUrl: '',
  fallbackCatalogUrl: 'data/catalog.sample.json',
  apiBaseUrl: ''
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

function moneyZarFromCents(cents) {
  const n = Number(cents || 0);
  if (!n) return 'Price not set';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n / 100);
}

function itemSku(item){ return String(item.sku || item.SKU || ''); }
function itemType(item){ return String(item.bundle_type || item.Bundle_Type || item.type || 'Bundle'); }
function itemGrade(item){ return String(item.grade || item.Grade || '').trim(); }
function itemSubject(item){ return String(item.subject_or_all || item.Subject_Name || 'ALL'); }
function itemYear(item){ return String(item.year_or_range || item.Year || ''); }

// ✅ FIXED: convert file_count (paper+memo) into paper count
function itemPapers(item){
  // Prefer a true paper_count if backend ever provides it
  const paperCount = item.paper_count ?? item.papers;
  if (paperCount !== undefined && paperCount !== null && String(paperCount).trim() !== '') {
    return Number(paperCount || 0);
  }

  // Fallback to file count; memos are ALWAYS included => 2 files per paper
  const fileCount = item.file_count ?? item.Included_File_Count ?? item.included_file_count;
  const n = Number(fileCount || 0);
  return Math.round(n / 2);
}

function buyNow(sku){
  window.location.href = `checkout.html?sku=${encodeURIComponent(sku)}`;
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

let catalogItems = [];

function uniqueSorted(list){
  return [...new Set((list || []).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)));
}

function formatCard(item, featured=false){
  const sku = itemSku(item);
  const type = itemType(item);
  const grade = itemGrade(item);
  const subject = itemSubject(item);
  const year = itemYear(item);
  const papers = itemPapers(item);
  const price = moneyZarFromCents(item.price_cents || item.Price_Cents);

  const tag = featured ? 'Featured bundle' : type;
  const wrapperClass = featured ? 'featured-card card-surface' : 'card-surface';

  return `
    <article class="${wrapperClass}">
      <span class="card-tag">${tag}</span>
      <h3>${sku}</h3>
      <div class="badge-row">
        ${grade ? `<span class="badge">Grade ${grade}</span>` : ''}
        <span class="badge">${subject}</span>
        ${year ? `<span class="badge">${year}</span>` : ''}
      </div>
      <p>${(item.description || '').split('\n')[0] || 'Exam paper bundle with memos included.'}</p>
      <ul>
        <li>Papers included: ${papers}</li>
        <li>Memo included with every paper</li>
      </ul>
      <div class="price-chip">${price}</div>
      <div class="card-actions">
        <a class="btn btn-secondary" href="package.html?sku=${encodeURIComponent(sku)}">View details</a>
        <button class="btn btn-primary" type="button" onclick="buyNow('${sku.replace(/'/g, "\\'")}')">Buy</button>
      </div>
    </article>
  `;
}

function populateFilters(items){
  const types = uniqueSorted(items.map(i => itemType(i)));
  const subjects = uniqueSorted(items.map(i => itemSubject(i)));
  // Province may not exist in v2 catalog. Keep dropdown but default to ALL.
  const provinces = uniqueSorted(items.map(i => i.province || i.province_filter || i.Province_Filter || 'ALL'));

  if (filterType) {
    filterType.innerHTML =
      '<option value="ALL">All types</option>' +
      types.map(v => `<option value="${v}">${v}</option>`).join('');
  }

  if (filterSubject) {
    filterSubject.innerHTML =
      '<option value="ALL">All subjects</option>' +
      subjects.map(v => `<option value="${v}">${v}</option>`).join('');
  }

  if (filterProvince) {
    filterProvince.innerHTML =
      '<option value="ALL">All provinces</option>' +
      provinces.map(v => `<option value="${v}">${v}</option>`).join('');
  }
}

function sortItems(items){
  const mode = sortBy ? sortBy.value : 'featured';
  const copy = [...items];

  if (mode === 'priceAsc') copy.sort((a,b) => Number(a.price_cents || 0) - Number(b.price_cents || 0));
  else if (mode === 'priceDesc') copy.sort((a,b) => Number(b.price_cents || 0) - Number(a.price_cents || 0));
  else if (mode === 'filesDesc') copy.sort((a,b) => itemPapers(b) - itemPapers(a)); // label is Papers
  else if (mode === 'nameAsc') copy.sort((a,b) => itemSku(a).localeCompare(itemSku(b)));
  else copy.sort((a,b) => itemPapers(b) - itemPapers(a));

  return copy;
}

function renderFeatured(items){
  if (!featuredRoot) return;
  const featured = [...items].sort((a,b) => itemPapers(b) - itemPapers(a)).slice(0, 3);
  featuredRoot.innerHTML = featured.map(i => formatCard(i, true)).join('');
}

function applyFilters(){
  const type = filterType ? filterType.value : 'ALL';
  const province = filterProvince ? filterProvince.value : 'ALL';
  const subject = filterSubject ? filterSubject.value : 'ALL';
  const term = (searchInput ? searchInput.value : '').trim().toLowerCase();

  let filtered = catalogItems.filter(item => {
    const itemTypeVal = itemType(item);
    const itemProvinceVal = String(item.province || item.province_filter || item.Province_Filter || 'ALL');
    const itemSubjectVal = itemSubject(item);

    const textBlob = [
      itemSku(item),
      itemSubjectVal,
      itemProvinceVal,
      itemTypeVal,
      item.description || ''
    ].join(' ').toLowerCase();

    if (type !== 'ALL' && itemTypeVal !== type) return false;
    if (province !== 'ALL' && itemProvinceVal !== province) return false;
    if (subject !== 'ALL' && itemSubjectVal !== subject) return false;
    if (term && !textBlob.includes(term)) return false;
    return true;
  });

  filtered = sortItems(filtered);

  if (cardsRoot) {
    cardsRoot.innerHTML = filtered.length
      ? filtered.map(i => formatCard(i, false)).join('')
      : '<article class="card-surface"><h3>No matches</h3><p>Try a different search or filter.</p></article>';
  }
}

async function loadCatalog(){
  try {
    const { payload, source } = await fetchStudyHubCatalog();
    catalogItems = payload.items || payload.packages || [];

    const generated = payload.generated_at || payload.generatedAt || 'Unknown';
    const sourceLabel = source === window.STUDYHUB_CONFIG.fallbackCatalogUrl ? 'fallback sample data' : 'live catalog';

    if (metaEl) {
      metaEl.textContent = `Loaded ${catalogItems.length} bundles from ${sourceLabel}. Generated: ${generated}`;
      metaEl.classList.add('status-ok');
    }

    populateFilters(catalogItems);
    renderFeatured(catalogItems);
    applyFilters();
  } catch (err) {
    if (metaEl) {
      metaEl.textContent = 'Catalog could not be loaded.';
      metaEl.classList.add('status-error');
    }
    if (cardsRoot) {
      cardsRoot.innerHTML = '<article class="card-surface"><h3>Catalog unavailable</h3><p>Check your live catalog URL in config.js.</p></article>';
    }
    if (featuredRoot) featuredRoot.innerHTML = '';
    console.error(err);
  }
}

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

// Quick-pick buttons
try {
  document.querySelectorAll('[data-search]').forEach(btn => {
    btn.addEventListener('click', () => {
      const term = btn.getAttribute('data-search') || '';
      if (searchInput){
        searchInput.value = term;
        searchInput.dispatchEvent(new Event('input', { bubbles:true }));
      }
      const target = document.getElementById('packages');
      if (target) target.scrollIntoView({ behavior:'smooth' });
    });
  });
} catch(e) {}

loadCatalog();
