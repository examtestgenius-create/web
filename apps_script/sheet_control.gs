/**
 * StudyHub Google Sheets Control Menu
 * Adds a "StudyHub" menu next to Help when the spreadsheet opens.
 * Requires the existing scanner/importer/downloader/bundle functions.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('StudyHub')
    .addItem('Open Control Panel', 'showStudyHubControlPanel')
    .addSeparator()
    .addSubMenu(
      SpreadsheetApp.getUi().createMenu('1. Scan & Import')
        .addItem('Start / Resume Full Scan', 'uiStartFullScan')
        .addItem('Stop Scan Safely', 'uiStopFullScan')
        .addItem('Show Scan Status', 'uiShowScanStatus')
        .addItem('Reset Scan Cursor', 'uiResetScan')
    )
    .addSubMenu(
      SpreadsheetApp.getUi().createMenu('2. Download to Source Library')
        .addItem('Download Next Batch', 'uiDownloadNextBatch')
        .addItem('Start Automatic Downloads', 'uiStartDownloads')
        .addItem('Stop Automatic Downloads', 'uiStopDownloads')
        .addItem('Show Download Summary', 'uiShowDownloadSummary')
    )
    .addSubMenu(
      SpreadsheetApp.getUi().createMenu('3. Build Bundles')
        .addItem('Build Single Subject Bundles', 'uiBuildSingleSubject')
        .addItem('Build Single Year Bundles', 'uiBuildSingleYear')
        .addItem('Build Master Bundles', 'uiBuildMaster')
        .addItem('Build Ultimate Bundles', 'uiBuildUltimate')
        .addItem('Start All Bundle Jobs', 'uiBuildAllBundles')
        .addItem('Stop Bundle Job', 'uiStopBundles')
    )
    .addSubMenu(
      SpreadsheetApp.getUi().createMenu('4. Review')
        .addItem('Open Queue', 'uiOpenQueue')
        .addItem('Open Import Diagnostics', 'uiOpenDiagnostics')
        .addItem('Open Catalog', 'uiOpenCatalog')
        .addItem('Refresh Dashboard Summary', 'uiRefreshDashboard')
    )
    .addSeparator()
    .addItem('Install Automatic Triggers', 'uiInstallTriggers')
    .addItem('Remove Automatic Triggers', 'uiRemoveTriggers')
    .addToUi();
}

function uiStartFullScan() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.alert(
    'Start full StudyHub scan?',
    'This processes ScannerLinks in safe batches. Only Grade 8-12, years 2022+, English/Afrikaans content and complete paper/memo pairs may enter Queue.',
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) return;
  const result = startScannerLinksImport();
  toastResult_('Scan started', result);
}

function uiStopFullScan() {
  const result = stopScannerLinksImport();
  toastResult_('Scan stopped safely', result);
}

function uiShowScanStatus() {
  const result = scannerLinksImportStatus();
  SpreadsheetApp.getUi().alert('StudyHub Scan Status', formatObject_(result), SpreadsheetApp.getUi().ButtonSet.OK);
}

function uiResetScan() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.alert('Reset scanner cursor?', 'Existing Queue records are preserved. Duplicate protection remains active.', ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;
  const result = resetScannerLinksImport();
  toastResult_('Scanner cursor reset', result);
}

function uiDownloadNextBatch() {
  const result = runDownloadBatch();
  toastResult_('Download batch completed', result);
}

function uiStartDownloads() {
  PropertiesService.getScriptProperties().setProperty('DL_RUNNING', 'TRUE');
  ensureUiTrigger_('uiAutomaticDownloadTick', 15);
  const result = runDownloadBatch();
  toastResult_('Automatic downloads started', result);
}

function uiAutomaticDownloadTick() {
  const running = String(PropertiesService.getScriptProperties().getProperty('DL_RUNNING')).toUpperCase() === 'TRUE';
  if (running) runDownloadBatch();
}

function uiStopDownloads() {
  PropertiesService.getScriptProperties().setProperty('DL_RUNNING', 'FALSE');
  deleteUiTrigger_('uiAutomaticDownloadTick');
  SpreadsheetApp.getActive().toast('Automatic downloads stopped.', 'StudyHub', 6);
}

function uiShowDownloadSummary() {
  const rows = sheetRowsUi_('Queue');
  const summary = countByUi_(rows, 'status');
  SpreadsheetApp.getUi().alert('Download Summary', formatObject_(summary), SpreadsheetApp.getUi().ButtonSet.OK);
}

function uiBuildSingleSubject() { toastResult_('Single Subject build', buildSingleSubjectBundles()); }
function uiBuildSingleYear() { toastResult_('Single Year build', buildSingleYearBundles()); }
function uiBuildMaster() { toastResult_('Master build', buildMasterBundles()); }
function uiBuildUltimate() { toastResult_('Ultimate build', buildUltimateBundles()); }

function uiBuildAllBundles() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.alert('Build all bundles?', 'Only DOWNLOADED source pairs should be bundled. Products remain unpublished until ZIP status is READY.', ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;
  toastResult_('All bundle jobs started', startBundleJob());
}

function uiStopBundles() { toastResult_('Bundle job stopped', stopBundleJob()); }
function uiOpenQueue() { activateSheetUi_('Queue'); }
function uiOpenDiagnostics() { activateSheetUi_('ImportDiagnostics'); }
function uiOpenCatalog() { activateSheetUi_('Catalog'); }

function uiRefreshDashboard() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName('Dashboard');
  if (!sheet) sheet = ss.insertSheet('Dashboard', 0);
  sheet.clear();

  const queue = sheetRowsUi_('Queue');
  const diagnostics = sheetRowsUi_('ImportDiagnostics');
  const catalog = sheetRowsUi_('Catalog');
  const queueCounts = countByUi_(queue, 'status');
  const diagnosticCounts = countByUi_(diagnostics, 'status');

  const data = [
    ['StudyHub Control Dashboard', ''],
    ['Last refreshed', new Date()],
    ['', ''],
    ['QUEUE', 'COUNT'],
    ...Object.keys(queueCounts).sort().map(k => [k, queueCounts[k]]),
    ['', ''],
    ['IMPORT DIAGNOSTICS', 'COUNT'],
    ...Object.keys(diagnosticCounts).sort().map(k => [k, diagnosticCounts[k]]),
    ['', ''],
    ['Catalog rows', catalog.length],
    ['Published + ZIP READY', catalog.filter(r => String(r.published).toUpperCase() === 'TRUE' && String(r.zip_status).toUpperCase() === 'READY').length]
  ];
  sheet.getRange(1, 1, data.length, 2).setValues(data);
  sheet.getRange('A1:B1').merge().setValue('StudyHub Control Dashboard').setFontSize(16).setFontWeight('bold').setBackground('#2f76ff').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
  sheet.activate();
  ss.toast('Dashboard summary refreshed.', 'StudyHub', 6);
}

function showStudyHubControlPanel() {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body{font-family:Arial,sans-serif;padding:16px;color:#14213d;background:#f6f8fc}
      h2{margin-top:0}.card{background:white;border:1px solid #dbe4f3;border-radius:14px;padding:12px;margin:10px 0}
      button{width:100%;padding:11px;margin:5px 0;border:0;border-radius:9px;background:#2f76ff;color:white;font-weight:700;cursor:pointer}
      button.stop{background:#b42318}button.secondary{background:#35536f}
      .note{font-size:12px;color:#5c6b80;line-height:1.45}
    </style>
    <h2>StudyHub Control</h2>
    <div class="card"><b>1. Scan and Import</b>
      <button onclick="run('uiStartFullScan')">Start / Resume Full Scan</button>
      <button class="stop" onclick="run('uiStopFullScan')">Stop Scan Safely</button>
      <button class="secondary" onclick="run('uiShowScanStatus')">Show Scan Status</button>
    </div>
    <div class="card"><b>2. Download</b>
      <button onclick="run('uiDownloadNextBatch')">Download Next Batch</button>
      <button onclick="run('uiStartDownloads')">Start Automatic Downloads</button>
      <button class="stop" onclick="run('uiStopDownloads')">Stop Downloads</button>
    </div>
    <div class="card"><b>3. Build Bundles</b>
      <button onclick="run('uiBuildAllBundles')">Build All Bundle Types</button>
      <button class="stop" onclick="run('uiStopBundles')">Stop Bundle Job</button>
    </div>
    <div class="card"><b>Review</b>
      <button class="secondary" onclick="run('uiRefreshDashboard')">Refresh Dashboard</button>
      <button class="secondary" onclick="run('uiOpenDiagnostics')">Open Diagnostics</button>
    </div>
    <p class="note">Rejected rows are expected for unsupported languages, SAL, Grades below 8, years before 2022, missing metadata and files without a matching paper or memo. Only validated pairs move to Queue.</p>
    <script>
      function run(fn){google.script.run.withFailureHandler(e=>alert(e.message)).withSuccessHandler(()=>{} )[fn]();}
    </script>
  `).setTitle('StudyHub Control');
  SpreadsheetApp.getUi().showSidebar(html);
}

function uiInstallTriggers() {
  ensureUiTrigger_('runScannerLinksImportBatch', 5);
  ensureUiTrigger_('uiAutomaticDownloadTick', 15);
  SpreadsheetApp.getActive().toast('StudyHub automatic triggers installed.', 'StudyHub', 6);
}

function uiRemoveTriggers() {
  ['runScannerLinksImportBatch','uiAutomaticDownloadTick','runBundleJobTick'].forEach(deleteUiTrigger_);
  SpreadsheetApp.getActive().toast('StudyHub automatic triggers removed.', 'StudyHub', 6);
}

function ensureUiTrigger_(handler, minutes) {
  const exists = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === handler);
  if (!exists) ScriptApp.newTrigger(handler).timeBased().everyMinutes(minutes).create();
}
function deleteUiTrigger_(handler) {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === handler) ScriptApp.deleteTrigger(t); });
}
function activateSheetUi_(name) {
  const ss = SpreadsheetApp.getActive();
  const s = ss.getSheetByName(name);
  if (!s) throw new Error(name + ' sheet does not exist yet.');
  s.activate();
}
function sheetRowsUi_(name) {
  const s = SpreadsheetApp.getActive().getSheetByName(name);
  if (!s || s.getLastRow() < 2) return [];
  const values = s.getDataRange().getValues();
  const headers = values.shift().map(String);
  return values.map(row => { const o = {}; headers.forEach((h,i) => o[h] = row[i]); return o; });
}
function countByUi_(rows, field) {
  const out = {};
  rows.forEach(r => { const k = String(r[field] || 'BLANK').toUpperCase(); out[k] = (out[k] || 0) + 1; });
  return out;
}
function formatObject_(obj) { return Object.keys(obj).map(k => k + ': ' + (typeof obj[k] === 'object' ? JSON.stringify(obj[k]) : obj[k])).join('\n'); }
function toastResult_(title, result) { SpreadsheetApp.getActive().toast(formatObject_(result || {ok:true}), title, 10); }
