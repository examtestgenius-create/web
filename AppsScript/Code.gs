/**
 * ExamTestGenius - PayFast ITN Receiver (Google Apps Script)
 *
 * Deploy as Web App and use the /exec URL as PayFast notify_url.
 * Web apps receive POST params via doPost(e) and e.parameter. 
 */

function doPost(e) {
  try {
    const p = (e && e.parameter) ? e.parameter : {};
    const cfg = getCfg_();

    // Signature check (recommended). If passphrase is not enabled, leave PAYFAST_PASSPHRASE empty.
    if (!validateSignature_(p, cfg.passphrase)) {
      console.error('Invalid signature', JSON.stringify(p));
      return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
    }

    const status = String(p.payment_status || '').toUpperCase();
    if (status !== 'COMPLETE') {
      return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
    }

    const buyerEmail = p.email_address || '';
    const waNumber   = p.custom_str1 || '';
    const itemName   = p.item_name || '';
    const amount     = p.amount_gross || p.amount || '';

    // Determine SKU (optional). If you later add a custom field for SKU, use it here.
    const skuGuess = guessSku_(itemName);

    // Resolve links
    const links = resolveLinks_(cfg, skuGuess) || cfg.defaultLinks;

    // Email buyer
    const subjectBuyer = `Your ExamTestGenius download links: ${itemName}`;
    const bodyBuyer = [
      'Thank you for your payment!',
      '',
      `Item: ${itemName}`,
      skuGuess ? `SKU: ${skuGuess}` : null,
      amount ? `Amount: ${amount}` : null,
      '',
      'Download links:',
      ...links,
      '',
      `Support: ${cfg.supportEmail}`
    ].filter(Boolean).join('
');

    if (buyerEmail) {
      MailApp.sendEmail(buyerEmail, subjectBuyer, bodyBuyer);
    }

    // Email admin
    const subjectAdmin = `New paid order: ${itemName}`;
    const bodyAdmin = [
      'Payment COMPLETE',
      '',
      `Item: ${itemName}`,
      skuGuess ? `SKU: ${skuGuess}` : null,
      amount ? `Amount: ${amount}` : null,
      `Buyer: ${buyerEmail}`,
      `WhatsApp: ${waNumber}`,
      '',
      'Links:',
      ...links,
      '',
      'Raw payload:',
      JSON.stringify(p, null, 2)
    ].filter(Boolean).join('
');

    MailApp.sendEmail(cfg.supportEmail, subjectAdmin, bodyAdmin);

    // Always respond OK
    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);

  } catch (err) {
    console.error(err);
    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * Run once after pasting code to set Script Properties quickly.
 */
function setupScriptProperties() {
  const props = PropertiesService.getScriptProperties();
  setIfEmpty_(props, 'SUPPORT_EMAIL', 'examtestgenius@gmail.com');
  setIfEmpty_(props, 'PAYFAST_PASSPHRASE', '');
  setIfEmpty_(props, 'DEFAULT_LINKS_JSON', JSON.stringify([
    'https://drive.google.com/your-link-1',
    'https://drive.google.com/your-link-2'
  ]));
  setIfEmpty_(props, 'SKU_LINKS_JSON', JSON.stringify({
    // "G12-Maths-2024-Full": ["https://drive.google.com/..."],
    // "G11-Physics-2023-Jun": ["https://drive.google.com/..."],
  }));
  return props.getProperties();
}

// -------- helpers --------

function getCfg_() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const supportEmail = props.SUPPORT_EMAIL || 'examtestgenius@gmail.com';
  const passphrase   = props.PAYFAST_PASSPHRASE || '';

  let defaultLinks = [];
  try { defaultLinks = JSON.parse(props.DEFAULT_LINKS_JSON || '[]'); } catch (e) { defaultLinks = []; }

  let skuLinks = {};
  try { skuLinks = JSON.parse(props.SKU_LINKS_JSON || '{}'); } catch (e) { skuLinks = {}; }

  return { supportEmail, passphrase, defaultLinks, skuLinks };
}

function resolveLinks_(cfg, sku) {
  if (!sku) return null;
  const v = cfg.skuLinks[sku];
  return (Array.isArray(v) && v.length) ? v : null;
}

function guessSku_(itemName) {
  const s = String(itemName || '');
  const m = s.match(/[A-Z0-9]{2,}-[A-Za-z0-9-]{2,}/);
  return m ? m[0] : '';
}

function setIfEmpty_(props, key, value) {
  const current = props.getProperty(key);
  if (!current) props.setProperty(key, value);
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
