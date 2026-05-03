// StudyHub catalog (loads index.json and renders filterable cards)
let ALL_PRODUCTS = [];
const qs = new URLSearchParams(location.search);

function money(cents) { return `R${Math.round(cents/100)}`; }

function label(p) {
  if (p.bundle_type === 'PP') return `Paper ${p.paper_type || ''} • ${p.year_or_range || p.year || ''}`.trim();
  if (p.bundle_type === 'SS') return `All papers • ${p.year_or_range || p.year || ''}`.trim();
  if (p.bundle_type === 'MB') return `All years (2022+)`;
  if (p.bundle_type === 'UB') return `All subjects • 2022+`;
  return '';
}

function title(p) {
  const g = p.grade ? `Grade ${p.grade}` : '';
  const s = p.subject ? p.subject : (p.subject_code === 'ALL' ? 'All Subjects' : '');
  const yr = p.year_or_range || p.year || '';
  if (p.bundle_type === 'UB') return `${g} Ultimate (2022+)`;
  if (p.bundle_type === 'MB') return `${g} ${s} Master (2022+)`;
  if (p.bundle_type === 'SS') return `${g} ${s} ${yr}`;
  if (p.bundle_type === 'PP') return `${g} ${s} ${p.paper_type || ''} ${yr}`.trim();
  return p.sku;
}

function populateDropdown(id, values) {
  const sel = document.getElementById(id);
  const existing = new Set([...sel.options].map(o => o.value));
  values.forEach(v => {
    if (!v || existing.has(v)) return;
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

function render(items) {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '';
  document.getElementById('catalogSummary').textContent = `${items.length} product(s) found.`;

  items.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product';
    card.innerHTML = `
      <h3>${title(p)}</h3>
      <p class="meta">${label(p)}</p>
      <div class="row">
        <div class="price">${money(p.price_cents)}</div>
        <a class="btn btn-primary" href="checkout.html?sku=${encodeURIComponent(p.sku)}">Buy</a>
      </div>
      <p class="meta">SKU: ${p.sku}</p>
    `;
    grid.appendChild(card);
  });
}

function getFiltered() {
  const grade = document.getElementById('gradeFilter').value;
  const subject = document.getElementById('subjectFilter').value;
  const pkg = document.getElementById('packageFilter').value;
  const year = document.getElementById('yearFilter').value;

  return ALL_PRODUCTS.filter(p =>
    (!grade || String(p.grade) === grade) &&
    (!subject || (p.subject || '') === subject) &&
    (!pkg || p.bundle_type === pkg) &&
    (!year || String(p.year_or_range || p.year || '') === year)
  );
}

function wireFilters() {
  document.querySelectorAll('.filters select').forEach(el => el.addEventListener('change', () => render(getFiltered())));
  document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('gradeFilter').value = '';
    document.getElementById('subjectFilter').value = '';
    document.getElementById('packageFilter').value = '';
    document.getElementById('yearFilter').value = '';
    render(ALL_PRODUCTS);
  });
}

fetch('index.json', {cache:'no-store'})
  .then(r => r.json())
  .then(data => {
    ALL_PRODUCTS = data.products || [];

    populateDropdown('subjectFilter', [...new Set(ALL_PRODUCTS.map(p => p.subject).filter(Boolean))].sort());
    populateDropdown('yearFilter', [...new Set(ALL_PRODUCTS.map(p => String(p.year_or_range || p.year || '')).filter(Boolean))].sort());

    if (qs.get('bundle')) document.getElementById('packageFilter').value = qs.get('bundle');

    wireFilters();
    render(getFiltered());
  })
  .catch(() => {
    document.getElementById('catalogSummary').textContent = 'Could not load index.json. Add a sample index.json or run the generator.';
  });
