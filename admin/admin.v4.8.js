
(function(){
  const cfg = window.STUDYHUB_CONFIG || {};
  const API = cfg.apiBaseUrl || cfg.webappUrl || '';
  const content = document.getElementById('content');
  const title = document.getElementById('title');
  const apiStatus = document.getElementById('apiStatus');
  const apiUrl = document.getElementById('apiUrl');
  let current = 'dashboard';

  function money(c){ return new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format((Number(c)||0)/100); }
  function esc(v){ return String(v ?? '').replace(/[&<>\"]/g, function(s){ return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[s]; }); }
  function setStatus(msg, cls){ apiStatus.textContent = msg; apiStatus.className = 'muted ' + (cls || ''); }
  function card(label,value,cls){ return '<div class="card"><strong>'+esc(label)+'</strong><b class="'+(cls||'')+'">'+esc(value)+'</b></div>'; }
  function errorBox(msg, extra){ content.innerHTML = '<div class="errorbox"><strong>Admin stopped because backend/API did not answer correctly.</strong><br>'+esc(msg)+'<br><br><div class="api-url">Backend URL: '+esc(API || 'missing')+'</div>'+(extra?'<br><pre>'+esc(extra)+'</pre>':'')+'</div>'; }
  function table(rows, cols){ if(!rows || !rows.length) return '<div class="empty">No records returned from backend.</div>'; return '<div class="table-wrap"><table class="table"><thead><tr>'+cols.map(c=>'<th>'+esc(c.label)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cols.map(c=>'<td>'+esc(c.fn?c.fn(r):r[c.key])+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'; }
  function timeout(ms){ return new Promise((_, reject)=>setTimeout(()=>reject(new Error('Backend timeout after '+ms+'ms')), ms)); }

  async function fetchJson(url, options){
    const res = await Promise.race([fetch(url, options), timeout(12000)]);
    const text = await res.text();
    if(!res.ok) throw new Error('HTTP '+res.status+' from backend: '+text.slice(0,200));
    try { return JSON.parse(text); }
    catch(e){ throw new Error('Backend did not return JSON. First text: '+text.slice(0,250)); }
  }
  async function apiGet(action, payload){
    if(!API) throw new Error('Backend URL missing in ../config.js');
    const params = new URLSearchParams(Object.assign({action:action,_ts:Date.now()}, payload || {}));
    const out = await fetchJson(API + '?' + params.toString(), { method:'GET', cache:'no-store' });
    if(out && out.ok === false) throw new Error(out.error || 'Backend returned ok=false');
    return out;
  }
  async function apiAdmin(adminAction, payload){
    // Important: call doGet action=admin, because this avoids CORS POST/preflight problems on Apps Script.
    if(!API) throw new Error('Backend URL missing in ../config.js');
    const params = new URLSearchParams(Object.assign({action:'admin', adminAction:adminAction, _ts:Date.now()}, payload || {}));
    const out = await fetchJson(API + '?' + params.toString(), { method:'GET', cache:'no-store' });
    if(out && out.ok === false) throw new Error(out.error || 'Backend returned ok=false');
    return out;
  }
  async function apiPost(action, payload){
    if(!API) throw new Error('Backend URL missing in ../config.js');
    const out = await fetchJson(API, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(Object.assign({action:action}, payload || {})) });
    if(out && out.ok === false) throw new Error(out.error || 'Backend returned ok=false');
    return out;
  }
  async function call(action, payload){
    if(action === 'health' || action === 'catalog') return apiGet(action, payload);
    try { return await apiPost(action, payload); }
    catch(e){ return await apiAdmin(action, payload); }
  }

  async function renderDashboard(){
    content.innerHTML = '<div class="empty">Loading LIVE dashboard from backend…</div>';
    const d = await call('adminDashboardSummary');
    content.innerHTML = '<div class="grid">'+
      card('Products', d.products ?? 0) + card('ZIPs Ready', d.zips_ready ?? 0, 'status-ok') + card('Orders Today', d.orders_today ?? 0) + card('Revenue Today', money(d.revenue_today_cents || 0)) +
      card('Scanner', (d.scanner && d.scanner.mode) || '—') + card('Downloads', d.downloads && d.downloads.running ? 'Running':'Stopped') + card('Bundles', d.bundles && d.bundles.enabled ? 'Enabled':'Stopped') + card('ZIP Total', d.zips && d.zips.total || 0) +
      '</div><div class="actions"><button class="btn" data-action="adminRunHealthCheck">Run Health Check</button><button class="btn secondary" data-action="adminRunScannerNow">Run Discovery Now</button><button class="btn secondary" data-action="adminStartDownloads">Start Downloads</button><button class="btn secondary" data-action="adminBuildMissingZips">Build Missing ZIPs</button></div><p class="muted api-url">LIVE data loaded at '+new Date().toLocaleString()+'</p>';
  }
  async function renderOrders(){ const d = await call('adminListOrders'); content.innerHTML = table(d.orders || [], [{label:'Date',key:'timestamp'},{label:'Order ID',key:'order_id'},{label:'Customer',key:'customer_email'},{label:'SKU',key:'sku'},{label:'Amount',fn:r=>money(r.amount_cents)},{label:'PayFast',key:'pf_status'},{label:'Delivery',key:'delivery_status'}]); }
  async function renderCatalog(){ const d = await call('adminListCatalog'); content.innerHTML = table(d.items || [], [{label:'SKU',key:'sku'},{label:'Title',key:'title'},{label:'Type',key:'bundle_type'},{label:'Grade',key:'grade'},{label:'Subject',key:'subject_or_all'},{label:'Price',fn:r=>money(r.price_cents)},{label:'ZIP',key:'zip_status'}]); }
  async function renderQueue(){ const d = await call('adminQueueSummary'); content.innerHTML = '<div class="grid">'+card('Queue Total', d.total ?? 0)+Object.entries(d.by_status || {}).map(([k,v])=>card(k,v)).join('')+'</div><pre>'+esc(JSON.stringify(d.by_status || {}, null, 2))+'</pre>'; }
  async function renderScanner(){ const d = await call('adminScannerStatus'); content.innerHTML = '<div class="grid">'+card('Mode',d.mode)+card('Running',d.running?'Yes':'No')+card('Cursor',d.cursor)+card('Batch Size',d.batch_size)+'</div><div class="actions"><button class="btn" data-action="adminRunScannerNow">Run Now</button><button class="btn secondary" data-action="adminStartScanner">Start</button><button class="btn secondary" data-action="adminStopScanner">Stop</button></div><pre>'+esc(JSON.stringify(d,null,2))+'</pre>'; }
  async function renderDownloads(){ const d = await call('adminDownloadStatus'); content.innerHTML = '<div class="grid">'+card('Running',d.running?'Yes':'No')+card('Cursor',d.cursor)+card('Batch Size',d.batch_size)+card('Last Run',d.last_run||'—')+'</div><div class="actions"><button class="btn" data-action="adminStartDownloads">Start Downloads</button><button class="btn secondary" data-action="adminStopDownloads">Stop Downloads</button><button class="btn secondary" data-action="adminRetryFailedDownloads">Retry Failed</button></div>'; }
  async function renderBundles(){ const d = await call('adminBundleStatus'); content.innerHTML = '<div class="grid">'+card('Enabled',d.enabled?'Yes':'No')+card('Last Run',d.last_run||'—')+'</div><div class="actions"><button class="btn" data-action="adminStartBundleJob">Start All Bundles</button><button class="btn secondary" data-action="adminPauseBundleJob">Pause</button><button class="btn secondary" data-action="adminStopBundleJob">Stop</button></div><pre>'+esc(JSON.stringify(d,null,2))+'</pre>'; }
  async function renderZips(){ const d = await call('adminZipStatus'); content.innerHTML = '<div class="grid">'+card('Ready',d.ready??0,'status-ok')+card('Missing',d.missing??0,'status-warn')+card('Total',d.total??0)+'</div><div class="actions"><button class="btn" data-action="adminBuildMissingZips">Build Missing ZIPs</button></div>'; }
  async function renderDiagnostics(){ content.innerHTML = '<div class="actions"><button class="btn" data-action="adminRunHealthCheck">Run Health Check</button></div><div class="empty">Click Run Health Check. Results are written to the Diagnostics sheet.</div>'; }

  async function runAction(action){
    try { setStatus('Running '+action+'…'); const out = await call(action, action === 'adminStartBundleJob' ? {mode:'ALL'} : {}); setStatus(action+' completed','status-ok'); alert(JSON.stringify(out,null,2)); loadPage(current); }
    catch(e){ setStatus(e.message,'status-error'); errorBox(e.message); }
  }
  async function loadPage(p){
    current = p;
    title.textContent = p === 'zips' ? 'ZIP Delivery' : p.charAt(0).toUpperCase()+p.slice(1);
    document.querySelectorAll('[data-page]').forEach(a=>a.classList.toggle('active', a.dataset.page === p));
    try {
      setStatus('LIVE API mode — using '+(API||'missing config'),'status-ok');
      if(p==='dashboard') return await renderDashboard();
      if(p==='orders') return await renderOrders();
      if(p==='catalog') return await renderCatalog();
      if(p==='queue') return await renderQueue();
      if(p==='scanner') return await renderScanner();
      if(p==='downloads') return await renderDownloads();
      if(p==='bundles') return await renderBundles();
      if(p==='zips') return await renderZips();
      if(p==='diagnostics') return await renderDiagnostics();
    } catch(e){ setStatus(e.message,'status-error'); errorBox(e.message); }
  }
  async function testBackend(){
    try { setStatus('Testing backend health…'); const h = await call('health'); content.innerHTML = '<div class="okbox"><strong>Backend health OK</strong><pre>'+esc(JSON.stringify(h,null,2))+'</pre></div>'; setStatus('Backend health OK','status-ok'); }
    catch(e){ setStatus(e.message,'status-error'); errorBox(e.message); }
  }

  apiUrl.textContent = 'Backend URL: ' + (API || 'missing in config.js');
  document.querySelectorAll('[data-page]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();loadPage(a.dataset.page);}));
  document.getElementById('refreshBtn').addEventListener('click',()=>loadPage(current));
  document.getElementById('testBtn').addEventListener('click',testBackend);
  document.addEventListener('click', e=>{ const b=e.target.closest('[data-action]'); if(b){ e.preventDefault(); runAction(b.dataset.action); } });
  loadPage('dashboard');
})();
