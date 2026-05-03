async function loadJson(path) {
  const res = await fetch(path, {cache:'no-store'});
  if (!res.ok) throw new Error('Failed to load ' + path);
  return await res.json();
}

function money(cents){
  return 'R' + (Number(cents || 0) / 100).toFixed(2);
}

function renderFreebies(items){
  const mount = document.getElementById('freeCards');
  if (!mount) return;
  mount.innerHTML = items.filter(x => x.active).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(item => `
    <article class="free-card">
      <span class="tag">FREE</span>
      <h3>${item.title}</h3>
      <p>${item.description}</p>
      <a class="btn btn-primary" href="${item.url}">Open</a>
    </article>`).join('');
}

function renderPacks(items){
  const mount = document.getElementById('packCards');
  if (!mount) return;
  mount.innerHTML = items.filter(x => x.published !== false).slice(0,6).map(item => `
    <article class="pack-card">
      <span class="tag">${item.bundle_type}</span>
      <h3>${item.title}</h3>
      <p>${item.description || 'Built from complete paper + memo records.'}</p>
      <div class="price"><strong>${money(item.price_cents)}</strong><span>${item.file_count || 0} files</span></div>
      <div class="pack-actions">
        <a class="btn btn-primary" href="package.html?sku=${encodeURIComponent(item.sku)}">View Pack</a>
        <a class="btn btn-secondary" href="checkout.html?sku=${encodeURIComponent(item.sku)}">Buy Now</a>
      </div>
    </article>`).join('');
}

Promise.all([
  loadJson('data/free-resources.json'),
  loadJson('data/catalog.json')
]).then(([freebies, catalog]) => {
  renderFreebies(freebies.items || []);
  renderPacks(catalog.items || []);
}).catch(err => {
  console.error(err);
});
