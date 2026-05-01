// StudyHub success.js
window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || { webappUrl:'', apiBaseUrl:'' };

const statusEl = document.getElementById('successStatus');
const deliveryBlock = document.getElementById('deliveryBlock');
const deliveryLink = document.getElementById('deliveryLink');
const invoiceLink = document.getElementById('invoiceLink');

function getOrderId(){
  const p = new URL(window.location.href).searchParams;
  return p.get('order_id') || p.get('m_payment_id') || p.get('order') || '';
}

async function pollStatus(orderId){
  const base = window.STUDYHUB_CONFIG.webappUrl || window.STUDYHUB_CONFIG.apiBaseUrl || '';
  if (!base){
    statusEl.textContent = 'Backend not configured. Please check your email for delivery.';
    return;
  }

  const url = base + '?action=order-status&order_id=' + encodeURIComponent(orderId);

  for (let i=0; i<10; i++){
    try {
      const res = await fetch(url, { cache:'no-store' });
      if (!res.ok) throw new Error('HTTP '+res.status);
      const out = await res.json();

      const status = String(out.status || out.payment_status || '').toUpperCase();
      const delivery = out.delivery_url || out.deliveryUrl || '';
      const invoice = out.invoice_url || out.invoiceUrl || '';

      if (status === 'COMPLETE' || (delivery && delivery.length>10)){
        statusEl.textContent = 'Payment confirmed. Your download is ready.';
        if (delivery) deliveryLink.href = delivery;
        if (invoice) invoiceLink.href = invoice;
        deliveryBlock.style.display = 'block';
        return;
      }

      statusEl.textContent = 'Waiting for payment confirmation… (this can take a moment)';
    } catch(e){
      console.error(e);
    }

    await new Promise(r=>setTimeout(r, 2500));
  }

  statusEl.textContent = 'Confirmation is taking longer than usual. Please check your email for delivery, or contact support.';
}

(function(){
  const orderId = getOrderId();
  if (!orderId){
    statusEl.textContent = 'Thank you. If you completed payment, please check your email for delivery.';
    return;
  }
  pollStatus(orderId);
})();
