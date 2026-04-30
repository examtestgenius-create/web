/** StudyHub — contact.gs */
function ensureContactsSheet_() {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName('Contacts');
  const headers = ['timestamp', 'name', 'email', 'message', 'source', 'status'];
  if (!sh) sh = ss.insertSheet('Contacts');
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  else sh.getRange(1,1,1,headers.length).setValues([headers]);
  return sh;
}

function handleContact_(payload) {
  payload = payload || {};
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim();
  const message = String(payload.message || '').trim();
  if (!name) return { ok:false, error:'Name is required' };
  if (!email) return { ok:false, error:'Email is required' };
  if (!message) return { ok:false, error:'Message is required' };
  const sh = ensureContactsSheet_();
  sh.appendRow([new Date(), name, email, message, 'website', 'NEW']);
  const adminEmail = String(CONFIG.NOTIFY_EMAIL || '').trim();
  if (adminEmail) {
    try { MailApp.sendEmail(adminEmail, 'StudyHub Contact Form - ' + name, 'Name: ' + name + '\nEmail: ' + email + '\n\n' + message); }
    catch (err) { logRunIfAvailable_('CONTACT_EMAIL_ERROR', email, '', String(err)); }
  }
  logRunIfAvailable_('CONTACT', email, '', 'Contact form submission stored');
  return { ok:true, message:'Message stored successfully' };
}
