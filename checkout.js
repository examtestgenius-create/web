function getConfig() { return window.STUDYHUB_CONFIG || {}; }

async function fetchCatalog() {
  const cfg = getConfig();
  const urls = [];
  if (cfg.liveCatalogUrl) urls.push(cfg.liveCatalogUrl);
  urls.push(cfg.fallbackCatalogUrl || 'data/catalog.sample.json');
  const errors = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      return Array.isArray(payload.items) ? payload.items : (payload.packages || []);
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }
  throw new Error(errors.join(' | ') || 'Catalog unavailable');
}

function normalized(item) {
  return {
    sku: String(item.SKU ?? item.sku ?? ''),
    title: String(item.Title ?? item.title ?? item.SKU ?? item.sku ?? 'Package'),
    bundleType: String(item.Bundle_Type ?? item.bundle_type ?? item.bundleType ?? 'Package'),
    subject: String(item.Subject_Name ?? item.subject_name ?? item.subject_or_all ?? 'ALL'),
    province: String(item.Province_Filter ?? item.province_filter ?? 'ALL'),
    fromYear: item.Coverage_From_Year ?? item.coverage_from_year ?? item.year_or_range ?? 2022,
    toYear: item.Coverage_To_Year ?? item.coverage_to_year ?? 'Onward',
    count: Number(item.Included_File_Count ?? item.included_file_count ?? item.file_count ?? 0),
    notes: String(item.Notes ?? item.notes ?? item.description ?? 'Exam papers and memos organised for fast revision.'),
    priceCents: Number(item.Price_Cents ?? item.price_cents ?? item.priceCents ?? 0)
  };
}

function moneyZar(cents) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format((Number(cents || 0)) / 100);
}

function buildAndSubmitPayFastForm(url, payload) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  form.style.display = 'none';
  Object.entries(payload || {}).forEach(([key, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

const sku = new URL(window.location.href).searchParams.get('sku') || '';
const els = {
  title: document.getElementById('checkoutTitle'),
  intro: document.getElementById('checkoutIntro'),
  skuField: document.getElementById('skuField'),
  price: document.getElementById('checkoutPrice'),
  badges: document.getElementById('checkoutBadges'),
  fromYear: document.getElementById('fromYearMeta'),
  toYear: document.getElementById('toYearMeta'),
  files: document.getElementById('filesMeta'),
  form: document.getElementById('checkoutForm'),
  status: document.getElementById('checkoutStatus'),
  summaryTitle: document.getElementById('summaryTitle')
};

async function loadCheckout() {
  if (!sku) {
    els.title.textContent = 'Missing package';
    els.intro.textContent = 'Open checkout with ?sku=YOUR_SKU';
    return;
  }
  els.skuField.value = sku;
  try {
    const item = (await fetchCatalog()).map(normalized).find(v => v.sku === sku);
    if (!item) {
      els.title.textContent = 'Package not found';
      els.intro.textContent = `No package with SKU ${sku} was found.`;
      return;
    }
    els.title.textContent = `Checkout — ${item.title}`;
    els.intro.textContent = 'Press Continue to PayFast to create the order and proceed to secure payment.';
    if (els.summaryTitle) els.summaryTitle.textContent = item.title;
    els.price.textContent = moneyZar(item.priceCents);
    els.badges.innerHTML = `<span class="badge">${item.subject}</span><span class="badge">${item.bundleType}</span>`;
    els.fromYear.textContent = item.fromYear;
    els.toYear.textContent = item.toYear;
    els.files.textContent = item.count;
  } catch (err) {
    console.error(err);
    els.title.textContent = 'Catalog unavailable';
    els.intro.textContent = 'The package could not be loaded.';
  }
}

if (els.form) {
  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cfg = getConfig();
    els.status.textContent = '';
    if (!cfg.apiBaseUrl) {
      els.status.textContent = 'Backend API URL is not configured.';
      els.status.className = 'inline-status error';
      return;
    }

    const formData = Object.fromEntries(new FormData(els.form).entries());
    const submitBtn = els.form.querySelector('button[type="submit"]');
    const payload = new URLSearchParams({
      action: 'createCheckout',
      sku,
      customer_name: formData.customer_name || '',
      customer_email: formData.customer_email || '',
      customer_phone: formData.customer_phone || '',
      notes: formData.notes || ''
    });

    if (submitBtn) submitBtn.disabled = true;
    els.status.textContent = 'Creating your PayFast checkout…';
    els.status.className = 'inline-status warning';

    try {
      const res = await fetch(cfg.apiBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: payload.toString()
      });
      const text = await res.text();
      let out = {};
      try { out = JSON.parse(text); } catch (parseErr) {
        throw new Error(text || 'Unexpected backend response');
      }
      if (!res.ok || !out.ok) throw new Error(out.error || 'Could not create the order');
      els.status.textContent = 'Redirecting to PayFast…';
      els.status.className = 'inline-status notice';
      buildAndSubmitPayFastForm(out.payfast_url, out.payfast_payload);
    } catch (err) {
      console.error(err);
      const msg = (err && err.message) ? err.message : 'Could not start PayFast checkout.';
      els.status.textContent = msg === 'Failed to fetch'
        ? 'Network or CORS error while contacting the backend. This hotfix uses a form-encoded POST to avoid Apps Script JSON preflight issues. If you still see this, the Web App deployment/permissions must be checked.'
        : msg;
      els.status.className = 'inline-status error';
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

loadCheckout();
