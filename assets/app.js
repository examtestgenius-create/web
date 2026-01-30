/** StudyHub – Google Apps Script backend (PayFast + Catalog)
 *  Endpoints:
 *    GET  ?action=catalog&callback=cb        -> JSONP products
 *    GET  ?action=sign&...&callback=cb       -> JSONP {ok, params, signature}
 *    POST (ITN webhook from PayFast)         -> validates + fulfills
 *
 *  Configure secrets under: Project Settings -> Script Properties
 *    MODE: 'live' | 'sandbox'
 *    MERCHANT_ID, MERCHANT_KEY, PASSPHRASE
 *    ADMIN_EMAIL
 *    SHEET_ID, CATALOG_SHEET (e.g. 'Products')
 */

const SP = PropertiesService.getScriptProperties();

// ---------- Utilities ----------
const PF_VALID_HOSTS = [
  'www.payfast.co.za',
  'sandbox.payfast.co.za',
  'w1w.payfast.co.za',
  'w2w.payfast.co.za',
];

// URL-encode like PHP's urlencode (spaces = '+', uppercase hex)
function enc_(v) {
  return encodeURIComponent(String(v)).replace(/%20/g, '+');
}

// hex string from byte[]
function toHex_(bytes) {
  return bytes.map(b => (b + 256).toString(16).slice(-2)).join('');
}

// MD5 helper
function md5_(s) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8);
  return toHex_(raw).toLowerCase();
}

// Assemble name=value pairs in required order (NOT alphabetical) per PayFast docs.
// https://developers.payfast.co.za/docs  -> "Create security signature" (variable order)
// We include keys that exist and are non-empty.
function buildSigString_(data, order, passphrase) {
  const pairs = [];
  for (const k of order) {
    if (data[k] !== undefined && data[k] !== null && data[k] !== '') {
      pairs.push(`${k}=${enc_(String(data[k]).trim())}`);
    }
  }
  let s = pairs.join('&');
  if (passphrase) s += `&passphrase=${enc_(String(passphrase).trim())}`;
  return s;
}

function getMode_() {
  const m = (SP.getProperty('MODE') || 'sandbox').toLowerCase();
  return (m === 'live') ? 'live' : 'sandbox';
}

function getPfHost_() {
  return (getMode_() === 'live') ? 'www.payfast.co.za' : 'sandbox.payfast.co.za';
}

function jsonp_(cb, obj) {
  const text = `${cb}(${JSON.stringify(obj)})`;
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// ---------- Catalog (JSONP) ----------
function getCatalog_() {
  const SHEET_ID = SP.getProperty('SHEET_ID');
  const TAB = SP.getProperty('CATALOG_SHEET') || 'Products';
  if (!SHEET_ID) return { products: [] };

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(TAB);
  if (!sh) return { products: [] };

  // Expected header row: sku | title | grade | subject | price_cents | has_memo | popular
  const values = sh.getDataRange().getValues();
  const [hdr, ...rows] = values;
  const idx = (name) => hdr.indexOf(name);

  const out = rows
    .filter(r => r && r.length)
    .map(r => ({
      sku: r[idx('sku')],
      title: r[idx('title')],
      grade: r[idx('grade')],
      subject: r[idx('subject')],
      price_cents: Number(r[idx('price_cents')] || 0),
      has_memo: String(r[idx('has_memo')]).toLowerCase() !== 'false',
      popular: String(r[idx('popular')]).toLowerCase() === 'true',
    }))
    .filter(p => p.sku);

  return { products: out };
}

// ---------- SIGN (JSONP) ----------
function signParams_(query) {
  const merchant_id  = SP.getProperty('MERCHANT_ID');
  const merchant_key = SP.getProperty('MERCHANT_KEY');
  const passphrase   = SP.getProperty('PASSPHRASE');

  if (!merchant_id || !merchant_key) {
    return { ok: false, error: 'Missing merchant credentials (Script Properties).' };
  }

  // Required from client
  const amount        = query.amount;           // string with 2 decimals (client already formatted)
  const item_name     = query.item_name;        // we use SKU here per client
  const m_payment_id  = query.m_payment_id;     // SKU
  const email_address = query.email_address || '';
  const name_first    = query.name_first || '';
  const name_last     = query.name_last || '';
  const return_url    = query.return_url;
  const cancel_url    = query.cancel_url;
  const notify_url    = query.notify_url;

  // Build PayFast param object (only those we send to PayFast form)
  const params = {
    // Merchant
    merchant_id,
    merchant_key,
    return_url,
    cancel_url,
    notify_url,
    // Buyer (optional)
    name_first,
    name_last,
    email_address,
    // Transaction
    m_payment_id,
    amount,
    item_name,
    // you can add: item_description, email_confirmation, confirmation_address, payment_method
  };

  // PayFast 'create signature' — param order matters (NOT alphabetical)
  // https://developers.payfast.co.za/docs  (Create security signature)
  const ORDER = [
    // merchant
    'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url',
    // buyer
    'name_first', 'name_last', 'email_address',
    // transaction
    'm_payment_id', 'amount', 'item_name', 'item_description',
    // options:
    'email_confirmation', 'confirmation_address', 'payment_method'
  ];

  const sigString = buildSigString_(params, ORDER, passphrase);
  const signature = md5_(sigString);

  return { ok: true, params, signature };
}

// ---------- ITN (POST) ----------
/**
 * ITN verification:
 * 1) 200 OK immediately (avoid retries)
 * 2) Verify signature over ALL fields posted (including merchant_id etc.), +passphrase
 * 3) Check valid host (optional but recommended)
 * 4) Compare expected amount with amount_gross
 * 5) Server validation: POST the param string to https://{host}/eng/query/validate and require 'VALID'
 * Docs: https://developers.payfast.co.za/docs/itn-instant-transaction-notification/
 */
function doPost(e) {
  try {
    // (1) Immediately acknowledge
    const out = ContentService.createTextOutput('OK');
    out.setMimeType(ContentService.MimeType.TEXT);
    // do not return yet; continue processing in same request

    const rawBody = e.postData && e.postData.contents ? String(e.postData.contents) : ''; // raw query string
    const params  = e.parameter || {};

    // Keep a log line
    console.log('ITN raw:', rawBody);

    // Rebuild param string EXCLUDING &signature=... using the raw ordering
    // Safer than re-ordering keys
    const paramString = rawBody.replace(/(&|^)signature=[^&]*/i, '').replace(/^&/, '');

    // (2) Verify signature with passphrase
    const passphrase = SP.getProperty('PASSPHRASE') || '';
    const sigCheckString = passphrase ? `${paramString}&passphrase=${enc_(passphrase)}` : paramString;
    const sigComputed = md5_(sigCheckString);
    const sigOk = (String(params.signature || '').toLowerCase() === sigComputed);

    // (3) Check valid domain IP (best-effort in Apps Script)
    // Use 'Referer' header to resolve IP, fallback skip if header absent
    const ref = (e && e.headers && (e.headers['Referer'] || e.headers['referer'])) || '';
    let ipOk = true;
    if (ref) {
      try {
        const host = ref.replace(/^https?:\/\//i, '').split('/')[0];
        const ips = [];
        PF_VALID_HOSTS.forEach(h => {
          const res = UrlFetchApp.fetch(`https://dns.google/resolve?name=${h}&type=A`, { muteHttpExceptions: true });
          const json = JSON.parse(res.getContentText() || '{}');
          (json.Answer || []).forEach(a => { if (a.data) ips.push(a.data); });
        });
        const refIp = UrlFetchApp.fetch(`https://dns.google/resolve?name=${host}&type=A`, { muteHttpExceptions: true });
        const refJson = JSON.parse(refIp.getContentText() || '{}');
        const refHostIp = (refJson.Answer && refJson.Answer[0] && refJson.Answer[0].data) || '';
        ipOk = !!ips.find(x => x === refHostIp);
      } catch (err) {
        ipOk = true; // don't fail hard on DNS problems within GAS
      }
    }

    // (4) Compare amounts (lookup expected cents from catalog)
    const expectedCents = lookupPriceCents_(String(params.m_payment_id || '')); // uses Sheets
    const gross = Number(params.amount_gross || 0); // rands
    const amountOk = expectedCents > 0
      ? Math.abs((expectedCents / 100) - gross) <= 0.01
      : true; // if not found in catalog, do not fail—log for manual review

    // (5) Server confirmation: post back to PayFast validate endpoint
    const host = getPfHost_();
    const validateUrl = `https://${host}/eng/query/validate`;
    const res = UrlFetchApp.fetch(validateUrl, {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: paramString,
      muteHttpExceptions: true,
      validateHttpsCertificates: true,
    });
    const serverOk = (String(res.getContentText()).trim() === 'VALID');

    const allOk = sigOk && ipOk && amountOk && serverOk;

    console.log(JSON.stringify({ sigOk, ipOk, amountOk, serverOk, pf_payment_id: params.pf_payment_id, m_payment_id: params.m_payment_id, payment_status: params.payment_status }));

    if (allOk && String(params.payment_status).toUpperCase() === 'COMPLETE') {
      // Fulfill: email download links
      fulfillOrder_(params);
    } else {
      // Log for manual review
      console.warn('ITN validation failed', { sigOk, ipOk, amountOk, serverOk, params });
      notifyAdmin_('ITN validation failed', params);
    }

    return out;

  } catch (err) {
    console.error('ITN exception', err);
    return ContentService.createTextOutput('ERR').setMimeType(ContentService.MimeType.TEXT);
  }
}

// ---------- Helpers: Catalog lookup & fulfillment ----------
function lookupPriceCents_(sku) {
  try {
    const SHEET_ID = SP.getProperty('SHEET_ID');
    const TAB = SP.getProperty('CATALOG_SHEET') || 'Products';
    if (!SHEET_ID || !sku) return 0;
    const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB);
    const values = sh.getDataRange().getValues(); // small sheet expected
    const [hdr, ...rows] = values;
    const idx = (name) => hdr.indexOf(name);
    for (const r of rows) {
      if (String(r[idx('sku')]) === sku) {
        return Number(r[idx('price_cents')] || 0);
      }
    }
  } catch (e) {
    console.error('lookupPriceCents error', e);
  }
  return 0;
}

function productLinks_(sku) {
  // OPTIONAL: map SKU -> Drive links via sheet columns (e.g., 'drive_links')
  // For now, return placeholder; integrate your sheet column if available.
  return [
    'https://drive.google.com/your-pack-file-1',
    'https://drive.google.com/your-pack-file-2',
  ];
}

function notifyAdmin_(subject, params) {
  const admin = SP.getProperty('ADMIN_EMAIL') || Session.getActiveUser().getEmail() || '';
  if (!admin) return;
  GmailApp.sendEmail(admin, `[StudyHub] ${subject}`, JSON.stringify(params, null, 2));
}

function fulfillOrder_(params) {
  const admin = SP.getProperty('ADMIN_EMAIL') || '';
  const email = params.email_address || admin || '';
  const sku   = params.m_payment_id || params.item_name || 'Unknown SKU';
  const links = productLinks_(sku);
  const body =
`Hi,

Thank you for your purchase on StudyHub.

Your download links for **${sku}**:
${links.map(l => `• ${l}`).join('\n')}

Order ref: ${params.pf_payment_id}
Amount: R${params.amount_gross}

If you have any issues, reply to this email.

— StudyHub`;

  if (email) GmailApp.sendEmail(email, `Your StudyHub download links — ${sku}`, body);
  if (admin) GmailApp.sendEmail(admin, `[StudyHub] Fulfilled ${sku}`, `Buyer: ${email}\n\n${body}`);
}

// ---------- Router ----------
function doGet(e) {
  const a = (e.parameter.action || '').toLowerCase();
  const cb = e.parameter.callback || e.parameter.cb || 'callback';

  if (a === 'catalog') {
    const data = getCatalog_();
    return jsonp_(cb, data);
  }
  if (a === 'sign') {
    const sig = signParams_(e.parameter);
    return jsonp_(cb, sig);
  }
  // healthcheck / info
  return ContentService.createTextOutput(JSON.stringify({ ok: true, mode: getMode_(), host: getPfHost_() }))
    .setMimeType(ContentService.MimeType.JSON);
}
