// checkout.js (PRODUCTION - form POST to Apps Script, no fetch)
(function () {
  const cfg = window.STUDYHUB_CONFIG || {};
  const BACKEND_URL = (cfg.webappUrl || '').trim();

  const params = new URLSearchParams(location.search);
  const sku = (params.get("sku") || "").trim();

  const form = document.getElementById("checkoutForm");
  const status = document.getElementById("checkoutStatus");

  function showStatus(message) {
    if (!status) return;
    status.classList.remove("hidden");
    status.textContent = message;
  }

  function fail(msg) {
    console.error(msg);
    showStatus(msg);
    alert(msg);
  }

  if (!form) return fail("checkoutForm element not found on page.");
  if (!BACKEND_URL) return fail("Missing STUDYHUB_CONFIG.webappUrl in config.js");
  if (!sku) return fail("Missing SKU in URL. Example: checkout.html?sku=ETP-G12-2025-SY");

  // Ensure your form contains these input fields (name/email/phone)
  const nameInput = form.querySelector('input[name="name"]');
  const emailInput = form.querySelector('input[name="email"]');
  const phoneInput = form.querySelector('input[name="phone"]');
  const notesInput = form.querySelector('textarea[name="notes"]');

  if (!nameInput || !emailInput) {
    return fail("Missing name/email input fields in checkoutForm.");
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();

    const name = (nameInput.value || "").trim();
    const email = (emailInput.value || "").trim();
    const phone = phoneInput ? (phoneInput.value || "").trim() : "";
    const notes = notesInput ? (notesInput.value || "").trim() : "";

    if (!name) return fail("Please enter your name.");
    if (!email) return fail("Please enter your email.");

    showStatus("Redirecting to secure PayFast checkout...");

    // Create hidden POST form to Apps Script (NO CORS issues)
    const postForm = document.createElement("form");
    postForm.method = "POST";
    postForm.action = BACKEND_URL;
    postForm.style.display = "none";

    const fields = {
      action: "createCheckout",
      sku: sku,
      name: name,
      email: email,
      phone: phone,
      notes: notes
    };

    Object.keys(fields).forEach((k) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = k;
      input.value = fields[k];
      postForm.appendChild(input);
    });

    document.body.appendChild(postForm);
    postForm.submit();
  });
})();
