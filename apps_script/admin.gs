/** StudyHub Production Admin API REV3 */
function adminSummary(p) {
  guard(p);
  const queue = db().getSheetByName(APP.Q);
  const catalog = db().getSheetByName(APP.C);
  const orders = shEnsureOrdersSheet_();
  const orderRows = objects(orders).sort(function(a,b){return new Date(b.timestamp||0)-new Date(a.timestamp||0);});
  return {
    queue: queue ? shCounts_(objects(queue),'status') : {},
    catalog: catalog ? {
      total: objects(catalog).length,
      ready: objects(catalog).filter(function(x){return String(x.zip_status).toUpperCase()==='READY';}).length,
      published: objects(catalog).filter(function(x){return String(x.published).toUpperCase()==='TRUE';}).length
    } : {total:0,ready:0,published:0},
    orders: orderRows,
    orderCounts: shCounts_(orderRows,'pf_status'),
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

  if (action === 'publish') {
    const catalog = db().getSheetByName(APP.C);
    const item = catalog ? objects(catalog).find(function(x){return String(x.sku)===String(p.sku);}) : null;
    if (!item || String(item.zip_status).toUpperCase() !== 'READY') throw Error('ZIP not ready');
    update(catalog,item._row,{published:'TRUE',enabled:'TRUE',last_updated:new Date()});
    return {published:p.sku};
  }

  const sheet = shEnsureOrdersSheet_();
  const order = objects(sheet).find(function(x){return String(x.order_id)===String(p.order_id);});
  if (!order) throw Error('Order not found: '+String(p.order_id||''));

  if (action === 'mark_paid') {
    update(sheet,order._row,{pf_status:'MANUAL_PAID',completed_at:new Date(),admin_notes:shAppend_(order.admin_notes,'Manually marked paid by admin')});
    return shGrantAndDeliver_(sheet, Object.assign({},order,{pf_status:'MANUAL_PAID'}), true);
  }
  if (action === 'mark_unpaid') {
    update(sheet,order._row,{pf_status:'PENDING',delivery_status:'REVOKED',admin_notes:shAppend_(order.admin_notes,'Marked unpaid by admin')});
    return {status:'UNPAID',order_id:order.order_id};
  }
  if (action === 'grant_download') return shGrantAndDeliver_(sheet,order,false);
  if (action === 'revoke_download') {
    update(sheet,order._row,{delivery_status:'REVOKED',admin_notes:shAppend_(order.admin_notes,'Download revoked by admin')});
    return {status:'DOWNLOAD_REVOKED',order_id:order.order_id};
  }
  if (action === 'resend_email') return shGrantAndDeliver_(sheet,order,true);
  throw Error('Unknown action: '+action);
}

function guard(p) {
  const token = props().getProperty('ADMIN_API_TOKEN');
  if (!token || String(p.token||'') !== token) throw Error('Access denied');
}

function shGrantAndDeliver_(sheet,order,sendEmail) {
  if (!order.zip_url) throw Error('Order has no ZIP URL');
  const paid = ['COMPLETE','MANUAL_PAID'].indexOf(String(order.pf_status).toUpperCase()) >= 0;
  if (!paid && !sendEmail) {
    update(sheet,order._row,{delivery_status:'GRANTED_MANUALLY',admin_notes:shAppend_(order.admin_notes,'Download granted before payment confirmation')});
  } else {
    update(sheet,order._row,{delivery_status:'DELIVERY_SENT',delivery_sent_at:new Date(),admin_notes:shAppend_(order.admin_notes,'Download granted by admin')});
  }
  if (sendEmail) shSendDeliveryEmail_(order);
  return {status:sendEmail?'DELIVERY_EMAIL_SENT':'DOWNLOAD_GRANTED',order_id:order.order_id,zip_url:order.zip_url};
}

function shCounts_(rows,key) { const out={}; rows.forEach(function(x){const v=String(x[key]||'BLANK').toUpperCase();out[v]=(out[v]||0)+1;}); return out; }
function shAppend_(existing,note){return String(existing||'').trim()?String(existing)+' | '+note:note;}
