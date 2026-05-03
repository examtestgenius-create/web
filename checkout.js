(function () {
  const cfg = window.STUDYHUB_CONFIG || {};
  const BACKEND_URL = (cfg.webappUrl || "").trim();
  const CATALOG_URL = (cfg.fallbackCatalogUrl || "data/catalog.json").trim();

  const params = new URLSearchParams(location.search);
  const sku = (params.get("sku") || "").trim();

  const form = document.getElementById("checkoutForm");
  const status = document.getElementById("checkoutStatus");

  function showStatus(message) {
    if (!status) return;
    if (!message) {
      status.classList.add("hidden");
      status.textContent = "";
      return;
    }
    status.classList.remove("hidden");
    status.textContent = message;
  }

  function money(cents) {
    return "R" + (Number(cents || 0) / 100).toFixed(2);
  }

  function fail(msg) {
    console.error(msg);
    showStatus(msg);
    alert(msg);
  }

  if (!form) return fail("checkoutForm element not found on page.");
  if (!BACKEND_URL) return fail("Missing STUDYHUB_CONFIG.webappUrl in config.js");
  if (!sku) return fail("Missing SKU in URL. Example: checkout.html?sku=ETP-G12-2025-SY");

  (async function init() {
    try {
      showStatus("Loading pack details...");

      const catalogRes = await fetch(CATALOG_URL, { cache: "no-store" });
      if (!catalogRes.ok) throw new Error("Could not load catalog.json");

      const catalog = await catalogRes.json();
      const item = (catalog.items || []).find(x => String(x.sku || "") === sku);

      if (!item) {
        form.innerHTML = "<p>Pack not found.</p>";
        showStatus("");
        return;
      }

      // Inject the actual inputs into the empty form
      form.innerHTML = `
        <p><strong>${item.title}</strong></p>
        <p>Price: ${money(item.price_cents)}</p>

        <label>
          Name
          <input id="nameInput" type="text" name="name" required>
        </label>

        <label>
          Email
          <input id="emailInput" type="email" name="email" required>
        </label>

        <label>
          Phone
          <input id="phoneInput" type="tel" name="phone">
        </label>

        <label>
          Notes (optional)
          <textarea id="notesInput" name="notes"></textarea>
        </label>

        <button type="submit" class="btn btn-primary">
          Proceed to PayFast
        </button>
      `;

      showStatus("");

      form.addEventListener("submit", function (ev) {
        ev.preventDefault();

        const name = (document.getElementById("nameInput")?.value || "").trim();
        const email = (document.getElementById("emailInput")?.value || "").trim();
        const phone = (document.getElementById("phoneInput")?.value || "").trim();
        const notes = (document.getElementById("notesInput")?.value || "").trim();

        if (!name) return fail("Please enter your name.");
        if (!email) return fail("Please enter your email.");

        showStatus("Redirecting to secure PayFast checkout...");

        // POST to Apps Script using a real form submit
        const postForm = document.createElement("form");
        postForm.method = "POST";
        postForm.action = BACKEND_URL;
        postForm.style.display = "none";

        const fields = {
          action: "createCheckout",
          sku: item.sku,
          name,
          email,
          phone,
          notes
        };

        Object.keys(fields).forEach((k) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = k;
          input.value = fields[k] || "";
          postForm.appendChild(input);
        });

        document.body.appendChild(postForm);
        postForm.submit();
      });

    } catch (err) {
      console.error(err);
      form.innerHTML = "<p>Unable to load checkout right now.</p>";
      showStatus(err.message || "Checkout failed to load");
    }
  })();
})();
