const cfg = window.STUDYHUB_CONFIG || {};

let items = [];

const $ = id => document.getElementById(id);

const money = c =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR'
  }).format((Number(c) || 0) / 100);

const esc = s =>
  String(s ?? '').replace(/[&<>'"]/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[ch]));

function getWebAppUrl() {
  return (
    cfg.WEBAPP_URL ||
    cfg.webappUrl ||
    cfg.apiBaseUrl ||
    ''
  ).trim();
}

function getAdminUrl() {
  const base = getWebAppUrl();
  return cfg.ADMIN_URL || (base ? base + '?page=admin' : 'admin/');
}

function jsonp(action, params = {}) {
  return new Promise((resolve, reject) => {
    const base = getWebAppUrl();

    if (!base) {
      reject(new Error('Web App URL missing in config.js'));
      return;
    }

    const callbackName =
      'StudyHub_cb_' +
      Math.random().toString(36).slice(2) +
      Date.now();

    const query = new URLSearchParams({
      ...params,
      action,
      callback: callbackName,
      _ts: Date.now()
    });

    const script = document.createElement('script');
    let done = false;

    const timer = setTimeout(() => {
      if (!done) {
        cleanup();
        reject(new Error('Request timed out: ' + action));
      }
    }, 30000);

    function cleanup() {
      done = true;
      clearTimeout(timer);
      try {
        delete window[callbackName];
      } catch (e) {
        window[callbackName] = undefined;
      }
      if (script.parentNode) script.remove();
    }

    window[callbackName] = data => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Network/API error: ' + action));
    };

    script.src = base + '?' + query.toString();
    document.body.appendChild(script);
  });
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' loading ' + url);
  }

  return await response.json();
}

async function loadCatalog() {
  if ($('catalogMeta')) {
    $('catalogMeta').textContent = 'Loading catalog...';
  }

  // 1. New safer JSONP catalog route
  try {
    const data = await jsonp('catalogJsonp');

    if (data && data.ok) {
      items = normalizeItems(data.items || []);
      render();
      return;
    }

    throw new Error(data && data.error ? data.error : 'catalogJsonp failed');
  } catch (e) {
    console.warn('catalogJsonp failed, trying old catalog URLs:', e);
  }

  // 2. Old fallback method
  const urls = [
    cfg.liveCatalogUrl,
    cfg.webappUrl ? cfg.webappUrl + '?action=catalog' : '',
    cfg.apiBaseUrl ? cfg.apiBaseUrl + '?action=catalog' : '',
    cfg.fallbackCatalogUrl
  ].filter(Boolean);

  for (const url of urls) {
    try {
      const data = await fetchJson(url);
      items = normalizeItems(data.items || []);
      render();
      return;
    } catch (e) {
      console.warn(e);
    }
  }

  if ($('catalogMeta')) {
    $('catalogMeta').textContent =
      'Catalog unavailable. Check Apps Script deployment/config.';
  }

  if ($('cards')) {
    $('cards').innerHTML =
      '<div class="panel">Catalog unavailable. Check Apps Script deployment/config.</div>';
  }
}

function normalizeItems(list) {
  return (list || [])
    .filter(x => String(x.published).toLowerCase() !== 'false')
    .filter(x => !x.zip_status || String(x.zip_status).toUpperCase() === 'READY')
    .map(x => ({
      ...x,
      sku: String(x.sku || ''),
      title: x.title || x.sku || 'StudyHub bundle',
      bundle_type: x.bundle_type || 'Bundle',
      grade: x.grade || '',
      subject_or_all: x.subject_or_all || '',
      year_or_range: x.year_or_range || '',
      zip_status: x.zip_status || 'READY',
      price_cents: Number(x.price_cents || 0)
    }));
}

function render() {
  if ($('catalogMeta')) {
    $('catalogMeta').textContent = 'Loaded ' + items.length + ' bundles.';
  }

  const q = ($('q')?.value || '').toLowerCase();
  const grade = $('grade')?.value || 'ALL';
  const type = $('type')?.value || 'ALL';

  const list = items.filter(i =>
    (grade === 'ALL' || String(i.grade) === String(grade)) &&
    (type === 'ALL' || String(i.bundle_type) === String(type)) &&
    (!q || JSON.stringify(i).toLowerCase().includes(q))
  );

  if (!$('cards')) return;

  $('cards').innerHTML =
    list.map(cardHtml).join('') ||
    '<div class="panel">No bundles yet. Run scanner and ZIP builder from the Sheet menu.</div>';
}

function cardHtml(i) {
  return `
    <article class="card">
      <span class="eyebrow">${esc(i.bundle_type || 'Bundle')}</span>

      <h3>${esc(i.title || i.sku)}</h3>

      <div class="badges">
        <span class="badge">Grade ${esc(i.grade)}</span>
        <span class="badge">${esc(i.subject_or_all)}</span>
        <span class="badge">${esc(i.year_or_range)}</span>
        <span class="badge">${esc(i.zip_status)}</span>
      </div>

      <p class="muted">
        ${esc(i.description || 'Paper + memo ZIP bundle.')}
      </p>

      <div class="price">${money(i.price_cents)}</div>

      <div class="actions">
        <a class="btn secondary" href="package.html?sku=${encodeURIComponent(i.sku)}">
          Details
        </a>

        <button class="btn primary" onclick="StudyHub.buy('${esc(i.sku)}')">
          Buy
        </button>
      </div>
    </article>
  `;
}

async function buy(sku) {
  const item = items.find(x => String(x.sku) === String(sku));

  if (!item) {
    alert('Product not found: ' + sku);
    return;
  }

  const email = prompt('Enter email address for delivery:');

  if (!email) return;

  if (!email.includes('@')) {
    alert('Please enter a valid email address.');
    return;
  }

  await createPayFastCheckout(item, email);
}

async function createPayFastCheckout(item, email) {
  try {
    const result = await jsonp('createCheckoutJsonp', {
      sku: item.sku,
      email: email
    });

    if (!result || !result.ok) {
      throw new Error(result && result.error ? result.error : 'Checkout failed');
    }

    submitPayFast(result.endpoint, result.fields);
  } catch (e) {
    alert('Could not create PayFast checkout:\n\n' + e.message);
  }
}

function submitPayFast(endpoint, fields) {
  if (!endpoint || !fields) {
    alert('Invalid PayFast response.');
    return;
  }

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = endpoint;

  Object.keys(fields).forEach(key => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = fields[key];
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

function setupAdminLinks() {
  const adminUrl = getAdminUrl();

  document.querySelectorAll('.admin-link, a[href="admin/"]').forEach(link => {
    link.href = adminUrl;
    link.target = '_blank';
  });
}

document.addEventListener('input', e => {
  if (['q', 'grade', 'type'].includes(e.target.id)) {
    render();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  setupAdminLinks();
  loadCatalog();
});

window.StudyHub = {
  loadCatalog,
  render,
  buy
};
