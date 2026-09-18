const cfg = window.STUDYHUB_CONFIG || {};
const val = (o,...keys) => { for (const k of keys) if (o && o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; return ''; };
const money = cents => Number(cents || 0) === 0 ? 'FREE' : new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(Number(cents)/100);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wanted = new URL(location.href).searchParams.get('sku') || '';

async function fetchCatalog(){
  if (!cfg.liveCatalogUrl) throw new Error('Live Catalog URL is not configured.');
  const response = await fetch(cfg.liveCatalogUrl,{cache:'no-store'});
  if (!response.ok) throw new Error('HTTP '+response.status);
  const json = await response.json();
  if (json.ok === false) throw new Error(json.error || 'Catalog request failed.');
  const data = json.data || json.items || json.packages || json || [];
  return Array.isArray(data) ? data : [];
}

async function init(){
  const heading = document.getElementById('detailStatus');
  const root = document.getElementById('packageDetailRoot');
  if (!wanted) {
    heading.innerHTML = '<span class="eyebrow">Bundle detail</span><h1>Missing bundle SKU</h1><p>Return to the live Catalog and select a bundle.</p>';
    return;
  }
  try {
    const rows = await fetchCatalog();
    const item = rows.find(row => String(val(row,'sku','SKU')) === wanted);
    if (!item) throw new Error('Bundle not found in the live Catalog.');
    const title = val(item,'title','Title') || wanted;
    const grade = val(item,'grade','Grade');
    const subject = val(item,'subject_or_all','subject_name') || 'All subjects';
    const years = val(item,'year_or_range','year') || 'Available years';
    const type = val(item,'bundle_type','type') || 'Bundle';
    const pairs = Number(val(item,'pair_count') || 0);
    const files = Number(val(item,'file_count') || 0);
    const description = val(item,'description','notes') || 'Verified exam papers and matching memos, organised for focused revision.';
    heading.innerHTML = `<span class="eyebrow">Verified ZIP bundle</span><h1>${esc(title)}</h1><p>Review the exact package before secure checkout.</p>`;
    root.innerHTML = `
      <div class="detail-layout">
        <article class="detail-card card-surface">
          <div class="detail-card-top"><span class="bundle-badge">${esc(type)}</span><span class="ready-badge"><i></i> ZIP ready</span></div>
          <h2>${esc(subject)}</h2><p class="detail-description">${esc(description)}</p>
          <div class="detail-badges"><span>Grade ${esc(grade)}</span><span>${esc(years)}</span><span>${esc(subject)}</span></div>
          <div class="detail-stats"><div><strong>${pairs}</strong><small>verified paper + memo pairs</small></div><div><strong>${files}</strong><small>files in ZIP</small></div><div><strong>Digital</strong><small>delivery after confirmation</small></div></div>
          <div class="detail-note"><strong>What you receive</strong><p>A downloadable ZIP containing the listed verified papers and matching memos, plus a manifest describing the included records.</p></div>
        </article>
        <aside class="purchase-card card-surface">
          <span class="purchase-label">Secure digital purchase</span>
          <div class="purchase-price">${money(val(item,'price_cents'))}</div>
          <p>Pay securely through PayFast. The download is released after payment confirmation.</p>
          <a class="btn btn-primary btn-wide" href="checkout.html?sku=${encodeURIComponent(wanted)}">Continue to secure checkout</a>
          <a class="btn btn-light btn-wide" href="index.html#packages">Back to bundles</a>
          <small>Need help? <a href="mailto:examtestgenius@gmail.com?subject=${encodeURIComponent('StudyHub bundle help: '+wanted)}">Contact StudyHub support</a>.</small>
        </aside>
      </div>`;
  } catch (error) {
    heading.innerHTML = `<span class="eyebrow">Bundle detail</span><h1>Bundle unavailable</h1><p>${esc(error.message)}</p>`;
    root.innerHTML = '<a class="btn btn-primary" href="index.html#packages">Return to bundles</a>';
  }
}
init();
