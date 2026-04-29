
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

function downloadPlaceholder(sku) {
  alert(`Download placeholder for ${sku}. Connect final delivery/download logic here later.`);
}

const sku = new URL(window.location.href).searchParams.get('sku') || '';
const titleEl = document.getElementById('checkoutTitle');
const introEl = document.getElementById('checkoutIntro');
const skuField = document.getElementById('skuField');
const priceEl = document.getElementById('checkoutPrice');
const badgesEl = document.getElementById('checkoutBadges');
const fromYearMeta = document.getElementById('fromYearMeta');
const toYearMeta = document.getElementById('toYearMeta');
const filesMeta = document.getElementById('filesMeta');
const checkoutForm = document.getElementById('checkoutForm');
const checkoutStatus = document.getElementById('checkoutStatus');
const payLaterBtn = document.getElementById('payLaterBtn');
let currentItem = null;

async function loadCheckout() {
  if (!sku) {
    titleEl.textContent = 'Missing package';
    introEl.textContent = 'Open checkout with ?sku=YOUR_SKU';
    return;
  }
  skuField.value = sku;
  try {
    const { payload } = await fetchStudyHubCatalog();
    const items = payload.items || payload.packages || [];
    currentItem = items.find(v => String(v.SKU || v.sku || '') === sku);
    if (!currentItem) {
      titleEl.textContent = 'Package not found';
      introEl.textContent = `No package with SKU ${sku} was found.`;
      return;
    }
    titleEl.textContent = `Checkout — ${sku}`;
    introEl.textContent = 'This checkout captures an order and is ready for final payment wiring later.';
    priceEl.textContent = moneyZar(currentItem);
    badgesEl.innerHTML = `<span class="badge">${currentItem.Subject_Name || 'ALL'}</span><span class="badge">${currentItem.Province_Filter || 'ALL'}</span>`;
    fromYearMeta.textContent = currentItem.Coverage_From_Year || 2022;
    toYearMeta.textContent = currentItem.Coverage_To_Year || 'Onward';
    filesMeta.textContent = currentItem.Included_File_Count || 0;
  } catch (err) {
    titleEl.textContent = 'Catalog unavailable';
    introEl.textContent = 'The package could not be loaded.';
  }
}

if (payLaterBtn) {
  payLaterBtn.addEventListener('click', () => alert('Pay-later placeholder. Connect your final payment provider later.'));
}

if (checkoutForm) {
  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(checkoutForm).entries());
    const payload = { action: 'createCheckout', sku: sku, amount_cents: currentItem ? Number(currentItem.Price_Cents || 0) : 0, ...data };
    if (!window.STUDYHUB_CONFIG.apiBaseUrl) {
      const fakeId = 'ORD-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      window.location.href = `payment-success.html?order=${encodeURIComponent(fakeId)}`;
      return;
    }
    try {
      const body = new URLSearchParams();
      Object.entries(payload).forEach(([k, v]) => body.append(k, v == null ? '' : String(v)));
      const res = await fetch(window.STUDYHUB_CONFIG.apiBaseUrl, { method: 'POST', body });
      if (!res.ok) throw new Error('Order request failed');
      const out = await res.json();
      const orderId = out.order_id || out.Order_ID || out.orderId || 'ORDER';
      if (out.payfast_url && out.payfast_payload) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = out.payfast_url;
        Object.entries(out.payfast_payload).forEach(([key, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value == null ? '' : String(value);
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        return;
      }
      window.location.href = `payment-success.html?order=${encodeURIComponent(orderId)}`;
    } catch (err) {
      checkoutStatus.textContent = 'Order endpoint is not active yet. Using placeholder flow is recommended until deployment is complete.';
      checkoutStatus.classList.add('notice');
    }
  });
}

loadCheckout();
