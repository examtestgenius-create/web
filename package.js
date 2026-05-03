async function loadDetail(){
  const params = new URLSearchParams(location.search);
  const sku = params.get('sku');
  const res = await fetch('data/catalog.json');
  const data = await res.json();
  const item = (data.items || []).find(x => x.sku === sku) || data.items?.[0];
  const mount = document.getElementById('packageDetail');
  if (!item) { mount.innerHTML = '<p>Pack not found.</p>'; return; }
  mount.innerHTML = `
    <span class="tag">${item.bundle_type}</span>
    <h2>${item.title}</h2>
    <p>${item.description || ''}</p>
    <div class="price"><strong>R${(Number(item.price_cents||0)/100).toFixed(2)}</strong><span>${item.file_count || 0} files</span></div>
    <p><strong>SKU:</strong> ${item.sku}</p>
    <a class="btn btn-primary" href="checkout.html?sku=${encodeURIComponent(item.sku)}">Continue to Checkout</a>`;
}
loadDetail().catch(console.error);
