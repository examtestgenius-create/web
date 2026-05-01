// StudyHub checkout.js (Go-Live PayFast)
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
      return { payload, source: url, errors };
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

function itemSku(item){ return String(item.sku || item.SKU || ''); }
function itemPapers(item){
  const v = item.paper_count ?? item.papers ?? item.file_count ?? item.Included_File_Count ?? item.included_file_count;
  return Number(v || 0);
}

function buildHiddenForm(actionUrl, fields){
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = actionUrl;
  for (const [k,v] of Object.entries(fields)){
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
const payLaterBtn = document.getElementById('payLaterBtn');

let currentItem = null;

async function loadCheckout(){
  if (!sku){
    titleEl.textContent = 'Missing bundle';
    introEl.textContent = 'Open checkout with ?sku=YOUR_SKU';
    return;
  }

  skuField.value = sku;

  try {
    const { payload } = await fetchStudyHubCatalog();
    const items = payload.items || payload.packages || [];
    currentItem = items.find(v => String(v.sku || v.SKU || '') === sku) || null;

    if (!currentItem){
      titleEl.textContent = 'Bundle not found';
      introEl.textContent = `No bundle with SKU ${sku} was found.`;
      return;
    }

    titleEl.textContent = `Checkout — ${sku}`;
    introEl.innerHTML = 'Secure payment via <strong>PayFast</strong>. After confirmation, you will receive a ZIP download link.';

    priceEl.textContent = moneyZarFromCents(currentItem.price_cents || currentItem.Price_Cents);

    const grade = currentItem.grade || currentItem.Grade || '';
    const subject = currentItem.subject_or_all || currentItem.Subject_Name || 'ALL';
    const year = currentItem.year_or_range || '';

    badgesEl.innerHTML = [
      grade ? `<span class="badge">Grade ${grade}</span>` : '',
      `<span class="badge">${subject}</span>`,
      year ? `<span class="badge">${year}</span>` : ''
    ].join('');

    // Year meta is optional in v2
    fromYearMeta.textContent = (String(year).match(/(20\d{2})/) || ['—'])[0];
    toYearMeta.textContent = (String(year).match(/-(20\d{2})/) || ['—'])[0].replace('-', '') || '—';

    filesMeta.textContent = `${itemPapers(currentItem)} papers (memo included)`;

  } catch (err){
    titleEl.textContent = 'Catalog unavailable';
    introEl.textContent = 'The bundle could not be loaded.';
    console.error(err);
  }
}

if (payLaterBtn){
  payLaterBtn.style.display = 'none';
}

if (checkoutForm){
  checkoutForm.addEventListener('submit', async (e)=>{
    e.preventDefault();

    if (!window.STUDYHUB_CONFIG.apiBaseUrl){
      checkoutStatus.textContent = 'Backend not configured. Set webappUrl in config.js.';
      checkoutStatus.classList.add('status-error');
      return;
    }

    const data = Object.fromEntries(new FormData(checkoutForm).entries());
    const fullName = String(data.customer_name || '').trim();
    const email = String(data.customer_email || '').trim();
    const phone = String(data.customer_phone || '').trim();

    if (!email){
      checkoutStatus.textContent = 'Please enter your email.';
      return;
    }

    const parts = fullName.split(/\s+/).filter(Boolean);
    const name_first = parts[0] || 'Student';
    const name_last = parts.slice(1).join(' ') || 'Customer';

    checkoutStatus.textContent = 'Creating PayFast checkout…';
    checkoutStatus.classList.remove('status-error');

    try {
      const res = await fetch(window.STUDYHUB_CONFIG.apiBaseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createCheckout',
          sku: sku,
          email: email,
          customer_email: email,
          customer_phone: phone,
          name_first,
          name_last,
          cell_number: phone
        })
      });

      if (!res.ok) throw new Error('Checkout request failed');
      const out = await res.json();
      if (!out.ok) throw new Error(out.error || 'Checkout failed');

      // Build and submit PayFast form
      const form = buildHiddenForm(out.payfast_url, out.payfast_payload);
      form.submit();

    } catch (err){
      console.error(err);
      checkoutStatus.textContent = 'Could not start PayFast checkout. Please try again or contact support.';
      checkoutStatus.classList.add('status-error');
    }

  });
}

loadCheckout();
