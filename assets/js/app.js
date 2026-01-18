// Minimal interactivity and catalog filtering
const state = { grade:'', subject:'', term:'', type:'' };

function qs(sel){return document.querySelector(sel)}
function qsa(sel){return [...document.querySelectorAll(sel)]}

async function loadCatalog(){
  const el = qs('#catalog-list');
  if(!el) return;
  const res = await fetch('assets/data/papers.json');
  const data = await res.json();
  window.__papers = data;
  renderCatalog();
}

function renderCatalog(){
  const el = qs('#catalog-list');
  if(!el) return;
  const data = (window.__papers||[]).filter(p=>
    (!state.grade || p.grade===state.grade) &&
    (!state.subject || p.subject===state.subject) &&
    (!state.term || p.term===state.term) &&
    (!state.type || p.type===state.type)
  );
  el.innerHTML = data.map(p=>`<div class="item">
      <div class="note">${p.grade} • ${p.subject} • ${p.term} • ${p.year}</div>
      <h4>${p.title}</h4>
      <div class="note">${p.type==='memo'?'Memo':'Question Paper'}</div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <a class="btn btn-outline" href="${p.previewUrl}" target="_blank" rel="noopener">Preview</a>
        <a class="btn btn-primary" href="product.html?sku=${encodeURIComponent(p.bundleSku)}">Get Bundle</a>
      </div>
    </div>`).join('');
}

function handleFilters(){
  qsa('[data-filter]').forEach(sel=>{
    sel.addEventListener('change', e=>{
      state[sel.dataset.filter] = sel.value;
      renderCatalog();
    });
  });
}

function hydrateProduct(){
  const params = new URLSearchParams(location.search);
  const sku = params.get('sku');
  if(!sku) return;
  const el = qs('#sku');
  if(el) el.textContent = sku;
  // Wire PayFast form placeholders
  const itemName = qs('input[name="item_name"]');
  if(itemName) itemName.value = sku;
}

window.addEventListener('DOMContentLoaded', ()=>{
  loadCatalog();
  handleFilters();
  hydrateProduct();
});
