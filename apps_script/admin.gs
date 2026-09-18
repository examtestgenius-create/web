/** StudyHub Production Admin Control API REV4 */
function adminSummary(p) {
  guard(p);
  const queue = db().getSheetByName(APP.Q);
  const catalogSheet = db().getSheetByName(APP.C);
  const ordersSheet = shEnsureOrdersSheet_();
  const orders = objects(ordersSheet).sort(function(a,b){return new Date(b.timestamp||0)-new Date(a.timestamp||0);});
  const catalogRows = catalogSheet ? objects(catalogSheet) : [];
  return {
    queue: queue ? shCounts_(objects(queue),'status') : {},
    catalog: {
      total: catalogRows.length,
      ready: catalogRows.filter(function(x){return String(x.zip_status).toUpperCase()==='READY';}).length,
      published: catalogRows.filter(function(x){return String(x.published).toUpperCase()==='TRUE';}).length
    },
    catalogRows: catalogRows,
    orders: orders,
    orderCounts: shCounts_(orders,'pf_status'),
    system: health()
  };
}

function adminAction(p) {
  guard(p);
  const action = String(p.action || '');
  if (action === 'scan_start') return startScannerLinksImport();
  if (action === 'scan_stop') return stopScannerLinksImport();
  if (action === 'download') return runDownloadBatch();
  if (action === 'bundles') return buildAllBundles();

  if (['publish','unpublish','enable','disable'].indexOf(action) >= 0) {
    const catalog = db().getSheetByName(APP.C);
    const item = catalog ? objects(catalog).find(function(x){return String(x.sku)===String(p.sku);}) : null;
    if (!item) throw Error('Catalog item not found');
    if (action === 'publish') {
      if (String(item.zip_status).toUpperCase() !== 'READY' || !item.zip_url || Number(item.pair_count||0) < 1) throw Error('Catalog item is not ready');
      update(catalog,item._row,{published:'TRUE',enabled:'TRUE',last_updated:new Date()});
    }
    if (action === 'unpublish') update(catalog,item._row,{published:'FALSE',last_updated:new Date()});
    if (action === 'enable') update(catalog,item._row,{enabled:'TRUE',last_updated:new Date()});
    if (action === 'disable') update(catalog,item._row,{enabled:'FALSE',published:'FALSE',last_updated:new Date()});
    return {status:action.toUpperCase(),sku:item.sku};
  }

  const sheet = shEnsureOrdersSheet_();
  const order = objects(sheet).find(function(x){return String(x.order_id)===String(p.order_id);});
  if (!order) throw Error('Order not found: '+String(p.order_id||''));

  if (action === 'mark_paid') {
    update(sheet,order._row,{pf_status:'MANUAL_PAID',completed_at:new Date(),admin_notes:shAppend_(order.admin_notes,'Manually marked paid by Admin')});
    return shGrantAndDeliver_(sheet,Object.assign({},order,{pf_status:'MANUAL_PAID'}),true);
  }
  if (action === 'mark_unpaid') {
    update(sheet,order._row,{pf_status:'PENDING',delivery_status:'REVOKED',admin_notes:shAppend_(order.admin_notes,'Marked unpaid by Admin')});
    return {status:'UNPAID',order_id:order.order_id};
  }
  if (action === 'mark_refunded') {
    update(sheet,order._row,{pf_status:'REFUNDED',delivery_status:'REVOKED',admin_notes:shAppend_(order.admin_notes,'Marked refunded by Admin')});
    return {status:'REFUNDED',order_id:order.order_id};
  }
  if (action === 'grant_download') return shGrantAndDeliver_(sheet,order,false);
  if (action === 'revoke_download') {
    update(sheet,order._row,{delivery_status:'REVOKED',admin_notes:shAppend_(order.admin_notes,'Download revoked by Admin')});
    return {status:'DOWNLOAD_REVOKED',order_id:order.order_id};
  }
  if (action === 'resend_email') return shGrantAndDeliver_(sheet,order,true);
  if (action === 'add_note') {
    update(sheet,order._row,{admin_notes:shAppend_(order.admin_notes,String(p.note||'').slice(0,500))});
    return {status:'NOTE_ADDED',order_id:order.order_id};
  }
  throw Error('Unknown action: '+action);
}

function guard(p) {
  const token = props().getProperty('ADMIN_API_TOKEN');
  if (!token || String(p.token||'') !== token) throw Error('Access denied');
}

function shGrantAndDeliver_(sheet,order,sendEmail) {
  if (!order.zip_url) throw Error('Order has no ZIP URL');
  const paid = ['COMPLETE','MANUAL_PAID'].indexOf(String(order.pf_status).toUpperCase()) >= 0;
  const status = sendEmail ? 'DELIVERY_SENT' : (paid ? 'DELIVERY_SENT' : 'GRANTED_MANUALLY');
  update(sheet,order._row,{delivery_status:status,delivery_sent_at:sendEmail?new Date():order.delivery_sent_at,admin_notes:shAppend_(order.admin_notes,sendEmail?'Delivery email sent by Admin':'Download granted by Admin')});
  if (sendEmail) shSendDeliveryEmail_(order);
  return {status:sendEmail?'DELIVERY_EMAIL_SENT':'DOWNLOAD_GRANTED',order_id:order.order_id,zip_url:order.zip_url};
}
function shCounts_(rows,key){const out={};rows.forEach(function(x){const v=String(x[key]||'BLANK').toUpperCase();out[v]=(out[v]||0)+1;});return out;}
function shAppend_(existing,note){return String(existing||'').trim()?String(existing)+' | '+note:note;}
