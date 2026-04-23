window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {};
window.STUDYHUB_CONFIG.fallbackCatalogUrl =
  window.STUDYHUB_CONFIG.fallbackCatalogUrl || 'data/catalog.sample.json';
window.STUDYHUB_CONFIG.liveCatalogUrl =
  window.STUDYHUB_CONFIG.liveCatalogUrl || '';
window.STUDYHUB_CONFIG.apiBaseUrl =
  window.STUDYHUB_CONFIG.apiBaseUrl || '';
window.STUDYHUB_CONFIG.catalogTimeoutMs =
  Number(window.STUDYHUB_CONFIG.catalogTimeoutMs || 8000);

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchStudyHubCatalog() {
  const tryUrls = [];
  if (window.STUDYHUB_CONFIG.liveCatalogUrl) {
    tryUrls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
  }
  tryUrls.push(window.STUDYHUB_CONFIG.fallbackCatalogUrl);

  const errors = [];

  for (const url of tryUrls) {
    try {
      const payload = await fetchJsonWithTimeout(
        url,
        window.STUDYHUB_CONFIG.catalogTimeoutMs
      );
      return { payload, source: url, errors };
    } catch (err) {
      const msg =
        err && err.name === 'AbortError'
          ? 'Timeout'
          : (err && err.message ? err.message : String(err));
      errors.push(`${url}: ${msg}`);
    }
  }

  throw new Error(errors.join('\n'));
}

function normalizeCatalogItem(item) {
  return {
    sku: item.SKU || item.sku || '',
    title: item.Title || item.title || item.SKU || item.sku || 'Package',
    subject:
      item.Subject_Name ||
      item.subject_name ||
      item.subject_or_all ||
      'ALL',
    province:
      item.Province_Filter ||
      item.province_filter ||
      item.province ||
      'ALL',
    fromYear:
      item.Coverage_From_Year ||
      item.coverage_from_year ||
      (String(item.year_or_range || '').split('-')[0] || '—'),
    toYear:
      item.Coverage_To_Year ||
      item.coverage_to_year ||
      (String(item.year_or_range || '').split('-')[1] ||
        String(item.year_or_range || '—')),
    fileCount: Number(
      item.Included_File_Count ||
        item.included_file_count ||
        item.file_count ||
        0
    ),
    priceCents: Number(item.Price_Cents || item.price_cents || 0)
  };
}

function moneyZar(cents) {
  const value = Number(cents || 0);
  if (!value) return 'Price not set';

  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR'
  }).format(value / 100);
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
    const items = (payload.items || payload.packages || []).map(
      normalizeCatalogItem
    );

    currentItem = items.find(v => String(v.sku) === sku);

    if (!currentItem) {
      titleEl.textContent = 'Package not found';
      introEl.textContent = `No package with SKU ${sku} was found.`;
      return;
    }

    titleEl.textContent = `Checkout — ${currentItem.title}`;
    introEl.textContent =
      'Secure checkout via PayFast. Your ZIP download and invoice will appear after payment confirmation.';

    priceEl.textContent = moneyZar(currentItem.priceCents);
    badgesEl.innerHTML = `
      <span class="badge">${currentItem.subject}</span>
      <span class="badge">${currentItem.province}</span>
    `;
    fromYearMeta.textContent = currentItem.fromYear;
    toYearMeta.textContent = currentItem.toYear;
    filesMeta.textContent = currentItem.fileCount;
  } catch (err) {
    titleEl.textContent = 'Catalog unavailable';
    introEl.textContent = 'The package could not be loaded.';
    console.error(err);
  }
}

if (payLaterBtn) {
  payLaterBtn.addEventListener('click', () => {
    alert(
      'Pay-later is not enabled. Please continue with secure PayFast checkout.'
    );
  });
}

if (checkoutForm) {
  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(checkoutForm).entries());

    // IMPORTANT:
    // Use URLSearchParams so the browser sends a simple form POST.
    // This avoids the JSON/CORS preflight issue that causes "Failed to fetch".
    const body = new URLSearchParams({
      action: 'createCheckout',
      sku: sku,
      email: data.customer_email || '',
      customer_name: data.customer_name || '',
      customer_phone: data.customer_phone || '',
      notes: data.notes || ''
    });

    if (!window.STUDYHUB_CONFIG.apiBaseUrl) {
      checkoutStatus.textContent = 'Backend not configured yet.';
      checkoutStatus.classList.add('notice');
      return;
    }

    try {
      const res = await fetch(window.STUDYHUB_CONFIG.apiBaseUrl, {
        method: 'POST',
        body: body
      });

      if (!res.ok) {
        throw new Error('Checkout request failed');
      }

      const out = await res.json();

      if (!out.ok) {
        throw new Error(out.error || 'Checkout creation failed');
      }

      if (!out.payfast_url || !out.payfast_payload) {
        throw new Error('PayFast payload missing');
      }

      // Auto-submit to PayFast
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = out.payfast_url;

      Object.entries(out.payfast_payload).forEach(([k, v]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        input.value = String(v);
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      checkoutStatus.textContent = err.message || 'Checkout failed';
      checkoutStatus.classList.add('notice');
      console.error(err);
    }
  });
}

loadCheckout();
``
