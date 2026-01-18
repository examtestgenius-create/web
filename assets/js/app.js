/* ExamTestGenius front-end app (Google Sheet catalog + PayFast checkout)
 * Catalog is served from Apps Script Web App using doGet(mode=catalog).
 */

const CFG = {
  site: {
    supportEmail: 'examtestgenius@gmail.com',
    whatsappE164: '+27785766306',
    whatsappDigits: '27785766306'
  },
  payfast: {
    environment: 'live',
    merchant_id: '33250069',
    merchant_key: '1qwkh8wrtemwh',
    notify_url: 'https://script.google.com/macros/s/AKfycbxc0GRBKGyiSp3U4oeRIa5z-ZSlC0piN_kTfEhvfL7KucgBWVOwPqJUKUJTpNtvmm_g/exec',
    return_url: 'https://examtestpaper.co.za/thankyou.html',
    cancel_url: 'https://examtestpaper.co.za/cancel.html'
  },
  api: {
    appsScriptExec: 'https://script.google.com/macros/s/AKfycbxc0GRBKGyiSp3U4oeRIa5z-ZSlC0piN_kTfEhvfL7KucgBWVOwPqJUKUJTpNtvmm_g/exec',
    catalogMode: 'catalog',
    catalogKey: ''
  }
};

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const params = new URLSearchParams(location.search);

function formatZAR(n) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 }).format(n);
}

function toE164(waInput) {
  let n = (waInput || '').replace(/[^\d+]/g, '');
  if (n.startsWith('0')) n = '+27' + n.slice(1);
  if (!n.startsWith('+')) n = '+27' + n;
  return n;
}

function payfastProcessUrl() {
  return (CFG.payfast.environment === 'sandbox')
    ? 'https://sandbox.payfast.co.za/eng/process'
    : 'https://www.payfast.co.za/eng/process';
}

async function fetchCatalog() {
  const url = new URL(CFG.api.appsScriptExec);
  url.searchParams.set('mode', CFG.api.catalogMode);
  if (CFG.api.catalogKey) url.searchParams.set('key', CFG.api.catalogKey);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error('Catalog fetch failed: ' + res.status);
  return await res.json();
}

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

async function initCatalog() {
  const listEl = $('#catalog-list');
  if (!listEl) return;
  const noteEl = $('#catalog-note');
  noteEl.textContent = 'Loading…';
  let data;
  try { data = await fetchCatalog(); } catch (e) { noteEl.textContent = 'Could not load catalog. Please try again later.'; console.error(e); return; }
  const bundles = data.bundles || [];
  noteEl.textContent = `Loaded ${'${'}bundles.length} packs.`;

  const gradeSel = $('select[data-filter="grade"]');
  const subjSel  = $('select[data-filter="subject"]');
  const yearSel  = $('select[data-filter="year"]');
  const termSel  = $('select[data-filter="term"]');

  const subjects = uniq(bundles.map(b => String(b.subject||'')));
  const years = uniq(bundles.map(b => String(b.year||'')));

  function fill(sel, values, current) {
    if (!sel) return;
    const keepFirst = sel.querySelector('option[value=""]');
    sel.innerHTML = '';
    if (keepFirst) sel.appendChild(keepFirst);
    values.sort().forEach(v => { const o=document.createElement('option'); o.value=v; o.textContent=v; sel.appendChild(o); });
    if (current) sel.value = current;
  }

  fill(subjSel, subjects, params.get('subject')||'');
  fill(yearSel, years, params.get('year')||'');
  if (gradeSel && params.get('grade')) gradeSel.value = params.get('grade');
  if (termSel && params.get('term')) termSel.value = params.get('term');

  const state = { grade: params.get('grade')||'', subject: params.get('subject')||'', year: params.get('year')||'', term: params.get('term')||'' };

  $$('select[data-filter]').forEach(sel => {
    const key = sel.getAttribute('data-filter');
    sel.addEventListener('change', () => {
      state[key] = sel.value;
      render();
      const p = new URLSearchParams(state);
      for (const k of [...p.keys()]) if (!p.get(k)) p.delete(k);
      history.replaceState({}, '', location.pathname + (p.toString() ? '?' + p.toString() : ''));
    });
  });

  function matches(b) {
    return (!state.grade || String(b.grade) === String(state.grade))
      && (!state.subject || String(b.subject) === String(state.subject))
      && (!state.year || String(b.year) === String(state.year))
      && (!state.term || String(b.term) === String(state.term));
  }

  function cardHTML(b) {
    const price = (typeof b.price === 'number') ? formatZAR(b.price) : 'R—';
    const href = `product.html?sku=${'${'}encodeURIComponent(b.sku)}`;
    const count = (b.items||[]).length;
    return `
      <a class="card" href="${'${'}href}">
        <strong>${'${'}b.title}</strong>
        <div class="note">Grade ${'${'}b.grade} • ${'${'}b.subject} • ${'${'}b.year} • Term ${'${'}b.term} • ${'${'}count} files</div>
        <div class="pill blue" style="margin-top:10px">${'${'}price}</div>
      </a>
    `;
  }

  function render() {
    const filtered = bundles.filter(matches);
    listEl.innerHTML = filtered.map(cardHTML).join('') || `<div class="note">No results for the current filter.</div>`;
  }

  render();
}

async function initProduct() {
  const skuEl = $('#sku');
  if (!skuEl) return;
  const form = document.querySelector('form[action*="payfast"]');
  if (!form) return;

  form.setAttribute('action', payfastProcessUrl());
  form.querySelector('input[name="merchant_id"]').value = CFG.payfast.merchant_id;
  form.querySelector('input[name="merchant_key"]').value = CFG.payfast.merchant_key;
  form.querySelector('input[name="return_url"]').value = CFG.payfast.return_url;
  form.querySelector('input[name="cancel_url"]').value = CFG.payfast.cancel_url;
  form.querySelector('input[name="notify_url"]').value = CFG.payfast.notify_url;

  const sku = params.get('sku') || '';
  skuEl.textContent = sku;
  const mp = form.querySelector('input[name="m_payment_id"]');
  if (mp) mp.value = sku;

  let data;
  try { data = await fetchCatalog(); } catch (e) { console.error(e); form.querySelector('button[type="submit"]').disabled = true; return; }

  const bundle = (data.bundles||[]).find(b => b.sku === sku);
  const itemName = form.querySelector('input[name="item_name"]');
  const amount = form.querySelector('input[name="amount"]');

  if (!bundle) { itemName.value='Unknown item'; amount.value='0.00'; form.querySelector('button[type="submit"]').disabled=true; return; }

  itemName.value = bundle.title;
  amount.value = (typeof bundle.price === 'number' ? bundle.price : 0).toFixed(2);

  const fieldEmail = form.querySelector('input[name="email_address"]');
  const fieldWhatsApp = form.querySelector('input[name="custom_str1"]');

  form.addEventListener('submit', (e) => {
    fieldWhatsApp.value = toE164(fieldWhatsApp.value);
    if (!fieldEmail.value || !fieldWhatsApp.value) { e.preventDefault(); alert('Please enter a valid email and WhatsApp number.'); }
  });
}

window.addEventListener('DOMContentLoaded', () => { initCatalog(); initProduct(); });
