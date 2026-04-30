(function () {
  const params = new URL(window.location.href).searchParams;
  const orderId = params.get('order_id') || params.get('order') || params.get('m_payment_id') || '';
  const statusEl = document.getElementById('successStatus');
  const block = document.getElementById('deliveryBlock');
  const deliveryLink = document.getElementById('deliveryLink');
  const invoiceLink = document.getElementById('invoiceLink');
  const orderLabel = document.getElementById('orderIdLabel');
  orderLabel.textContent = orderId || 'Pending';

  async function loadStatus() {
    if (!orderId || !window.STUDYHUB_CONFIG.apiBaseUrl) {
      statusEl.textContent = orderId ? `Payment return received for order ${orderId}. Configure the Apps Script URL in config.js to load delivery and invoice links automatically.` : 'Payment return received. Configure the Apps Script URL in config.js to load delivery and invoice links automatically.';
      return;
    }
    try {
      const res = await fetch(window.STUDYHUB_CONFIG.apiBaseUrl + '?action=order-status&order_id=' + encodeURIComponent(orderId), { cache: 'no-store' });
      const out = await res.json();
      if (!res.ok || out.ok === false) throw new Error(out.error || 'Order lookup failed');
      statusEl.textContent = `Payment confirmed for order ${orderId}.`;
      if (out.delivery_url) {
        deliveryLink.href = out.delivery_url;
        deliveryLink.textContent = 'Open delivery link';
      } else {
        deliveryLink.removeAttribute('href');
        deliveryLink.textContent = 'Delivery link not ready yet';
      }
      if (out.invoice_url) {
        invoiceLink.href = out.invoice_url;
        invoiceLink.textContent = 'Open invoice';
      } else {
        invoiceLink.removeAttribute('href');
        invoiceLink.textContent = 'Invoice not ready yet';
      }
      block.style.display = 'block';
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Payment returned, but order details could not be loaded yet. Please contact support if this persists.';
    }
  }
  loadStatus();
})();
