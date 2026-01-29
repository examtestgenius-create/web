
window.cfg = {
  catalogEndpoint: 'https://script.google.com/macros/s/AKfycbwLzazM5zV41rFJ4d5NzZubstnUB-AYdfriqd9IKjb3ZoS_MmwNrnnR8c93ci5-HkST/exec',
  whatsappNumber: '0785766306',
  modeHint: 'live'
};
function ensureEndpointOK(){
  if(!window.cfg || !window.cfg.catalogEndpoint){ alert('Missing Web App /exec URL.'); return false; }
  try{ new URL(window.cfg.catalogEndpoint); }catch(e){ alert('Invalid cfg.catalogEndpoint.'); return false; }
  if(window.cfg.catalogEndpoint.includes('googleusercontent.com/macros/echo')){ alert('Wrong endpoint: use /exec.'); return false; }
  return true;
}
(function(){
  const CART_KEY='studyhub_cart';
  function read(){ try { return JSON.parse(localStorage.getItem(CART_KEY)||'[]'); } catch(e){ return []; } }
  function write(items){ localStorage.setItem(CART_KEY, JSON.stringify(items||[])); }
  function updateBadge(){ const b=document.querySelector('[data-cart-badge]'); if(!b) return; const n=read().length; b.style.display=n>0?'inline-flex':'none'; b.textContent=String(n); }
  window.Cart={read,write,updateBadge}; document.addEventListener('DOMContentLoaded', updateBadge);
})();
(function(){
  function normalizeSANumber(raw){ let num=String(raw||'').replace(/[^0-9]/g,''); if(num.startsWith('0')) num='27'+num.slice(1); return num; }
  function buildMsg(items,total){ const lines=['*StudyHub Order*','',...items.map((it,i)=>`#${i+1} ${it.name||it.sku} — R${Number((it.price_cents?it.price_cents/100:it.price)||0).toFixed(2)}`),'',`*Total:* R${Number(total).toFixed(2)}`,'','Please send your email address to receive the download links and invoice.']; return lines.join('
'); }
  function whatsappCheckout(){ const cart=(window.Cart?window.Cart.read():[]); if(!cart.length){ alert('Your cart is empty.'); return; } const total=cart.reduce((s,it)=> s + Number((it.price_cents?it.price_cents/100:it.price)||0),0); const msg=encodeURIComponent(buildMsg(cart,total)); const num=(window.cfg&&window.cfg.whatsappNumber? normalizeSANumber(window.cfg.whatsappNumber):''); if(!num){ alert('WhatsApp number not configured.'); return; } window.location.href=`https://wa.me/${num}?text=${msg}`; }
  window.whatsappCheckout=whatsappCheckout;
})();
window.addToCart=function(item){ const sku=item.sku||item.SKU; const name=item.name||item.title||sku||'Pack'; const price=(typeof item.price_cents==='number')?(item.price_cents/100):Number(item.price||0); const cart=window.Cart.read(); cart.push({sku,name,price}); window.Cart.write(cart); window.Cart.updateBadge(); };
(async function(){ if(document.body.dataset.page!=='catalog') return; try{ if(!ensureEndpointOK()) return; const url=`${window.cfg.catalogEndpoint}${window.cfg.catalogEndpoint.includes('?')?'&':'?'}action=catalog`; const res=await fetch(url); const data=await res.json(); const gradeSel=document.getElementById('gradeSel'); const subjectSel=document.getElementById('subjectSel'); const grid=document.getElementById('productGrid'); const grades=Array.from(new Set(data.map(d=>d.grade))).filter(Boolean).sort(); const subjects=Array.from(new Set(data.map(d=>d.subject))).filter(Boolean).sort(); ['All',...grades].forEach(g=>{ const o=document.createElement('option'); o.value=g; o.textContent=g; gradeSel.appendChild(o); }); ['All',...subjects].forEach(s=>{ const o=document.createElement('option'); o.value=s; o.textContent=s; subjectSel.appendChild(o); }); function render(){ const g=gradeSel.value,s=subjectSel.value; grid.innerHTML=''; data.filter(d=>(g==='All'||d.grade===g)&&(s==='All'||d.subject===s)).forEach(d=>{ const card=document.createElement('div'); card.className='card'; card.innerHTML=`<div class="grid" style="grid-template-columns:80px 1fr;gap:12px;align-items:center"><img src="${d.img||'./assets/placeholder.png'}" alt="${d.name}" style="width:80px;height:80px;object-fit:cover;border-radius:8px"/><div><div class="muted">${d.grade} • ${d.subject}</div><h3 style="margin:4px 0">${d.name}</h3><div class="price">R${Number(d.price).toFixed(2)}</div><div style="margin-top:8px"><button class="btn" data-add>Add to Cart</button></div></div></div>`; card.querySelector('[data-add]').addEventListener('click',()=>{ window.addToCart({sku:d.sku,name:d.name,price:d.price}); alert('Added to cart.'); window.Cart.updateBadge(); }); grid.appendChild(card); }); } gradeSel.addEventListener('change',render); subjectSel.addEventListener('change',render); render(); }catch(err){ console.error(err); } })();
