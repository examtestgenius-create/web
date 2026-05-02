
console.log('app.js READY');

async function fetchStudyHubCatalog(){
  const res = await fetch(window.STUDYHUB_CONFIG.liveCatalogUrl,{cache:'no-store'});
  if(!res.ok) throw new Error('Catalog load failed');
  return res.json();
}

function moneyZarFromCents(c){
  return new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(Number(c||0)/100);
}

async function loadCatalog(){
  const data = await fetchStudyHubCatalog();
  const items = data.items || data.packages || [];
  const root = document.getElementById('packageCards');
  if(!root) return;
  root.innerHTML = items.map(item=>`
    <article class="card-surface">
      <h3>${item.sku}</h3>
      <p>${item.description||''}</p>
      <div class="price-chip">${moneyZarFromCents(item.price_cents)}</div>
      <button class="btn btn-primary" onclick="location.href='checkout.html?sku=${item.sku}'">Buy</button>
    </article>
  `).join('');
}

loadCatalog();
