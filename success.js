// StudyHub success.js
// Polls Apps Script for order status and shows delivery + invoice links.
(function(){
  window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || { webappUrl:'', apiBaseUrl:'' };
  const statusEl = document.getElementById('successStatus');
  const deliveryBlock = document.getElementById('deliveryBlock');
  const deliveryLink = document.getElementById('deliveryLink');
  const invoiceLink = document.getElementById('invoiceLink');

  function setStatus(msg, state){
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.toggle('status-ok', state === 'ok');
    statusEl.classList.toggle('status-error', state === 'error');
  }

  function getOrderId(){
    const p = new URL(window.location.href).searchParams;
    return p.get('order') || localStorage.getItem('studyhub_last_order_id') || '';
  }

  async function fetchOrder(orderId){
    const base = window.STUDYHUB_CONFIG.webappUrl || window.STUDYHUB_CONFIG.apiBaseUrl || '';
    if (!base) throw new Error('Web App URL missing in config.js');
    const url = base + '?action=order-status&order_id=' + encodeURIComponent(orderId);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Order status fetch failed');
    return await res.json();
  }

  async function poll(){
    const orderId = getOrderId();
    if (!orderId){
      setStatus('Payment successful. Confirming your order… (missing order reference)', 'error');
      return;
    }
    setStatus('Confirming your order…', '');

    const start = Date.now();
    const timeoutMs = 120000;
    while (Date.now() - start < timeoutMs){
      try {
        const o = await fetchOrder(orderId);
        const status = String(o.status || '').toUpperCase();
        const deliveryUrl = o.delivery_url || '';
        const invoiceUrl = o.invoice_url || '';

        if (status === 'COMPLETE' && deliveryUrl){
          setStatus('Order confirmed. Your download is ready.', 'ok');
          if (deliveryLink) deliveryLink.href = deliveryUrl;
          if (invoiceLink) invoiceLink.href = invoiceUrl || '#';
          if (deliveryBlock) deliveryBlock.style.display = 'block';
          return;
        }
        if (status && status !== 'PENDING'){
          setStatus('Order status: ' + status + '. If you need help, contact support.', 'error');
          return;
        }
      } catch (e) {
        // keep trying
      }
      await new Promise(r => setTimeout(r, 3000));
    }

    setStatus('Still confirming payment. If this takes longer than a few minutes, contact support.', 'error');
  }

  poll();
})();
