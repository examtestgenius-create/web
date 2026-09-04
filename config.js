
/* Free-product display and delivery correction. */
(function () {
  const cfg = window.STUDYHUB_CONFIG || {};
  const moneyText = cents => Number(cents || 0) === 0
    ? 'FREE'
    : new Intl.NumberFormat('en-ZA', {style:'currency', currency:'ZAR'}).format(Number(cents) / 100);

  function replacePriceTbc(root) {
    const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (node.nodeValue && node.nodeValue.includes('Price TBC')) {
        node.nodeValue = node.nodeValue.replace(/Price TBC/g, 'FREE');
      }
    });
  }

  async function getLiveProduct() {
    const sku = new URL(location.href).searchParams.get('sku') || '';
    if (!sku || !cfg.liveCatalogUrl) return null;
    const response = await fetch(cfg.liveCatalogUrl, {cache:'no-store'});
    const json = await response.json();
    const rows = json.data || json.items || json.packages || json || [];
    return (Array.isArray(rows) ? rows : []).find(row => String(row.sku || row.SKU) === sku) || null;
  }

  async function fixFreeDetailOrCheckout() {
    const path = location.pathname.toLowerCase();
    if (!path.endsWith('/package.html') && !path.endsWith('/checkout.html')) return;
    try {
      const product = await getLiveProduct();
      if (!product || Number(product.price_cents || 0) !== 0) return;

      replacePriceTbc(document.body);
      document.querySelectorAll('.product-price, #checkoutPrice').forEach(el => {
        el.textContent = 'FREE';
        el.classList.add('free-price');
      });

      if (path.endsWith('/package.html')) {
        const buy = [...document.querySelectorAll('a,button')].find(el => /buy package/i.test(el.textContent || ''));
        if (buy) {
          buy.textContent = 'Download free sample';
          buy.href = product.zip_url;
          buy.target = '_blank';
          buy.rel = 'noopener';
        }
      }

      if (path.endsWith('/checkout.html')) {
        const form = document.getElementById('checkoutForm');
        const intro = document.getElementById('checkoutIntro');
        if (intro) intro.textContent = 'This verified sample is free. No PayFast payment is required.';
        if (form) {
          form.innerHTML = `<a class="btn btn-primary" href="${String(product.zip_url).replace(/"/g,'&quot;')}" target="_blank" rel="noopener">Download free sample</a>`;
        }
      }
    } catch (error) {
      console.warn('Free-product UI correction could not load:', error);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    replacePriceTbc(document.body);
    const observer = new MutationObserver(() => replacePriceTbc(document.body));
    observer.observe(document.body, {childList:true, subtree:true});
    setTimeout(fixFreeDetailOrCheckout, 500);
    setTimeout(fixFreeDetailOrCheckout, 1800);
  });
})();
