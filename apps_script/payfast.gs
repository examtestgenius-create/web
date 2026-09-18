/** StudyHub PayFast, Orders and secure delivery REV3 */
const OH=['order_id','sku','title','customer_email','customer_name','customer_phone','amount_cents','pf_payment_id','pf_status','invoice_url','zip_url','timestamp','delivery_status','delivery_sent_at','admin_notes','raw_itn','last_error','itn_signature_valid','itn_amount_valid','itn_server_valid','completed_at'];

function createCheckout(p){
  return lock('checkout',function(){
    const catalog=db().getSheetByName(APP.C);
    const item=catalog?objects(catalog).find(function(x){return String(x.sku)===String(p.sku);}):null;
    if(!item||String(item.published).toUpperCase()!=='TRUE'||String(item.zip_status).toUpperCase()!=='READY'||!item.zip_url)throw Error('Product not available');
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(p.customer_email||'')))throw Error('Valid email required');
    if(!String(p.customer_name||'').trim())throw Error('Customer name required');
    const pr=props(),id='SH-'+Utilities.getUuid().slice(0,12).toUpperCase();
    const base=pr.getProperty('SITE_BASE_URL')||'https://examtestpaper.co.za';
    const data={
      merchant_id:pr.getProperty('PAYFAST_MERCHANT_ID'),merchant_key:pr.getProperty('PAYFAST_MERCHANT_KEY'),
      return_url:(pr.getProperty('PAYFAST_RETURN_URL')||base+'/success.html')+'?order='+encodeURIComponent(id),
      cancel_url:pr.getProperty('PAYFAST_CANCEL_URL')||base+'/payment-cancelled.html',
      notify_url:pr.getProperty('PAYFAST_NOTIFY_URL'),email_address:String(p.customer_email),
      name_first:String(p.customer_name).slice(0,100),m_payment_id:id,
      amount:(Number(item.price_cents)/100).toFixed(2),item_name:String(item.title).slice(0,100)
    };
    ['merchant_id','merchant_key','notify_url'].forEach(function(k){if(!data[k])throw Error('Missing PayFast setting: '+k);});
    data.signature=sign(data,pr.getProperty('PAYFAST_PASSPHRASE'));
    const orders=shEnsureOrdersSheet_();
    shAppendOrder_(orders,{order_id:id,sku:item.sku,title:item.title,customer_email:p.customer_email,customer_name:p.customer_name,customer_phone:p.customer_phone||'',amount_cents:item.price_cents,pf_status:'PENDING',zip_url:item.zip_url,timestamp:new Date(),delivery_status:'PENDING'});
    const host=(pr.getProperty('PAYFAST_MODE')||'SANDBOX')==='LIVE'?'https://www.payfast.co.za/eng/process':'https://sandbox.payfast.co.za/eng/process';
    return{ok:true,data:{order_id:id,url:host+'?'+param(data)}};
  });
}

function handleItn(d){
  const sheet=shEnsureOrdersSheet_();
  const order=objects(sheet).find(function(x){return String(x.order_id)===String(d.m_payment_id);});
  if(!order)return'OK';
  if(String(order.pf_status).toUpperCase()==='COMPLETE')return'OK';
  const signatureValid=String(d.signature||'').toLowerCase()===sign(Object.fromEntries(Object.entries(d).filter(function(e){return e[0]!=='signature';})),props().getProperty('PAYFAST_PASSPHRASE'));
  const amountValid=Math.abs(Number(d.amount_gross)-Number(order.amount_cents)/100)<0.01;
  const paymentComplete=String(d.payment_status).toUpperCase()==='COMPLETE';
  if(!paymentComplete||!signatureValid||!amountValid){
    update(sheet,order._row,{pf_status:'ITN_FAILED',raw_itn:JSON.stringify(d),last_error:'ITN validation failed',itn_signature_valid:String(signatureValid).toUpperCase(),itn_amount_valid:String(amountValid).toUpperCase()});
    return'OK';
  }
  const invoiceUrl=shCreateInvoicePdf_(order,d);
  update(sheet,order._row,{pf_status:'COMPLETE',pf_payment_id:d.pf_payment_id||'',invoice_url:invoiceUrl,delivery_status:'DELIVERY_SENT',delivery_sent_at:new Date(),raw_itn:JSON.stringify(d),last_error:'',itn_signature_valid:'TRUE',itn_amount_valid:'TRUE',completed_at:new Date()});
  shSendDeliveryEmail_(Object.assign({},order,{pf_status:'COMPLETE',invoice_url:invoiceUrl}));
  return'OK';
}

function orderStatus(id){
  const order=objects(shEnsureOrdersSheet_()).find(function(x){return String(x.order_id)===String(id);});
  if(!order)return{ok:false,error:'Not found'};
  const paid=['COMPLETE','MANUAL_PAID'].indexOf(String(order.pf_status).toUpperCase())>=0;
  const granted=paid||['DELIVERY_SENT','GRANTED_MANUALLY'].indexOf(String(order.delivery_status).toUpperCase())>=0;
  return{ok:true,data:{order_id:id,pf_status:order.pf_status,status:order.pf_status,delivery_status:order.delivery_status,zip_url:granted?order.zip_url:'',invoice_url:granted?order.invoice_url:''}};
}

function shEnsureOrdersSheet_(){
  let sheet=db().getSheetByName(APP.O);if(!sheet)sheet=db().insertSheet(APP.O);
  if(!sheet.getLastRow()){sheet.getRange(1,1,1,OH.length).setValues([OH]);return sheet;}
  let headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const missing=OH.filter(function(h){return headers.indexOf(h)<0;});
  if(missing.length)sheet.getRange(1,headers.length+1,1,missing.length).setValues([missing]);
  return sheet;
}
function shAppendOrder_(sheet,data){const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);sheet.appendRow(headers.map(function(h){return data[h]!==undefined?data[h]:'';}));}
function shSendDeliveryEmail_(order){
  if(!order.customer_email)throw Error('Customer email missing');
  MailApp.sendEmail({to:order.customer_email,subject:'StudyHub order ready: '+order.order_id,htmlBody:'<h2>Your StudyHub bundle is ready</h2><p>Order: <b>'+order.order_id+'</b></p><p>'+order.title+'</p><p><a href="'+order.zip_url+'" style="display:inline-block;background:#2f76ff;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Download ZIP</a></p>'+(order.invoice_url?'<p><a href="'+order.invoice_url+'">Open invoice</a></p>':'')+'<p>Support: examtestgenius@gmail.com</p>'});
}
function shCreateInvoicePdf_(order,d){
  try{const folderId=props().getProperty('INVOICES_ROOT_ID');if(!folderId)return'';const doc=DocumentApp.create('Invoice '+order.order_id);const body=doc.getBody();body.appendParagraph('StudyHub Invoice').setHeading(DocumentApp.ParagraphHeading.HEADING1);body.appendParagraph('Order: '+order.order_id);body.appendParagraph('Customer: '+String(order.customer_name||''));body.appendParagraph('Email: '+String(order.customer_email||''));body.appendParagraph('Bundle: '+String(order.title||order.sku));body.appendParagraph('Amount: R '+(Number(order.amount_cents||0)/100).toFixed(2));body.appendParagraph('PayFast payment ID: '+String(d.pf_payment_id||''));body.appendParagraph('Paid: '+new Date());doc.saveAndClose();const file=DriveApp.getFileById(doc.getId());const pdf=DriveApp.getFolderById(folderId).createFile(file.getBlob().getAs(MimeType.PDF).setName('Invoice_'+order.order_id+'.pdf'));file.setTrashed(true);return pdf.getUrl();}catch(e){log('INVOICE',order.order_id,'ERROR',String(e));return'';}
}
function sign(d,pass){return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5,param(d)+(pass?'&passphrase='+enc(pass):''),Utilities.Charset.UTF_8).map(function(b){return('0'+(b<0?b+256:b).toString(16)).slice(-2);}).join('');}
function param(d){return Object.keys(d).filter(function(k){return d[k]!==''&&d[k]!=null;}).map(function(k){return k+'='+enc(d[k]);}).join('&');}
function enc(v){return encodeURIComponent(String(v)).replace(/%20/g,'+');}
