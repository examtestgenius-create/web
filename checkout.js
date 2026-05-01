// StudyHub checkout.js (PRODUCTION SAFE – NO CORS)
// Uses normal HTML form POST to Apps Script which returns
// an HTML auto-submit page for PayFast.

window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {
  liveCatalogUrl: '',
  fallbackCatalogUrl: 'data/catalog.sample.json',
  apiBaseUrl: ''
};

/* ===========================
   Helpers
=========================== */
async function fetchStudyHubCatalog() {
  const urls = [];
  if (window.STUDYHUB_CONFIG.liveCatalogUrl) {
    urls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
  }
  urls.push(window.STUDYHUB_CONFIG.fallbackCatalogUrl);

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {}
  }
  throw new Error('Catalog unavailable');
}

function moneyZarFromCents(cents) {
  const n = Number(cents || 0);
  if (!n) return 'Price not set';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR'
  }).format(n / 100);
}

// ✅ Paper count fix (paper + memo = 1 paper)
function itemPapers(item) {
  if (item.paper_count !== undefined && item.paper_count !== null) {
    return Number(item.paper_count || 0);
  }
  const files = Number(item.file_count || item.Included_File_Count || 0);
  return Math.round(files / 2); // memo always included
}

/* ===========================
   Page Elements
=========================== */
const sku = new URL(window.location.href).searchParams.get('sku') || '';

const titleEl = document.getElementById('checkoutTitle');
const introEl = document.getElementById('checkoutIntro');
const skuField = document.getElementById('skuField');
const priceEl = document.getElementById('checkoutPrice');
const badgesEl = document.getElementById('checkoutBadges');

const fromYearMeta = document.getElementById('fromYearMeta');
const toYearMeta = document.getElementById('toYearMeta');
const papersMeta = document.getElementById('filesMeta');

const checkoutForm = document.getElementById('checkoutForm');
const checkoutStatus = document.getElementById('checkoutStatus');
const payLaterBtn = document.getElementById('payLaterBtn');

/* ===========================
   Load checkout data
=========================== */
async function loadCheckout() {
  if (!sku) {
    titleEl.textContent = 'Missing bundle';
    introEl.textContent = 'Open checkout with ?sku=YOUR_SKU';
    return;
  }

  skuField.value = sku;

  try {
    const catalog = await fetchStudyHubCatalog();
    const items = catalog.items || catalog.packages || [];
    const item = items.find(i => String(i.sku || i.SKU) === sku);

    if (!item) {
      titleEl.textContent = 'Bundle not found';
      introEl.textContent = `No bundle with SKU ${sku}`;
      return;
    }

    titleEl.textContent = `Checkout — ${sku}`;
    introEl.innerHTML =
      'Secure payment via <strong>PayFast</strong>. After confirmation you will receive an instant ZIP download link.';

    priceEl.textContent = moneyZarFromCents(item.price_cents || item.Price_Cents);

    const grade = item.grade || '';
    const subject = item.subject_or_all || 'ALL';
    const year = item.year_or_range || '';

    badgesEl.innerHTML = [
      grade ? `<span class="badge">Grade ${grade}</span>` : '',
      `<span class="badge">${subject}</span>`,
      year ? `<span class="badge">${year}</span>` : ''
    ].join('');

    const years = String(year).match(/20\d{2}/g) || [];
    fromYearMeta.textContent = years[0] || '—';
    toYearMeta.textContent = years[1] || years[0] || '—';

    papersMeta.textContent = `${itemPapers(item)} papers (memo included)`;
  } catch (err) {
    console.error(err);
    titleEl.textContent = 'Catalog unavailable';
    introEl.textContent = 'Unable to load bundle details.';
  }
}

/* ===========================
   Checkout submit (NO FETCH)
=========================== */
if (payLaterBtn) payLaterBtn.style.display = 'none';

if (checkoutForm) {
  checkoutForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!window.STUDYHUB_CONFIG.webappUrl) {
      checkoutStatus.textContent =
        'Backend not configured. Please contact support.';
      checkoutStatus.classList.add('status-error');
      return;
    }

    const data = Object.fromEntries(new FormData(checkoutForm).entries());

    const fullName = String(data.customer_name || '').trim();
    const email = String(data.customer_email || '').trim();
    const phone = String(data.customer_phone || '').trim();

    if (!email) {
      checkoutStatus.textContent = 'Please enter your email address.';
      checkoutStatus.classList.add('status-error');
      return;
    }

    const parts = fullName.split(/\s+/).filter(Boolean);
    const name_first = parts[0] || 'Student';
    const name_last = parts.slice(1).join(' ') || 'Customer';

    checkoutStatus.textContent = 'Redirecting to PayFast…';
    checkoutStatus.classList.remove('status-error');

    // ✅ NORMAL FORM POST (NO CORS)
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = window.STUDYHUB_CONFIG.webappUrl;

    const fields = {
      action: 'createCheckout',
      redirect: '1', // tells Code.gs to return HTML auto-post
      sku: sku,
      email: email,
      customer_email: email,
      customer_phone: phone,
      name_first,
      name_last,
      cell_number: phone
    };

    Object.entries(fields).forEach(([k, v]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = String(v);
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  });
}

loadCheckout();
``
