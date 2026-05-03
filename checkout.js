async function initCheckout(){
  const params = new URLSearchParams(location.search);
  const sku = params.get('sku');
  const res = await fetch('data/catalog.json');
  const data = await res.json();
  const item = (data.items || []).find(x => x.sku === sku) || data.items?.[0];
  const form = document.getElementById('checkoutForm');
  if (!item) { form.innerHTML = '<p>Pack not found.</p>'; return; }
  form.innerHTML = `
    <p><strong>${item.title}</strong></p>
    <p>Price: R${(Number(item.price_cents||0)/100).toFixed(2)}</p>
    <label>Name<input type="text" name="name" required></label>
    <label>Email<input type="email" name="email" required></label>
    <label>Phone<input type="tel" name="phone"></label>
    <input type="hidden" name="sku" value="${item.sku}">
    <button type="button" class="btn btn-primary" id="payfastBtn">Proceed to PayFast</button>
    <p class="checkout-note">Replace this button flow with the real PayFast form fields and signature generation in production.</p>`;
  document.getElementById('payfastBtn').addEventListener('click', ()=>alert('Wire this page to your Apps Script launch endpoint or PayFast form submit.'));
}
initCheckout().catch(console.error);
