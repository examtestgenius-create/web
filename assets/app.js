
// StudyHub minimal client
const cfg = {
  brand: 'StudyHub',
  currency: 'ZAR',
  whatsappNumber: '+27716816131', // e.g. '27711234567' (international format, no +)
  catalogEndpoint: 'https://script.google.com/macros/s/AKfycbwLzazM5zV41rFJ4d5NzZubstnUB-AYdfriqd9IKjb3ZoS_MmwNrnnR8c93ci5-HkST/exec', // Optional: Apps Script Web App URL with ?action=catalog
};

function loadJsonp(url){
  return new Promise((resolve, reject) => {
    const cb = 'cb_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP timeout'));
    }, 15000);

    function cleanup(){
      clearTimeout(timer);
      delete window[cb];
      script.remove();
    }

    window[cb] = (data) => {
      cleanup();
      resolve(data);
    };

    const join = url.includes('?') ? '&' : '?';
    script.src = `${url}${join}callback=${cb}`;
    script.onerror = () => {
      cleanup();
      reject(new Error('JSONP load error'));
    };

    document.body.appendChild(script);
  });
}

function formatZAR(cents){
  const r = (cents/100).toFixed(0);
  return `R${r}`;
}

async function loadCatalog(){
  // Priority: endpoint -> local JSON
  if(cfg.catalogEndpoint){
    const url = cfg.catalogEndpoint + (cfg.catalogEndpoint.includes('?') ? '&' : '?') + 'action=catalog';
    const res = await fetch(url);
    if(!res.ok) throw new Error('Catalog fetch failed');
    return await res.json();
  }
  const res = await fetch('./products.json');
  return await res.json();
}

function getCart(){
  try{return JSON.parse(localStorage.getItem('studyhub_cart')||'[]')}catch(e){return []}
}
function setCart(items){
  localStorage.setItem('studyhub_cart', JSON.stringify(items));
  renderCartBadge();
}
function addToCart(item){
  const cart = getCart();
  const idx = cart.findIndex(x=>x.sku===item.sku);
  if(idx>=0) cart[idx].qty += 1;
  else cart.push({...item, qty:1});
  setCart(cart);
}
function renderCartBadge(){
  const el = document.querySelector('[data-cart-badge]');
  if(!el) return;
  const cart = getCart();
  const n = cart.reduce((a,b)=>a+(b.qty||0),0);
  el.textContent = n;
  el.style.display = n>0 ? 'inline-grid' : 'none';
}

function matchFilters(p, grade, subject){
  if(grade && p.grade!==grade) return false;
  if(subject && p.subject!==subject) return false;
  return true;
}

function unique(list){
  return [...new Set(list)].filter(Boolean);
}

async function initCatalogPage(){
  const data = await loadCatalog();
  const products = data.products || [];

  // Populate filters
  const grades = unique(products.map(p=>p.grade)).sort();
  const subjects = unique(products.map(p=>p.subject)).sort();

  const gradeSel = document.getElementById('gradeSel');
  const subjSel = document.getElementById('subjectSel');

  if(gradeSel){
    gradeSel.innerHTML = '<option value="">All Grades</option>' + grades.map(g=>`<option>${g}</option>`).join('');
  }
  if(subjSel){
    subjSel.innerHTML = '<option value="">All Subjects</option>' + subjects.map(s=>`<option>${s}</option>`).join('');
  }

  const grid = document.getElementById('productGrid');

  function render(){
    const g = gradeSel ? gradeSel.value : '';
    const s = subjSel ? subjSel.value : '';
    const filtered = products.filter(p=>matchFilters(p,g,s));
    grid.innerHTML = filtered.map(p=>{
      const memoLabel = p.hasMemo ? 'Papers + Memos' : 'Memo required';
      const memoChip = p.hasMemo ? '<span class="btn btn-secondary" style="padding:6px 10px;border-radius:999px;font-weight:700">Memo Included</span>'
                                 : '<span class="btn btn-secondary" style="padding:6px 10px;border-radius:999px;font-weight:700;color:#b91c1c;border-color:#fecaca;background:#fff5f5">Missing Memo</span>';
      const disabled = p.hasMemo ? '' : 'disabled';
      const disableStyle = p.hasMemo ? '' : 'style="opacity:.55;cursor:not-allowed"';
      return `
      <div class="card">
        <h3>${p.title}</h3>
        <small>${p.grade} • ${p.subject} • ${memoLabel}</small>
        <div class="price">${formatZAR(p.price_cents)}</div>
        <div class="actions">
          ${memoChip}
          <button class="btn btn-primary" ${disabled} ${disableStyle} data-add="${p.sku}">Add to Cart</button>
          <a class="btn btn-secondary" href="cart.html">Checkout</a>
        </div>
      </div>`;
    }).join('');

    grid.querySelectorAll('[data-add]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const sku = btn.getAttribute('data-add');
        const item = products.find(x=>x.sku===sku);
        if(!item || !item.hasMemo) return;
        addToCart({sku:item.sku,title:item.title,price_cents:item.price_cents});
      });
    });
  }

  if(gradeSel) gradeSel.addEventListener('change', render);
  if(subjSel) subjSel.addEventListener('change', render);
  render();
  renderCartBadge();
}

function toWhatsAppMessage(cart, email){
  const lines = cart.map(i=>`- ${i.title} x${i.qty} (${formatZAR(i.price_cents)})`);
  const total = cart.reduce((a,b)=>a+b.price_cents*b.qty,0);
  return encodeURIComponent([
    `StudyHub Order Request`,
    email ? `Email: ${email}` : '',
    '',
    ...lines,
    '',
    `Total: ${formatZAR(total)}`
  ].filter(Boolean).join('\n'));
}

function renderCart(){
  const cart = getCart();
  const list = document.getElementById('cartList');
  const totalEl = document.getElementById('cartTotal');

  if(!list) return;
  if(cart.length===0){
    list.innerHTML = '<div class="card"><b>Your cart is empty.</b><div class="muted" style="margin-top:6px">Browse packs to add items.</div><div style="margin-top:12px"><a class="btn btn-primary" href="catalog.html">Browse Packs</a></div></div>';
    if(totalEl) totalEl.textContent = 'R0';
    renderCartBadge();
    return;
  }

  list.innerHTML = cart.map((i,idx)=>`
    <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div>
        <b>${i.title}</b>
        <div class="muted" style="font-size:13px">${formatZAR(i.price_cents)} each</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <button class="btn btn-secondary" data-dec="${idx}">−</button>
        <b>${i.qty}</b>
        <button class="btn btn-secondary" data-inc="${idx}">+</button>
        <button class="btn btn-secondary" data-del="${idx}">Remove</button>
      </div>
    </div>
  `).join('');

  const total = cart.reduce((a,b)=>a+b.price_cents*b.qty,0);
  if(totalEl) totalEl.textContent = formatZAR(total);

  list.querySelectorAll('[data-inc]').forEach(b=>b.addEventListener('click',()=>{
    const idx=+b.getAttribute('data-inc');
    cart[idx].qty++; setCart(cart); renderCart();
  }));
  list.querySelectorAll('[data-dec]').forEach(b=>b.addEventListener('click',()=>{
    const idx=+b.getAttribute('data-dec');
    cart[idx].qty=Math.max(1,cart[idx].qty-1); setCart(cart); renderCart();
  }));
  list.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{
    const idx=+b.getAttribute('data-del');
    cart.splice(idx,1); setCart(cart); renderCart();
  }));

  renderCartBadge();
}

function initCartActions(){
  renderCart();
  const email = document.getElementById('buyerEmail');
  const waBtn = document.getElementById('whatsappCheckout');
  if(waBtn){
    waBtn.addEventListener('click',()=>{
      const cart=getCart();
      if(!cfg.whatsappNumber){
        alert('WhatsApp number not configured yet. Set it in app.js');
        return;
      }
      const msg = toWhatsAppMessage(cart, email?email.value:'');
      window.open(`https://wa.me/${cfg.whatsappNumber}?text=${msg}`,'_blank');
    });
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  renderCartBadge();
  if(document.body.dataset.page==='catalog') initCatalogPage().catch(e=>console.error(e));
  if(document.body.dataset.page==='cart') initCartActions();
});
