
// StudyHub client – minimal, with PayFast checkout (v2)

// ============================================================
// CONFIG – EDIT THESE
// ============================================================
const cfg = {
  brand: 'StudyHub',
  currency: 'ZAR',

  // WhatsApp number in international format (no +, spaces, or dashes), e.g. '27716816131'
  whatsappNumber: '',

  // LIVE or SANDBOX PayFast mode
  mode: 'live', // 'live' | 'sandbox'

  // Your Apps Script Web App base (no trailing slash). Example:
  // 'https://script.google.com/macros/s/AKfycbw.../exec'
  webAppBase: 'https://script.google.com/macros/s/AKfycbwLzazM5zV41rFJ4d5NzZubstnUB-AYdfriqd9IKjb3ZoS_MmwNrnnR8c93ci5-HkST/exec',

  // Derived endpoints (do not change)
  get catalogEndpoint() { return `${this.webAppBase}?action=catalog`; },
  get signEndpoint()    { return `${this.webAppBase}?action=sign`;    },
  get notify_url()      { return this.webAppBase; },

  // Return/Cancel URLs (client fallbacks; server may override via Script Properties)
  get return_url() { return `${window.location.origin}/cart.html?status=success`; },
  get cancel_url() { return `${window.location.origin}/cart.html?status=cancel`;  },

  // PayFast process URL
  get payfastProcessUrl() {
    return this.mode === 'sandbox'
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process';
  }
};

// ============================================================
// JSONP loader (for Apps Script)
// ============================================================
function loadJsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = 'cb_' + Math.random().toString(36).slice(2);
    const s  = document.createElement('script');

    const timer = setTimeout(() => {
      cleanup(); reject(new Error('JSONP timeout'));
    }, 15000);

    function cleanup() {
      clearTimeout(timer);
      try { delete window[cb]; } catch (_) {}
      s.remove();
    }

    window[cb] = (data) => { cleanup(); resolve(data); };

    const join = url.includes('?') ? '&' : '?';
    s.src = `${url}${join}callback=${cb}`;
    s.onerror = () => { cleanup(); reject(new Error('JSONP load error')); };
    document.body.appendChild(s);
  });
}

// ============================================================
// Helpers
// ============================================================
function formatZAR(cents) {
  const r = (Number(cents || 0) / 100).toFixed(0);
  return `R${r}`;
}
async function loadCatalog() { return loadJsonp(cfg.catalogEndpoint); }
function roundToCents_(rands) { return (Math.round((Number(rands) || 0) * 100) / 100).toFixed(2); }

// ============================================================
// Cart storage + badge
// ============================================================
function getCart() {
  try { return JSON.parse(localStorage.getItem('studyhub_cart') || '[]'); }
  catch (e) { return []; }
}
function setCart(items) {
  localStorage.setItem('studyhub_cart', JSON.stringify(items));
  renderCartBadge();
}
function addToCart(item) {
  const cart = getCart();
  const idx = cart.findIndex(x => x && x.sku === item.sku);
  if (idx >= 0) cart[idx].qty = (Number(cart[idx].qty) || 1) + 1;
  else cart.push({ ...item, qty: 1 });
  setCart(cart);
}
function renderCartBadge() {
  const el = document.querySelector('[data-cart-badge]');
  if (!el) return;
  const cart = getCart();
  const n = cart.reduce((a, b) => a + (Number(b.qty) || 0), 0);
  el.textContent = String(n);
  el.style.display = n > 0 ? 'inline-grid' : 'none';
}
window.addToCart = addToCart; // used by catalog buttons

// ============================================================
// Catalog page
// ============================================================
function matchFilters(p, grade, subject) {
  if (grade && p.grade !== grade) return false;
  if (subject && p.subject !== subject) return false;
  return true;
}
function unique(list) { return [...new Set(list)].filter(Boolean); }

async function initCatalogPage() {
  const data = await loadCatalog();
  const products = (data && data.products) ? data.products : [];

  const grades   = unique(products.map(p => p.grade)).sort();
  const subjects = unique(products.map(p => p.subject)).sort();

  const gradeSel = document.getElementById('gradeSel');
  const subjSel  = document.getElementById('subjectSel');
  const grid     = document.getElementById('productGrid');
  if (!grid) return;

  if (gradeSel) {
    gradeSel.innerHTML =
      '<option value="">All Grades</option>' +
      grades.map(g => `<option value="${g}">${g}</option>`).join('');
  }
  if (subjSel) {
    subjSel.innerHTML =
      '<option value="">All Subjects</option>' +
      subjects.map(s => `<option value="${s}">${s}</option>`).join('');
  }

  function render() {
    const g = gradeSel ? gradeSel.value : '';
    const s = subjSel  ? subjSel.value  : '';
    const filtered = products.filter(p => matchFilters(p, g, s));

    grid.innerHTML = filtered.map(p => {
      const hasMemo = (p.has_memo !== false); // backend sends "has_memo"
      const memoChip = hasMemo
        ? '<span class="btn btn-secondary" style="padding:6px 10px;border-radius:999px;font-weight:700">Memo Included</span>'
        : '<span class="btn btn-secondary" style="padding:6px 10px;border-radius:999px;font-weight:700;color:#b91c1c;border-color:#fecaca;background:#fff5f5">Missing Memo</span>';

      const disabled    = hasMemo ? '' : 'disabled';
      const disableAttr = hasMemo ? '' : 'style="opacity:.55;cursor:not-allowed"';

      return `
        <div class="card">
          <h3>${p.title}</h3>
          <small>${p.grade} • ${p.subject}</small>
          <div class="price">${formatZAR(p.price_cents)}</div>
          <div class="actions">
            ${memoChip}
            <button class="btn btn-primary" ${disabled} ${disableAttr} data-add="${p.sku}">Add to Cart</button>
            cart.htmlGo to Cart</a>
          </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('[data-add]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sku = btn.getAttribute('data-add');
        const item = products.find(x => x.sku === sku);
        if (!item || item.has_memo === false) return;
        addToCart({ sku: item.sku, title: item.title, price_cents: item.price_cents });
        renderCartBadge();
      });
    });
  }

  if (gradeSel) gradeSel.addEventListener('change', render);
  if (subjSel)  subjSel.addEventListener('change', render);
  render();
  renderCartBadge();
}

// ============================================================
// Cart page
// ============================================================
function toWhatsAppMessage(cart, email) {
  const lines = cart.map(i => `- ${i.title} x${i.qty} (${formatZAR(i.price_cents)})`);
  const total = cart.reduce((a, b) => a + Number(b.price_cents || 0) * Number(b.qty || 1), 0);
  return encodeURIComponent(
    [
      `${cfg.brand} Order Request`,
      email ? `Email: ${email}` : '',
      '',
      ...lines,
      '',
      `Total: ${formatZAR(total)}`
    ].filter(Boolean).join('\n')
  );
}

function renderCart() {
  const cart   = getCart();
  const list   = document.getElementById('cartList');
  const totalEl= document.getElementById('cartTotal');
  if (!list) return;

  if (cart.length === 0) {
    list.innerHTML =
      '<div class="card"><b>Your cart is empty.</b>' +
      '<div class="muted" style="margin-top:6px">Browse packs to add items.</div>' +
      '<div style="margin-top:12px">catalog.htmlBrowse Packs</a></div></div>';
    if (totalEl) totalEl.textContent = 'R0';
    renderCartBadge();
    return;
  }

  list.innerHTML = cart.map((i, idx) => `
    <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div>
        <b>${i.title}</b>
        <div class="muted" style="font-size:13px">${formatZAR(i.price_cents)} each</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <button class="btn btn-secondary" data-dec="${idx}">−</button>
        <b>${i.qty}</b>
        <button class="btn btn-secondary" data-inc="${idx}">+</button>
        <button class="btn btn-secondary" data-del="${idx}">Remove</button>
      </div>
    </div>
  `).join('');

  const total = cart.reduce((a, b) => a + Number(b.price_cents || 0) * Number(b.qty || 1), 0);
  if (totalEl) totalEl.textContent = formatZAR(total);

  list.querySelectorAll('[data-inc]').forEach(b => b.addEventListener('click', () => {
    const idx = +b.getAttribute('data-inc');
    cart[idx].qty = (Number(cart[idx].qty) || 1) + 1;
    setCart(cart); renderCart();
  }));
  list.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => {
    const idx = +b.getAttribute('data-dec');
    cart[idx].qty = Math.max(1, (Number(cart[idx].qty) || 1) - 1);
    setCart(cart); renderCart();
  }));
  list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    const idx = +b.getAttribute('data-del');
    cart.splice(idx, 1); setCart(cart); renderCart();
  }));

  renderCartBadge();
}

// ---- PayFast form submit ----
function postToPayfast_(params, signature) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = cfg.payfastProcessUrl;

  const all = { ...params, signature };
  Object.keys(all).forEach(k => {
    const input = document.createElement('input');
    input.type = 'hidden'; input.name = k; input.value = all[k];
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

function initCartActions() {
  renderCart();

  const emailEl = document.getElementById('buyerEmail');

  // WhatsApp checkout (optional)
  const waBtn = document.getElementById('whatsappCheckout');
  if (waBtn) {
    waBtn.addEventListener('click', () => {
      const cart = getCart();
      if (!cfg.whatsappNumber) {
        alert('WhatsApp number not configured yet. Set it in assets/app.js');
        return;
      }
      const msg = toWhatsAppMessage(cart, emailEl ? emailEl.value : '');
      window.open(`https://wa.me/${cfg.whatsappNumber}?text=${msg}`, '_blank');
    });
  }

  // PayFast checkout (secure, server-signed)
  const pfBtn = document.getElementById('payfastBtn');
  if (pfBtn) {
    pfBtn.addEventListener('click', async () => {
      const agree = document.getElementById('agree');
      if (!agree || !agree.checked) { alert('Please accept the Terms & Conditions to continue.'); return; }

      const cart = getCart();
      if (!cart.length) { alert('Your cart is empty.'); return; }

      // Backend fulfills ONE SKU per ITN
      if (cart.length !== 1) {
        alert('Please checkout one item at a time.');
        return;
      }

      const item = cart[0];
      const qty  = Number(item.qty || 1);
      const email= (emailEl && emailEl.value) ? emailEl.value : '';

      const totalCents = Number(item.price_cents || 0) * qty;
      if (totalCents < 5000) { // R50 minimum
        alert('Minimum order is R50. Please add a larger pack.');
        return;
      }

      const amount       = roundToCents_(totalCents / 100);
      const m_payment_id = item.sku; // IMPORTANT: SKU here
      const item_name    = item.sku; // and here (backend fallback extractor)

      // Ask backend to sign (JSONP to avoid CORS)
      const q = new URLSearchParams({
        callback: `cb_${Math.random().toString(36).slice(2)}`,
        amount,
        item_name,
        m_payment_id,
        email_address: email,
        name_first: 'Buyer',
        name_last:  'StudyHub',
        return_url: cfg.return_url,
        cancel_url: cfg.cancel_url,
        notify_url: cfg.notify_url
      });
      const url = `${cfg.signEndpoint}&${q.toString()}`;

      try {
        await new Promise((resolve, reject) => {
          const cbName = q.get('callback');
          const s = document.createElement('script');
          window[cbName] = (data) => {
            try {
              delete window[cbName]; s.remove();
              if (!data || !data.ok) { reject(new Error('Sign failed')); return; }
              postToPayfast_(data.params, data.signature);
              resolve();
            } catch (e) { reject(e); }
          };
          s.onerror = () => { delete window[cbName]; s.remove(); reject(new Error('JSONP error')); };
          s.src = url;
          document.body.appendChild(s);
        });
      } catch (err) {
        console.error(err);
        alert('Could not start PayFast checkout. Please try again.');
      }
    });
  }
}

// ============================================================
// Boot – auto-detect page (no need for data-page)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  renderCartBadge();
  if (document.getElementById('productGrid')) initCatalogPage().catch(e => console.error(e));
  if (document.getElementById('cartList'))    initCartActions();
});
