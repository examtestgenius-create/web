/**
- StudyHub — payfast.gs
- PayFast checkout + ITN verification + Orders + Delivery.
*/
const PAYFAST_CHECKOUT_FIELD_ORDER = [
  'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url',
  'name_first', 'name_last', 'email_address', 'cell_number',
  'm_payment_id', 'amount', 'item_name', 'item_description',
  'custom_int1', 'custom_int2', 'custom_int3', 'custom_int4', 'custom_int5',
  'custom_str1', 'custom_str2', 'custom_str3', 'custom_str4', 'custom_str5',
  'email_confirmation', 'confirmation_address',
  'payment_method'
];

function createCheckout_(payload) {
  const sku = payload.sku || '';
  const email = payload.email || payload.customer_email || '';
  const item = getPublishedCatalog_().items.find(function (x) { return x.sku === sku; });

  if (!item) return { ok: false, error: 'SKU not found' };
  if (!email) return { ok: false, error: 'Customer email is required' };
  if (!CONFIG.SITE_BASE_URL) return { ok: false, error: 'SITE_BASE_URL Script Property is missing' };
  if (!CONFIG.PAYFAST_MERCHANT_ID || !CONFIG.PAYFAST_MERCHANT_KEY) {
    return { ok: false, error: 'PayFast merchant settings are missing' };
  }

  const orderId = 'SH-' + new Date().getTime();
  const amount = (Number(item.price_cents || 0) / 100).toFixed(2);
  const notifyUrl = ScriptApp.getService().getUrl();

  const pf = {
    merchant_id: CONFIG.PAYFAST_MERCHANT_ID,
    merchant_key: CONFIG.PAYFAST_MERCHANT_KEY,
    return_url: CONFIG.SITE_BASE_URL + '/payment-success.html',
    cancel_url: CONFIG.SITE_BASE_URL + '/payment-cancelled.html',
    notify_url: notifyUrl,
    m_payment_id: orderId,
    amount: amount,
    item_name: item.title || sku,
    item_description: item.description || ('StudyHub purchase ' + sku),
    email_address: email,
    email_confirmation: '1',
    confirmation_address: CONFIG.NOTIFY_EMAIL || email
  };

  if (CONFIG.PAYFAST_PASSPHRASE) {
    pf.signature = generatePayFastCheckoutSignature_(pf, CONFIG.PAYFAST_PASSPHRASE);
  }

  upsertOrder_(orderId, sku, email, item.price_cents, 'PENDING', JSON.stringify(payload));
  logRun_('CHECKOUT_CREATE', sku, orderId, 'Created pending order for ' + email);

  return {
    ok: true,
    order_id: orderId,
    payfast_url: CONFIG.PAYFAST_PROCESS_URL,
    payfast_payload: pf
  };
}

function handlePayFastITN_(itn) {
  const orderId = itn.m_payment_id || itn.order_id || '';
  if (!orderId) return { ok: false, error: 'Missing order ID' };

  const paymentStatus = String(itn.payment_status || '').toUpperCase().trim();
  const order = getOrderRow_(orderId);
  if (!order) {
    logRun_('PAYFAST_ITN', orderId, paymentStatus, 'Order not found; ITN ignored');
    return { ok: false, error: 'Order not found' };
  }

  const sigOk = payfastItnValidSignature_(itn, CONFIG.PAYFAST_PASSPHRASE);
  const amountOk = payfastItnAmountMatches_(itn, order.amount_cents);
  const serverOk = payfastItnServerConfirm_(itn);
  const verified = sigOk && amountOk && serverOk;

  updateOrderStatus_(orderId, verified ? paymentStatus : 'ITN_FAILED', JSON.stringify(itn));

  if (verified && paymentStatus === 'COMPLETE') {
    const deliveryUrl = resolveDeliveryUrlForSku_(order.sku);
    setOrderDeliveryUrl_(orderId, deliveryUrl);
  }

  logRun_('PAYFAST_ITN', orderId, JSON.stringify({
    paymentStatus: paymentStatus,
    verified: verified,
    sigOk: sigOk,
    amountOk: amountOk,
    serverOk: serverOk
  }), 'ITN processed');

  return { ok: true, verified: verified };
}

function generatePayFastCheckoutSignature_(data, passphrase) {
  const cleaned = {};
  Object.keys(data).forEach(function (k) {
    const v = data[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') cleaned[k] = String(v).trim();
  });

  const keys = PAYFAST_CHECKOUT_FIELD_ORDER
    .filter(function (k) { return Object.prototype.hasOwnProperty.call(cleaned, k); })
    .concat(Object.keys(cleaned).filter(function (k) {
      return PAYFAST_CHECKOUT_FIELD_ORDER.indexOf(k) < 0 && k !== 'signature';
    }));

  const pairs = [];
  keys.forEach(function (k) { pairs.push(k + '=' + payfastUrlEncode_(cleaned[k])); });
  if (passphrase) pairs.push('passphrase=' + payfastUrlEncode_(String(passphrase).trim()));
  return md5hex_(pairs.join('&'));
}

function payfastItnValidSignature_(itn, passphrase) {
  const keys = Object.keys(itn).filter(function (k) { return k !== 'signature'; }).sort();
  const pairs = keys.map(function (k) {
    return k + '=' + payfastUrlEncode_(String(itn[k] !== undefined ? itn[k] : ''));
  });
  if (passphrase) pairs.push('passphrase=' + payfastUrlEncode_(String(passphrase).trim()));
  const expected = md5hex_(pairs.join('&'));
  return String(itn.signature || '').toLowerCase() === expected.toLowerCase();
}

function payfastItnAmountMatches_(itn, amountCents) {
  const expected = Number(amountCents || 0) / 100;
  const gross = Number(itn.amount_gross || itn.amount || 0);
  return Math.abs(expected - gross) <= 0.01;
}

function payfastItnServerConfirm_(itn) {
  const isSandbox = String(CONFIG.PAYFAST_PROCESS_URL || '').indexOf('sandbox') >= 0;
  const pfHost = isSandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';
  const url = 'https://' + pfHost + '/eng/query/validate';

  const keys = Object.keys(itn).filter(function (k) { return k !== 'signature'; }).sort();
  const pairs = keys.map(function (k) {
    return k + '=' + encodeURIComponent(String(itn[k] !== undefined ? itn[k] : '')).replace(/%20/g, '+');
  });
  if (CONFIG.PAYFAST_PASSPHRASE) {
    pairs.push('passphrase=' + encodeURIComponent(CONFIG.PAYFAST_PASSPHRASE).replace(/%20/g, '+'));
  }

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: pairs.join('&'),
    muteHttpExceptions: true,
    followRedirects: true
  });

  return String(res.getContentText() || '').trim() === 'VALID';
}

function payfastUrlEncode_(value) {
  return encodeURIComponent(String(value))
    .replace(/%20/g, '+')
    .replace(/%[0-9a-f]{2}/gi, function (m) { return m.toUpperCase(); });
}

function md5hex_(s) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8);
  return digest.map(function (b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function upsertOrder_(orderId, sku, email, amountCents, status, rawPayload) {
  const sh = requireSheet_('Orders');
  sh.appendRow([new Date(), orderId, sku, email, amountCents, status, '', '', '', rawPayload || '']);
}

function updateOrderStatus_(orderId, status, rawPayload) {
  const sh = requireSheet_('Orders');
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === orderId) {
      sh.getRange(i + 1, 6).setValue(status);
      sh.getRange(i + 1, 7).setValue(new Date());
      if (rawPayload) sh.getRange(i + 1, 10).setValue(rawPayload);
      return true;
    }
  }
  return false;
}

function getOrderStatus_(orderId) {
  if (!orderId) return { ok: false, error: 'Missing order ID' };
  const rows = requireSheet_('Orders').getDataRange().getValues();
  const headers = rows[0] || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === orderId) {
      return Object.fromEntries(headers.map(function (h, idx) { return [h, rows[i][idx]]; }));
    }
  }
  return { ok: false, error: 'Order not found' };
}

function getOrderRow_(orderId) {
  const sh = requireSheet_('Orders');
  const rows = sh.getDataRange().getValues();
  const headers = rows[0] || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === orderId) {
      const obj = Object.fromEntries(headers.map(function (h, idx) { return [h, rows[i][idx]]; }));
      return { order_id: obj.order_id, sku: obj.sku, customer_email: obj.customer_email, amount_cents: obj.amount_cents };
    }
  }
  return null;
}

function setOrderDeliveryUrl_(orderId, deliveryUrl) {
  const sh = requireSheet_('Orders');
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === orderId) {
      sh.getRange(i + 1, 9).setValue(deliveryUrl || '');
      return true;
    }
  }
  return false;
}

function setOrderInvoiceUrl_(orderId, invoiceUrl) {
  const sh = requireSheet_('Orders');
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === orderId) {
      sh.getRange(i + 1, 8).setValue(invoiceUrl || '');
      return true;
    }
  }
  return false;
}

/**
 * PATCHED: prefer an existing bundle ZIP URL first,
 * then try to build the ZIP on demand,
 * then fallback to catalog deliveryUrl/driveUrl.
 */
function resolveDeliveryUrlForSku_(sku) {
  const cat = getPublishedCatalog_();
  const item = cat.items.find(function (x) { return x.sku === sku; });

  try {
    const zipMap = getBundleZipUrlMap_();
    if (zipMap[sku]) return zipMap[sku];
  } catch (err) {
    logRun_('ZIP_URL_MAP_ERROR', sku, '', String(err));
  }

  try {
    const zipUrl = createOrRefreshBundleZipForSku_(sku, false);
    if (zipUrl) return zipUrl;
  } catch (err) {
    logRun_('ZIP_ON_DEMAND_ERROR', sku, '', String(err));
  }

  return item ? (item.deliveryUrl || item.driveUrl || '') : '';
}

function issueInvoice_(orderId) {
  const roots = ensureDriveRoots_();
  const order = getOrderStatus_(orderId);
  if (!order || order.ok === false) return '';

  const sku = order.sku || '';
  const email = order.customer_email || '';
  const amountCents = Number(order.amount_cents || 0);
  const amount = (amountCents / 100).toFixed(2);

  const content =
    'StudyHub Invoice
' +
    'Invoice for Order: ' + orderId + '
' +
    'SKU: ' + sku + '
' +
    'Customer: ' + email + '
' +
    'Amount (ZAR): ' + amount + '
' +
    'Date: ' + (new Date()).toISOString() + '
';

  const folder = ensureSubFolder_(roots.invoicesRoot, 'Orders');
  const fileName = orderId + '_invoice.txt';
  const blob = Utilities.newBlob(content, MimeType.PLAIN_TEXT, fileName);
  const file = upsertFileInFolder_(folder, fileName, blob);
  return file.getUrl();
}

function sendDelivery_(orderId) {
  const order = getOrderStatus_(orderId);
  if (!order || order.ok === false) return;

  const toCustomer = String(order.customer_email || '').trim();
  const admin = String(CONFIG.NOTIFY_EMAIL || '').trim();
  const subject = 'StudyHub Delivery - Order ' + orderId;
  const body = [
    'Thank you for your purchase.',
    '',
    'Order ID: ' + orderId,
    'SKU: ' + (order.sku || ''),
    'Delivery link: ' + (order.delivery_url || ''),
    'Invoice: ' + (order.invoice_url || ''),
    '',
    'If you have any issues, reply to this email.'
  ].join('
');

  if (toCustomer) MailApp.sendEmail(toCustomer, subject, body);
  if (admin) MailApp.sendEmail(admin, '[ADMIN COPY] ' + subject, body);
  logRun_('DELIVERY_EMAIL', orderId, '', 'Sent delivery email(s)');
}
