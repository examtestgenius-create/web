const APP={Q:'Queue',L:'RunLog',C:'Catalog',O:'Orders'};
function props(){return PropertiesService.getScriptProperties()}
function db(){const id=props().getProperty('SHEET_ID');if(!id)throw Error('Missing SHEET_ID');return SpreadsheetApp.openById(id)}
function tab(n,h){let s=db().getSheetByName(n);if(!s)s=db().insertSheet(n);if(!s.getLastRow()&&h)s.appendRow(h);return s}
function objects(s){if(s.getLastRow()<2)return[];const a=s.getDataRange().getValues(),h=a.shift().map(String);return a.map((r,x)=>{const o={_row:x+2};h.forEach((k,i)=>o[k]=r[i]);return o})}
function out(v){return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON)}
function log(a,e,status,note){tab(APP.L,['timestamp','action','entity','input','output','status','notes']).appendRow([new Date(),a,e,'','',status||'OK',note||''])}
function lock(name,fn){const l=LockService.getScriptLock();if(!l.tryLock(10000))throw Error(name+' busy');try{return fn()}finally{l.releaseLock()}}
function doGet(e){const p=(e&&e.parameter)||{},api=p.api||'health';try{
 if(api==='health')return out({ok:true,data:health()});
 if(api==='catalogPublic')return out({ok:true,data:catalogPublic()});
 if(api==='checkout')return out(createCheckout(p));
 if(api==='orderStatus')return out(orderStatus(p.order_id||''));
 if(api==='adminSummary')return out({ok:true,data:adminSummary(p)});
 if(api==='adminAction')return out({ok:true,data:adminAction(p)});
 return out({ok:false,error:'Unknown API'});
}catch(x){log('API_ERROR',api,'ERROR',String(x));return out({ok:false,error:String(x.message||x)})}}
function doPost(e){try{return ContentService.createTextOutput(handleItn((e&&e.parameter)||{}))}catch(x){log('PAYFAST_ITN','doPost','ERROR',String(x));return ContentService.createTextOutput('ERROR')}}
function health(){return{time:new Date().toISOString(),sheet:db().getName(),mode:props().getProperty('PAYFAST_MODE')||'SANDBOX',discovery:props().getProperty('SL_IMPORT_RUNNING')||'FALSE',downloads:props().getProperty('DL_RUNNING')||'FALSE',bundles:props().getProperty('BUNDLE_JOB_ENABLED')||'FALSE'}}
function catalogPublic(){const s=db().getSheetByName(APP.C);return s?objects(s).filter(x=>String(x.published).toUpperCase()==='TRUE'&&String(x.zip_status).toUpperCase()==='READY'&&x.zip_url):[]}
