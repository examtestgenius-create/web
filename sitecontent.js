/** StudyHub — sitecontent.gs */
const SITE_CONTENT_DEFAULTS_ = {
  LegalEntityName: 'StudyHub',
  PhysicalAddress: '',
  SupportEmail: '',
  SupportPhone: '',
  RegistrationNumber: '',
  VATNumber: '',
  InformationOfficer: '',
  TermsLastUpdated: '',
  PrivacyLastUpdated: '',
  RefundsLastUpdated: ''
};

function ensureSiteContentSheet_() {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName('SiteContent');
  if (!sh) sh = ss.insertSheet('SiteContent');
  const headers = ['key', 'value'];
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  else sh.getRange(1,1,1,headers.length).setValues([headers]);
  return sh;
}

function seedSiteContentDefaults_() {
  const sh = ensureSiteContentSheet_();
  const rows = sh.getDataRange().getValues();
  const existing = {};
  for (let i = 1; i < rows.length; i++) existing[String(rows[i][0] || '').trim()] = true;
  const add = [];
  Object.keys(SITE_CONTENT_DEFAULTS_).forEach(function(key){
    if (!existing[key]) add.push([key, SITE_CONTENT_DEFAULTS_[key]]);
  });
  if (add.length) sh.getRange(sh.getLastRow()+1, 1, add.length, 2).setValues(add);
}

function getSiteContent_() {
  const sh = ensureSiteContentSheet_();
  seedSiteContentDefaults_();
  const rows = sh.getDataRange().getValues();
  const out = {};
  for (let i = 1; i < rows.length; i++) {
    const key = String(rows[i][0] || '').trim();
    if (!key) continue;
    out[key] = rows[i][1] == null ? '' : String(rows[i][1]);
  }
  return { ok: true, items: out, ts: nowIso_() };
}
