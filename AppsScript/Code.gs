/**
 * ExamTestGenius - Single Apps Script Web App
 *
 * - doGet(e): serves catalog JSON built from your Google Sheet (Drive file links already in sheet)
 * - doPost(e): receives PayFast ITN, validates signature, logs to Orders sheet, and emails links
 */

function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const mode = String(p.mode || '').toLowerCase();

  if (mode === 'catalog') {
    const cfg = getCfg_();
    if (cfg.catalogKey && String(p.key || '') !== cfg.catalogKey) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const data = buildCatalog_(cfg);
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const itn = (e && e.parameter) ? e.parameter : {};
    const cfg = getCfg_();

    ensureOrdersSheet_(cfg);

    const sigOk = validateSignature_(itn, cfg.passphrase);
    logOrder_(cfg, itn, sigOk);

    if (!sigOk) {
      console.error('Invalid signature', JSON.stringify(itn));
      return ok_();
    }

    const status = String(itn.payment_status || '').toUpperCase();
    if (status !== 'COMPLETE') return ok_();

    const sku = String(itn.m_payment_id || '').trim();
    const links = resolveLinksFromSheet_(cfg, sku);

    const buyerEmail = itn.email_address || '';
    const waNumber   = itn.custom_str1 || '';
    const itemName   = itn.item_name || '';
    const amount     = itn.amount_gross || itn.amount || '';

    const subjectBuyer = `Your ExamTestGenius download links: ${itemName}`;
    const bodyBuyer = [
      'Thank you for your payment!',
      '',
      `Item: ${itemName}`,
      sku ? `SKU: ${sku}` : null,
      amount ? `Amount: ${amount}` : null,
      '',
      'Download links:',
      ...(links.length ? links : ['(No links found for this SKU yet — please contact support)']),
      '',
      `Support: ${cfg.supportEmail}`
    ].filter(Boolean).join('
');

    if (buyerEmail) MailApp.sendEmail(buyerEmail, subjectBuyer, bodyBuyer);

    const subjectAdmin = `New paid order: ${itemName}`;
    const bodyAdmin = [
      'Payment COMPLETE',
      '',
      `Item: ${itemName}`,
      sku ? `SKU: ${sku}` : null,
      amount ? `Amount: ${amount}` : null,
      `Buyer: ${buyerEmail}`,
      `WhatsApp: ${waNumber}`,
      '',
      'Links:',
      ...(links.length ? links : ['(No links found for this SKU yet)']),
      '',
      'Raw ITN:',
      JSON.stringify(itn, null, 2)
    ].filter(Boolean).join('
');

    MailApp.sendEmail(cfg.supportEmail, subjectAdmin, bodyAdmin);

    return ok_();

  } catch (err) {
    console.error(err);
    return ok_();
  }
}

function ok_() {
  return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
}

function getCfg_() {
  const props = PropertiesService.getScriptProperties();

  const sheetId = props.getProperty('SHEET_ID') || '';
  const filesSheetName = props.getProperty('FILES_SHEET_NAME') || 'Files';
  const ordersSheetName = props.getProperty('ORDERS_SHEET_NAME') || 'Orders';
  const supportEmail = props.getProperty('SUPPORT_EMAIL') || 'examtestgenius@gmail.com';
  const passphrase = props.getProperty('PAYFAST_PASSPHRASE') || '';
  const catalogKey = props.getProperty('CATALOG_API_KEY') || '';

  let prices = {};
  try { prices = JSON.parse(props.getProperty('PRICES_JSON') || '{}'); } catch (e) { prices = {}; }

  return { sheetId, filesSheetName, ordersSheetName, supportEmail, passphrase, catalogKey, prices };
}

function setupExamTestGenius() {
  const props = PropertiesService.getScriptProperties();
  setIfEmpty_(props, 'SUPPORT_EMAIL', 'examtestgenius@gmail.com');
  setIfEmpty_(props, 'FILES_SHEET_NAME', 'Files');
  setIfEmpty_(props, 'ORDERS_SHEET_NAME', 'Orders');
  setIfEmpty_(props, 'PAYFAST_PASSPHRASE', '');
  setIfEmpty_(props, 'CATALOG_API_KEY', '');
  setIfEmpty_(props, 'PRICES_JSON', JSON.stringify({}));
  return props.getProperties();
}

function setIfEmpty_(props, key, value) {
  const cur = props.getProperty(key);
  if (!cur) props.setProperty(key, value);
}

function buildCatalog_(cfg) {
  if (!cfg.sheetId) {
    return { error: 'SHEET_ID missing', bundles: [] };
  }
  const ss = SpreadsheetApp.openById(cfg.sheetId);
  const sh = ss.getSheetByName(cfg.filesSheetName);
  if (!sh) return { error: `Files sheet not found: ${cfg.filesSheetName}`, bundles: [] };

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { bundles: [] };

  const header = values[0].map(String);
  const idx = (name) => header.indexOf(name);

  const iStatus = idx('Status');
  const iGrade = idx('Grade');
  const iSubject = idx('Subject');
  const iYear = idx('Year');
  const iTerm = idx('Term');
  const iPaperName = idx('PaperName');
  const iLink = idx('Link');
  const iPreview = idx('PreviewURL');
  const iType = idx('Type');
  const iTitle = idx('Title');
  const iBundleSKU = idx('BundleSKU');

  const bundles = {};

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const status = iStatus >= 0 ? String(row[iStatus] || '') : '';
    if (status && status !== 'UPLOADED') continue;

    const grade = iGrade >= 0 ? String(row[iGrade] || '') : '';
    const subject = iSubject >= 0 ? String(row[iSubject] || '') : '';
    const year = iYear >= 0 ? String(row[iYear] || '') : '';
    const term = iTerm >= 0 ? String(row[iTerm] || '') : '';

    let sku = (iBundleSKU >= 0 ? String(row[iBundleSKU] || '') : '').trim();
    if (!sku) sku = makeSku_(grade, subject, year, term);

    const paperName = iPaperName >= 0 ? String(row[iPaperName] || '') : '';
    const link = iLink >= 0 ? String(row[iLink] || '') : '';
    const preview = iPreview >= 0 ? String(row[iPreview] || '') : '';
    const type = iType >= 0 ? String(row[iType] || '') : '';
    const title = iTitle >= 0 ? String(row[iTitle] || '') : '';

    if (!bundles[sku]) {
      const bundleTitle = `Grade ${grade} • ${subject} • ${year} • Term ${term}`;
      bundles[sku] = {
        sku,
        title: bundleTitle,
        grade, subject, year, term,
        price: (cfg.prices && cfg.prices[sku] !== undefined) ? Number(cfg.prices[sku]) : null,
        items: []
      };
    }

    bundles[sku].items.push({ paperName, title, type, link, previewUrl: preview });
  }

  return { bundles: Object.values(bundles) };
}

function makeSku_(grade, subject, year, term) {
  const s = `${grade}-${subject}-${year}-T${term}`.toUpperCase();
  return s.replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '-').replace(/-+/g, '-');
}

function resolveLinksFromSheet_(cfg, sku) {
  if (!cfg.sheetId || !sku) return [];
  const ss = SpreadsheetApp.openById(cfg.sheetId);
  const sh = ss.getSheetByName(cfg.filesSheetName);
  if (!sh) return [];

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const header = values[0].map(String);
  const iStatus = header.indexOf('Status');
  const iBundleSKU = header.indexOf('BundleSKU');
  const iLink = header.indexOf('Link');

  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const status = iStatus >= 0 ? String(row[iStatus] || '') : '';
    if (status && status !== 'UPLOADED') continue;

    const rowSku = iBundleSKU >= 0 ? String(row[iBundleSKU] || '').trim() : '';
    let effectiveSku = rowSku;
    if (!effectiveSku) {
      const grade = String(row[header.indexOf('Grade')] || '');
      const subject = String(row[header.indexOf('Subject')] || '');
      const year = String(row[header.indexOf('Year')] || '');
      const term = String(row[header.indexOf('Term')] || '');
      effectiveSku = makeSku_(grade, subject, year, term);
    }

    if (effectiveSku !== sku) continue;
    const link = iLink >= 0 ? String(row[iLink] || '') : '';
    if (link) out.push(link);
  }
  return out;
}

function ensureOrdersSheet_(cfg) {
  if (!cfg.sheetId) return;
  const ss = SpreadsheetApp.openById(cfg.sheetId);
  let sh = ss.getSheetByName(cfg.ordersSheetName);
  if (!sh) sh = ss.insertSheet(cfg.ordersSheetName);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['timestamp','payment_status','sig_ok','item_name','m_payment_id','amount_gross','email_address','whatsapp','pf_payment_id','signature','raw_json']);
  }
}

function logOrder_(cfg, itn, sigOk) {
  if (!cfg.sheetId) return;
  const ss = SpreadsheetApp.openById(cfg.sheetId);
  const sh = ss.getSheetByName(cfg.ordersSheetName);
  if (!sh) return;

  sh.appendRow([
    new Date(),
    itn.payment_status || '',
    sigOk ? 'YES' : 'NO',
    itn.item_name || '',
    itn.m_payment_id || '',
    itn.amount_gross || itn.amount || '',
    itn.email_address || '',
    itn.custom_str1 || '',
    itn.pf_payment_id || '',
    itn.signature || '',
    JSON.stringify(itn)
  ]);
}

function validateSignature_(params, passphrase) {
  if (!params || !params.signature) return false;
  const signature = String(params.signature).toLowerCase();
  const keys = Object.keys(params)
    .filter(k => k !== 'signature' && params[k] !== undefined && params[k] !== null && String(params[k]).length > 0)
    .sort();
  const encoded = keys.map(k => `${k}=${encodeURIComponent(String(params[k]).trim())}`).join('&');
  const withPass = (passphrase && String(passphrase).trim())
    ? `${encoded}&passphrase=${encodeURIComponent(String(passphrase).trim())}`
    : encoded;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, withPass)
    .map(b => (b + 256).toString(16).slice(-2))
    .join('');
  return digest === signature;
}
