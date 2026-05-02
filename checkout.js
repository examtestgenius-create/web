
// CLEAN checkout.js (no HTML entities)
// Version: v1-clean
console.log('checkout.js loaded clean');

const sku = new URL(window.location.href).searchParams.get('sku') || '';
const titleEl = document.getElementById('checkoutTitle');
const introEl = document.getElementById('checkoutIntro');
const priceEl = document.getElementById('checkoutPrice');
const filesMeta = document.getElementById('filesMeta');
const checkoutForm = document.getElementById('checkoutForm');
const checkoutStatus = document.getElementById('checkoutStatus');

function money(cents){
  return new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(Number(cents||0)/100);
}

async function load(){
  const res = await fetch(window.STUDYHUB_CONFIG.liveCatalogUrl,{cache:'no-store'});
  const data = await res.json();
  const items = data.items || data.packages || [];
  const item = items.find(i=>String(i.sku||i.SKU)===sku);
  if(!item){ titleEl.textContent='Bundle not found'; return; }
  titleEl.textContent = `Checkout — ${sku}`;
  introEl.innerHTML = 'Secure payment via <strong>PayFast</strong>.';
  priceEl.textContent = money(item.price_cents);
  filesMeta.textContent = `${item.file_count||0} files`;
}

checkoutForm.addEventListener('submit', async e=>{
  e.preventDefault();
  checkoutStatus.textContent = 'Redirecting to PayFast…';
  const fd = Object.fromEntries(new FormData(checkoutForm).entries());
  const res = await fetch(window.STUDYHUB_CONFIG.apiBaseUrl,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=UTF-8'},
    body:JSON.stringify({
      action:'createCheckout',
      sku,
      email:fd.customer_email,
      customer_email:fd.customer_email,
      customer_phone:fd.customer_phone||'',
      name_first:(fd.customer_name||'Student').split(' ')[0],
      name_last:(fd.customer_name||'Customer').split(' ').slice(1).join(' ')||'Customer'
    })
  });
  const out = await res.json();
  if(!out.ok) throw new Error(out.error||'Checkout failed');
  const f = document.createElement('form');
  f.method='POST'; f.action=out.payfast_url;
  Object.entries(out.payfast_payload).forEach(([k,v])=>{
    const i=document.createElement('input'); i.type='hidden'; i.name=k; i.value=v; f.appendChild(i);
  });
  document.body.appendChild(f); f.submit();
});

load();
