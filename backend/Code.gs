
/** StudyHub PayFast Backend (Google Apps Script)
 * Uses Sheet tabs: Catalog, Orders
 * Script Properties required:
 * PF_ENV (live|sandbox), PF_MERCHANT_ID, PF_MERCHANT_KEY, PF_PASSPHRASE,
 * SUPPORT_EMAIL, FROM_NAME, WEBSITE_URL, WEBAPP_URL
 */
var SHEETS={CATALOG:'Catalog',ORDERS:'Orders'};
var CATALOG_HEADERS=['sku','title','grade','subject','price_cents','hasMemo','drive_links','active'];
var ORDERS_HEADERS=['order_id','timestamp','email','name','phone','sku','amount_cents','status','pf_payment_id','pf_payment_status','pf_signature','ipn_valid','email_sent','download_links'];

function prop_(k,d){var v=PropertiesService.getScriptProperties().getProperty(k);return (v===null||v==='')?d:v;}
function nowISO_(){return Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"yyyy-MM-dd'T'HH:mm:ssXXX");}
function ss_(){var ss=SpreadsheetApp.getActiveSpreadsheet(); if(!ss) throw new Error('Open the bound Google Sheet.'); return ss;}
function sheet_(name, headers){var ss=ss_(); var sh=ss.getSheetByName(name); if(!sh) sh=ss.insertSheet(name); if(sh.getLastRow()===0){sh.getRange(1,1,1,headers.length).setValues([headers]); sh.setFrozenRows(1);} return sh;}
function ensureSchema_(){sheet_(SHEETS.CATALOG,CATALOG_HEADERS); sheet_(SHEETS.ORDERS,ORDERS_HEADERS);} 
function readTable_(name, headers){var sh=sheet_(name,headers); var a=sh.getDataRange().getValues(); if(a.length<2) return []; var head=a[0], out=[]; for(var r=1;r<a.length;r++){var row=a[r], o={}; for(var c=0;c<head.length;c++) o[head[c]]=row[c]; out.push(o);} return out;}
function appendRow_(name, headers, obj){var sh=sheet_(name,headers); var head=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]; sh.appendRow(head.map(function(k){return obj.hasOwnProperty(k)?obj[k]:'';}));}
function updateRowByKey_(name, headers, keyCol, keyVal, updates){var sh=sheet_(name,headers); var data=sh.getDataRange().getValues(); var head=data[0]; var idx=head.indexOf(keyCol); for(var r=1;r<data.length;r++) if(String(data[r][idx])===String(keyVal)){ for(var c=0;c<head.length;c++){var k=head[c]; if(updates.hasOwnProperty(k)) sh.getRange(r+1,c+1).setValue(updates[k]);} return true;} return false;}
function getProduct_(sku){var cat=readTable_(SHEETS.CATALOG,CATALOG_HEADERS); for(var i=0;i<cat.length;i++) if(String(cat[i].sku).trim()===String(sku).trim()) return cat[i]; return null;}
function listProducts_(){var items=readTable_(SHEETS.CATALOG,CATALOG_HEADERS).filter(function(p){return String(p.active).toLowerCase()!=='false';}).map(function(p){return {sku:String(p.sku||'').trim(),title:p.title,grade:Number(p.grade||0),subject:p.subject,price_cents:Number(p.price_cents||0),hasMemo:(String(p.hasMemo).toLowerCase()!=='false'),drive_links:String(p.drive_links||'').trim()};}); return {products:items};}
function createOrder_(email,name,phone,sku){var prod=getProduct_(sku); if(!prod) throw new Error('SKU not found'); var order={order_id:'SH-'+Date.now()+'-'+Math.floor(Math.random()*10000),timestamp:nowISO_(),email:email||'',name:name||'',phone:phone||'',sku:String(sku).trim(),amount_cents:Number(prod.price_cents||0),status:'PENDING',pf_payment_id:'',pf_payment_status:'',pf_signature:'',ipn_valid:'',email_sent:'',download_links:String(prod.drive_links||'').trim()}; appendRow_(SHEETS.ORDERS, ORDERS_HEADERS, order); return order;}
function pfBase_(){return (String(prop_('PF_ENV','live')).toLowerCase()==='sandbox')?'https://sandbox.payfast.co.za':'https://www.payfast.co.za';}
function pfProcessUrl_(){return pfBase_()+'/eng/process';}
function pfValidateUrl_(){return pfBase_()+'/eng/query/validation';}
function md5_(s){var raw=Utilities.computeDigest(Utilities.DigestAlgorithm.MD5,s);return raw.map(function(b){var v=(b&255).toString(16);return v.length===1?'0'+v:v;}).join('');}
function pfSignature_(params, passphrase){var keys=Object.keys(params).filter(function(k){return params[k]!==undefined&&params[k]!==null&&params[k]!=='';}).sort(); var pairs=keys.map(function(k){return encodeURIComponent(k).replace(/%20/g,'+')+'='+encodeURIComponent(String(params[k])).replace(/%20/g,'+');}); if(passphrase) pairs.push('passphrase='+encodeURIComponent(passphrase).replace(/%20/g,'+')); return md5_(pairs.join('&'));}
function renderPayfastRedirect_(order, product){
  var merchant_id=String(prop_('PF_MERCHANT_ID','')).trim();
  var merchant_key=String(prop_('PF_MERCHANT_KEY','')).trim();
  var passphrase=String(prop_('PF_PASSPHRASE',''));
  var webapp_url=String(prop_('WEBAPP_URL','')).trim();
  var website_url=String(prop_('WEBSITE_URL','')).trim();
  if(!merchant_id||!merchant_key) throw new Error('Missing merchant id/key');
  if(!webapp_url||!website_url) throw new Error('Missing WEBAPP_URL/WEBSITE_URL');
  var return_url=website_url.replace(/\/$/,'')+'/success.html';
  var cancel_url=website_url.replace(/\/$/,'')+'/cancel.html';
  var notify_url=webapp_url;
  var amount=(Number(order.amount_cents||0)/100).toFixed(2);
  var pf={merchant_id:merchant_id,merchant_key:merchant_key,return_url:return_url,cancel_url:cancel_url,notify_url:notify_url,m_payment_id:order.order_id,amount:amount,item_name:(product.title||order.order_id).toString().substring(0,100),name_first:(order.name||'').toString().substring(0,50),email_address:order.email};
  pf.signature=pfSignature_(pf, passphrase);
  var html='<html><body onload="document.forms[0].submit()"><p>Redirecting to PayFast…</p><form method="post" action="'+pfProcessUrl_()+'">';
  Object.keys(pf).forEach(function(k){html+='<input type="hidden" name="'+k+'" value="'+String(pf[k]).replace(/"/g,'&quot;')+'" />';});
  html+='</form></body></html>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function parseFormEncoded_(raw){var p={}; if(!raw) return p; raw.split('&').forEach(function(x){if(!x) return; var kv=x.split('='); var k=decodeURIComponent(kv[0]||''); var v=decodeURIComponent((kv[1]||'').replace(/\+/g,' ')); p[k]=v;}); return p;}
function sendDeliveryEmail_(to,name,orderId,links){
  var support=String(prop_('SUPPORT_EMAIL','examtestgenius@gmail.com'));
  var fromName=String(prop_('FROM_NAME','StudyHub'));
  var subject='Your StudyHub downloads – Order '+orderId;
  var html='<div style="font-family:Inter,Arial,sans-serif"><p>Hi '+(name||'there')+',</p><p>Download links:</p><ul>'+links.map(function(u){return '<li><a href="'+u+'">'+u+'</a></li>';}).join('')+'</ul><p>— '+fromName+' Support ('+support+')</p></div>';
  GmailApp.sendEmail(to, subject, 'Open links in browser', {name:fromName, htmlBody:html, replyTo:support});
}
function handleItn_(raw,obj){
  var passphrase=String(prop_('PF_PASSPHRASE',''));
  var merchant_id=String(prop_('PF_MERCHANT_ID','')).trim();
  var receivedSig=String(obj.signature||'').toLowerCase();
  var copy=JSON.parse(JSON.stringify(obj)); delete copy.signature;
  var sigOk=(pfSignature_(copy, passphrase)===receivedSig);
  var resp=UrlFetchApp.fetch(pfValidateUrl_(), {method:'post',headers:{'Content-Type':'application/x-www-form-urlencoded'},payload:raw,muteHttpExceptions:true});
  var validOk=(String(resp.getContentText()||'').trim().toLowerCase()==='valid');
  if(obj.merchant_id && merchant_id && String(obj.merchant_id)!==merchant_id) throw new Error('Merchant mismatch');
  var orderId=obj.m_payment_id; var pfId=obj.pf_payment_id; var status=String(obj.payment_status||'').toUpperCase();
  var amountCents=Math.round(Number(obj.amount_gross||'0')*100);
  var orders=readTable_(SHEETS.ORDERS, ORDERS_HEADERS); var order=null;
  for(var i=0;i<orders.length;i++) if(String(orders[i].order_id)===String(orderId)) {order=orders[i]; break;}
  if(!order) throw new Error('Order not found');
  var amtOk=(Number(order.amount_cents||0)===Number(amountCents));
  updateRowByKey_(SHEETS.ORDERS, ORDERS_HEADERS, 'order_id', orderId, {pf_payment_id:pfId,pf_payment_status:status,pf_signature:receivedSig,ipn_valid:(validOk&&sigOk&&amtOk)?'YES':'NO',status:(status==='COMPLETE'&&validOk&&sigOk&&amtOk)?'PAID':status});
  if(status==='COMPLETE'&&validOk&&sigOk&&amtOk){
    var links=String(order.download_links||'').split(/\s*;\s*|\s*\n\s*/).filter(String);
    sendDeliveryEmail_(String(order.email||''), String(order.name||''), orderId, links);
    updateRowByKey_(SHEETS.ORDERS, ORDERS_HEADERS, 'order_id', orderId, {email_sent:'YES'});
  }
}
function doGet(e){
  try{
    ensureSchema_();
    var action=String((e&&e.parameter&&e.parameter.action)?e.parameter.action:'products').toLowerCase();
    if(action==='products') return ContentService.createTextOutput(JSON.stringify(listProducts_())).setMimeType(ContentService.MimeType.JSON);
    if(action==='pay'){
      var sku=String(e.parameter.sku||'').trim(); var email=String(e.parameter.email||'').trim();
      if(!sku||!email) throw new Error('Missing sku/email');
      var prod=getProduct_(sku); if(!prod) throw new Error('SKU not found');
      var order=createOrder_(email, String(e.parameter.name||''), String(e.parameter.phone||''), sku);
      return renderPayfastRedirect_(order, prod);
    }
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Unknown action'})).setMimeType(ContentService.MimeType.JSON);
  }catch(err){
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:String(err)})).setMimeType(ContentService.MimeType.JSON);
  }
}
function doPost(e){
  try{
    ensureSchema_();
    var raw=e.postData&&e.postData.contents?e.postData.contents:'';
    var params=parseFormEncoded_(raw);
    handleItn_(raw, params);
    return ContentService.createTextOutput('OK');
  }catch(err){
    return ContentService.createTextOutput('ERR:'+String(err));
  }
}
