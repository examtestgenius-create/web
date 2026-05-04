const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbyXt4B0uC9UBVQil7DZN_QbxasaiE0BJAU82mdaXGRMtTwzkpJaZdpSOQAPgzo-A1Cu/exec';
let cart = [];
let allPacks = [];
let activeBundleFilter = 'ALL';

const freebies = [
  { title: 'Maths Formula Quick Sheet', body: 'Core formula reminders for test week.', icon: '📘' },
  { title: 'Exam Trap Checklist', body: 'Common mistakes students lose marks on.', icon: '⚠️' },
  { title: '7-Day Revision Plan', body: 'Simple schedule for focused preparation.', icon: '🗓️' },
  { title: 'Study Method Guide', body: 'Active recall, spaced repetition and paper practice.', icon: '🚀' }
];

const fallbackPacks = [
  { sku: 'SH-G12-MATHEMATICS-2024-SS', title: 'Grade 12 Mathematics 2024', bundle_type: 'SINGLE_SUBJECT', grade: 12, subject_or_all: 'Mathematics', year_or_range: '2024', price_cents: 9900, file_count: '—', paper_count: '—' }
];

document.addEventListener('DOMContentLoaded', () => {
  renderFreebies();
  wirePackFilters();
  loadPacks();
  renderCartBar();
});

function renderFreebies() {
  const el = document.getElementById('freeCards');
  if (!el) return;
  el.innerHTML = freebies.map(f => `
    <article class="card">
      <div style="font-size:30px">${f.icon}</div>
      <h3>${esc(f.title)}</h3>
      <p>${esc(f.body)}</p>
      <a class="btn btn-ghost" href="#packs">Use with packs</a>
    </article>
  `).join('');
}

function wirePackFilters() {
  const search = document.getElementById('packSearch');
  const select = document.getElementById('bundleFilter');
  if (search) search.addEventListener('input', renderFilteredPacks);
  if (select) select.addEventListener('change', () => setBundleFilter(select.value));
  document.querySelectorAll('[data-filter]').forEach(btn => btn.addEventListener('click', () => setBundleFilter(btn.dataset.filter)));
}

function setBundleFilter(value) {
  activeBundleFilter = value || 'ALL';
  const select = document.getElementById('bundleFilter');
  if (select) select.value = activeBundleFilter;
  document.querySelectorAll('[data-filter]').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === activeBundleFilter));
  renderFilteredPacks();
}

async function loadPacks() {
  const el = document.getElementById('packCards');
  if (!el) return;
  el.innerHTML = '<div class="card">Loading verified papers...</div>';
  try {
    const r = await fetch(`${BACKEND_URL}?action=catalog`, { cache: 'no-store' });
    const d = await r.json();
    allPacks = (d.ok && d.items && d.items.length) ? d.items.map(normalizePack) : fallbackPacks.map(normalizePack);
  } catch (e) {
    allPacks = fallbackPacks.map(normalizePack);
  }
  renderFilteredPacks();
}

function normalizePack(p) {
  p = p || {};
  p.bundle_type = normalizeBundleType(p.bundle_type);
  if (!p.paper_count && Number.isFinite(Number(p.file_count))) p.paper_count = Math.floor(Number(p.file_count) / 2);
  return p;
}

function normalizeBundleType(v) {
  const s = String(v || '').trim().toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (s === 'SS') return 'SINGLE_SUBJECT';
  if (s === 'SY') return 'SINGLE_YEAR';
  if (s === 'MB') return 'MASTER';
  if (s === 'UB') return 'ULTIMATE';
  if (s === 'PP') return 'PAPER_PAIR';
  return s || '';
}

function renderFilteredPacks() {
  const q = String(document.getElementById('packSearch')?.value || '').toLowerCase().trim();
  const items = allPacks.filter(p => {
    const bundleOk = activeBundleFilter === 'ALL' || p.bundle_type === activeBundleFilter;
    const text = [p.sku, p.title, p.grade, p.subject_or_all, p.year_or_range, p.bundle_type].join(' ').toLowerCase();
    const searchOk = !q || text.includes(q);
    return bundleOk && searchOk;
  });
  renderPacks(items);
  const count = document.getElementById('packCountText');
  if (count) count.textContent = `${items.length} bundle(s) shown`;
}

function renderPacks(packs) {
  const el = document.getElementById('packCards');
  if (!el) return;
  if (!packs.length) {
    el.innerHTML = '<div class="empty-state">No bundles found. Clear the search or choose All bundles.</div>';
    return;
  }
  el.innerHTML = packs.map(card).join('');
  document.querySelectorAll('[data-buy]').forEach(btn => btn.addEventListener('click', () => buy(btn.dataset.buy)));
  document.querySelectorAll('[data-cart]').forEach(btn => btn.addEventListener('click', () => addToCart(btn.dataset.cart)));
}

function card(p) {
  return `
    <article class="pack-card">
      <div class="pack-meta"><span class="tag">Grade ${esc(p.grade)}</span><span class="tag">${esc(fmt(p.bundle_type))}</span></div>
      <h3>${esc(p.title || p.sku)}</h3>
      <p>${esc(desc(p))}</p>
      <div class="price">R ${(Number(p.price_cents || 0) / 100).toFixed(2)}</div>
      <p class="fine">${paperCountLabel(p)} • ZIP delivery after verified payment</p>
      <label class="buy-row"><input type="checkbox" data-accept="${esc(p.sku)}"> <span>I accept the terms and refund policy.</span></label>
      <div class="hero-actions"><button class="btn btn-secondary" data-cart="${esc(p.sku)}">Add to Cart</button><button class="btn btn-primary" data-buy="${esc(p.sku)}">Buy Now</button></div>
    </article>`;
}

function desc(p) {
  if (p.bundle_type === 'SINGLE_SUBJECT') return `${p.subject_or_all} papers and memos for ${p.year_or_range}.`;
  if (p.bundle_type === 'SINGLE_YEAR') return `All available papers and memos for all subjects in ${p.year_or_range}.`;
  if (p.bundle_type === 'MASTER') return `${p.subject_or_all} papers and memos from 2022 onwards.`;
  if (p.bundle_type === 'ULTIMATE') return `All available papers and memos for Grade ${p.grade}.`;
  if (p.bundle_type === 'PAPER_PAIR') return `${p.subject_or_all || 'Selected subject'} paper with memo for ${p.year_or_range}.`;
  return 'Verified paper + memo pack.';
}

function paperCountLabel(p) {
  const count = getPaperCount(p);
  return count === '—' ? 'Papers: —' : `Papers: ${count}`;
}

function getPaperCount(p) {
  if (p.paper_count !== undefined && p.paper_count !== null && p.paper_count !== '') {
    const n = Number(p.paper_count);
    return Number.isFinite(n) ? Math.floor(n) : String(p.paper_count);
  }
  const fileCount = Number(p.file_count);
  if (Number.isFinite(fileCount)) return Math.floor(fileCount / 2);
  return '—';
}

async function buy(sku) {
  const box = document.querySelector(`[data-accept="${CSS.escape(sku)}"]`);
  if (box && !box.checked) return alert('Please accept the terms and refund policy.');
  const email = prompt('Email for ZIP and invoice:');
  if (!validEmail(email)) return alert('Enter a valid email.');
  try {
    const d = await post({ action: 'checkout', sku, email });
    submitPayFast(d.payfast);
  } catch (e) { alert(e.message); }
}

function addToCart(sku) { if (!cart.includes(sku)) cart.push(sku); renderCartBar(); }

function renderCartBar() {
  let b = document.getElementById('cartBar');
  if (!b) {
    b = document.createElement('div');
    b.id = 'cartBar';
    b.className = 'cart-bar';
    b.innerHTML = '<strong id="cartCount">Cart (0)</strong><button class="btn btn-secondary" id="clearCart">Clear</button><button class="btn btn-primary" id="cartCheckout">Checkout Cart</button>';
    document.body.appendChild(b);
    document.getElementById('clearCart').onclick = () => { cart = []; renderCartBar(); };
    document.getElementById('cartCheckout').onclick = checkoutCart;
  }
  document.getElementById('cartCount').textContent = `Cart (${cart.length})`;
  b.classList.toggle('show', cart.length > 0);
}

async function checkoutCart() {
  if (!cart.length) return alert('Cart empty');
  const email = prompt('Email for ZIPs and invoice:');
  if (!validEmail(email)) return alert('Enter a valid email.');
  try {
    const d = await post({ action: 'checkoutCart', skus: cart, email });
    alert(`Bulk discount: R ${(d.pricing.discount_cents / 100).toFixed(2)}
Total: R ${(d.pricing.total_cents / 100).toFixed(2)}`);
    submitPayFast(d.payfast);
  } catch (e) { alert(e.message); }
}

async function post(body) {
  const r = await fetch(BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  const d = await r.json();
  if (!d.ok) throw Error(d.error || 'Request failed');
  return d;
}

function submitPayFast(pf) {
  const f = document.createElement('form');
  f.method = 'POST';
  f.action = pf.process_url;
  Object.entries(pf).forEach(([k, v]) => {
    if (k === 'process_url') return;
    const i = document.createElement('input');
    i.type = 'hidden';
    i.name = k;
    i.value = v;
    f.appendChild(i);
  });
  document.body.appendChild(f);
  f.submit();
}

function validEmail(e) { return e && /\S+@\S+\.\S+/.test(e); }
function fmt(v) { return String(v || '').replaceAll('_', ' ').replace(/\w/g, c => c.toUpperCase()); }
function esc(v) { return String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
