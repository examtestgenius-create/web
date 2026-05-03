window.STUDYHUB_CONFIG = {
  payfast: {
    merchant_id: "12345678", // digits only (PayFast requires integer) 
    merchant_key: "XXXXXXXXXXXXX", // 13 chars as PayFast validates
    return_url: "https://YOUR_USERNAME.github.io/studyhub-site/success.html",
    cancel_url: "https://YOUR_USERNAME.github.io/studyhub-site/catalog.html",
    notify_url: "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
  }
};
