window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {};
window.STUDYHUB_CONFIG.fallbackCatalogUrl = window.STUDYHUB_CONFIG.fallbackCatalogUrl || 'data/catalog.sample.json';
window.STUDYHUB_CONFIG.liveCatalogUrl = window.STUDYHUB_CONFIG.liveCatalogUrl || '';
window.STUDYHUB_CONFIG.apiBaseUrl = window.STUDYHUB_CONFIG.apiBaseUrl || '';
window.STUDYHUB_CONFIG.contactMode = window.STUDYHUB_CONFIG.contactMode || 'placeholder';

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
  throw new Error(errors.join('
'));
}

function inferGradeFromSku(sku) {
  const m = String(sku || '').match(/SH-G(\d{1,2})-/i);
  return m && m[1] ? m[1] : '';
}

function normalizeCatalogItem(item) {
  const sku = item.SKU || item.sku || '';
  const title = item.Title || item.title || sku || 'Package';
  const type = item.Bundle_Type || item.bundle_type || item.type || 'Package';
  const subject = item.Subject_Name || item.subject_name || item.subject_or_all || 'ALL';
  const province = item.Province_Filter || item.province_filter || item.province || 'ALL';
  const yearRange = item.year_or_range || item.Year_Range || '';
  const fileCount = Number(item.Included_File_Count || item.included_file_count || item.file_count || 0);
  const priceCents = Number(item.Price_Cents || item.price_cents || 0);
  const notes = item.Notes || item.notes || item.description || '';
  const driveUrl = item.Drive_Url || item.driveUrl || '';
  const deliveryUrl = item.Delivery_Url || item.deliveryUrl || '';
  let fromYear = item.Coverage_From_Year || item.coverage_from_year || '';
  let toYear = item.Coverage_To_Year || item.coverage_to_year || '';
  if ((!fromYear || !toYear) && /^\d{4}-\d{4}$/.test(String(yearRange))) {
    const parts = String(yearRange).split('-');
    fromYear = fromYear || parts[0];
    toYear = toYear || parts[1];
  }
  if (!fromYear && /^\d{4}$/.test(String(yearRange))) fromYear = yearRange;
  if (!toYear && /^\d{4}$/.test(String(yearRange))) toYear = yearRange;
  return { raw: item, sku, title, type, subject, province, yearRange, fromYear: fromYear || '—', toYear: toYear || '—', fileCount, priceCents, notes, driveUrl, deliveryUrl, grade: inferGradeFromSku(sku) };
}

function moneyZar(item) {
  const cents = Number(item.priceCents || item.Price_Cents || item.price_cents || 0);
  if (!cents) return 'Price not set';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(cents / 100);
}

function buyPlaceholder(sku) {
  const target = `checkout.html?sku=${encodeURIComponent(sku)}`;
  window.location.href = target;
}

function downloadPlaceholder(sku) {
  alert(`Delivery is linked to a paid order. Open checkout for ${sku} to proceed.`);
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

function featuredScore(item) {
  let score = item.fileCount || 0;
  if (item.type === 'Ultimate Bundle') score += 1000;
  if (item.type === 'Master Bundle') score += 300;
  if ((item.subject || '').toUpperCase().includes('ENGLISH')) score += 50;
  return score;
}

function formatCard(item, featured = false) {
  const tag = featured ? 'Featured package' : item.type;
  const wrapperClass = featured ? 'featured-card card-surface' : 'card-surface';
  return `
  <article class="${wrapperClass}">
    <span class="card-tag">${tag}</span>
    <h3>${item.title}</h3>
    <p class="product-note">${item.sku}</p>
    <div class="badge-row">
      <span class="badge">Grade ${item.grade || '—'}</span>
      <span class="badge">${item.subject}</span>
      <span class="badge">${item.province}</span>
    </div>
    <p>${item.notes || 'StudyHub bundle from the live catalog.'}</p>
    <ul>
      <li>From year: ${item.fromYear}</li>
      <li>To year: ${item.toYear}</li>
      <li>Files counted: ${item.fileCount}</li>
    </ul>
    <div class="price-chip">${moneyZar(item)}</div>
    <div class="card-actions">
      <a class="btn btn-secondary" href="package.html?sku=${encodeURIComponent(item.sku)}">View details</a>
      <button class="btn btn-primary" type="button" onclick="buyPlaceholder('${item.sku.replace(/'/g, "\'")}')">Buy package</button>
      <button class="btn btn-ghost" type="button" onclick="downloadPlaceholder('${item.sku.replace(/'/g, "\'")}')">Download later</button>
    </div>
  </article>`;
}

function uniqueSorted(list) {
  return [...new Set(list.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function populateFilters(items) {
  const types = uniqueSorted(items.map(i => i.type));
  const provinces = uniqueSorted(items.map(i => i.province));
  const subjects = uniqueSorted(items.map(i => i.subject));
  if (filterType) filterType.innerHTML = '<option value="ALL">All types</option>' + types.map(v => `<option value="${v}">${v}</option>`).join('');
  if (filterProvince) filterProvince.innerHTML = '<option value="ALL">All provinces</option>' + provinces.map(v => `<option value="${v}">${v}</option>`).join('');
  if (filterSubject) filterSubject.innerHTML = '<option value="ALL">All subjects</option>' + subjects.map(v => `<option value="${v}">${v}</option>`).join('');
}

function sortItems(items) {
  const mode = sortBy ? sortBy.value : 'featured';
  const copy = [...items];
  if (mode === 'priceAsc') copy.sort((a, b) => a.priceCents - b.priceCents);
  else if (mode === 'priceDesc') copy.sort((a, b) => b.priceCents - a.priceCents);
  else if (mode === 'filesDesc') copy.sort((a, b) => b.fileCount - a.fileCount);
  else if (mode === 'nameAsc') copy.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  else copy.sort((a, b) => featuredScore(b) - featuredScore(a));
  return copy;
}

function renderFeatured(items) {
  if (!featuredRoot) return;
  const featured = [...items].sort((a, b) => featuredScore(b) - featuredScore(a)).slice(0, 3);
  featuredRoot.innerHTML = featured.map(item => formatCard(item, true)).join('');
}

function applyFilters() {
  const type = filterType ? filterType.value : 'ALL';
  const province = filterProvince ? filterProvince.value : 'ALL';
  const subject = filterSubject ? filterSubject.value : 'ALL';
  const term = ((searchInput && searchInput.value) || '').trim().toLowerCase();

  let filtered = catalogItems.filter(item => {
    const textBlob = [item.sku, item.title, item.subject, item.province, item.type, item.notes, `Grade ${item.grade}`].join(' ').toLowerCase();
    if (type !== 'ALL' && item.type !== type) return false;
    if (province !== 'ALL' && item.province !== province) return false;
    if (subject !== 'ALL' && item.subject !== subject) return false;
    if (term && !textBlob.includes(term)) return false;
    return true;
  });

  filtered = sortItems(filtered);
  cardsRoot.innerHTML = filtered.length
    ? filtered.map(item => formatCard(item, false)).join('')
    : '<article class="card-surface"><h3>No matches</h3><p>Try a different search, sort, or filter combination.</p></article>';
}

async function loadCatalog() {
  try {
    const { payload, source } = await fetchStudyHubCatalog();
    const items = payload.items || payload.packages || [];
    catalogItems = items.map(normalizeCatalogItem);
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

if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(contactForm).entries());
    if (!window.STUDYHUB_CONFIG.apiBaseUrl) {
      alert('Contact placeholder captured locally. Set apiBaseUrl to activate backend contact logging later.');
      return;
    }
    try {
      const res = await fetch(window.STUDYHUB_CONFIG.apiBaseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'contact', ...data })
      });
      if (!res.ok) throw new Error('Request failed');
      alert('Message sent.');
      contactForm.reset();
    } catch {
      alert('Contact endpoint is not active yet.');
    }
  });
}

try {
  document.querySelectorAll('[data-search]').forEach(btn => {
    btn.addEventListener('click', () => {
      const term = btn.getAttribute('data-search') || '';
      if (searchInput) {
        searchInput.value = term;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const target = document.getElementById('packages');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
} catch (e) {}

loadCatalog();
