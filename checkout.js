window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {};

function updateBasketCount() {
  const el = document.getElementById("basketCount");
  if (!el || !window.StudyHubCart) return;
  el.textContent = `(${window.StudyHubCart.count()})`;
}

function moneyZarCents(cents) {
  const v = Number(cents || 0);
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR"
  }).format(v / 100);
}

function parseYearRangeFromText(text) {
  const s = String(text || "").trim();
  let m = s.match(/(\d{4})\s*-\s*(\d{4})/);
  if (m) return { fromYear: m[1], toYear: m[2] };
  m = s.match(/(\d{4})/);
  if (m) return { fromYear: m[1], toYear: m[1] };
  return { fromYear: "—", toYear: "—" };
}

function parseYearRangeFromSku(sku) {
  const s = String(sku || "");
  const m = s.match(/-(\d{4})-(\d{4})-/);
  if (m) return { fromYear: m[1], toYear: m[2] };
  const one = s.match(/-(\d{4})-/);
  if (one) return { fromYear: one[1], toYear: one[1] };
  return { fromYear: "—", toYear: "—" };
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

async function fetchStudyHubCatalog() {
  const urls = [];
  if (window.STUDYHUB_CONFIG.liveCatalogUrl) {
    urls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
  }
  urls.push(window.STUDYHUB_CONFIG.fallbackCatalogUrl || "data/catalog.sample.json");

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      return await res.json();
    } catch {
      continue;
    }
  }
  throw new Error("Catalog unavailable");
}

function normalizeCatalogItem(item) {
  const skuVal = item.SKU || item.sku || "";
  const titleVal = item.Title || item.title || skuVal || "Package";

  let fromYear = item.Coverage_From_Year || "";
  let toYear = item.Coverage_To_Year || "";

  if (!fromYear || !toYear) {
    const yr = parseYearRangeFromText(item.year_or_range || "");
    fromYear = fromYear || yr.fromYear;
    toYear = toYear || yr.toYear;
  }

  if (!fromYear || !toYear) {
    const yr2 = parseYearRangeFromSku(skuVal);
    fromYear = yr2.fromYear;
    toYear = yr2.toYear;
  }

  return {
    sku: skuVal,
    title: titleVal,
    subject: item.subject || "ALL",
    province: item.province || "ALL",
    fromYear,
    toYear,
    fileCount: Number(item.fileCount || 0),
    priceCents: Number(item.priceCents || 0)
  };
}

async function loadCheckout() {
  updateBasketCount();

  if (!sku) return;

  skuField.value = sku;

  try {
    const payload = await fetchStudyHubCatalog();
    const items = (payload.items || payload.packages || []).map(normalizeCatalogItem);

    currentItem = items.find(v => String(v.sku) === sku);

    if (!currentItem) {
      checkoutStatus.textContent = "Package not loaded yet.";
      checkoutStatus.classList.add("notice");
      return;
    }

    titleEl.textContent = `Checkout — ${currentItem.title}`;
    introEl.textContent = "Secure checkout via PayFast.";
    priceEl.textContent = moneyZarCents(currentItem.priceCents);

    badgesEl.innerHTML =
      `<span class="badge">${currentItem.subject}</span>` +
      `<span class="badge">${currentItem.province}</span>`;

    fromYearMeta.textContent = currentItem.fromYear;
    toYearMeta.textContent = currentItem.toYear;
    filesMeta.textContent = currentItem.fileCount;
  } catch (err) {
    checkoutStatus.textContent = "Catalog unavailable.";
    checkoutStatus.classList.add("notice");
    console.error(err);
  }
}

if (checkoutForm) {
  checkoutForm.addEventListener("submit", e => {
    e.preventDefault();

    if (!currentItem) {
      checkoutStatus.textContent = "Package not loaded yet.";
      checkoutStatus.classList.add("notice");
      return;
    }

    const data = Object.fromEntries(new FormData(checkoutForm).entries());

    const form = document.createElement("form");
    form.method = "POST";
    form.action = window.STUDYHUB_CONFIG.apiBaseUrl;

    addHidden(form, "action", "checkoutBridge");
    addHidden(form, "customer_name", data.customer_name || "");
    addHidden(form, "customer_email", data.customer_email || "");
    addHidden(form, "customer_phone", data.customer_phone || "");
    addHidden(
      form,
      "items_json",
      JSON.stringify([
        {
          sku: currentItem.sku,
          title: currentItem.title,
          qty: 1,
          priceCents: currentItem.priceCents
        }
      ])
    );

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
