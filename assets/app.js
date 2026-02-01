
window.cfg = window.cfg || {
  // Paste Apps Script Web App URL (ends with /exec)
  catalogEndpoint: "",
  supportEmail: "examtestgenius@gmail.com",
  whatsappNumber: "",
  whatsappPretty: ""
};

const CART_KEY='studyhub_cart';
function readCart(){ try{ return JSON.parse(localStorage.getItem(CART_KEY)||'[]'); }catch(e){ return []; } }
function writeCart(items){ localStorage.setItem(CART_KEY, JSON.stringify(items)); refreshBadge(); }
function refreshBadge(){ const b=document.querySelector('[data-cart-badge]'); if(!b) return; const c=readCart().length; b.style.display=c?'grid':'none'; b.textContent=c||''; }
window.refreshBadge = refreshBadge;
window.addToCart = function(item){
  const cart = readCart();
  const i = cart.findIndex(x=>x.sku===item.sku);
  if(i>=0) cart[i].qty = (Number(cart[i].qty)||1)+1;
  else cart.push({ sku:item.sku, title:item.title, price:Number(item.price||0), qty:1 });
  writeCart(cart);
};

document.addEventListener('DOMContentLoaded', refreshBadge);
