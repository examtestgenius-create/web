window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {
  liveCatalogUrl: '',
  fallbackCatalogUrl: 'data/catalog.sample.json',
  apiBaseUrl: ''
};

async function fetchStudyHubCatalog() {
  const tryUrls = [];
  if (window.STUDYHUB_CONFIG.liveCatalogUrl) {
    tryUrls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
  }
  tryUrls.push(window.STUDYHUB_CONFIG.fallbackCatalogUrl);

  const errors = [];
  for (const url of tryUrls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      return { payload };
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }
  throw new Error(errors.join('\n'));
}

function moneyZarFromCents(cents) {
  const n = Number(cents || 0);
  if (!n) return 'Price not set';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR'
  }).format(n / 100);
}

function itemPapers(item) {
  if (item.paper_count !== undefined && item.paper_count !== null && String(item.paper_count) !== '') {
    return Number(item.paper_count);
  }
  if (item.papers !== undefined && item.papers !== null && String(item.papers) !== '') {
    return Number(item.papers);
  }
  const fileCount = Number(
    item.file_count ??
    item.Included_File_Count ??
    item.included_file_count ??
    0
  );
  return fileCount > 0 ? Math.max(1, Math.round(fileCount / 2)) : 0;
}

function buildHiddenForm(actionUrl, fields) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = actionUrl;
  for (const [k, v] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = k;
    input.value = String(v);
    form.appendChild(input);
  }
  document.body.appendChild(form);
  return form;
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

async function loadCheckout() {
  if (!sku) {
    titleEl.textContent = 'Missing bundle';
    return;
  }

  skuField.value = sku;

  try {
    const { payload } = await fetchStudyHubCatalog();
    const items = payload.items || payload.packages || [];
    const item = items.find(v => String(v.sku || v.SKU || '') === sku);

    if (!item) {
      titleEl.textContent = 'Bundle not found';
      return;
    }

    titleEl.textContent = `Checkout — ${sku}`;
    introEl.innerHTML = 'Secure payment via <strong>PayFast</strong>. Each paper includes the question paper and memo.';
    priceEl.textContent = moneyZarFromCents(item.price_cents);
    badgesEl.innerHTML = `
      ${item.grade ? `<span class="badge">Grade ${item.grade}</span>` : ''}
      <span class="badge">${item.subject_or_all || 'ALL'}</span>
      ${item.year_or_range ? `<span class="badge">${item.year_or_range}</span>` : ''}
    `;
    fromYearMeta.textContent = item.year_or_range || '—';
    toYearMeta.textContent = item.year_or_range || '—';
    filesMeta.textContent = `${itemPapers(item)} papers (question + memo)`;
  } catch (err) {
    console.error(err);
    titleEl.textContent = 'Catalog unavailable';
  }
}

checkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = Object.fromEntries(new FormData(checkoutForm).entries());
  if (!data.customer_email) {
    checkoutStatus.textContent = 'Please enter your email.';
    return;
  }

  checkoutStatus.textContent = 'Redirecting to PayFast…';

  const res = await fetch(window.STUDYHUB_CONFIG.apiBaseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'createCheckout',
      sku,
      email: data.customer_email,
      name_first: data.customer_name || 'Student',
      cell_number: data.customer_phone || ''
    })
  });

  const out = await res.json();
  if (!out.ok) throw new Error(out.error);

  buildHiddenForm(out.payfast_url, out.payfast_payload).submit();
});

loadCheckout();
