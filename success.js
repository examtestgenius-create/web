window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {};
const params = new URL(window.location.href).searchParams;
const orderId = params.get('order_id') || params.get('order') || params.get('m_payment_id') || '';
const statusEl = document.getElementById('successStatus');
const blockEl = document.getElementById('deliveryBlock');
const deliveryEl = document.getElementById('deliveryLink');
const invoiceEl = document.getElementById('invoiceLink');
async function loadOrderStatus() {
  if (!orderId) { if (statusEl) statusEl.textContent = 'Order reference missing. Please check your confirmation email.'; return; }
  const base = window.STUDYHUB_CONFIG.apiBaseUrl || 'https://script.google.com/macros/s/AKfycbzP1FMuDC92FKnQ0T-DJrMah3b7vsO1rADn4IYq5kjXzu79C4hdu1fyo1vGhxs9K5Vy/exec';
  try {
    const res = await fetch(base + '?action=order-status&order_id=' + encodeURIComponent(orderId), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const out = await res.json();
    const status = String(out.status || out.payment_status || '').toUpperCase();
    const delivery = out.delivery_url || out.deliveryUrl || '';
    const invoice = out.invoice_url || out.invoiceUrl || '';
    if (statusEl) statusEl.textContent = status ? ('Order ' + orderId + ' status: ' + status) : ('Order ' + orderId + ' captured.');
    if (delivery || invoice) {
      if (deliveryEl && delivery) deliveryEl.href = delivery;
      if (invoiceEl && invoice) invoiceEl.href = invoice;
      if (blockEl) blockEl.style.display = 'block';
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = 'We could not confirm the order automatically yet. Please refresh in a moment or contact support with order ' + orderId + '.';
  }
}
loadOrderStatus();
