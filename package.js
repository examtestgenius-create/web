// package.js (Live + basket-enabled)

window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {};
window.STUDYHUB_CONFIG.fallbackCatalogUrl =
  window.STUDYHUB_CONFIG.fallbackCatalogUrl || "data/catalog.sample.json";
window.STUDYHUB_CONFIG.liveCatalogUrl =
  window.STUDYHUB_CONFIG.liveCatalogUrl || "";
window.STUDYHUB_CONFIG.catalogTimeoutMs =
  Number(window.STUDYHUB_CONFIG.catalogTimeoutMs || 8000);

// ---------- Basket helpers ----------
function updateBasketCount() {
  const el = document.getElementById("basketCount");
  if (!el || !window.StudyHubCart) return;
  el.textContent = `(${window.StudyHubCart.count()})`;
}

function addToBasket(item) {
  if (!window.StudyHubCart) {
    alert("Basket not available (assets/cart.js not loaded).");
    return;
  }
  window.StudyHubCart.add({
    sku: item.sku,
    title: item.title,
    priceCents: Number(item.priceCents || 0),
    qty: 1
  });
  updateBasketCount();
  alert("Added to basket ✅");
}

// ---------- Fetch helpers ----------
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
  if (window.STUDYHUB_CONFIG.liveCatalogUrl) {
    tryUrls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
  }
  tryUrls.push(window.STUDYHUB_CONFIG.fallbackCatalogUrl);

  const errors = [];

  for (const url of tryUrls) {
    try {
      const payload = await fetchJsonWithTimeout(url, window.STUDYHUB_CONFIG.catalogTimeoutMs);
      return { payload, source: url, errors };
    } catch (err) {
      const msg =
        err && err.name === "AbortError"
          ? `Timed out after ${window.STUDYHUB_CONFIG.catalogTimeoutMs}ms`
          : (err && err.message ? err.message : String(err));
      errors.push(`${url}: ${msg}`);
    }
  }
  throw new Error(errors.join("\n"));
}

// ---------- Catalog normalization ----------
function inferGradeFromSku(sku) {
  const m = String(sku || "").match(/SH-G(\d{1,2})-/i);
  return m && m[1] ? m[1] : "";
}

function parseYearRangeFromText(text) {
  const s = String(text || "").trim();
  // 2022-2024
  let m = s.match(/(\d{4})\s*-\s*(\d{4})/);
  if (m) return { fromYear: m[1], toYear: m[2] };
  // single year 2024
  m = s.match(/(\d{4})/);
  if (m) return { fromYear: m[1], toYear: m[1] };
  return { fromYear: "", toYear: "" };
}

function parseYearRangeFromSku(sku) {
  const s = String(sku || "");
  let m = s.match(/-(\d{4})-(\d{4})-/);
  if (m) return { fromYear: m[1], toYear: m[2] };
  m = s.match(/-(\d{4})-/);
  if (m) return { fromYear: m[1], toYear: m[1] };
  return { fromYear: "", toYear: "" };
}

function normalizeCatalogItem(item) {
  const sku = item.SKU || item.sku || "";
  const title = item.Title || item.title || sku || "Package";
  const type = item.Bundle_Type || item.bundle_type || item.type || "Package";

  const subject =
    item.Subject_Name ||
    item.subject_name ||
    item.subject_or_all ||
    item.subject ||
    "ALL";

  const province =
    item.Province_Filter ||
    item.province_filter ||
    item.province ||
    "ALL";

  const yearRange = item.year_or_range || item.Year_Range || item.yearRange || "";
  const fileCount = Number(item.Included_File_Count || item.included_file_count || item.file_count || item.fileCount || 0);
  const priceCents = Number(item.Price_Cents || item.price_cents || item.priceCents || 0);
  const notes = item.Notes || item.notes || item.description || "";

  // Try explicit fields first
  let fromYear = item.Coverage_From_Year || item.coverage_from_year || "";
  let toYear = item.Coverage_To_Year || item.coverage_to_year || "";

  // Try yearRange fallback
  if (!fromYear || !toYear) {
    const yr = parseYearRangeFromText(yearRange);
    fromYear = fromYear || yr.fromYear;
    toYear = toYear || yr.toYear;
  }

  // Try SKU fallback
  if (!fromYear || !toYear) {
    const yr2 = parseYearRangeFromSku(sku);
    fromYear = fromYear || yr2.fromYear;
    toYear = toYear || yr2.toYear;
  }

  return {
    sku,
    title,
    type,
    subject,
    province,
    yearRange,
    fromYear: String(fromYear || "—"),
    toYear: String(toYear || "—"),
    fileCount,
    priceCents,
    notes,
    grade: inferGradeFromSku(sku)
  };
}

function moneyZar(cents) {
  const value = Number(cents || 0);
  if (!value) return "Price not set";
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(value / 100);
}

// ---------- Page rendering ----------
const detailStatus = document.getElementById("detailStatus");
const detailRoot = document.getElementById("packageDetailRoot");

function getSkuFromUrl() {
  return new URL(window.location.href).searchParams.get("sku") || "";
}

function detailMarkup(item) {
  return `
    <div class="detail-layout">
      <section class="detail-panel card-surface">
        <span class="eyebrow">${item.type}</span>
        <h2>${item.title}</h2>
        <p class="product-note">${item.sku}</p>

        <div class="badge-row">
          <span class="badge">Grade ${item.grade || "—"}</span>
          <span class="badge">${item.subject}</span>
          <span class="badge">${item.province}</span>
        </div>

        <p>${item.notes || "StudyHub package from the live catalog."}</p>

        <div class="detail-actions">
          <button class="btn btn-secondary" type="button" id="addToBasketBtn">Add to basket</button>
          <a class="btn btn-primary" href="checkout.html?sku=${encodeURIComponent(item.sku)}">Buy package</a>
          <a class="btn btn-ghost" href="basket.html">View basket</a>
          <a class="btn btn-ghost" href="index.html#packages">Back to catalog</a>
        </div>
      </section>

      <aside class="detail-panel card-surface product-sidebar">
        <div class="product-price">${moneyZar(item.priceCents)}</div>

        <div class="detail-meta-list">
          <div class="detail-meta-item"><strong>From year</strong><span>${item.fromYear}</span></div>
          <div class="detail-meta-item"><strong>To year</strong><span>${item.toYear}</span></div>
          <div class="detail-meta-item"><strong>Paper sets included</strong><span>${item.fileCount}</span></div>
          <div class="detail-meta-item"><strong>Subject</strong><span>${item.subject}</span></div>
          <div class="detail-meta-item"><strong>Bundle type</strong><span>${item.type}</span></div>
        </div>
      </aside>
    </div>
  `;
}

async function loadPackageDetail() {
  updateBasketCount();

  const sku = getSkuFromUrl();
  if (!sku) {
    detailStatus.innerHTML = `
      <span class="eyebrow">Package detail</span>
      <h2>Missing package SKU</h2>
      <p>Add <code>?sku=YOUR_SKU</code> to the URL.</p>
    `;
    return;
  }

  try {
    const { payload, source } = await fetchStudyHubCatalog();
    const items = (payload.items || payload.packages || []).map(normalizeCatalogItem);
    const item = items.find(v => String(v.sku) === sku);

    if (!item) {
      detailStatus.innerHTML = `
        <span class="eyebrow">Package detail</span>
        <h2>Package not found</h2>
        <p>No package with SKU <code>${sku}</code> was found.</p>
      `;
      return;
    }

    const sourceLabel =
      source === window.STUDYHUB_CONFIG.fallbackCatalogUrl ? "fallback sample data" : "live catalog";

    detailStatus.innerHTML = `
      <span class="eyebrow">Package detail</span>
      <h2>${item.title}</h2>
      <p>Loaded from ${sourceLabel}.</p>
    `;

    detailRoot.innerHTML = detailMarkup(item);

    const btn = document.getElementById("addToBasketBtn");
    if (btn) btn.addEventListener("click", () => addToBasket(item));

    updateBasketCount();
  } catch (err) {
    detailStatus.innerHTML = `
      <span class="eyebrow">Package detail</span>
      <h2>Catalog unavailable</h2>
      <p>The package detail could not be loaded.</p>
    `;
    console.error(err);
  }
}

loadPackageDetail();
