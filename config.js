window.STUDYHUB_CONFIG = {
  siteBaseUrl: 'https://examtestpaper.co.za',
  apiBaseUrl: 'https://script.google.com/macros/s/AKfycbyaL0g4sF4TWLRjSR1ioLV7J01msJejXMzgSttJzgQr_upEKXkx_tGagwXnLjMuT1bl_A/exec',
  webappUrl: 'https://script.google.com/macros/s/AKfycbyaL0g4sF4TWLRjSR1ioLV7J01msJejXMzgSttJzgQr_upEKXkx_tGagwXnLjMuT1bl_A/exec',
  liveCatalogUrl: 'https://script.google.com/macros/s/AKfycbyaL0g4sF4TWLRjSR1ioLV7J01msJejXMzgSttJzgQr_upEKXkx_tGagwXnLjMuT1bl_A/exec?api=catalogPublic',
  fallbackCatalogUrl: '',
  contactEmail: 'examtestgenius@gmail.com'
};

/* Compatibility UI layer for package.html and checkout.html after the new public redesign. */
(function () {
  const path = location.pathname.toLowerCase();
  const isPackage = path.endsWith('/package.html');
  const isCheckout = path.endsWith('/checkout.html');
  if (!isPackage && !isCheckout) return;

  document.body.classList.add(isPackage ? 'studyhub-package-page' : 'studyhub-checkout-page');
  const style = document.createElement('style');
  style.textContent = `
    .studyhub-package-page,.studyhub-checkout-page{background:#f4f7ff;color:#10213e;min-height:100vh}
    .studyhub-package-page .site-header,.studyhub-checkout-page .site-header{position:sticky;top:0;z-index:30;background:rgba(244,247,255,.9);backdrop-filter:blur(16px);border-bottom:1px solid #dce6f7}
    .studyhub-package-page .nav,.studyhub-checkout-page .nav{height:76px;display:flex;align-items:center;justify-content:space-between;padding:0!important}
    .studyhub-package-page .brand-logo,.studyhub-checkout-page .brand-logo{display:block!important;width:auto!important;height:46px!important;max-width:150px!important;object-fit:contain!important}
    .studyhub-package-page .nav nav,.studyhub-checkout-page .nav nav{display:flex;align-items:center;gap:22px}
    .studyhub-package-page .nav nav a,.studyhub-checkout-page .nav nav a{font-weight:800;color:#435675}
    .studyhub-package-page .detail-main,.studyhub-checkout-page .detail-main{min-height:calc(100vh - 150px);padding:0}
    .studyhub-package-page .section,.studyhub-checkout-page .section{padding:54px 0 74px}
    .studyhub-package-page .container,.studyhub-checkout-page .container{width:min(1120px,calc(100% - 34px));margin:auto}
    .studyhub-package-page .back-link,.studyhub-checkout-page .back-link{display:inline-flex;margin-bottom:22px;color:#245fc9;font-weight:900}
    .studyhub-package-page .section-head{max-width:850px;margin:0 0 24px!important}
    .studyhub-package-page .section-head h2,.studyhub-checkout-page h2{font-size:clamp(2rem,4vw,3.4rem)!important;line-height:1.08!important;letter-spacing:-.04em!important;margin:12px 0!important;color:#10213e!important;overflow-wrap:anywhere}
    .studyhub-package-page .section-head p,.studyhub-checkout-page #checkoutIntro{color:#64748b;line-height:1.7}
    .studyhub-package-page .eyebrow,.studyhub-checkout-page .eyebrow{display:inline-flex;padding:8px 12px;border-radius:999px;background:#e7efff;color:#2159b7;font-size:.72rem;font-weight:900;text-transform:uppercase}
    .studyhub-package-page .detail-layout,.studyhub-checkout-page .detail-layout{display:grid!important;grid-template-columns:1.22fr .78fr!important;gap:20px!important;align-items:start}
    .studyhub-package-page .detail-panel,.studyhub-checkout-page .detail-panel{padding:28px!important;border-radius:26px!important;background:#fff!important;border:1px solid #dce6f7!important;box-shadow:0 20px 45px rgba(10,38,84,.1)!important}
    .studyhub-package-page .detail-panel h3,.studyhub-checkout-page .detail-panel h3{font-size:1.3rem;margin:0 0 12px;overflow-wrap:anywhere}
    .studyhub-package-page .product-note{font-size:1rem;line-height:1.7;color:#64748b}
    .studyhub-package-page .badge-row,.studyhub-checkout-page .badge-row{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}
    .studyhub-package-page .badge,.studyhub-checkout-page .badge{display:inline-flex;padding:7px 10px;border-radius:999px;background:#edf3ff;color:#315d9d;font-size:.73rem;font-weight:800}
    .studyhub-package-page .detail-meta-list,.studyhub-checkout-page .detail-meta-list{display:grid;gap:10px;margin-top:18px}
    .studyhub-package-page .detail-meta-item,.studyhub-checkout-page .detail-meta-item{display:flex;justify-content:space-between;gap:20px;padding:12px 14px;border-radius:14px;background:#f5f8fd;border:1px solid #e2e9f5}
    .studyhub-package-page .product-price,.studyhub-checkout-page .product-price{font-size:2rem;font-weight:900;color:#087954;margin:12px 0}
    .studyhub-package-page .detail-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
    .studyhub-package-page .btn,.studyhub-checkout-page .btn{border:0;border-radius:999px;padding:13px 19px;font-weight:900;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
    .studyhub-package-page .btn-primary,.studyhub-checkout-page .btn-primary{background:linear-gradient(135deg,#2f76ff,#8057ff);color:#fff;box-shadow:0 12px 24px rgba(47,118,255,.24)}
    .studyhub-package-page .btn-secondary{background:#fff;border:1px solid #dce6f7;color:#10213e}
    .studyhub-checkout-page .checkout-form{display:grid!important;grid-template-columns:1fr 1fr!important;gap:15px!important;margin-top:22px!important}
    .studyhub-checkout-page .checkout-form label{display:grid!important;gap:7px!important;font-size:.82rem!important;font-weight:800!important;color:#435675!important}
    .studyhub-checkout-page .checkout-form label:first-child,.studyhub-checkout-page .checkout-form label:nth-child(3),.studyhub-checkout-page .checkout-form label:nth-child(5),.studyhub-checkout-page .checkout-form button{grid-column:1/-1!important}
    .studyhub-checkout-page .checkout-form input{width:100%!important;min-width:0!important;border:1px solid #cad7ea!important;border-radius:14px!important;background:#f9fbff!important;padding:13px 14px!important;font:inherit!important;color:#10213e!important}
    .studyhub-checkout-page .checkout-form input:focus{outline:3px solid rgba(47,118,255,.15)!important;border-color:#2f76ff!important}
    .studyhub-checkout-page #termsCheck{width:18px!important;height:18px!important;padding:0!important;flex:0 0 18px!important}
    .studyhub-checkout-page .checkout-form label:nth-child(5){display:flex!important;align-items:flex-start!important;gap:10px!important}
    .studyhub-checkout-page .checkout-form button{min-height:50px;font-size:1rem}
    .studyhub-package-page .site-footer,.studyhub-checkout-page .site-footer{background:#06152f;color:#bccbe0;padding:24px 0;border:0}
    .studyhub-package-page .footer-row,.studyhub-checkout-page .footer-row{display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap}
    .studyhub-package-page .small-link,.studyhub-checkout-page .small-link{color:#dce8ff;font-weight:800}
    @media(max-width:800px){
      .studyhub-package-page .detail-layout,.studyhub-checkout-page .detail-layout{grid-template-columns:1fr!important}
      .studyhub-checkout-page .checkout-form{grid-template-columns:1fr!important}
      .studyhub-checkout-page .checkout-form label,.studyhub-checkout-page .checkout-form button{grid-column:1!important}
      .studyhub-package-page .nav nav,.studyhub-checkout-page .nav nav{display:none}
      .studyhub-package-page .section,.studyhub-checkout-page .section{padding-top:34px}
      .studyhub-package-page .detail-panel,.studyhub-checkout-page .detail-panel{padding:20px!important}
    }
  `;
  document.head.appendChild(style);
})();
