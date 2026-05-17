
const cfg = window.STUDYHUB_CONFIG || {};
const API = cfg.apiBaseUrl || cfg.webappUrl || '';
const content = document.getElementById('content');
const title = document.getElementById('title');
const apiStatus = document.getElementById('apiStatus');
let current = 'dashboard';

function money(c){return new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format((Number(c)||0)/100)}
function esc(v){return String(v ?? '').replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]))}
function setStatus(msg, cls=''){apiStatus.textContent=msg;apiStatus.className='muted '+cls}
function cacheBust(){return '_ts=' + Date.now()}
function card(label,value,cls=''){return `<div class="card"><strong>${esc(label)}</strong><b class="${cls}">${esc(value)}</b></div>`}
function table(rows,cols){if(!rows||!rows.length)return '<div class="empty">No records returned from backend.</div>';return `<div class="table-wrap"><table class="table"><thead><tr>${cols.map(c=>`<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${esc(c.fn?c.fn(r):r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
async function apiPost(action,payload={}){
  if(!API) throw new Error('Backend URL missing in ../config.js');
  const res = await fetch(API, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action,...payload}) });
  if(!res.ok) throw new Error('HTTP '+res.status+' from Apps Script');
  const out = await res.json();
  if(out && out.ok === false) throw new Error(out.error || 'Backend returned ok=false');
  return out;
}
async function apiGet(action,payload={}){
  if(!API) throw new Error('Backend URL missing in ../config.js');
  const params = new URLSearchParams({action, ...payload, _ts:Date.now()});
  const res = await fetch(API + '?' + params.toString(), { method:'GET', cache:'no-store' });
  if(!res.ok) throw new Error('HTTP '+res.status+' from Apps Script');
  const out = await res.json();
  if(out && out.ok === false) throw new Error(out.error || 'Backend returned ok=false');
  return out;
}
async function api(action,payload={}){
  try { return await apiPost(action,payload); }
  catch(postErr){
    // fallback for health/catalog/order-status style tests only
    if(action === 'health' || action === 'catalog') return await apiGet(action,payload);
    throw postErr;
  }
}
function apiError(e){
  console.error(e);
  setStatus(e.message,'status-error');
  content.innerHTML = `<div class="errorbox"><strong>LIVE backend error:</strong><br>${esc(e.message)}<br><br><div class="api-url">Backend URL: ${esc(API || 'missing')}</div><br>Check: Apps Script deployment is latest, access is Anyone, Script Properties are set, and the new backend files are deployed.</div>`;
}
async function renderDashboard(){content.innerHTML='<div class="empty">Loading LIVE dashboard from backend…</div>';const d=await api('adminDashboardSummary');content.innerHTML=`<div class="grid">${card('Products',d.products??0)}${card('ZIPs Ready',d.zips_ready??0,'status-ok')}${card('Orders Today',d.orders_today??0)}${card('Revenue Today',money(d.revenue_today_cents||0))}${card('Scanner',d.scanner?.mode||'—')}${card('Downloads',d.downloads?.running?'Running':'Stopped')}${card('Bundles',d.bundles?.enabled?'Enabled':'Stopped')}${card('ZIP Total',d.zips?.total??0)}</div><div class="actions"><button class="btn" onclick="runAction('adminRunHealthCheck')">Run Health Check</button><button class="btn secondary" onclick="runAction('adminRunScannerNow')">Run Discovery Now</button><button class="btn secondary" onclick="runAction('adminStartDownloads')">Start Downloads</button><button class="btn secondary" onclick="runAction('adminBuildMissingZips')">Build Missing ZIPs</button></div><p class="muted api-url">Data loaded from backend at ${new Date().toLocaleString()}</p>`}
async function renderOrders(){content.innerHTML='<div class="empty">Loading LIVE orders…</div>';const d=await api('adminListOrders');content.innerHTML=table(d.orders||[],[{label:'Date',key:'timestamp'},{label:'Order ID',key:'order_id'},{label:'Customer',key:'customer_email'},{label:'SKU',key:'sku'},{label:'Amount',fn:r=>money(r.amount_cents)},{label:'PayFast',key:'pf_status'},{label:'Delivery',key:'delivery_status'}])}
async function renderCatalog(){content.innerHTML='<div class="empty">Loading LIVE catalog…</div>';const d=await api('adminListCatalog');content.innerHTML=table(d.items||[],[{label:'SKU',key:'sku'},{label:'Title',key:'title'},{label:'Type',key:'bundle_type'},{label:'Grade',key:'grade'},{label:'Subject',key:'subject_or_all'},{label:'Price',fn:r=>money(r.price_cents)},{label:'ZIP',key:'zip_status'}])}
async function renderQueue(){const d=await api('adminQueueSummary');content.innerHTML=`<div class="grid">${card('Queue Total',d.total??0)}${Object.entries(d.by_status||{}).map(([k,v])=>card(k,v)).join('')}</div><pre>${esc(JSON.stringify(d.by_status||{},null,2))}</pre>`}
async function renderScanner(){const d=await api('adminScannerStatus');content.innerHTML=`<div class="grid">${card('Mode',d.mode)}${card('Running',d.running?'Yes':'No')}${card('Cursor',d.cursor)}${card('Batch Size',d.batch_size)}</div><div class="actions"><button class="btn" onclick="runAction('adminRunScannerNow')">Run Now</button><button class="btn secondary" onclick="runAction('adminStartScanner')">Start</button><button class="btn secondary" onclick="runAction('adminStopScanner')">Stop</button></div><pre>${esc(JSON.stringify(d,null,2))}</pre>`}
async function renderDownloads(){const d=await api('adminDownloadStatus');content.innerHTML=`<div class="grid">${card('Running',d.running?'Yes':'No')}${card('Cursor',d.cursor)}${card('Batch Size',d.batch_size)}${card('Last Run',d.last_run||'—')}</div><div class="actions"><button class="btn" onclick="runAction('adminStartDownloads')">Start Downloads</button><button class="btn secondary" onclick="runAction('adminStopDownloads')">Stop Downloads</button><button class="btn secondary" onclick="runAction('adminRetryFailedDownloads')">Retry Failed</button></div>`}
async function renderBundles(){const d=await api('adminBundleStatus');content.innerHTML=`<div class="grid">${card('Enabled',d.enabled?'Yes':'No')}${card('Last Run',d.last_run||'—')}</div><div class="actions"><button class="btn" onclick="runAction('adminStartBundleJob',{mode:'ALL'})">Start All Bundles</button><button class="btn secondary" onclick="runAction('adminPauseBundleJob')">Pause</button><button class="btn secondary" onclick="runAction('adminStopBundleJob')">Stop</button></div><pre>${esc(JSON.stringify(d,null,2))}</pre>`}
async function renderZips(){const d=await api('adminZipStatus');content.innerHTML=`<div class="grid">${card('Ready',d.ready??0,'status-ok')}${card('Missing',d.missing??0,'status-warn')}${card('Total',d.total??0)}</div><div class="actions"><button class="btn" onclick="runAction('adminBuildMissingZips')">Build Missing ZIPs</button></div>`}
async function renderDiagnostics(){content.innerHTML='<div class="actions"><button class="btn" onclick="runAction('adminRunHealthCheck')">Run Health Check</button></div><div class="empty">Click Run Health Check. Results are written to the Diagnostics sheet.</div>'}
async function runAction(action,payload={}){try{setStatus('Running '+action+'…');const out=await api(action,payload);setStatus(action+' completed','status-ok');alert(JSON.stringify(out,null,2));loadPage(current)}catch(e){apiError(e)}}
async function loadPage(p){current=p;title.textContent=p==='zips'?'ZIP Delivery':p[0].toUpperCase()+p.slice(1);document.querySelectorAll('[data-page]').forEach(a=>a.classList.toggle('active',a.dataset.page===p));try{setStatus('LIVE API connected to '+(API||'missing config'),'status-ok');if(p==='dashboard')return renderDashboard();if(p==='orders')return renderOrders();if(p==='catalog')return renderCatalog();if(p==='queue')return renderQueue();if(p==='scanner')return renderScanner();if(p==='downloads')return renderDownloads();if(p==='bundles')return renderBundles();if(p==='zips')return renderZips();if(p==='diagnostics')return renderDiagnostics()}catch(e){apiError(e)}}
async function testBackend(){try{setStatus('Testing backend health…');const h=await api('health');alert(JSON.stringify(h,null,2));setStatus('Backend health OK','status-ok')}catch(e){apiError(e)}}
document.querySelectorAll('[data-page]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();loadPage(a.dataset.page)}));
document.getElementById('refreshBtn').addEventListener('click',()=>loadPage(current));
document.getElementById('testBtn').addEventListener('click',testBackend);
loadPage('dashboard');
