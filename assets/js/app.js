/* ExamTestGenius front-end app
   - Catalog rendering + filters
   - Product page population + PayFast form wiring
   - URL deep-linking (grade/subject/term/type/sku)
*/

const CFG = {
  site: {
    baseUrl: 'https://examtestpaper.co.za',
    supportEmail: 'examtestgenius@gmail.com'
  },
  payfast: {
    merchant_id: '33250069',           // LIVE
    merchant_key: '1qwkh8wrtemwh',     // LIVE
    notify_url: 'https://script.google.com/macros/s/AKfycbxc0GRBKGyiSp3U4oeRIa5z-ZSlC0piN_kTfEhvfL7KucgBWVOwPqJUKUJTpNtvmm_g/exec',
    return_url: 'https://examtestpaper.co.za/thankyou.html',
    cancel_url: 'https://examtestpaper.co.za/cancel.html'
  },
  data: {
    catalogUrl: 'assets/data/papers.json'
  }
};

// ---------- Utilities ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const params = new URLSearchParams(location.search);

function formatZAR(n) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 }).format(n);
}

function toE164(waInput) {
  // Normalize WhatsApp number to E.164 (e.g. +2771...)
  let n = (waInput || '').replace(/[^\d+]/g, '');
  if (n.startsWith('0')) n = '+27' + n.slice(1);
  if (!n.startsWith('+')) n = '+27' + n; // assume ZA if local
  return n;
}

// ---------- Catalog page ----------
async function initCatalog() {
  const listEl = $('#catalog-list');
  if (!listEl) return;

  const res = await fetch(CFG.data.catalogUrl, { cache: 'no-store' });
  const items = await res.json();

  const initial = {
    grade: params.get('grade') || '',
    subject: params.get('subject') || '',
    term: params.get('term') || '',
    type: params.get('type') || ''
  };

  $$('select[data-filter]').forEach(sel => {
    const key = sel.getAttribute('data-filter');
    if (initial[key]) sel.value = initial[key];
    sel.addEventListener('change', () => {
      initial[key] = sel.value;
      render();
      const p = new URLSearchParams(initial);
      for (const k of [...p.keys()]) if (!p.get(k)) p.delete(k);
      history.replaceState({}, '', location.pathname + (p.toString() ? '?' + p : ''));
    });
  });

  function matchesFilters(x) {
    return (!initial.grade || x.grade === initial.grade)
        && (!initial.subject || x.subject === initial.subject)
        && (!initial.term || x.term === initial.term)
        && (!initial.type || (x.type || '') === initial.type);
  }

  function cardHTML(x) {
    const price = typeof x.price === 'number' ? formatZAR(x.price) : 'R—';
    const img = x.cover ? `<img src="${x.cover}" alt="${x.title}" loading="lazy">` : '';
    const href = `product.html?sku=${encodeURIComponent(x.sku)}`;
    return `
      <a class="card" href="${href}">
        ${img}
        <strong>${x.title}</strong>
        <div class="note">${x.grade} • ${x.subject}</div>
        <div class="pill price">${price}</div>
      </a>
    `;
  }

  function render() {
    const filtered = items.filter(matchesFilters);
    listEl.innerHTML = filtered.map(cardHTML).join('') || `<div class="note">No results for the current filter.</div>`;
  }

  render();
}

// ---------- Product (checkout) page ----------
async function initProduct() {
  const skuEl = $('#sku');
  if (!skuEl) return;

  const res = await fetch(CFG.data.catalogUrl, { cache: 'no-store' });
  const items = await res.json();

  const sku = params.get('sku');
  const item = items.find(x => x.sku === sku);

  const form = document.querySelector('form[action*="payfast"]');
  const fieldItemName = form.querySelector('input[name="item_name"]');
  const fieldAmount   = form.querySelector('input[name="amount"]');
  const fieldEmail    = form.querySelector('input[name="email_address"]');
  const fieldWhatsApp = form.querySelector('input[name="custom_str1"]');

  form.querySelector('input[name="merchant_id"]').value = CFG.payfast.merchant_id;
  form.querySelector('input[name="merchant_key"]').value = CFG.payfast.merchant_key;
  form.querySelector('input[name="return_url"]').value   = CFG.payfast.return_url;
  form.querySelector('input[name="cancel_url"]').value   = CFG.payfast.cancel_url;
  form.querySelector('input[name="notify_url"]').value   = CFG.payfast.notify_url;

  if (!item) {
    skuEl.textContent = '(unknown item)';
    fieldItemName.value = 'Unknown item';
    fieldAmount.value = '0';
    form.querySelector('button[type="submit"]').disabled = true;
    return;
  }

  skuEl.textContent = item.sku;
  fieldItemName.value = item.title;
  fieldAmount.value = (item.price || 0).toFixed(2);

  form.addEventListener('submit', (e) => {
    fieldWhatsApp.value = toE164(fieldWhatsApp.value);
    if (!fieldEmail.value || !fieldWhatsApp.value) {
      e.preventDefault();
      alert('Please enter a valid email and WhatsApp number.');
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  initCatalog();
  initProduct();
});
