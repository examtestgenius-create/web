// StudyHub checkout: loads SKU from index.json and fills PayFast hosted payment form.
function money2(cents){return (cents/100).toFixed(2)}

const qs = new URLSearchParams(location.search);
const sku = qs.get('sku');

function setForm(cfg, orderId, sku, amountCents){
  document.getElementById('pf_merchant_id').value = cfg.payfast.merchant_id;
  document.getElementById('pf_merchant_key').value = cfg.payfast.merchant_key;
  document.getElementById('pf_return_url').value = cfg.payfast.return_url;
  document.getElementById('pf_cancel_url').value = cfg.payfast.cancel_url;
  document.getElementById('pf_notify_url').value = cfg.payfast.notify_url;
  document.getElementById('pf_order_id').value = orderId;
  document.getElementById('pf_item_name').value = sku;
  document.getElementById('pf_amount').value = money2(amountCents);

  const ok = cfg.payfast.merchant_id && cfg.payfast.merchant_key && cfg.payfast.notify_url;
  document.getElementById('payBtn').disabled = !ok;
}

function title(p){
  if (p.title) return p.title;
  const g = p.grade ? `Grade ${p.grade}` : '';
  if (p.bundle_type === 'UB') return `${g} Ultimate (2022+)`;
  if (p.bundle_type === 'MB') return `${g} ${p.subject} Master (2022+)`;
  if (p.bundle_type === 'SS') return `${g} ${p.subject} ${p.year_or_range || p.year}`;
  if (p.bundle_type === 'PP') return `${g} ${p.subject} ${p.paper_type} ${p.year_or_range || p.year}`;
  return p.sku;
}

if (!sku){
  document.getElementById('productSummary').innerHTML = '<h2>Missing SKU</h2><p>Please return to the catalog and select a product.</p><a class="btn btn-primary" href="catalog.html">Open Catalog</a>';
} else {
  fetch('index.json', {cache:'no-store'})
    .then(r => r.json())
    .then(data => {
      const p = (data.products || []).find(x => x.sku === sku);
      if (!p) throw new Error('SKU not found');

      const orderId = `${sku}-${Date.now()}`;

      document.getElementById('productSummary').innerHTML = `
        <h2>${title(p)}</h2>
        <p class="muted">SKU: ${p.sku}</p>
        <div class="divider"></div>
        <p><strong>Price:</strong> R${Math.round(p.price_cents/100)}</p>
        <p class="muted">Delivery: ZIP download link by email after payment verification.</p>
      `;

      const cfg = window.STUDYHUB_CONFIG;
      if (!cfg || !cfg.payfast){
        document.getElementById('productSummary').insertAdjacentHTML('beforeend', '<p class="hint">Config missing. Copy <code>assets/js/config.example.js</code> to <code>assets/js/config.js</code> and set PayFast + notify_url.</p>');
        return;
      }

      setForm(cfg, orderId, p.sku, p.price_cents);
    })
    .catch(() => {
      document.getElementById('productSummary').innerHTML = '<h2>Product not found</h2><p>The selected SKU does not exist in index.json.</p><a class="btn btn-primary" href="catalog.html">Back to catalog</a>';
    });
}
