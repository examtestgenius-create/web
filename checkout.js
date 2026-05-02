
window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {
  liveCatalogUrl: '',
  fallbackCatalogUrl: 'data/catalog.sample.json',
  apiBaseUrl: ''
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
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n / 100);
}

function itemPapers(item) {
  if (item.paper_count !== undefined && item.paper_count !== null && String(item.paper_count) !== '') {
    return Number(item.paper_count);
  }
  if (item.papers !== undefined && item.papers !== null && String(item.papers) !== '') {
    return Number(item.papers);
  }
  const fileCount = Number(item.file_count ?? item.Included_File_Count ?? item.included_file_count ?? 0);
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
    introEl.textContent = 'Open checkout with ?sku=YOUR_SKU';
    return;
  }

  skuField.value = sku;

  try {
    const { payload } = await fetchStudyHubCatalog();
    const items = payload.items || payload.packages || [];
    const item = items.find(v => String(v.sku || v.SKU || '') === sku);

    if (!item) {
      titleEl.textContent = 'Bundle not found';
      introEl.textContent = `No bundle with SKU ${sku} was found.`;
      return;
    }

    titleEl.textContent = `Checkout — ${sku}`;
    introEl.innerHTML =
      'Secure payment via <strong>PayFast</strong>. Each paper includes the question paper and memo.';

    priceEl.textContent = moneyZarFromCents(item.price_cents || item.Price_Cents);

    const grade = item.grade || item.Grade || '';
    const subject = item.subject_or_all || item.Subject_Name || 'ALL';
    const year = item.year_or_range || item.Year || '';

    badgesEl.innerHTML = [
      grade ? `<span class="badge">Grade ${grade}</span>` : '',
      `<span class="badge">${subject}</span>`,
      year ? `<span class="badge">${year}</span>` : ''
    ].join('');

    fromYearMeta.textContent = (String(year).match(/(20\d{2})/) || ['—'])[0];
    toYearMeta.textContent = ((String(year).match(/-(20\d{2})/) || ['—'])[0].replace('-', '')) || '—';
    filesMeta.textContent = `${itemPapers(item)} papers (question paper + memo per paper)`;

  } catch (err) {
    console.error(err);
    titleEl.textContent = 'Catalog unavailable';
    introEl.textContent = 'The bundle could not be loaded.';
  }
}

if (checkoutForm) {
  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(checkoutForm).entries());
    const email = String(data.customer_email || '').trim();
    const fullName = String(data.customer_name || '').trim();
    const phone = String(data.customer_phone || '').trim();

    if (!email) {
      checkoutStatus.textContent = 'Please enter your email.';
      return;
    }

    const parts = fullName.split(/\s+/).filter(Boolean);
    const name_first = parts[0] || 'Student';
    const name_last = parts.slice(1).join(' ') || 'Customer';

    checkoutStatus.textContent = 'Redirecting to PayFast…';

    try {
      const res = await fetch(window.STUDYHUB_CONFIG.apiBaseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createCheckout',
          sku,
          email,
          customer_email: email,
          customer_phone: phone,
          name_first,
          name_last,
          cell_number: phone
        })
      });

      const out = await res.json();
      if (!out.ok) throw new Error(out.error || 'Checkout failed');

      buildHiddenForm(out.payfast_url, out.payfast_payload).submit();

    } catch (err) {
      console.error(err);
      checkoutStatus.textContent = 'Could not start PayFast checkout. Please try again.';
      checkoutStatus.classList.add('status-error');
    }
  });
}

loadCheckout();
