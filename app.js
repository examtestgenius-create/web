// app.js (Basket-enabled)

window.STUDYHUB_CONFIG = window.STUDYHUB_CONFIG || {};
window.STUDYHUB_CONFIG.fallbackCatalogUrl =
  window.STUDYHUB_CONFIG.fallbackCatalogUrl || "data/catalog.sample.json";
window.STUDYHUB_CONFIG.liveCatalogUrl =
  window.STUDYHUB_CONFIG.liveCatalogUrl || "";
window.STUDYHUB_CONFIG.apiBaseUrl =
  window.STUDYHUB_CONFIG.apiBaseUrl || "";
window.STUDYHUB_CONFIG.catalogTimeoutMs =
  Number(window.STUDYHUB_CONFIG.catalogTimeoutMs || 8000);

// ------------------- Basket helpers -------------------
function updateBasketCount() {
  const el = document.getElementById("basketCount");
  if (!el || !window.StudyHubCart) return;
  el.textContent = `(${window.StudyHubCart.count()})`;
}

function addToBasketPlaceholder(sku, title, priceCents) {
  if (!window.StudyHubCart) {
    alert("Basket not available. Make sure assets/cart.js is loaded.");
    return;
  }
  window.StudyHubCart.add({
    sku: String(sku || ""),
    title: String(title || sku || ""),
    priceCents: Number(priceCents || 0),
    qty: 1
  });
  updateBasketCount();
  alert("Added to basket ✅");
}

// expose for inline onclick in card templates
window.addToBasketPlaceholder = addToBasketPlaceholder;
window.updateBasketCount = updateBasketCount;

// ------------------- Fetch helpers -------------------
async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchStudyHubCatalog() {
  const tryUrls = [];

  if (window.STUDYHUB_CONFIG.liveCatalogUrl) tryUrls.push(window.STUDYHUB_CONFIG.liveCatalogUrl);
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
      console.warn("Catalog source failed:", url, msg);
    }
  }

  throw new Error(errors.join("\n"));
}

// ------------------- Catalog normalization -------------------
function inferGradeFromSku(sku) {
  const m = String(sku || "").match(/SH-G(\d{1,2})-/i);
  return m && m[1] ? m[1] : "";
}

function normalizeCatalogItem(item) {
  const sku = item.SKU || item.sku || "";
  const title = item.Title || item.title || sku || "Package";
  const type = item.Bundle_Type || item.bundle_type || item.type || "Package";
  const subject = item.Subject_Name || item.subject_name || item.subject_or_all || "ALL";
  const province = item.Province_Filter || item.province_filter || item.province || "ALL";
  const yearRange = item.year_or_range || item.Year_Range || "";
  const fileCount = Number(item.Included_File_Count || item.included_file_count || item.file_count || 0);
  const priceCents = Number(item.Price_Cents || item.price_cents || 0);
  const notes = item.Notes || item.notes || item.description || "";

  let fromYear = item.Coverage_From_Year || item.coverage_from_year || "";
  let toYear = item.Coverage_To_Year || item.coverage_to_year || "";

  if ((!fromYear || !toYear) && /^\d{4}-\d{4}$/.test(String(yearRange))) {
    const parts = String(yearRange).split("-");
    fromYear = fromYear || parts[0];
    toYear = toYear || parts[1];
  }

  if (!fromYear && /^\d{4}$/.test(String(yearRange))) fromYear = yearRange;
  if (!toYear && /^\d{4}$/.test(String(yearRange))) toYear = yearRange;

  return {
    sku,
    title,
    type,
    subject,
    province,
    yearRange,
    fromYear: fromYear || "—",
    toYear: toYear || "—",
    fileCount,
    priceCents,
    notes,
    grade: inferGradeFromSku(sku),
    deliveryUrl: item.deliveryUrl || item.Delivery_Url || "",
    driveUrl: item.driveUrl || item.Drive_Url || ""
  };
}

function moneyZar(item) {
  const cents = Number(item.priceCents || item.Price_Cents || item.price_cents || 0);
  if (!cents) return "Price not set";

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR"
  }).format(cents / 100);
}

// ------------------- Actions -------------------
function buyPlaceholder(sku) {
  window.location.href = `checkout.html?sku=${encodeURIComponent(sku)}`;
}

function downloadPlaceholder(sku) {
  alert(`Delivery is linked to a paid order. Open checkout for ${sku} to proceed.`);
}

const metaEl = document.getElementById("catalogMeta");
const cardsRoot = document.getElementById("packageCards");
const featuredRoot = document.getElementById("featuredCards");
const filterType = document.getElementById("filterType");
const filterProvince = document.getElementById("filterProvince");
const filterSubject = document.getElementById("filterSubject");
const sortBy = document.getElementById("sortBy");
const clearFilters = document.getElementById("clearFilters");
const searchInput = document.getElementById("searchInput");
const contactForm = document.getElementById("contactForm");

let catalogItems = [];

function featuredScore(item) {
  let score = item.fileCount || 0;
  if (item.type === "Ultimate Bundle") score += 1000;
  if (item.type === "Master Bundle") score += 300;
  if ((item.subject || "").toUpperCase().includes("ENGLISH")) score += 50;
  return score;
}

function formatCard(item, featured = false) {
  const tag = featured ? "Featured package" : item.type;
  const wrapperClass = featured ? "featured-card card-surface" : "card-surface";

  const escSku = String(item.sku || "").replace(/'/g, "\\'");
  const escTitle = String(item.title || "").replace(/'/g, "\\'");

  return `
  <article class="${wrapperClass}">
    <span class="card-tag">${tag}</span>
    <h3>${item.title}</h3>
    <p class="product-note">${item.sku}</p>

    <div class="badge-row">
      <span class="badge">Grade ${item.grade || "—"}</span>
      <span class="badge">${item.subject}</span>
      <span class="badge">${item.province}</span>
    </div>

    <p>${item.notes || "StudyHub bundle from the live catalog."}</p>

    <ul>
      <li>From year: ${item.fromYear}</li>
      <li>To year: ${item.toYear}</li>
      <li>Paper sets included: ${item.fileCount}</li>
    </ul>

    <div class="price-chip">${moneyZar(item)}</div>

    <div class="card-actions">
      <a class="btn btn-secondary" href="package.html?sku=${encodeURIComponent(item.sku)}">View details</a>

      <button class="btn btn-secondary" type="button"
        onclick="addToBasketPlaceholder('${escSku}','${escTitle}',${Number(item.priceCents || 0)})">
        Add to basket
      </button>

      <button class="btn btn-primary" type="button" onclick="buyPlaceholder('${escSku}')">Buy package</button>
      <button class="btn btn-ghost" type="button" onclick="downloadPlaceholder('${escSku}')">Download later</button>
    </div>
  </article>`;
}

function uniqueSorted(list) {
  return [...new Set(list.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function populateFilters(items) {
  const types = uniqueSorted(items.map(i => i.type));
  const provinces = uniqueSorted(items.map(i => i.province));
  const subjects = uniqueSorted(items.map(i => i.subject));

  if (filterType) {
    filterType.innerHTML =
      '<option value="ALL">All types</option>' +
      types.map(v => `<option value="${v}">${v}</option>`).join('');
  }

  if (filterProvince) {
    filterProvince.innerHTML =
      '<option value="ALL">All provinces</option>' +
      provinces.map(v => `<option value="${v}">${v}</option>`).join('');
  }

  if (filterSubject) {
    filterSubject.innerHTML =
      '<option value="ALL">All subjects</option>' +
      subjects.map(v => `<option value="${v}">${v}</option>`).join('');
  }
}

function sortItems(items) {
  const mode = sortBy ? sortBy.value : "featured";
  const copy = [...items];

  if (mode === "priceAsc") copy.sort((a, b) => a.priceCents - b.priceCents);
  else if (mode === "priceDesc") copy.sort((a, b) => b.priceCents - a.priceCents);
  else if (mode === "filesDesc") copy.sort((a, b) => b.fileCount - a.fileCount);
  else if (mode === "nameAsc") copy.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  else copy.sort((a, b) => featuredScore(b) - featuredScore(a));

  return copy;
}

function renderFeatured(items) {
  if (!featuredRoot) return;
  const featured = [...items].sort((a, b) => featuredScore(b) - featuredScore(a)).slice(0, 3);
  featuredRoot.innerHTML = featured.map(item => formatCard(item, true)).join("");
}

function applyFilters() {
  const type = filterType ? filterType.value : "ALL";
  const province = filterProvince ? filterProvince.value : "ALL";
  const subject = filterSubject ? filterSubject.value : "ALL";
  const term = ((searchInput && searchInput.value) || "").trim().toLowerCase();

  let filtered = catalogItems.filter(item => {
    const textBlob = [
      item.sku,
      item.title,
      item.subject,
      item.province,
      item.type,
      item.notes,
      `Grade ${item.grade}`
    ].join(" ").toLowerCase();

    if (type !== "ALL" && item.type !== type) return false;
    if (province !== "ALL" && item.province !== province) return false;
    if (subject !== "ALL" && item.subject !== subject) return false;
    if (term && !textBlob.includes(term)) return false;

    return true;
  });

  filtered = sortItems(filtered);

  if (cardsRoot) {
    cardsRoot.innerHTML = filtered.length
      ? filtered.map(item => formatCard(item, false)).join("")
      : '<article class="card-surface"><h3>No matches</h3><p>Try a different search, sort, or filter combination.</p></article>';
  }

  updateBasketCount();
}

async function loadCatalog() {
  try {
    const { payload, source } = await fetchStudyHubCatalog();
    const items = payload.items || payload.packages || [];
    catalogItems = items.map(normalizeCatalogItem);

    const generated = payload.generatedAt || payload.generated_at || "Unknown";
    const sourceLabel =
      source === window.STUDYHUB_CONFIG.fallbackCatalogUrl ? "fallback sample data" : "live catalog";

    if (metaEl) {
      metaEl.textContent = `Loaded ${catalogItems.length} package rows from ${sourceLabel}. Generated: ${generated}`;
      metaEl.classList.add("status-ok");
    }

    populateFilters(catalogItems);
    renderFeatured(catalogItems);
    applyFilters();
    updateBasketCount();
  } catch (err) {
    console.error("Catalog load failed:", err);

    if (metaEl) {
      metaEl.textContent = "Catalog could not be loaded.";
      metaEl.classList.add("status-error");
      metaEl.title = String(err.message || err);
    }

    if (cardsRoot) {
      cardsRoot.innerHTML =
        '<article class="card-surface"><h3>Catalog unavailable</h3><p>Check the live URL or fallback JSON file. Open the browser console (F12) to see the exact error.</p></article>';
    }

    if (featuredRoot) featuredRoot.innerHTML = "";
    updateBasketCount();
  }
}

[filterType, filterProvince, filterSubject, sortBy].forEach(el => {
  if (el) el.addEventListener("change", applyFilters);
});

if (searchInput) searchInput.addEventListener("input", applyFilters);

if (clearFilters) {
  clearFilters.addEventListener("click", () => {
    if (filterType) filterType.value = "ALL";
    if (filterProvince) filterProvince.value = "ALL";
    if (filterSubject) filterSubject.value = "ALL";
    if (sortBy) sortBy.value = "featured";
    if (searchInput) searchInput.value = "";
    applyFilters();
  });
}

// Contact (kept as-is)
if (contactForm) {
  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(contactForm).entries());
    if (!window.STUDYHUB_CONFIG.apiBaseUrl) {
      alert("Contact endpoint not configured.");
      return;
    }

    try {
      const body = new URLSearchParams({
        action: "contact",
        name: data.name || "",
        email: data.email || "",
        message: data.message || ""
      });

      const res = await fetch(window.STUDYHUB_CONFIG.apiBaseUrl, {
        method: "POST",
        body
      });

      if (!res.ok) throw new Error("Request failed");

      alert("Message sent.");
      contactForm.reset();
    } catch {
      alert("Contact endpoint is not active yet.");
    }
  });
}

try {
  document.querySelectorAll("[data-search]").forEach(btn => {
    btn.addEventListener("click", () => {
      const term = btn.getAttribute("data-search") || "";
      if (searchInput) {
        searchInput.value = term;
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const target = document.getElementById("packages");
      if (target) target.scrollIntoView({ behavior: "smooth" });
    });
  });
} catch (e) {
  console.warn(e);
}

updateBasketCount();
loadCatalog();
``
