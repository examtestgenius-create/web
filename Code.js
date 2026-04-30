/**
- StudyHub — Code.gs
- Core config, web endpoints, helpers, Drive roots setup, diagnostics, and auto-pipeline.
*/
/** --------------------------
- Global Configuration
- -------------------------- */
const CONFIG = {
APP_NAME: 'StudyHub',
// Core
SITE_BASE_URL: PropertiesService.getScriptProperties().getProperty('SITE_BASE_URL') || '',
SHEET_ID: PropertiesService.getScriptProperties().getProperty('SHEET_ID') || '',
NOTIFY_EMAIL: PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL') || '',
// PayFast
PAYFAST_MERCHANT_ID: PropertiesService.getScriptProperties().getProperty('PAYFAST_MERCHANT_ID') || '',
PAYFAST_MERCHANT_KEY: PropertiesService.getScriptProperties().getProperty('PAYFAST_MERCHANT_KEY') || '',
PAYFAST_PASSPHRASE: PropertiesService.getScriptProperties().getProperty('PAYFAST_PASSPHRASE') || '',
PAYFAST_PROCESS_URL: PropertiesService.getScriptProperties().getProperty('PAYFAST_PROCESS_URL') || 'https://www.payfast.co.za/eng/process',
// Drive roots (IDs only; created/ensured by setupDriveRoots_())
DRIVE_ROOT_ID: PropertiesService.getScriptProperties().getProperty('DRIVE_ROOT_ID') || '',
SOURCE_LIBRARY_ID: PropertiesService.getScriptProperties().getProperty('SOURCE_LIBRARY_ID') || '',
BUNDLES_ROOT_ID: PropertiesService.getScriptProperties().getProperty('BUNDLES_ROOT_ID') || '',
INVOICES_ROOT_ID: PropertiesService.getScriptProperties().getProperty('INVOICES_ROOT_ID') || '',
LOGS_ROOT_ID: PropertiesService.getScriptProperties().getProperty('LOGS_ROOT_ID') || ''
};

/** --------------------------
- Web App Entry Points
- -------------------------- */
function doGet(e) {
const action = (e && e.parameter && e.parameter.action) || 'health';
if (action === 'health') return json_({ ok: true, app: CONFIG.APP_NAME, ts: nowIso_() });
if (action === 'catalog') return json_(getPublishedCatalog_());
if (action === 'order-status') return json_(getOrderStatus_((e && e.parameter && e.parameter.order_id) || ''));
if (action === 'diagnostics') return json_(getDiagnostics_());
if (action === 'discovery-status') return json_(safeCall_('discoveryRefreshStatus_', {}));
if (action === 'queue-stats') return json_(safeCall_('queueStats_', { ok: false, error: 'queueStats_ unavailable' }));
if (action === 'drive-root-status') return json_(getDriveRootStatus_());
if (action === 'download-status') return json_(safeCall_('downloadLoopStatus_', { ok: false, error: 'downloadLoopStatus_ unavailable' }));
if (action === 'auto-pipeline-status') return json_(autoPipelineStatus_());
if (action === 'bundle-status') return json_(safeCall_('getBundleStatus_', { ok: false, error: 'getBundleStatus_ unavailable' }));
if (action === 'bundle-job-status') return json_(safeCall_('getBundleJobStatus_', { ok: false, error: 'getBundleJobStatus_ unavailable' }));
  if (action === 'site-content') return json_(getSiteContent_());
return json_({ ok: false, error: 'Unknown action' });
}

function doPost(e) {
const payload = parsePostPayload_(e);
if (!payload || !payload.action) return json_({ ok: false, error: 'Missing action in POST payload' });
if (payload.action === 'createCheckout') return json_(createCheckout_(payload));
if (payload.action === 'itn') return json_(handlePayFastITN_(payload));
  if (payload.action === 'contact') return json_(handleContact_(payload));
if (payload.action === 'bundle-status') return json_(safeCall_('getBundleStatus_', { ok: false, error: 'getBundleStatus_ unavailable' }));
if (payload.action === 'bundle-job-status') return json_(safeCall_('getBundleJobStatus_', { ok: false, error: 'getBundleJobStatus_ unavailable' }));
return json_({ ok: false, error: 'Unknown action' });
}

function parsePostPayload_(e) {
  const out = {};
  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(function (k) { out[k] = e.parameter[k]; });
  }
  const raw = (e && e.postData && e.postData.contents) ? String(e.postData.contents) : '';
  const contentType = (e && e.postData && e.postData.type) ? String(e.postData.type).toLowerCase() : '';
  if (raw) {
    if (contentType.indexOf('application/json') >= 0 || /^[\s]*[\[{]/.test(raw)) {
      try {
        const parsedJson = JSON.parse(raw);
        if (parsedJson && typeof parsedJson === 'object') {
          Object.keys(parsedJson).forEach(function (k) { out[k] = parsedJson[k]; });
        }
      } catch (err) {
        // ignore and rely on e.parameter if form-urlencoded
      }
    }
  }
  const hasPayFastShape = !!(out.m_payment_id || out.payment_status || out.pf_payment_id || out.amount_gross);
  if (!out.action && hasPayFastShape) out.action = 'itn';
  return out;
}

function decodeFormComponent_(value) {
  try {
    return decodeURIComponent(String(value || '').replace(/\+/g, ' '));
  } catch (err) {
    return String(value || '');
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** --------------------------
- Spreadsheet helpers
- -------------------------- */
function getSpreadsheet_() {
  if (CONFIG.SHEET_ID && String(CONFIG.SHEET_ID).trim() !== '') {
    return SpreadsheetApp.openById(CONFIG.SHEET_ID);
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('No spreadsheet available. Set SHEET_ID or bind this script to a Google Sheet.');
}

function sheet_(name) {
  return getSpreadsheet_().getSheetByName(name);
}

function requireSheet_(name) {
  const sh = sheet_(name);
  if (!sh) throw new Error('Sheet "' + name + '" not found. Run setupStudyHub_() first.');
  return sh;
}

function rowsToObjects_(rows) {
  const headers = rows[0] || [];
  return rows.slice(1)
    .filter(function (r) { return r.some(function (v) { return v !== '' && v !== null; }); })
    .map(function (r) {
      return Object.fromEntries(headers.map(function (h, i) { return [h, r[i]]; }));
    });
}

function nowIso_() {
  return new Date().toISOString();
}

/** --------------------------
- Drive helpers
- -------------------------- */
function getFolderSafe_(id) {
  if (!id || String(id).trim() === '') return null;
  try {
    return DriveApp.getFolderById(id);
  } catch (err) {
    return null;
  }
}

function requireFolder_(id, label) {
  const folder = getFolderSafe_(id);
  if (!folder) throw new Error(label + ' is missing or invalid in Script Properties.');
  return folder;
}

function ensureSubFolder_(parentFolder, folderName) {
  const safeName = sanitizeFolderName_(folderName);
  const it = parentFolder.getFoldersByName(safeName);
  if (it.hasNext()) return it.next();
  return parentFolder.createFolder(safeName);
}

function findSubFolder_(parentFolder, folderName) {
  const safeName = sanitizeFolderName_(folderName);
  const it = parentFolder.getFoldersByName(safeName);
  return it.hasNext() ? it.next() : null;
}

function sanitizeFolderName_(name) {
  return String(name || '')
    .replace(/[\/:*?"<>\n]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDriveIdFromUrl_(url) {
  const s = String(url || '');
  let m = s.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return m[1];
  m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return m[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return s;
  return '';
}

function upsertTextFileInFolder_(folder, fileName, content, mimeType) {
  const files = folder.getFilesByName(fileName);
  while (files.hasNext()) files.next().setTrashed(true);
  folder.createFile(fileName, content, mimeType || MimeType.PLAIN_TEXT);
}

function countRealFilesInFolder_(folder) {
  let count = 0;
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    const name = f.getName();
    if (name === 'manifest.json' || name === 'README.txt') continue;
    count++;
  }
  return count;
}

function countRealFilesRecursive_(folder) {
  let count = countRealFilesInFolder_(folder);
  const subs = folder.getFolders();
  while (subs.hasNext()) count += countRealFilesRecursive_(subs.next());
  return count;
}

/** --------------------------
- Generic helpers
- -------------------------- */
function stringOrBlank_(v) { return (v === undefined || v === null) ? '' : String(v); }
function numberOrZero_(v) { const n = Number(v); return isNaN(n) ? 0 : n; }
function boolFromAny_(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  return ['true', '1', 'yes', 'y'].indexOf(s) >= 0;
}
function compareNumericString_(a, b) {
  const na = Number(a), nb = Number(b);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return String(a).localeCompare(String(b));
}
function sanitizeSkuPart_(value) {
  const s = String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'NA';
}
function buildSku_(grade, subjectOrAll, yearOrRange, suffix) {
  const subjectPart = sanitizeSkuPart_(subjectOrAll);
  return 'SH-G' + grade + '-' + subjectPart + '-' + yearOrRange + '-' + suffix;
}
function slugify_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function extensionForFileType_(fileType) {
  const t = String(fileType || '').toUpperCase();
  if (t === 'PDF') return '.pdf';
  if (t === 'ZIP') return '.zip';
  return '';
}
function makeSafeFileName_(value) {
  return String(value || '')
    .replace(/[\/:_?"<>\n]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}
function safeCall_(functionName, fallback) {
  try {
    if (typeof this[functionName] === 'function') return this[functionName]();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
  return fallback;
}

/** --------------------------
- Drive Roots: setup + status + ensure
- -------------------------- */
function setupDriveRoots_() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  let driveRootId = stringOrBlank_(props.getProperty('DRIVE_ROOT_ID'));

  const rootResp = ui.prompt(
    'StudyHub: Drive Root',
    'Enter an existing Drive Folder URL or ID for the top-level StudyHub root.\nLeave blank to auto-create "StudyHub" under your My Drive.',
    ui.ButtonSet.OK_CANCEL
  );
  if (rootResp.getSelectedButton() === ui.Button.CANCEL) return;

  const rootInput = String(rootResp.getResponseText() || '').trim();
  if (rootInput) {
    const extracted = extractDriveIdFromUrl_(rootInput);
    if (!extracted) throw new Error('Could not parse Drive folder ID from: ' + rootInput);
    driveRootId = extracted;
  }

  let driveRootFolder;
  if (driveRootId) {
    driveRootFolder = getFolderSafe_(driveRootId);
    if (!driveRootFolder) throw new Error('DRIVE_ROOT_ID is invalid or inaccessible.');
  } else {
    const rootIter = DriveApp.getFoldersByName('StudyHub');
    driveRootFolder = rootIter.hasNext() ? rootIter.next() : DriveApp.createFolder('StudyHub');
    driveRootId = driveRootFolder.getId();
  }

  props.setProperty('DRIVE_ROOT_ID', driveRootId);
  const sourceLibrary = ensureSubFolder_(driveRootFolder, 'SourceLibrary');
  const bundlesRoot = ensureSubFolder_(driveRootFolder, 'Bundles');
  const invoicesRoot = ensureSubFolder_(driveRootFolder, 'Invoices');
  const logsRoot = ensureSubFolder_(driveRootFolder, 'Logs');

  props.setProperty('SOURCE_LIBRARY_ID', sourceLibrary.getId());
  props.setProperty('BUNDLES_ROOT_ID', bundlesRoot.getId());
  props.setProperty('INVOICES_ROOT_ID', invoicesRoot.getId());
  props.setProperty('LOGS_ROOT_ID', logsRoot.getId());

  const manifest = {
    ts: nowIso_(),
    drive_root_id: driveRootId,
    source_library_id: sourceLibrary.getId(),
    bundles_root_id: bundlesRoot.getId(),
    invoices_root_id: invoicesRoot.getId(),
    logs_root_id: logsRoot.getId()
  };
  upsertTextFileInFolder_(logsRoot, 'drive_roots_manifest.json', JSON.stringify(manifest, null, 2), MimeType.PLAIN_TEXT);

  logRunIfAvailable_('SETUP', 'DRIVE_ROOTS', JSON.stringify({ root: driveRootFolder.getUrl() }), 'Drive root + standard subfolders ensured');
  ui.alert('Drive roots configured.

Root: ' + driveRootFolder.getUrl());
}

function ensureDriveRoots_() {
  const props = PropertiesService.getScriptProperties();
  const driveRoot = requireFolder_(props.getProperty('DRIVE_ROOT_ID'), 'DRIVE_ROOT_ID');
  const sourceLibrary = requireFolder_(props.getProperty('SOURCE_LIBRARY_ID'), 'SOURCE_LIBRARY_ID');
  const bundlesRoot = requireFolder_(props.getProperty('BUNDLES_ROOT_ID'), 'BUNDLES_ROOT_ID');
  const invoicesRoot = requireFolder_(props.getProperty('INVOICES_ROOT_ID'), 'INVOICES_ROOT_ID');
  const logsRoot = requireFolder_(props.getProperty('LOGS_ROOT_ID'), 'LOGS_ROOT_ID');
  return { driveRoot: driveRoot, sourceLibrary: sourceLibrary, bundlesRoot: bundlesRoot, invoicesRoot: invoicesRoot, logsRoot: logsRoot };
}

function showDriveRootStatus_() {
  SpreadsheetApp.getUi().alert(JSON.stringify(getDriveRootStatus_(), null, 2));
}

function getDriveRootStatus_() {
  const props = PropertiesService.getScriptProperties();
  const ids = {
    DRIVE_ROOT_ID: stringOrBlank_(props.getProperty('DRIVE_ROOT_ID')),
    SOURCE_LIBRARY_ID: stringOrBlank_(props.getProperty('SOURCE_LIBRARY_ID')),
    BUNDLES_ROOT_ID: stringOrBlank_(props.getProperty('BUNDLES_ROOT_ID')),
    INVOICES_ROOT_ID: stringOrBlank_(props.getProperty('INVOICES_ROOT_ID')),
    LOGS_ROOT_ID: stringOrBlank_(props.getProperty('LOGS_ROOT_ID'))
  };
  function safeUrl(id) { const f = getFolderSafe_(id); return f ? f.getUrl() : ''; }
  return {
    ok: !!(ids.DRIVE_ROOT_ID && ids.SOURCE_LIBRARY_ID && ids.BUNDLES_ROOT_ID && ids.INVOICES_ROOT_ID && ids.LOGS_ROOT_ID),
    ids: ids,
    urls: {
      DRIVE_ROOT_URL: safeUrl(ids.DRIVE_ROOT_ID),
      SOURCE_LIBRARY_URL: safeUrl(ids.SOURCE_LIBRARY_ID),
      BUNDLES_ROOT_URL: safeUrl(ids.BUNDLES_ROOT_ID),
      INVOICES_ROOT_URL: safeUrl(ids.INVOICES_ROOT_ID),
      LOGS_ROOT_URL: safeUrl(ids.LOGS_ROOT_ID)
    },
    ts: nowIso_()
  };
}

function logRunIfAvailable_(action, input, output, notes) {
  try {
    if (typeof logRun_ === 'function') logRun_(action, input, output, notes);
  } catch (e) {
    // no-op if admin.gs not loaded yet
  }
}

function getDiagnostics_() {
  const ss = getSpreadsheet_();
  const props = PropertiesService.getScriptProperties();
  return {
    ok: true,
    app: CONFIG.APP_NAME,
    spreadsheetName: ss.getName(),
    spreadsheetId: ss.getId(),
    configured: {
      siteBaseUrl: !!CONFIG.SITE_BASE_URL,
      sheetId: !!CONFIG.SHEET_ID,
      notifyEmail: !!CONFIG.NOTIFY_EMAIL,
      payfastMerchantId: !!CONFIG.PAYFAST_MERCHANT_ID,
      payfastMerchantKey: !!CONFIG.PAYFAST_MERCHANT_KEY,
      payfastPassphrase: !!CONFIG.PAYFAST_PASSPHRASE,
      driveRootId: !!(props.getProperty('DRIVE_ROOT_ID') || ''),
      sourceLibraryId: !!(props.getProperty('SOURCE_LIBRARY_ID') || ''),
      bundlesRootId: !!(props.getProperty('BUNDLES_ROOT_ID') || ''),
      invoicesRootId: !!(props.getProperty('INVOICES_ROOT_ID') || ''),
      logsRootId: !!(props.getProperty('LOGS_ROOT_ID') || '')
    },
    ts: nowIso_()
  };
}

/** --------------------------
- Auto-pipeline: start/stop/status + scheduler tick
- -------------------------- */
const AUTO_PIPELINE_ENABLED_KEY = 'AUTO_PIPELINE_ENABLED';
const AUTO_PIPELINE_CADENCE_MIN_KEY = 'AUTO_PIPELINE_CADENCE_MIN';
const AUTO_PIPELINE_LAST_RUN_KEY = 'AUTO_PIPELINE_LAST_RUN';

function fullAutoBuild_() {
  const props = PropertiesService.getScriptProperties();
  const cadence = Math.max(1, Math.floor(Number(props.getProperty(AUTO_PIPELINE_CADENCE_MIN_KEY) || 15)));
  props.setProperty(AUTO_PIPELINE_ENABLED_KEY, 'true');
  props.setProperty(AUTO_PIPELINE_CADENCE_MIN_KEY, String(cadence));
  deleteTriggersForFunction_('autoPipelineTick_');
  ScriptApp.newTrigger('autoPipelineTick_').timeBased().everyMinutes(cadence).create();
  logRunIfAvailable_('AUTO_PIPELINE', 'START', String(cadence), 'Enabled auto pipeline at ' + cadence + ' min cadence');
  autoPipelineTick_();
}

function stopAutoPipeline_() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(AUTO_PIPELINE_ENABLED_KEY, 'false');
  props.deleteProperty(AUTO_PIPELINE_LAST_RUN_KEY);
  deleteTriggersForFunction_('autoPipelineTick_');
  logRunIfAvailable_('AUTO_PIPELINE', 'STOP', '', 'Auto pipeline disabled and trigger removed');
}

function autoPipelineStatus_() {
  const props = PropertiesService.getScriptProperties();
  const enabled = props.getProperty(AUTO_PIPELINE_ENABLED_KEY) === 'true';
  const cadence = Number(props.getProperty(AUTO_PIPELINE_CADENCE_MIN_KEY) || 15);
  const lastRun = props.getProperty(AUTO_PIPELINE_LAST_RUN_KEY) || '';
  const triggers = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'autoPipelineTick_'; });
  let discovery = { ok: false, error: 'discoveryRefreshStatus_ unavailable' };
  let queue = { ok: false, error: 'queueStats_ unavailable' };
  let download = { ok: false, error: 'downloadLoopStatus_ unavailable' };
  try { if (typeof discoveryRefreshStatus_ === 'function') discovery = discoveryRefreshStatus_(); } catch (e) { discovery = { ok: false, error: String(e) }; }
  try { if (typeof queueStats_ === 'function') queue = queueStats_(); } catch (e) { queue = { ok: false, error: String(e) }; }
  try { if (typeof downloadLoopStatus_ === 'function') download = downloadLoopStatus_(); } catch (e) { download = { ok: false, error: String(e) }; }
  return {
    ok: true,
    enabled: enabled,
    cadence_minutes: cadence,
    last_run: lastRun,
    trigger_count: triggers.length,
    discovery_status: discovery,
    download_status: download,
    queue_summary: { total_queue_records: queue.total_queue_records || 0, by_status: queue.by_status || {} },
    ts: nowIso_()
  };
}

function autoPipelineTick_() {
  const props = PropertiesService.getScriptProperties();
  const enabled = props.getProperty(AUTO_PIPELINE_ENABLED_KEY) === 'true';
  if (!enabled) {
    deleteTriggersForFunction_('autoPipelineTick_');
    logRunIfAvailable_('AUTO_TICK_SKIP', 'DISABLED', '', 'Pipeline disabled; trigger cleaned up');
    return;
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    logRunIfAvailable_('AUTO_TICK_SKIP', 'LOCKED', '', 'Another tick still running');
    return;
  }
  try {
    props.setProperty(AUTO_PIPELINE_LAST_RUN_KEY, nowIso_());
  } catch (err) {
    logRunIfAvailable_('AUTO_TICK_ERROR', '', '', String(err));
    throw err;
  } finally {
    lock.releaseLock();
  }
}
