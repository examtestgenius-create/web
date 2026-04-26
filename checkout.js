window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {};

function updateBasketCount() {
  const el = document.getElementById("basketCount");
  if (!el || !window.StudyHubCart) return;
  el.textContent = `(${window.StudyHubCart.count()})`;
}

function moneyZarCents(cents) {
  const v = Number(cents || 0);
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(v / 100);
}

const sku = new URL(window.location.href).searchParams.get("sku") || "";
const titleEl = document.getElementById("checkoutTitle");
const introEl = document.getElementById("checkoutIntro");
const skuField = document.getElementById("skuField");
const priceEl = document.getElementById("checkoutPrice");
const badgesEl = document.getElementById("checkoutBadges");
const fromYearMeta = document.getElementById("fromYearMeta");
const toYearMeta = document.getElementById("toYearMeta");
const filesMeta = document.getElementById("filesMeta");
const checkoutForm = document.getElementById("checkoutForm");
const checkoutStatus = document.getElementById("checkoutStatus");
const payLaterBtn = document.getElementById("payLaterBtn");

let currentItem = null;

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchStudyHubCatalog() {
  const tryUrls = [];
  if (window.STUDYHUB_CONFIG.liveCatalogUrl) tryUrls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
  tryUrls.push(window.STUDYHUB_CONFIG.fallbackCatalogUrl || "data/catalog.sample.json");

  const errors = [];
  for (const url of tryUrls) {
    try {
      const payload = await fetchJsonWithTimeout(url, Number(window.STUDYHUB_CONFIG.catalogTimeoutMs || 8000));
      return { payload, source: url, errors };
    } catch (err) {
      errors.push(`${url}: ${err && err.message ? err.message : String(err)}`);
    }
  }
  throw new Error(errors.join("\n"));
}

function normalizeCatalogItem(item) {
  return {
    sku: item.SKU || item.sku || "",
    title: item.Title || item.title || item.SKU || item.sku || "Package",
    subject: item.Subject_Name || item.subject_name || item.subject_or_all || "ALL",
    province: item.Province_Filter || item.province_filter || item.province || "ALL",
    fromYear: item.Coverage_From_Year || item.coverage_from_year || "—",
    toYear: item.Coverage_To_Year || item.coverage_to_year || "—",
    fileCount: Number(item.Included_File_Count || item.included_file_count || item.file_count || 0),
    priceCents: Number(item.Price_Cents || item.price_cents || 0)
  };
}

async function loadCheckout() {
  updateBasketCount();

  if (sku) {
    skuField.value = sku;

    try {
      const { payload } = await fetchStudyHubCatalog();
      const items = (payload.items || payload.packages || []).map(normalizeCatalogItem);
      currentItem = items.find(v => String(v.sku) === sku);

      if (!currentItem) {
        titleEl.textContent = "Package not found";
        introEl.textContent = `No package with SKU ${sku} was found.`;
        return;
      }

      titleEl.textContent = `Checkout — ${currentItem.title}`;
      introEl.textContent = "Secure checkout via PayFast.";

      priceEl.textContent = moneyZarCents(currentItem.priceCents);
      badgesEl.innerHTML = `<span class="badge">${currentItem.subject}</span><span class="badge">${currentItem.province}</span>`;
      fromYearMeta.textContent = currentItem.fromYear;
      toYearMeta.textContent = currentItem.toYear;
      filesMeta.textContent = currentItem.fileCount;
    } catch (err) {
      titleEl.textContent = "Catalog unavailable";
      introEl.textContent = "The package could not be loaded.";
      console.error(err);
    }
  } else {
    if (!window.StudyHubCart) {
      titleEl.textContent = "Basket not available";
      introEl.textContent = "Cart module missing.";
      return;
    }

    const cart = window.StudyHubCart.read();
    if (!cart.length) {
      titleEl.textContent = "Basket empty";
      introEl.textContent = "Add bundles to your basket first.";
      skuField.value = "—";
      priceEl.textContent = moneyZarCents(0);
      badgesEl.innerHTML = `<span class="badge">Basket</span>`;
      fromYearMeta.textContent = "—";
      toYearMeta.textContent = "—";
      filesMeta.textContent = "—";
      return;
    }

    titleEl.textContent = "Checkout — Basket";
    introEl.textContent = "Secure checkout for multiple bundles via PayFast.";
    skuField.value = "BASKET";
    priceEl.textContent = moneyZarCents(window.StudyHubCart.totalCents());
    badgesEl.innerHTML = `<span class="badge">Multiple items</span>`;
    filesMeta.textContent = cart.reduce((s, x) => s + Number(x.qty || 0), 0);
    fromYearMeta.textContent = "—";
    toYearMeta.textContent = "—";
  }
}

if (payLaterBtn) {
  payLaterBtn.addEventListener("click", () => {
    alert("Pay-later is not enabled. Please continue with secure PayFast checkout.");
  });
}

if (checkoutForm) {
  checkoutForm.addEventListener("submit", (e) => {
    e.preventDefault();

    checkoutStatus.textContent = "";
    checkoutStatus.classList.remove("notice");

    if (!window.STUDYHUB_CONFIG.apiBaseUrl) {
      checkoutStatus.textContent = "Backend not configured yet.";
      checkoutStatus.classList.add("notice");
      return;
    }

    const data = Object.fromEntries(new FormData(checkoutForm).entries());

    let items = [];
    if (sku) {
      if (!currentItem) {
        checkoutStatus.textContent = "Package not loaded yet.";
        checkoutStatus.classList.add("notice");
        return;
      }
      items = [{ sku: currentItem.sku, title: currentItem.title, qty: 1, priceCents: currentItem.priceCents }];
    } else {
      if (!window.StudyHubCart) {
        checkoutStatus.textContent = "Basket module missing.";
        checkoutStatus.classList.add("notice");
        return;
      }
      items = window.StudyHubCart.read();
      if (!items.length) {
        checkoutStatus.textContent = "Your basket is empty.";
        checkoutStatus.classList.add("notice");
        return;
      }
    }

    // ✅ No fetch: post HTML form to Apps Script -> Apps Script returns HTML auto-submit to PayFast
    const form = document.createElement("form");
    form.method = "POST";
    form.action = window.STUDYHUB_CONFIG.apiBaseUrl;

    addHidden(form, "action", "checkoutBridge");
    addHidden(form, "customer_name", data.customer_name || "");
    addHidden(form, "customer_email", data.customer_email || "");
    addHidden(form, "customer_phone", data.customer_phone || "");
    addHidden(form, "notes", data.notes || "");
    addHidden(form, "items_json", JSON.stringify(items));

    document.body.appendChild(form);
    form.submit();
  });
}

function addHidden(form, name, value) {
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = name;
  input.value = String(value ?? "");
  form.appendChild(input);
}

loadCheckout();
