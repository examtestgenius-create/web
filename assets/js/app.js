
// ====== CONFIG ======
const CATALOG_URL =
  "https://script.google.com/macros/s/AKfycbzwE4xmXVI4oIbo_hDU4CXT9ZS1skIuUhelCAmBhUP35Q5C51v0Emtk5KnAj0Pb3V6E/exec?mode=catalog";

// HTML hooks (your existing markup)
const selGrade   = document.querySelector('[data-filter="grade"]');
const selSubject = document.querySelector('[data-filter="subject"]');
const selYear    = document.querySelector('[data-filter="year"]');
const selTerm    = document.querySelector('[data-filter="term"]');
const listEl     = document.getElementById("catalog-list");
const noteEl     = document.getElementById("catalog-note");

// in-memory cache of all bundles
let ALL_BUNDLES = [];

// ====== UTIL ======
const norm = (v) => (v ?? "").toString().trim();
const up   = (v) => norm(v).toUpperCase();
const isAll = (v) => v === "" || up(v) === "ALL";

function uniqueSorted(values, { numeric=false } = {}) {
  const arr = [...new Set(values.map(norm).filter(Boolean))];
  if (numeric) return arr.sort((a,b) => Number(a) - Number(b));
  return arr.sort((a,b) => a.localeCompare(b, undefined, { numeric:true }));
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

// Fill a <select> with options (preserving the first "All ..." option)
function setOptions(select, values, allLabel) {
  if (!select) return;
  const first = select.querySelector("option[value='']")?.outerHTML
             || select.querySelector("option[value='ALL']")?.outerHTML
             || `<option value="">${allLabel}</option>`;
  const html = values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  select.innerHTML = first + html;
}

// ====== FILTERING & RENDER ======
function currentFilters() {
  return {
    grade:   selGrade   ? selGrade.value   : "",
    subject: selSubject ? selSubject.value : "",
    year:    selYear    ? selYear.value    : "",
    term:    selTerm    ? selTerm.value    : ""
  };
}

function passFilters(b, f) {
  if (!isAll(f.grade)   && up(b.grade)   !== up(f.grade))   return false;
  if (!isAll(f.subject) && up(b.subject) !== up(f.subject)) return false;
  if (!isAll(f.year)    && up(b.year)    !== up(f.year))    return false;

  // accept "1" and "T1" as the same
  const bt = up(String(b.term)).replace(/^T/, "");
  const ft = up(String(f.term)).replace(/^T/, "");
  if (!isAll(f.term) && bt !== ft) return false;

  return true;
}

function render(bundles) {
  // Count line
  noteEl.textContent = `Loaded ${bundles.length} pack${bundles.length === 1 ? "" : "s"}.`;

  // No results
  if (!bundles.length) {
    listEl.innerHTML = `<p>No results for the current filter.</p>`;
    return;
  }

  // Cards
  const cards = bundles.map(b => {
    const items = (b.items || []).map(it => `
      <li>
        ${escapeHtml(it.paperName || "Paper")}
        — ${escapeHtml(it.link)}Download</a>
      </li>
    `).join("");

    return `
      <article class="pack-card">
        <h3>${escapeHtml(b.title || b.sku)}</h3>
        <p><strong>SKU:</strong> ${escapeHtml(b.sku)}</p>
        <ul>${items}</ul>
        <div class="actions">
          <!-- Hook this to your checkout when ready -->
          #Buy</a>
        </div>
      </article>
    `;
  }).join("");

  listEl.innerHTML = cards;
}

function applyFilters() {
  const f = currentFilters();
  const filtered = ALL_BUNDLES.filter(b => passFilters(b, f));
  render(filtered);
}

// ====== INIT ======
async function initCatalog() {
  try {
    noteEl.textContent = "Loading catalog…";
    listEl.innerHTML = "";

    const res = await fetch(CATALOG_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    ALL_BUNDLES = Array.isArray(data?.bundles) ? data.bundles : [];

    // Populate dropdowns from data (subjects & years were empty in your HTML)
    const grades   = uniqueSorted(ALL_BUNDLES.map(b => b.grade), { numeric:true });
    const subjects = uniqueSorted(ALL_BUNDLES.map(b => b.subject));
    const years    = uniqueSorted(ALL_BUNDLES.map(b => b.year), { numeric:true });
    const terms    = uniqueSorted(ALL_BUNDLES.map(b => String(b.term).replace(/^T/, "")), { numeric:true });

    // If you prefer to keep your prefilled Grades/Terms, comment these two lines
    setOptions(selGrade,   grades,   "All grades");
