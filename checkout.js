(async function () {
  const BACKEND_URL =
    "https://script.google.com/macros/s/AKfycbyrGxdt2HhRklPLlpYq_1P-dGh1NfkXAXw-ZJkHmWZ5SJy5vCOHuSakr4LBXwqgz0gV8Q/exec";

  const params = new URLSearchParams(location.search);
  const sku = params.get("sku");

  const form = document.getElementById("checkoutForm");
  const status = document.getElementById("checkoutStatus");

  function showStatus(message) {
    if (!status) return;
    status.classList.remove("hidden");
    status.textContent = message;
  }

  function money(cents) {
    return "R" + (Number(cents || 0) / 100).toFixed(2);
  }

  try {
    const catalogRes = await fetch("data/catalog.json", { cache: "no-store" });
    if (!catalogRes.ok) throw new Error("Could not load catalog.json");

    const catalog = await catalogRes.json();
    const item =
      (catalog.items || []).find((x) => x.sku === sku) ||
      (catalog.items || [])[0];

    if (!item) {
      form.innerHTML = "<p>Pack not found.</p>";
      return;
    }

    form.innerHTML = `
      <p><strong>${item.title}</strong></p>
      <p>Price: ${money(item.price_cents)}</p>

      <label>
        Name
        <input type="text" name="name" required>
      </label>

      <label>
        Email
        <input type="email" name="email" required>
      </label>

      <label>
        Phone
        <input type="tel" name="phone">
      </label>

      <button type="submit" class="btn btn-primary">
        Proceed to PayFast
      </button>
    `;

    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();

      showStatus("Preparing secure checkout...");

      const fd = new FormData(form);

      const payload = new URLSearchParams({
        action: "createCheckout",
        sku: item.sku,
        name: fd.get("name") || "",
        email: fd.get("email") || "",
        phone: fd.get("phone") || "",
      });

      try {
        const res = await fetch(BACKEND_URL, {
          method: "POST",
          body: payload,
        });

        const data = await res.json();

        if (!data.ok) {
          throw new Error(data.error || "Checkout could not start");
        }

        if (!data.payfast_url || !data.payfast_payload) {
          throw new Error("Backend did not return PayFast checkout data");
        }

        const pfForm = document.createElement("form");
        pfForm.method = "POST";
        pfForm.action = data.payfast_url;

        Object.entries(data.payfast_payload).forEach(([key, value]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = value;
          pfForm.appendChild(input);
        });

        document.body.appendChild(pfForm);

        showStatus("Redirecting to secure PayFast checkout...");
        pfForm.submit();
      } catch (err) {
        console.error(err);
        showStatus(err.message || "Checkout failed");
      }
    });
  } catch (err) {
    console.error(err);
    if (form) form.innerHTML = "<p>Unable to load checkout right now.</p>";
    showStatus(err.message || "Checkout failed to load");
  }
})();
