const CONFIG = (function(){
  var p = PropertiesService.getScriptProperties();
  return {
    APP_NAME: 'Exam Test Paper',
    SITE_BASE_URL: p.getProperty('SITE_BASE_URL') || 'https://examtestpaper.co.za',
    SHEET_ID: p.getProperty('SHEET_ID') || p.getProperty('STUDYHUB_SHEET_ID') || '',
    NOTIFY_EMAIL: p.getProperty('NOTIFY_EMAIL') || 'examtestgenius@gmail.com',
    PAYFAST_MERCHANT_ID: p.getProperty('PAYFAST_MERCHANT_ID') || '',
    PAYFAST_MERCHANT_KEY: p.getProperty('PAYFAST_MERCHANT_KEY') || '',
    PAYFAST_PASSPHRASE: p.getProperty('PAYFAST_PASSPHRASE') || '',
    PAYFAST_PROCESS_URL: p.getProperty('PAYFAST_PROCESS_URL') || 'https://sandbox.payfast.co.za/eng/process',
    DRIVE_ROOT_ID: p.getProperty('DRIVE_ROOT_ID') || p.getProperty('DRIVE_ROOT_FOLDER_ID') || '',
    SOURCE_LIBRARY_ID: p.getProperty('SOURCE_LIBRARY_ID') || '',
    BUNDLES_ROOT_ID: p.getProperty('BUNDLES_ROOT_ID') || '',
    BUNDLE_ZIPS_ROOT_ID: p.getProperty('BUNDLE_ZIPS_ROOT_ID') || '',
    INVOICES_ROOT_ID: p.getProperty('INVOICES_ROOT_ID') || '',
    LOGS_ROOT_ID: p.getProperty('LOGS_ROOT_ID') || ''
  };
})();

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'health';
  if (action === 'health') return json_({ ok:true, app:CONFIG.APP_NAME, ts:nowIso_() });
  if (action === 'catalog') return json_(getPublishedCatalog_());
  if (action === 'order-status') return json_(getOrderStatus_(String((e && e.parameter && e.parameter.order_id) || '')));
  if (action === 'diagnostics') return json_(getDiagnostics_());
  if (action === 'site-config') return json_(loadSiteSettings_());
  if (action === 'free-resources') return json_(buildFreeResourcesJson_());
  return json_({ ok:false, error:'Unknown action' });
}

function doPost(e) {
  const payload = parsePostPayload_(e);
  if (!payload || !payload.action) return json_({ ok:false, error:'Missing action in POST payload' });
  if (payload.action === 'createCheckout' || payload.action === 'create-checkout') return json_(createCheckout_(payload));
  if (payload.action === 'itn' || payload.action === 'payfast-itn') return textFromObj_(handlePayFastITN_(payload));
  if (payload.action === 'contact') return json_(handleContactForm_(payload));
  return json_({ ok:false, error:'Unknown action' });
}

function parsePostPayload_(e) {
  var out = {};
  if (e && e.parameter) Object.keys(e.parameter).forEach(function(k){ out[k] = e.parameter[k]; });
  var raw = (e && e.postData && e.postData.contents) ? String(e.postData.contents) : '';
  var contentType = (e && e.postData && e.postData.type) ? String(e.postData.type).toLowerCase() : '';
  if (raw && (contentType.indexOf('application/json') >= 0 || /^\s*[\[{]/.test(raw))) {
    try {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') Object.keys(parsed).forEach(function(k){ out[k] = parsed[k]; });
    } catch(err) {}
  }
  var hasPayFastShape = !!(out.m_payment_id || out.payment_status || out.pf_payment_id || out.amount_gross);
  if (!out.action && hasPayFastShape) out.action = 'itn';
  return out;
}

function setupStudyHub_() {
  var ss = getSpreadsheet_();
  ensureSheet_(ss, 'Queue', ['timestamp','provider','source_url','province','grade','subject','year','language','paper_type','paper_file_type','memo_file_type','has_memo','paper_url','memo_url','status','notes','target_folder_url']);
  ensureSheet_(ss, 'RunLog', ['timestamp','action','input','output','notes']);
  ensureSheet_(ss, 'Catalog', ['sku','bundle_type','title','grade','year_or_range','subject_or_all','price_cents','driveUrl','deliveryUrl','file_count','last_updated','description','published']);
  ensureSheet_(ss, 'Orders', ['timestamp','order_id','sku','customer_email','amount_cents','status','paid_at','invoice_url','delivery_url','raw_payload']);
  ensureSheet_(ss, 'BundleZips', ['timestamp','sku','zip_file_name','zip_file_id','zip_url','bundle_folder_id','bundle_folder_url','file_count','status','notes']);
  ensureSheet_(ss, 'Site_Settings', ['key','value','notes','updated_at']);
  ensureSheet_(ss, 'Free_Resources', ['title','type','description','url','active','sort_order']);
  seedDefaultSettings_();
  logRun_('SETUP', 'SHEETS', '', 'StudyHub sheets ensured');
  return { ok:true, spreadsheetId:ss.getId() };
}

function setupDriveRoots_() {
  var props = PropertiesService.getScriptProperties();
  var driveRoot = getFolderSafe_(CONFIG.DRIVE_ROOT_ID);
  if (!driveRoot) {
    var rootIter = DriveApp.getFoldersByName('StudyHub');
    driveRoot = rootIter.hasNext() ? rootIter.next() : DriveApp.createFolder('StudyHub');
    props.setProperty('DRIVE_ROOT_ID', driveRoot.getId());
  }
  var sourceLibrary = ensureSubFolder_(driveRoot, 'SourceLibrary');
  var bundlesRoot = ensureSubFolder_(driveRoot, 'Bundles');
  var bundleZipsRoot = ensureSubFolder_(driveRoot, 'BundleZips');
  var invoicesRoot = ensureSubFolder_(driveRoot, 'Invoices');
  var logsRoot = ensureSubFolder_(driveRoot, 'Logs');
  props.setProperty('SOURCE_LIBRARY_ID', sourceLibrary.getId());
  props.setProperty('BUNDLES_ROOT_ID', bundlesRoot.getId());
  props.setProperty('BUNDLE_ZIPS_ROOT_ID', bundleZipsRoot.getId());
  props.setProperty('INVOICES_ROOT_ID', invoicesRoot.getId());
  props.setProperty('LOGS_ROOT_ID', logsRoot.getId());
  return getDriveRootStatus_();
}

function getDriveRootStatus_() {
  return {
    ok: !!CONFIG.DRIVE_ROOT_ID,
    ids: {
      DRIVE_ROOT_ID: CONFIG.DRIVE_ROOT_ID,
      SOURCE_LIBRARY_ID: PropertiesService.getScriptProperties().getProperty('SOURCE_LIBRARY_ID') || '',
      BUNDLES_ROOT_ID: PropertiesService.getScriptProperties().getProperty('BUNDLES_ROOT_ID') || '',
      BUNDLE_ZIPS_ROOT_ID: PropertiesService.getScriptProperties().getProperty('BUNDLE_ZIPS_ROOT_ID') || '',
      INVOICES_ROOT_ID: PropertiesService.getScriptProperties().getProperty('INVOICES_ROOT_ID') || '',
      LOGS_ROOT_ID: PropertiesService.getScriptProperties().getProperty('LOGS_ROOT_ID') || ''
    },
    ts: nowIso_()
  };
}

function getDiagnostics_() {
  const props = PropertiesService.getScriptProperties();
  return {
    ok: true,
    app: CONFIG.APP_NAME,
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
      bundleZipsRootId: !!(props.getProperty('BUNDLE_ZIPS_ROOT_ID') || ''),
      invoicesRootId: !!(props.getProperty('INVOICES_ROOT_ID') || ''),
      logsRootId: !!(props.getProperty('LOGS_ROOT_ID') || '')
    },
    ts: nowIso_()
  };
}

function loadSiteSettings_() {
  var sh = requireSheet_('Site_Settings');
  var out = {};
  rowsToObjects_(sh.getDataRange().getValues()).forEach(function(r){ if (r.key) out[String(r.key)] = r.value; });
  out.backend_url = ScriptApp.getService().getUrl();
  return out;
}

function buildFreeResourcesJson_() {
  return { items: rowsToObjects_(requireSheet_('Free_Resources').getDataRange().getValues()).map(function(r){ r.active = String(r.active).toLowerCase() !== 'false'; return r; }) };
}

function getPublishedCatalog_() {
  var items = rowsToObjects_(requireSheet_('Catalog').getDataRange().getValues()).map(function(r){ r.published = String(r.published).toLowerCase() !== 'false'; r.price_cents = Number(r.price_cents || 0); r.file_count = Number(r.file_count || 0); return r; }).filter(function(x){ return x.published; });
  return { version:'2.1', generated_at:nowIso_(), items:items };
}

function handleContactForm_(params) {
  var body = ['New support message','','Name: ' + (params.name || ''),'Email: ' + (params.email || ''),'Message: ' + (params.message || '')].join('
');
  MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, 'Exam Test Paper Contact Form', body);
  return { ok:true };
}

function getSpreadsheet_() {
  if (CONFIG.SHEET_ID && String(CONFIG.SHEET_ID).trim() !== '') return SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('No spreadsheet available. Set SHEET_ID or bind this script to a Google Sheet.');
}
function ensureSheet_(ss,name,headers){var sh=ss.getSheetByName(name); if(!sh) sh=ss.insertSheet(name); if(sh.getLastRow()===0) sh.appendRow(headers); else sh.getRange(1,1,1,headers.length).setValues([headers]); return sh;}
function requireSheet_(name){var sh=getSpreadsheet_().getSheetByName(name); if(!sh) throw new Error('Sheet "' + name + '" not found. Run setupStudyHub_() first.'); return sh;}
function rowsToObjects_(rows){var headers=rows[0]||[]; return rows.slice(1).filter(function(r){return r.some(function(v){ return v !== '' && v !== null; });}).map(function(r){ return Object.fromEntries(headers.map(function(h,i){ return [h, r[i]]; })); });}
function nowIso_(){return new Date().toISOString();}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
function textFromObj_(obj){return ContentService.createTextOutput((obj && obj.ok===false)?'ERROR':'OK').setMimeType(ContentService.MimeType.TEXT);}
function logRun_(action,input,output,notes){requireSheet_('RunLog').appendRow([new Date(), action||'', input||'', output||'', notes||'']);}
function getFolderSafe_(id){ if(!id || String(id).trim()==='') return null; try { return DriveApp.getFolderById(id); } catch(err){ return null; } }
function ensureSubFolder_(parent, name){ var safe=String(name||'').replace(/[\/:*?"<>
]+/g,'-').replace(/\s+/g,' ').trim(); var it=parent.getFoldersByName(safe); return it.hasNext()?it.next():parent.createFolder(safe); }
function findSubFolder_(parent, name){ var safe=String(name||'').replace(/[\/:*?"<>
]+/g,'-').replace(/\s+/g,' ').trim(); var it=parent.getFoldersByName(safe); return it.hasNext()?it.next():null; }
function upsertBlobFileInFolder_(folder,fileName,blob){var existing=folder.getFilesByName(fileName); while(existing.hasNext()) existing.next().setTrashed(true); blob.setName(fileName); return folder.createFile(blob);}
function upsertFileInFolder_(folder,fileName,blob){return upsertBlobFileInFolder_(folder,fileName,blob);} 
function extractDriveIdFromUrl_(url){ var m=String(url||'').match(/[-\w]{25,}/); return m?m[0]:''; }
function countRealFilesRecursive_(folder){ var count=0, files=folder.getFiles(); while(files.hasNext()){ var f=files.next(), name=f.getName(); if(name!=='manifest.json' && name!=='README.txt') count++; } var subs=folder.getFolders(); while(subs.hasNext()) count += countRealFilesRecursive_(subs.next()); return count; }
function ensureDriveRoots_(){
  var props=PropertiesService.getScriptProperties();
  var driveRoot=getFolderSafe_(props.getProperty('DRIVE_ROOT_ID') || props.getProperty('DRIVE_ROOT_FOLDER_ID'));
  if(!driveRoot) throw new Error('DRIVE_ROOT_ID is missing or invalid in Script Properties.');
  var sourceLibrary=getFolderSafe_(props.getProperty('SOURCE_LIBRARY_ID')) || ensureSubFolder_(driveRoot,'SourceLibrary');
  var bundlesRoot=getFolderSafe_(props.getProperty('BUNDLES_ROOT_ID')) || ensureSubFolder_(driveRoot,'Bundles');
  var bundleZipsRoot=getFolderSafe_(props.getProperty('BUNDLE_ZIPS_ROOT_ID')) || ensureSubFolder_(driveRoot,'BundleZips');
  var invoicesRoot=getFolderSafe_(props.getProperty('INVOICES_ROOT_ID')) || ensureSubFolder_(driveRoot,'Invoices');
  var logsRoot=getFolderSafe_(props.getProperty('LOGS_ROOT_ID')) || ensureSubFolder_(driveRoot,'Logs');
  props.setProperty('SOURCE_LIBRARY_ID', sourceLibrary.getId()); props.setProperty('BUNDLES_ROOT_ID', bundlesRoot.getId()); props.setProperty('BUNDLE_ZIPS_ROOT_ID', bundleZipsRoot.getId()); props.setProperty('INVOICES_ROOT_ID', invoicesRoot.getId()); props.setProperty('LOGS_ROOT_ID', logsRoot.getId());
  return { driveRoot:driveRoot, sourceLibrary:sourceLibrary, bundlesRoot:bundlesRoot, bundleZipsRoot:bundleZipsRoot, invoicesRoot:invoicesRoot, logsRoot:logsRoot };
}
