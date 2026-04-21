/**
- StudyHub — admin.gs
- Menu + setup + diagnostics + logging.
*/
function onOpen() {
SpreadsheetApp.getUi()
.createMenu('StudyHub Admin')
.addItem('Setup Sheets', 'setupStudyHub_')
.addItem('Setup Drive Roots', 'setupDriveRoots_')
.addItem('Drive Root Status', 'showDriveRootStatus_')
.addSeparator()
.addItem('Full Auto Build', 'fullAutoBuild_')
.addItem('Stop Auto Build', 'stopAutoPipeline_')
.addItem('Auto Build Status', 'showAutoPipelineStatus_')
.addSeparator()
.addItem('Run Full Build Pipeline', 'runFullBuildPipeline')
.addItem('Run Discovery Refresh', 'runDiscoveryRefresh')
.addSeparator()
.addItem('Start Single Subject Bundle (Until Done)', 'startSingleSubjectBundleJob_')
.addItem('Start Single Year Bundle (Until Done)', 'startSingleYearBundleJob_')
.addItem('Start Master Bundle (Until Done)', 'startMasterBundleJob_')
.addItem('Start Ultimate Bundle (Until Done)', 'startUltimateBundleJob_')
.addItem('Start All Bundles (Until Done)', 'startAllBundleJobs_')
.addItem('Generate Catalog', 'generateCatalog_')
.addItem('Pause Bundle Job', 'pauseBundleJob_')
.addItem('Resume Bundle Job', 'resumeBundleJob_')
.addItem('Stop Bundle Job (Reset)', 'stopBundleJob_')
.addItem('Bundle Job Status', 'showBundleJobStatus_')
.addItem('Bundle Status (JSON)', 'showBundleStatus_')
.addItem('Bundle Status (Sheet)', 'writeBundleStatusSheet_')
.addItem('Diagnose Missing Grades 11/12', 'diagnoseMissingUltimateGrades_')
.addSeparator()
.addItem('Build ZIP for One SKU', 'createBundleZipForSkuPrompt_')
.addItem('Build All Bundle ZIPs', 'createAllBundleZips_')
.addItem('Refresh Catalog Delivery URLs from ZIPs', 'refreshCatalogDeliveryUrlsFromZipMap_')
.addItem('Bundle ZIP Status', 'showBundleZipStatus_')
.addSeparator()
.addItem('Start Discovery Loop', 'startDiscoveryRefresh_')
.addItem('Stop Discovery Loop', 'stopDiscoveryRefresh_')
.addItem('Discovery Status', 'showDiscoveryStatus_')
.addItem('Reset Discovery State', 'resetDiscoveryState_')
.addSeparator()
.addItem('Download Queued Records', 'downloadQueuedRecords_')
.addItem('Stop Download Loop', 'stopDownloadQueueLoop_')
.addItem('Download Loop Status', 'showDownloadLoopStatus_')
.addItem('Retry Failed Downloads', 'retryFailedDownloads_')
.addSeparator()
.addItem('Show Queue Stats', 'showQueueStats_')
.addItem('Write QueueStats Sheet', 'writeQueueStatsSheet_')
.addItem('Hard Reset Queue', 'hardResetQueue_')
.addItem('Hard Reset Queue + Stats', 'hardResetQueueAndStats_')
.addSeparator()
.addItem('Diagnostics', 'showDiagnostics_')
.addToUi();
}

function setupStudyHub_() {
const ss = getSpreadsheet_();
ensureSheet_(ss, 'Queue', [
  'timestamp', 'provider', 'source_url', 'province', 'grade', 'subject', 'year', 'language',
  'paper_type', 'paper_file_type', 'memo_file_type', 'has_memo', 'paper_url', 'memo_url',
  'status', 'notes', 'target_folder_url'
]);
ensureSheet_(ss, 'RunLog', ['timestamp', 'action', 'input', 'output', 'notes']);
ensureSheet_(ss, 'Catalog', [
  'sku', 'bundle_type', 'title', 'grade', 'year_or_range', 'subject_or_all', 'price_cents',
  'driveUrl', 'deliveryUrl', 'file_count', 'last_updated', 'description', 'published'
]);
ensureSheet_(ss, 'Orders', [
  'timestamp', 'order_id', 'sku', 'customer_email', 'amount_cents', 'status', 'paid_at',
  'invoice_url', 'delivery_url', 'raw_payload'
]);
ensureSheet_(ss, 'BundleZips', [
  'timestamp', 'sku', 'zip_file_name', 'zip_file_id', 'zip_url', 'bundle_folder_id',
  'bundle_folder_url', 'file_count', 'status', 'notes'
]);
logRun_('SETUP', 'SHEETS', '', 'StudyHub sheets ensured');
}

function ensureSheet_(ss, name, headers) {
let sh = ss.getSheetByName(name);
if (!sh) sh = ss.insertSheet(name);
if (sh.getLastRow() === 0) {
  sh.appendRow(headers);
} else {
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
}
}

function showDiagnostics_() {
SpreadsheetApp.getUi().alert(JSON.stringify(getDiagnostics_(), null, 2));
}

function showDiscoveryStatus_() {
SpreadsheetApp.getUi().alert(JSON.stringify(discoveryRefreshStatus_(), null, 2));
}

function showAutoPipelineStatus_() {
SpreadsheetApp.getUi().alert(JSON.stringify(autoPipelineStatus_(), null, 2));
}

function showDownloadLoopStatus_() {
SpreadsheetApp.getUi().alert(JSON.stringify(downloadLoopStatus_(), null, 2));
}

function logRun_(action, input, output, notes) {
const sh = requireSheet_('RunLog');
sh.appendRow([new Date(), action, input, output, notes]);
}

function showBundleJobStatus_() {
SpreadsheetApp.getUi().alert(JSON.stringify(getBundleJobStatus_(), null, 2));
}
