// checkout.js – FINAL, CLEAN, WORKING
console.log('checkout.js READY FINAL');

const sku = new URL(window.location.href).searchParams.get('sku') || '';

const titleEl = document.getElementById('checkoutTitle');
const introEl = document.getElementById('checkoutIntro');
const priceEl = document.getElementById('checkoutPrice');
const filesMeta = document.getElementById('filesMeta');
const fromYearEl = document.getElementById('fromYearMeta');
const toYearEl = document.getElementById('toYearMeta');
const skuField = document.getElementById('skuField');

const checkoutForm = document.getElementById('checkoutForm');
const checkoutStatus = document.getElementById('checkoutStatus');

function money(cents) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR'
  }).format((Number(cents || 0)) / 100);
}

async function load() {
  if (!sku) {
    titleEl.textContent = 'Missing package';
    return;
  }

  const res = await fetch(window.STUDYHUB_CONFIG.liveCatalogUrl, { cache: 'no-store' });
  const data = await res.json();
  const items = data.items || data.packages || [];
  const item = items.find(i => String(i.sku || i.SKU) === sku);

  if (!item) {
    titleEl.textContent = 'Package not found';
    return;
  }

  // Header
  titleEl.textContent = `Checkout — ${sku}`;
  introEl.innerHTML = 'Secure payment via <strong>PayFast</strong>.';

  // SKU field
  if (skuField) {
    skuField.value = sku;
    skuField.readOnly = true;
  }

  // Price
  priceEl.textContent = money(item.price_cents || item.Price_Cents);

  // Year range
  const yearText = String(item.year_or_range || '');
  const match = yearText.match(/(20\d{2}).*?(20\d{2})/);
  fromYearEl.textContent = match ? match[1] : '—';
  toYearEl.textContent = match ? match[2] : '—';

  // Included files
  const fileCount =
    item.file_count ??
    item.Included_File_Count ??
    item.paper_count ??
    item.papers ??
    0;

  filesMeta.textContent = `${fileCount} papers (question + memo per paper)`;
}

checkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  checkoutStatus.textContent = 'Redirecting to PayFast…';

  const fd = Object.fromEntries(new FormData(checkoutForm).entries());

  const res = await fetch(window.STUDYHUB_CONFIG.apiBaseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({
      action: 'createCheckout',
      sku,
      email: fd.customer_email,
      customer_email: fd.customer_email,
      customer_phone: fd.customer_phone || '',
      name_first: (fd.customer_name || 'Student').split(' ')[0],
      name_last: (fd.customer_name || 'Customer').split(' ').slice(1).join(' ') || 'Customer'
    })
  });

  const out = await res.json();
  if (!out.ok) throw new Error(out.error || 'Checkout failed');

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = out.payfast_url;

  Object.entries(out.payfast_payload).forEach(([k, v]) => {
    const i = document.createElement('input');
    i.type = 'hidden';
    i.name = k;
    i.value = v;
    form.appendChild(i);
  });

  document.body.appendChild(form);
  form.submit();
});

load();
