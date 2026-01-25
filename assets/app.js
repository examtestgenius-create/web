
// StudyHub client – catalog + cart + PayFast secure sign (v2)

/* ============================================================
   CONFIG (edit me)
   ============================================================ */
const cfg = {
  brand: 'StudyHub',
  currency: 'ZAR',

  // LIVE or SANDBOX mode for PayFast
  //   'live'    → https://www.payfast.co.za/eng/process
  //   'sandbox' → https://sandbox.payfast.co.za/eng/process
  mode: 'live',

  // Optional WhatsApp checkout (sheet-driven order handoff)
  // e.g. '27716816131' (country code + number, no + or spaces)
  whatsappNumber: '',

  // Your Apps Script Web App base (no trailing slash)
  // Example: 'https://script.google.com/macros/s/AKfycbxYourDeployId/exec'
  webAppBase: 'https://script.google.com/macros/s/AKfycbwLzazM5zV41rFJ4d5NzZubstnUB-AYdfriqd9IKjb3ZoS_MmwNrnnR8c93ci5-HkST/exec',

  // Derived endpoints used by the cart/site
  get catalogEndpoint() { return `${this.webAppBase}?action=catalog`; },
  get signEndpoint()    { return `${this.webAppBase}?action=sign`; },

  // PayFast URLs (+ notify/return/cancel)
  get payfastProcessUrl() {
    return this.mode === 'sandbox'
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process';
  },
  // If PF_* are set as Script Properties, the server will override these.
  get return_url() { return `${window.location.origin}/cart.html?status=success`; },
  get cancel_url() { return `${window.location.origin}/cart.html?status=cancel`;  },
  get notify_url() { return this.webAppBase; } // ITN → Apps Script doPost
};

/* ============================================================
   JSONP LOADER (for Apps Script)
   ============================================================ */
function loadJsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = 'cb_' + Math.random().toString(36).slice(2);
    const scriptEl = document.createElement('script');

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP timeout'));
    }, 15000);

    function cleanup() {
      clearTimeout(timer);
      try { delete window[cb]; } catch (_) {}
      scriptEl.remove();
    }

    window[cb] = (data) => {
      cleanup();
      resolve(data);
    };

    const join = url.includes('?') ? '&' : '?';
    scriptEl.src = `${url}${join}callback=${cb}`;
    scriptEl.onerror = () => {
      cleanup();
      reject(new Error('JSONP load error'));
    };
    document.body.appendChild(scriptEl);
  });
}

/* ============================================================
   HELPERS
   ============================================================ */
function formatZAR(cents) {
  const r = (Number(cents || 0) / 100).toFixed(0);
  return `R${r}`;
}

async function loadCatalog() {
  if (cfg.catalogEndpoint) {
    return await loadJsonp(cfg.catalogEndpoint);
  }
  const res = await fetch('./products.json');
  return await res.json();
}

function roundToCents_(rands) {
  return (Math.round((Number(rands) || 0) * 100) / 100).toFixed(2);
}

/* ============================================================
   CART STORAGE + BADGE
   ============================================================ */
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

// expose for inline scripts (homepage)
window.addToCart = addToCart;

/* ============================================================
   CATALOG PAGE (filters + grid)
   ============================================================ */
function matchFilters(p, grade, subject) {
  if (grade && p.grade !== grade) return false;
  if (subject && p.subject !== subject) return false;
  return true;
}

function unique(list) {
  return [...new Set(list)].filter(Boolean);
}

async function initCatalogPage() {
  const data = await loadCatalog();
  const products = data.products || [];

  // Populate filters
  const grades   = unique(products.map(p => p.grade)).sort();
  const subjects = unique(products.map(p => p.subject)).sort();

  const gradeSel = document.getElementById('gradeSel');
  const subjSel  = document.getElementById('subjectSel');
  const grid     = document.getElementById('productGrid');

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
      const memoChip = p.has_memo !== false
        ? '<span class="btn btn-secondary" style="padding:6px 10px;border-radius:999px;font-weight:700">Memo Included</span>'
        : '<span class="btn btn-secondary" style="padding:6px 10px;border-radius:999px;font-weight:700;color:#b91c1c;border-color:#fecaca;background:#fff5f5">Missing Memo</span>';

      const disabled    = p.has_memo === false ? 'disabled' : '';
      const disableAttr = p.has_memo === false ? 'style="opacity:.55;cursor:not-allowed"' : '';

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
        if (!item || item.has_memo === false) return; // block missing memos
        addToCart({ sku: item.sku, title: item.title, price_cents: item.price_cents });
        const old = btn.textContent;
        btn.textContent = 'Added ✓';
        btn.disabled = true;
        setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 900);
      });
    });
  }

  if (gradeSel) gradeSel.addEventListener('change', render);
  if (subjSel)  subjSel.addEventListener('change', render);

  render();
  renderCartBadge();
}

/* ============================================================
   CART PAGE (render + WhatsApp + PayFast)
   ============================================================ */
function toWhatsAppMessage(cart, email) {
  const lines = cart.map(i => `- ${i.title} x${i.qty} (${formatZAR(i.price_cents)})`);
  const total = cart.reduce((a, b) => a + Number(b.price_cents || 0) * Number(b.qty || 1), 0);
  return encodeURIComponent([
    `${cfg.brand} Order Request`,
    email ? `Email: ${email}` : '',
    '',
    ...lines,
    '',
    `Total: ${formatZAR(total)}`
  ].filter(Boolean).join('\n'));
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

function postToPayfast_(params, signature) {
  const url = cfg.payfastProcessUrl;
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;

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

  // WhatsApp Checkout (optional)
  const waBtn = document.getElementById('whatsappCheckout');
  if (waBtn) {
    waBtn.addEventListener('click', () => {
      const cart = getCart();
      if (!cfg.whatsappNumber) { alert('WhatsApp number not configured yet.'); return; }
      const msg = toWhatsAppMessage(cart, emailEl ? emailEl.value : '');
      window.open(`https://wa.me/${cfg.whatsappNumber}?text=${msg}`, '_blank');
    });
  }

  // PayFast Checkout (secure, server‑signed)
  const pfBtn = document.getElementById('payfastBtn');
  if (pfBtn) {
    pfBtn.addEventListener('click', async () => {
      const agree = document.getElementById('agree');
      if (!agree || !agree.checked) { alert('Please accept the Terms & Conditions to continue.'); return; }

      const cart = getCart();
      if (!cart.length) { alert('Your cart is empty.'); return; }

      // IMPORTANT: backend fulfills ONE SKU per ITN.
      if (cart.length !== 1) {
        alert('Please checkout one item at a time.\nTip: Complete checkout for the first item, then return for the next.');
        return;
      }

      const item = cart[0];
      const qty = Number(item.qty || 1);
      const email = (emailEl && emailEl.value) ? emailEl.value : '';

      const totalCents = Number(item.price_cents || 0) * qty;
      if (totalCents < 5000) { // R50 minimum order
        alert('Minimum order is R50. Please add a larger pack.');
        return;
      }

      const amount = roundToCents_(totalCents / 100);
      // VERY IMPORTANT: use SKU for both m_payment_id and item_name
      const m_payment_id = item.sku;
      const item_name    = item.sku;

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
              delete window[cbName];
              s.remove();
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

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  renderCartBadge();
  const page = (document.body && document.body.dataset && document.body.dataset.page) || '';
  if (page === 'catalog') initCatalogPage().catch(e => console.error(e));
  if (page === 'cart')    initCartActions();
});
