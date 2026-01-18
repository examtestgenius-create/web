
// ====== CONFIG ======
const CATALOG_URL =
  "https://script.google.com/macros/s/AKfycbzwE4xmXVI4oIbo_hDU4CXT9ZS1skIuUhelCAmBhUP35Q5C51v0Emtk5KnAj0Pb3V6E/exec?mode=catalog";

// Hooks to existing elements in catalog.html
const selGrade   = document.querySelector('[data-filter="grade"]');
const selSubject = document.querySelector('[data-filter="subject"]');
const selYear    = document.querySelector('[data-filter="year"]');
const selTerm    = document.querySelector('[data-filter="term"]');
const listEl     = document.getElementById("catalog-list");
const noteEl     = document.getElementById("catalog-note");

let ALL_BUNDLES = [];

// ====== UTIL ======
const norm = (v) => (v ?? "").toString().trim();
const up   = (v) => norm(v).toUpperCase();
const isAll = (v) => v === "" || up(v) === "ALL";

function uniqueSorted(values, { numeric=false } = {}) {
  const arr = [...new Set(values.map(norm).filter(Boolean))];
  return numeric ? arr.sort((a,b)=>Number(a)-Number(b))
                 : arr.sort((a,b)=>a.localeCompare(b, undefined, { numeric:true }));
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function setOptions(select, values, allLabel) {
  if (!select) return;
  const first = select.querySelector('option[value=""]')?.outerHTML
             || select.querySelector("option")?.outerHTML
             || `<option value="">${allLabel}</option>`;
  const html = values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  select.innerHTML = first + html;
}

// ====== FILTER + RENDER ======
function currentFilters() {
  return {
    grade:   selGrade?.value   || "",
    subject: selSubject?.value || "",
    year:    selYear?.value    || "",
    term:    selTerm?.value    || ""
  };
}

function passFilters(b, f) {
  if (!isAll(f.grade)   && up(b.grade)   !== up(f.grade))   return false;
  if (!isAll(f.subject) && up(b.subject) !== up(f.subject)) return false;
  if (!isAll(f.year)    && up(b.year)    !== up(f.year))    return false;

  // Accept "1" and "T1" as equivalent
  const bt = up(String(b.term)).replace(/^T/, "");
  const ft = up(String(f.term)).replace(/^T/, "");
  if (!isAll(f.term) && bt !== ft) return false;

  return true;
}

function render(list) {
  noteEl.textContent = `Loaded ${list.length} pack${list.length === 1 ? "" : "s"}.`;

  if (!list.length) {
    listEl.innerHTML = `<p>No results for the current filter.</p>`;
    return;
  }

  const html = list.map(b => {
    const items = (b.items || []).map(it => `
      <li>
        ${escapeHtml(it.paperName || "Paper")} —
        ${escapeHtml(it.link)}Download</a>
      </li>
    `).join("");

    return `
      <article class="pack-card">
        <h3>${escapeHtml(b.title || b.sku)}</h3>
        <p><strong>SKU:</strong> ${escapeHtml(b.sku)}</p>
        <ul>${items}</ul>
        <div class="actions">
          <!-- Wire this to PayFast later -->
          #Buy</a>
        </div>
      </article>`;
  }).join("");

  listEl.innerHTML = html;
}

function applyFilters() {
  const f = currentFilters();
  render(ALL_BUNDLES.filter(b => passFilters(b, f)));
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

    // Build Subjects & Years from data (these were empty in your HTML)
    const subjects = uniqueSorted(ALL_BUNDLES.map(b => b.subject));
    const years    = uniqueSorted(ALL_BUNDLES.map(b => b.year), { numeric: true });

    setOptions(selSubject, subjects, "All subjects");
    setOptions(selYear,    years,    "All years");

    // Ensure first view shows everything (avoid filtering out your G12 test)
    if (selGrade)   selGrade.value   = "";   // All grades
    if (selTerm)    selTerm.value    = "";   // All terms
    if (selSubject) selSubject.value = "";
    if (selYear)    selYear.value    = "";

    render(ALL_BUNDLES);

    [selGrade, selSubject, selYear, selTerm].forEach(el => {
      if (el) el.addEventListener("change", applyFilters);
    });
  } catch (err) {
    console.error("Catalog load failed:", err);
    noteEl.textContent = "Could not load catalog.";
    listEl.innerHTML = `<p style="color:#f66">Error loading catalog. See console for details.</p>`;
  }
}

document.addEventListener("DOMContentLoaded", initCatalog);
