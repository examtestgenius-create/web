// StudyHub / ExamTestGenius - Web App (catalog + ITN)
function doGet(e){
  const p = e && e.parameter || {}; const mode = String(p.mode||'').toLowerCase();
  if(mode==='catalog') return json_(buildCatalog_());
  if(mode==='ping')    return json_({ok:true});
  return json_({error:'not_found', hint:'use ?mode=catalog or ?mode=ping'});
}
function doPost(e){
  const itn = e && e.parameter || {}; // PayFast ITN
  // TODO: validate signature + amount + idempotency
  logOrder_(itn);
  sendEmails_(itn);
  return ContentService.createTextOutput('OK');
}
function buildCatalog_(){
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('SHEET_ID');
  const filesSheet = props.getProperty('FILES_SHEET_NAME')||'Files';
  if(!sheetId) return {bundles:[], error:'SHEET_ID missing'};
  const sh = SpreadsheetApp.openById(sheetId).getSheetByName(filesSheet);
  if(!sh) return {bundles:[], error:'Files sheet missing'};
  const v = sh.getDataRange().getValues(); if(v.length<2) return {bundles:[]};
  const h=v[0].map(String); const I=n=>h.indexOf(n);
  const iStatus=I('Status'), iGrade=I('Grade'), iSubject=I('Subject'), iYear=I('Year'), iTerm=I('Term'), iLink=I('Link'), iPaper=I('PaperName'), iSku=I('BundleSKU');
  const bundles={};
  for(let r=1;r<v.length;r++){
    const row=v[r]; const status=String(row[iStatus]||''); if(status && status!=='UPLOADED') continue;
    const grade=String(row[iGrade]||''), subject=String(row[iSubject]||''), year=String(row[iYear]||''), term=String(row[iTerm]||'');
    let sku = iSku>=0 ? String(row[iSku]||'').trim() : '';
    if(!sku) sku = `${grade}-${subject}-${year}-T${term}`.toUpperCase().replace(/\s+/g,'-');
    const link = String(row[iLink]||'').trim(); if(!link) continue; const paper = iPaper>=0?String(row[iPaper]||''):'';
    if(!bundles[sku]) bundles[sku] = { sku, title:`Grade ${grade} • ${subject} • ${year} • Term ${term}`, grade, subject, year, term, items:[] };
    bundles[sku].items.push({paperName:paper, link});
  }
  return {bundles:Object.values(bundles)};
}
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
function logOrder_(itn){
  try{ const props=PropertiesService.getScriptProperties(); const ss=SpreadsheetApp.openById(props.getProperty('SHEET_ID')); const sh=ss.getSheetByName(props.getProperty('ORDERS_SHEET_NAME')||'Orders')||ss.insertSheet('Orders');
    if(sh.getLastRow()===0) sh.appendRow(['timestamp','payment_status','item_name','m_payment_id','amount_gross','email_address','pf_payment_id','raw']);
    sh.appendRow([new Date(), itn.payment_status||'', itn.item_name||'', itn.m_payment_id||'', itn.amount_gross||itn.amount||'', itn.email_address||'', itn.pf_payment_id||'', JSON.stringify(itn)]);
  }catch(err){console.error(err)}
}
function sendEmails_(itn){
  const props=PropertiesService.getScriptProperties(); const support=props.getProperty('SUPPORT_EMAIL')||'examtestgenius@gmail.com';
  const to=itn.email_address||support; const sku=itn.m_payment_id||''; const links=findLinksForSku_(sku);
  const body = ['Thank you for your payment!', '', `Item: ${itn.item_name||sku}`, '', 'Links:', ...(links.length?links:['(No links found)'])].join('
');
  try{MailApp.sendEmail(to, 'Your StudyHub downloads', body);}catch(e){console.error(e)}
  try{MailApp.sendEmail(support, 'New order (sandbox)', body + '

Raw ITN:
'+JSON.stringify(itn,null,2));}catch(e){console.error(e)}
}
function findLinksForSku_(sku){
  if(!sku) return []; const props=PropertiesService.getScriptProperties(); const ss=SpreadsheetApp.openById(props.getProperty('SHEET_ID')); const sh=ss.getSheetByName(props.getProperty('FILES_SHEET_NAME')||'Files'); if(!sh) return [];
  const v=sh.getDataRange().getValues(); if(v.length<2) return []; const h=v[0].map(String); const I=n=>h.indexOf(n);
  const iStatus=I('Status'), iSku=I('BundleSKU'), iG=I('Grade'), iS=I('Subject'), iY=I('Year'), iT=I('Term'), iL=I('Link');
  const out=[]; for(let r=1;r<v.length;r++){ const row=v[r]; const status=iStatus>=0?String(row[iStatus]||''):''; if(status && status!=='UPLOADED') continue; let rowSku=iSku>=0?String(row[iSku]||'').trim():''; if(!rowSku){ rowSku=`${row[iG]}-${row[iS]}-${row[iY]}-T${row[iT]}`.toUpperCase().replace(/\s+/g,'-'); }
    if(rowSku===sku){ const link=iL>=0?String(row[iL]||'').trim():''; if(link) out.push(link); }
  }
  return out;
}
