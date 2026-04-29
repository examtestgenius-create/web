function getConfig() { return window.STUDYHUB_CONFIG || {}; }
const statusEl = document.getElementById('successStatus');
const deliveryBlock = document.getElementById('deliveryBlock');
const deliveryLink = document.getElementById('deliveryLink');
const invoiceLink = document.getElementById('invoiceLink');
const orderRefEl = document.getElementById('orderRef');
const params = new URL(window.location.href).searchParams;
const orderId = params.get('order') || params.get('m_payment_id') || '';
if (orderRefEl) orderRefEl.textContent = orderId || 'Pending';

function setStatus(text, className = 'warning') {
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.className = className;
  }
}

async function checkOrderStatus() {
  if (!orderId) {
    setStatus('No order reference was returned from payment. Please contact support with your email address.', 'error');
    return;
  }
  const cfg = getConfig();
  if (!cfg.apiBaseUrl) {
    setStatus('Backend API is not configured.', 'error');
    return;
  }
  let attempts = 0;
  const maxAttempts = 24;
  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const res = await fetch(`${cfg.apiBaseUrl}?action=order-status&order_id=${encodeURIComponent(orderId)}`, { cache: 'no-store' });
      const out = await res.json();
      const status = String(out.status || out.payment_status || '').toUpperCase();
      if (status === 'COMPLETE') {
        const deliveryUrl = out.delivery_url || out.deliveryUrl || '';
        const invoiceUrl = out.invoice_url || out.invoiceUrl || '';
        if (deliveryUrl) deliveryLink.href = deliveryUrl;
        if (invoiceUrl) invoiceLink.href = invoiceUrl;
        else invoiceLink.closest('p')?.classList.add('hidden');
        deliveryBlock.classList.remove('hidden');
        deliveryBlock.style.display = 'block';
        setStatus('Payment confirmed. Your bundle is ready to download.', 'notice');
        return;
      }
      if (status === 'ITN_FAILED' || status === 'FAILED' || status === 'CANCELLED') {
        setStatus('Payment verification failed or was cancelled. Please try again or contact support.', 'error');
        return;
      }
      setStatus(`Payment received. Waiting for secure backend confirmation… (check ${attempts}/${maxAttempts})`, 'warning');
    } catch (err) {
      setStatus(`Checking payment status… (retry ${attempts}/${maxAttempts})`, 'warning');
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  setStatus('Payment is still being confirmed. Please refresh this page in a few minutes or contact support if needed.', 'warning');
}

checkOrderStatus();
