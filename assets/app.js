
// StudyHub minimal client (fixed + hardened)

const cfg = {
  brand: "StudyHub",
  currency: "ZAR",

  // Put your WhatsApp number here in international format without +
  // Example South Africa: 27716816131
  whatsappNumber: "",

  // Your Google Apps Script JSONP endpoint (must support ?callback=cb_xxx)
  catalogEndpoint:
    "https://script.google.com/macros/s/AKfycbwLzazM5zV41rFJ4d5NzZubstnUB-AYdfriqd9IKjb3ZoS_MmwNrnnR8c93ci5-HkST/exec",
};

// -----------------------------
// JSONP loader (for Apps Script)
// -----------------------------
function loadJsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    const scriptEl = document.createElement("script");

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("JSONP timeout"));
    }, 15000);

    function cleanup() {
      clearTimeout(timer);
      try {
        delete window[cb];
      } catch (_) {}
      scriptEl.remove();
    }

    window[cb] = (data) => {
      cleanup();
      resolve(data);
    };

    const join = url.includes("?") ? "&" : "?";
    scriptEl.src = `${url}${join}callback=${cb}`;

    scriptEl.onerror = () => {
      cleanup();
      reject(new Error("JSONP load error"));
    };

    document.body.appendChild(scriptEl);
  });
}

// -----------------------------
// Helpers
// -----------------------------
function formatZAR(cents) {
  const r = (Number(cents || 0) / 100).toFixed(0);
  return `R${r}`;
}

async function loadCatalog() {
  if (cfg.catalogEndpoint) {
    return await loadJsonp(cfg.catalogEndpoint);
  }
  const res = await fetch("./products.json");
  return await res.json();
}

// -----------------------------
// Cart storage (supports legacy keys)
// -----------------------------
const CART_KEYS = ["studyhub_cart", "sh_cart", "cart"];

function readCart() {
  for (const k of CART_KEYS) {
    try {
      const v = JSON.parse(localStorage.getItem(k) || "null");
      if (Array.isArray(v)) return { key: k, items: v };
      if (v && Array.isArray(v.items)) return { key: k, items: v.items };
    } catch (_) {}
  }
  return { key: "studyhub_cart", items: [] };
}

function writeCart(items) {
  // Always write to the primary key (keeps it consistent)
  localStorage.setItem("studyhub_cart", JSON.stringify(items));
  renderCartBadge();
}

function cartCount(items) {
  return items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
}

function renderCartBadge() {
  const el = document.querySelector("[data-cart-badge]");
  if (!el) return;

  const { items } = readCart();
  const n = cartCount(items);

  el.textContent = String(n);
  el.style.display = n > 0 ? "inline-grid" : "none";
}

function addToCart(item) {
  const state = readCart();
  const cart = state.items.slice();

  const idx = cart.findIndex((x) => x && x.sku === item.sku);
  if (idx >= 0) {
    cart[idx].qty = (Number(cart[idx].qty) || 1) + 1;
  } else {
    cart.push({
      sku: item.sku,
      title: item.title,
      price_cents: Number(item.price_cents || 0),
      qty: 1,
    });
  }

  writeCart(cart);
}

// -----------------------------
// Catalog helpers
// -----------------------------
function matchFilters(p, grade, subject) {
  if (grade && p.grade !== grade) return false;
  if (subject && p.subject !== subject) return false;
  return true;
}

function unique(list) {
  return [...new Set(list)].filter(Boolean);
}

// -----------------------------
// Catalog page init
// -----------------------------
async function initCatalogPage() {
  const data = await loadCatalog();
  const products = data.products || [];

  // Populate filters
  const grades = unique(products.map((p) => p.grade)).sort();
  const subjects = unique(products.map((p) => p.subject)).sort();

  const gradeSel = document.getElementById("gradeSel");
  const subjSel = document.getElementById("subjectSel");

  if (gradeSel) {
    gradeSel.innerHTML =
      '<option value="">All Grades</option>' +
      grades.map((g) => `<option value="${g}">${g}</option>`).join("");
  }
  if (subjSel) {
    subjSel.innerHTML =
      '<option value="">All Subjects</option>' +
      subjects.map((s) => `<option value="${s}">${s}</option>`).join("");
  }

  const grid = document.getElementById("productGrid");
  if (!grid) return;

  function render() {
    const g = gradeSel ? gradeSel.value : "";
    const s = subjSel ? subjSel.value : "";
    const filtered = products.filter((p) => matchFilters(p, g, s));

    grid.innerHTML = filtered
      .map((p) => {
        const memoLabel = p.hasMemo ? "Papers + Memos" : "Memo required";

        const memoChip = p.hasMemo
          ? '<span class="btn btn-secondary" style="padding:6px 10px;border-radius:999px;font-weight:700">Memo Included</span>'
          : '<span class="btn btn-secondary" style="padding:6px 10px;border-radius:999px;font-weight:700;color:#b91c1c;border-color:#fecaca;background:#fff5f5">Missing Memo</span>';

        const disabled = p.hasMemo ? "" : "disabled";
        const disableStyle = p.hasMemo
          ? ""
          : 'style="opacity:.55;cursor:not-allowed"';

        return `
          <div class="card">
            <h3>${p.title}</h3>
            <small>${p.grade} • ${p.subject} • ${memoLabel}</small>
            <div class="price">${formatZAR(p.price_cents)}</div>
            <div class="actions">
              ${memoChip}
              <button class="btn btn-primary" ${disabled} ${disableStyle} data-add="${p.sku}">Add to Cart</button>
              cart.htmlCheckout</a>
            </div>
          </div>`;
      })
      .join("");

    grid.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sku = btn.getAttribute("data-add");
        const item = products.find((x) => x.sku === sku);

        // Block missing memos
        if (!item || !item.hasMemo) return;

        addToCart({
          sku: item.sku,
          title: item.title,
          price_cents: item.price_cents,
        });

        // Tiny UX feedback
        const old = btn.textContent;
        btn.textContent = "Added ✓";
        btn.disabled = true;
        setTimeout(() => {
          btn.textContent = old;
          btn.disabled = false;
        }, 900);
      });
    });

    renderCartBadge();
  }

  if (gradeSel) gradeSel.addEventListener("change", render);
  if (subjSel) subjSel.addEventListener("change", render);

  render();
}

// -----------------------------
// WhatsApp checkout helper
// -----------------------------
function toWhatsAppMessage(cart, email) {
  const lines = cart.map(
    (i) => `- ${i.title} x${i.qty} (${formatZAR(i.price_cents)})`
  );
  const total = cart.reduce((a, b) => a + b.price_cents * b.qty, 0);

  return encodeURIComponent(
    [
      `${cfg.brand} Order Request`,
      email ? `Email: ${email}` : "",
      "",
      ...lines,
      "",
      `Total: ${formatZAR(total)}`,
    ]
      .filter(Boolean)
      .join("\n")
  );
}

// -----------------------------
// Cart render + actions
// -----------------------------
function renderCart() {
  const state = readCart();
  const cart = state.items;
  const list = document.getElementById("cartList");
  const totalEl = document.getElementById("cartTotal");

  if (!list) return;

  if (cart.length === 0) {
    list.innerHTML = `
      <div class="card">
        <b>Your cart is empty.</b>
        <div class="muted" style="margin-top:6px">Browse packs to add items.</div>
        <div style="margin-top:12px">
          catalog.htmlBrowse Packs</a>
        </div>
      </div>
    `;
    if (totalEl) totalEl.textContent = "R0";
    renderCartBadge();
    return;
  }

  list.innerHTML = cart
    .map(
      (i, idx) => `
      <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <b>${i.title}</b>
          <div class="muted" style="font-size:13px">${formatZAR(
            i.price_cents
          )} each</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <button class="btn btn-secondary" data-dec="${idx}">−</button>
          <b>${i.qty}</b>
          <button class="btn btn-secondary" data-inc="${idx}">+</button>
          <button class="btn btn-secondary" data-del="${idx}">Remove</button>
        </div>
      </div>
    `
    )
    .join("");

  const total = cart.reduce((a, b) => a + b.price_cents * b.qty, 0);
  if (totalEl) totalEl.textContent = formatZAR(total);

  list.querySelectorAll("[data-inc]").forEach((b) =>
    b.addEventListener("click", () => {
      const idx = +b.getAttribute("data-inc");
      cart[idx].qty = (Number(cart[idx].qty) || 1) + 1;
      writeCart(cart);
      renderCart();
    })
  );

  list.querySelectorAll("[data-dec]").forEach((b) =>
    b.addEventListener("click", () => {
      const idx = +b.getAttribute("data-dec");
      cart[idx].qty = Math.max(1, (Number(cart[idx].qty) || 1) - 1);
      writeCart(cart);
      renderCart();
    })
  );

  list.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => {
      const idx = +b.getAttribute("data-del");
      cart.splice(idx, 1);
      writeCart(cart);
      renderCart();
    })
  );

  renderCartBadge();
}

function initCartActions() {
  renderCart();

  const email = document.getElementById("buyerEmail");
  const waBtn = document.getElementById("whatsappCheckout");

  if (waBtn) {
    waBtn.addEventListener("click", () => {
      const { items: cart } = readCart();

      if (!cfg.whatsappNumber) {
        alert("WhatsApp number not configured yet. Set it in assets/app.js");
        return;
      }

      const msg = toWhatsAppMessage(cart, email ? email.value : "");
      window.open(`https://wa.me/${cfg.whatsappNumber}?text=${msg}`, "_blank");
    });
  }
}

// -----------------------------
// Boot
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
  renderCartBadge();

  const page = document.body?.dataset?.page || "";
  if (page === "catalog") initCatalogPage().catch((e) => console.error(e));
  if (page === "cart") initCartActions();
});
``
