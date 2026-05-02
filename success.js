// StudyHub success.js (aligned)
// Shows delivery link after PayFast confirmation by polling Apps Script order-status.
(function(){
  window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || { webappUrl:'', apiBaseUrl:'', siteBaseUrl:'' };
  const statusEl = document.getElementById('successStatus');
  const deliveryBlock = document.getElementById('deliveryBlock');
  const deliveryLink = document.getElementById('deliveryLink');
  const invoiceLink = document.getElementById('invoiceLink');

  function setStatus(msg, ok){
    if(!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.toggle('status-ok', !!ok);
    statusEl.classList.toggle('status-error', ok === false);
  }

  function getOrderId(){
    const p = new URL(window.location.href).searchParams;
    return p.get('order') || localStorage.getItem('studyhub_last_order_id') || '';
  }

  async function fetchOrder(orderId){
    const base = window.STUDYHUB_CONFIG.webappUrl || window.STUDYHUB_CONFIG.apiBaseUrl || '';
    if(!base) throw new Error('Web App URL not configured in config.js');
    const url = base + '?action=order-status&order_id=' + encodeURIComponent(orderId);
    const res = await fetch(url, {cache:'no-store'});
    if(!res.ok) throw new Error('Order status request failed');
    return await res.json();
  }

  async function poll(){
    const orderId = getOrderId();
    if(!orderId){
      setStatus('Payment received. Confirming your order… (missing order reference)', false);
      return;
    }
    setStatus('Confirming your order…', null);

    const started = Date.now();
    const timeoutMs = 90_000;
    const intervalMs = 3000;

    while(Date.now() - started < timeoutMs){
      try{
        const order = await fetchOrder(orderId);
        const status = String(order.status || order.Status || '').toUpperCase();
        const deliveryUrl = order.delivery_url || order.deliveryUrl || '';
        const invoiceUrl = order.invoice_url || order.invoiceUrl || '';

        if(status === 'COMPLETE' && deliveryUrl){
          setStatus('Order confirmed. Your download is ready.', true);
          if(deliveryLink) deliveryLink.href = deliveryUrl;
          if(invoiceLink) invoiceLink.href = invoiceUrl || '#';
          if(deliveryBlock) deliveryBlock.style.display = 'block';
          return;
        }
        if(status && status !== 'PENDING'){
          // e.g. FAILED, CANCELLED, ITN_FAILED
          setStatus('Order status: ' + status + '. If you need help, contact support.', false);
          return;
        }
      }catch(e){
        // keep trying
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }
    setStatus('Still confirming payment. If this takes longer than a few minutes, contact support with your email address.', false);
  }

  poll();
})();
