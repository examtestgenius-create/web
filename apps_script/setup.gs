/**
 * StudyHub Bootstrap
 * Run CREATE_COMPLETE_STUDYHUB once from the existing standalone Apps Script project.
 * Creates the Google Sheet, every required tab, Drive folders and Script Properties.
 */

function CREATE_COMPLETE_STUDYHUB() {
  const props = PropertiesService.getScriptProperties();
  const root = getOrCreateRootFolder_('StudyHub');
  const folders = {
    SOURCE_LIBRARY_ID: getOrCreateFolder_(root, 'Source_Library').getId(),
    BUNDLES_ROOT_ID: getOrCreateFolder_(root, 'Bundles').getId(),
    BUNDLE_ZIPS_ROOT_ID: getOrCreateFolder_(root, 'Bundle_Zips').getId(),
    ORDERS_ROOT_ID: getOrCreateFolder_(root, 'Orders').getId(),
    LOGS_ROOT_ID: getOrCreateFolder_(root, 'Logs_And_Exports').getId()
  };
  const invoices = getOrCreateFolder_(DriveApp.getFolderById(folders.ORDERS_ROOT_ID), 'Invoices');
  folders.INVOICES_ROOT_ID = invoices.getId();

  let ss;
  const existingId = props.getProperty('SHEET_ID');
  try {
    ss = existingId ? SpreadsheetApp.openById(existingId) : null;
  } catch (_) {
    ss = null;
  }
  if (!ss) {
    ss = SpreadsheetApp.create('StudyHub');
    const file = DriveApp.getFileById(ss.getId());
    root.addFile(file);
    try { DriveApp.getRootFolder().removeFile(file); } catch (_) {}
  }

  const schemas = {
    Dashboard: ['metric','value','last_updated','notes'],
    ScannerLinks: ['timestamp','provider','province','source_url','link_text','link_url','filename','grade','subject','year','language','assessment_type','paper_type','role','file_type','notes'],
    Sources: ['enabled','provider','province','page_url','notes'],
    Queue: ['timestamp','provider','source_url','province','grade','subject','year','language','assessment_type','paper_type','paper_file_type','memo_file_type','paper_url','memo_url','status','source_folder_url','notes'],
    ImportDiagnostics: ['timestamp','scanner_row','status','pair_key','provider','province','grade','subject','year','language','assessment_type','paper_type','candidate_role','link_text','link_url','reason'],
    BundleStatus: ['timestamp','job_id','bundle_type','sku','grade','subject_or_all','year_or_range','status','pair_count','file_count','bundle_folder_url','message'],
    Catalog: ['sku','bundle_type','grade','year_or_range','subject_or_all','price_cents','zip_url','file_count','last_updated','title','description','published','zip_status','bundle_folder_url','paper_count','memo_count','pair_count','manifest_file_url','last_error'],
    Orders: ['order_id','sku','title','customer_email','customer_name','customer_phone','amount_cents','pf_payment_id','pf_status','invoice_url','zip_url','timestamp','delivery_status','delivery_sent_at','admin_notes','raw_itn','last_error','itn_signature_valid','itn_amount_valid','itn_server_valid','completed_at'],
    RunLog: ['timestamp','action','entity','input','output','status','notes'],
    Diagnostics: ['check_name','last_run','status','details'],
    Config: ['key','value','notes'],
    Subjects: ['grade','subject']
  };

  Object.keys(schemas).forEach(function(name) {
    createOrRepairTab_(ss, name, schemas[name]);
  });

  populateSubjects_(ss.getSheetByName('Subjects'));
  populateConfig_(ss.getSheetByName('Config'), ss.getId(), root.getId(), folders);
  buildDashboard_(ss.getSheetByName('Dashboard'));

  const first = ss.getSheets()[0];
  if (first.getName() === 'Sheet1' && first.getLastRow() === 0 && Object.keys(schemas).length > 1) {
    ss.deleteSheet(first);
  }

  props.setProperties({
    SHEET_ID: ss.getId(),
    DRIVE_ROOT_ID: root.getId(),
    SOURCE_LIBRARY_ID: folders.SOURCE_LIBRARY_ID,
    BUNDLES_ROOT_ID: folders.BUNDLES_ROOT_ID,
    BUNDLE_ZIPS_ROOT_ID: folders.BUNDLE_ZIPS_ROOT_ID,
    INVOICES_ROOT_ID: folders.INVOICES_ROOT_ID,
    LOGS_ROOT_ID: folders.LOGS_ROOT_ID,
    DISCOVERY_MODE: props.getProperty('DISCOVERY_MODE') || 'SAMPLE',
    DISCOVERY_RUNNING: 'FALSE',
    DISCOVERY_CURSOR: '0',
    DISCOVERY_BATCH_SIZE: props.getProperty('DISCOVERY_BATCH_SIZE') || '500',
    DL_RUNNING: 'FALSE',
    DL_CURSOR: '0',
    DL_BATCH_SIZE: props.getProperty('DL_BATCH_SIZE') || '10',
    BUNDLE_JOB_ENABLED: 'FALSE',
    BUNDLE_JOB_BATCH_SIZE: props.getProperty('BUNDLE_JOB_BATCH_SIZE') || '10',
    BUNDLE_MIN_PAIR_COUNT: '1',
    BUNDLE_STOP_REQUESTED: 'FALSE',
    SL_IMPORT_RUNNING: 'FALSE',
    SL_IMPORT_CURSOR: '2',
    SL_IMPORT_BATCH_SIZE: props.getProperty('SL_IMPORT_BATCH_SIZE') || '500',
    SITE_BASE_URL: props.getProperty('SITE_BASE_URL') || 'https://examtestpaper.co.za',
    NOTIFY_EMAIL: props.getProperty('NOTIFY_EMAIL') || 'examtestgenius@gmail.com'
  }, false);

  Logger.log('STUDYHUB CREATED SUCCESSFULLY');
  Logger.log('Spreadsheet URL: ' + ss.getUrl());
  Logger.log('Drive root URL: ' + root.getUrl());
  SpreadsheetApp.flush();

  return {
    ok: true,
    spreadsheet_id: ss.getId(),
    spreadsheet_url: ss.getUrl(),
    drive_root_id: root.getId(),
    drive_root_url: root.getUrl(),
    tabs: Object.keys(schemas)
  };
}

function createOrRepairTab_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  const existing = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String) : [];
  headers.forEach(function(header) {
    if (existing.indexOf(header) < 0) existing.push(header);
  });
  sheet.getRange(1, 1, 1, existing.length).setValues([existing]);
  sheet.getRange(1, 1, 1, existing.length)
    .setFontWeight('bold').setBackground('#2f76ff').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), existing.length).createFilter();
  sheet.autoResizeColumns(1, existing.length);
}

function populateSubjects_(sheet) {
  if (sheet.getLastRow() > 1) return;
  const junior = ['Mathematics','Natural Sciences','Social Sciences','Economic and Management Sciences (EMS)','Technology','Creative Arts','English HL','English FAL','Afrikaans HL','Afrikaans FAL'];
  const senior = ['Mathematics','Mathematical Literacy','Physical Sciences','Life Sciences','Accounting','Economics','Business Studies','Geography','History','English HL','English FAL','Afrikaans HL','Afrikaans FAL'];
  const rows = [];
  ['8','9'].forEach(g => junior.forEach(s => rows.push([g,s])));
  ['10','11','12'].forEach(g => senior.forEach(s => rows.push([g,s])));
  sheet.getRange(2,1,rows.length,2).setValues(rows);
}

function populateConfig_(sheet, sheetId, rootId, folders) {
  const values = [
    ['SHEET_ID',sheetId,'StudyHub backend spreadsheet'],
    ['DRIVE_ROOT_ID',rootId,'Main StudyHub Drive folder'],
    ['SOURCE_LIBRARY_ID',folders.SOURCE_LIBRARY_ID,'Verified paper and memo storage'],
    ['BUNDLES_ROOT_ID',folders.BUNDLES_ROOT_ID,'Working bundle folders'],
    ['BUNDLE_ZIPS_ROOT_ID',folders.BUNDLE_ZIPS_ROOT_ID,'Final ZIP delivery files'],
    ['INVOICES_ROOT_ID',folders.INVOICES_ROOT_ID,'Invoice PDF storage'],
    ['LOGS_ROOT_ID',folders.LOGS_ROOT_ID,'Logs and exports'],
    ['DISCOVERY_MODE','SAMPLE','Change to LIVE only when approved sources are ready'],
    ['LANGUAGE_SCOPE','English; Afrikaans','Other languages and SAL excluded'],
    ['GRADE_SCOPE','8; 9; 10; 11; 12','Locked scope'],
    ['YEAR_SCOPE','2022 onward','Locked scope']
  ];
  if (sheet.getLastRow() > 1) return;
  sheet.getRange(2,1,values.length,3).setValues(values);
}

function buildDashboard_(sheet) {
  if (sheet.getLastRow() > 1) return;
  const rows = [
    ['System Status','READY',new Date(),'StudyHub backend workbook created'],
    ['Scanner','STOPPED',new Date(),'Start from Apps Script or Control Centre'],
    ['Downloader','STOPPED',new Date(),'Only VALIDATED pairs are downloaded'],
    ['Bundle Builder','STOPPED',new Date(),'Only DOWNLOADED pairs are bundled'],
    ['ZIP Builder','NOT INSTALLED',new Date(),'Required before products can publish'],
    ['PayFast','CONFIGURATION REQUIRED',new Date(),'Keep merchant secrets in Script Properties']
  ];
  sheet.getRange(2,1,rows.length,4).setValues(rows);
}

function getOrCreateRootFolder_(name) {
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function getOrCreateFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
