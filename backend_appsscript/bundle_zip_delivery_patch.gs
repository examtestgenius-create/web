/**
 * StudyHub — bundle_zip_delivery_patch.gs
 *
 * Add this as a NEW file in your Apps Script project.
 *
 * Purpose:
 *   - Generate ZIP files per bundle SKU
 *   - Store ZIPs in Drive under /StudyHub/Bundle_Zips/
 *   - Prefer ZIP URLs for customer delivery
 *   - Keep folder URLs as the underlying driveUrl
 */

const BUNDLE_ZIPS_ROOT_ID_KEY_ = 'BUNDLE_ZIPS_ROOT_ID';
const BUNDLE_ZIPS_ROOT_NAME_ = 'Bundle_Zips';
const BUNDLE_ZIPS_SHEET_NAME_ = 'BundleZips';

function ensureBundleZipsRoot_() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty(BUNDLE_ZIPS_ROOT_ID_KEY_);
  const existing = getFolderSafe_(existingId);
  if (existing) return existing;

  const roots = ensureDriveRoots_();
  const zipRoot = ensureSubFolder_(roots.driveRoot, BUNDLE_ZIPS_ROOT_NAME_);
  props.setProperty(BUNDLE_ZIPS_ROOT_ID_KEY_, zipRoot.getId());
  return zipRoot;
}

function ensureBundleZipsSheet_() {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(BUNDLE_ZIPS_SHEET_NAME_);
  const headers = [
    'timestamp', 'sku', 'zip_file_name', 'zip_file_id', 'zip_url',
    'bundle_folder_id', 'bundle_folder_url', 'file_count', 'status', 'notes'
  ];
  if (!sh) sh = ss.insertSheet(BUNDLE_ZIPS_SHEET_NAME_);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
  } else {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sh;
}

function upsertBundleZipRow_(payload) {
  const sh = ensureBundleZipsSheet_();
  const rows = sh.getDataRange().getValues();
  const headers = rows[0] || [];
  const skuIdx = headers.indexOf('sku');
  const row = [
    new Date(), payload.sku || '', payload.zip_file_name || '', payload.zip_file_id || '', payload.zip_url || '',
    payload.bundle_folder_id || '', payload.bundle_folder_url || '', payload.file_count || 0,
    payload.status || '', payload.notes || ''
  ];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][skuIdx] || '') === String(payload.sku || '')) {
      sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  sh.appendRow(row);
}

function bundleTypeRootNameFromSku_(sku) {
  const m = String(sku || '').match(/-([A-Z]{2})$/);
  const code = m ? m[1] : '';
  if (code === 'SS') return 'Single_Subject';
  if (code === 'SY') return 'Single_Year';
  if (code === 'MB') return 'Master_Bundle';
  if (code === 'UB') return 'Ultimate_Bundle';
  throw new Error('Could not infer bundle type from SKU: ' + sku);
}

function findBundleFolderBySku_(sku) {
  const roots = ensureDriveRoots_();
  const bundleRootName = bundleTypeRootNameFromSku_(sku);
  const typeRoot = findSubFolder_(roots.bundlesRoot, bundleRootName);
  if (!typeRoot) return null;
  const gradeFolders = typeRoot.getFolders();
  while (gradeFolders.hasNext()) {
    const gradeFolder = gradeFolders.next();
    const bundleFolders = gradeFolder.getFolders();
    while (bundleFolders.hasNext()) {
      const folder = bundleFolders.next();
      if (String(folder.getName()) === String(sku)) return folder;
    }
  }
  return null;
}

function collectRealFilesRecursiveForZip_(folder, relativePrefix, out) {
  out = out || [];
  relativePrefix = relativePrefix || '';
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const name = String(file.getName() || '');
    if (name === 'manifest.json' || name === 'README.txt') continue;
    const zipPath = relativePrefix ? (relativePrefix + '/' + name) : name;
    const blob = file.getBlob().setName(zipPath);
    out.push(blob);
  }
  const subs = folder.getFolders();
  while (subs.hasNext()) {
    const sub = subs.next();
    const nextPrefix = relativePrefix ? (relativePrefix + '/' + sub.getName()) : sub.getName();
    collectRealFilesRecursiveForZip_(sub, nextPrefix, out);
  }
  return out;
}

function countRealFilesRecursiveSafe_(folder) {
  try {
    return countRealFilesRecursive_(folder);
  } catch (err) {
    return collectRealFilesRecursiveForZip_(folder, '', []).length;
  }
}

function upsertBlobFileInFolder_(folder, fileName, blob) {
  const files = folder.getFilesByName(fileName);
  while (files.hasNext()) files.next().setTrashed(true);
  return folder.createFile(blob.setName(fileName));
}

function setAnyoneWithLinkViewerSafe_(file) {
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    logRunIfAvailable_('BUNDLE_ZIP_SHARE_WARNING', file.getId(), '', 'Could not set anyone-with-link viewer: ' + String(err));
  }
}

function createOrRefreshBundleZipForSku_(sku, forceRebuild) {
  sku = String(sku || '').trim();
  if (!sku) throw new Error('Missing SKU');
  const bundleFolder = findBundleFolderBySku_(sku);
  if (!bundleFolder) throw new Error('Bundle folder not found for SKU: ' + sku);

  const zipRoot = ensureBundleZipsRoot_();
  let parentGroupName = 'Unsorted';
  try {
    const parents = bundleFolder.getParents();
    if (parents.hasNext()) parentGroupName = parents.next().getName();
  } catch (err) {}

  const groupFolder = ensureSubFolder_(zipRoot, parentGroupName);
  const zipName = sku + '.zip';

  if (!forceRebuild) {
    const existing = groupFolder.getFilesByName(zipName);
    if (existing.hasNext()) {
      const file = existing.next();
      upsertBundleZipRow_({
        sku: sku,
        zip_file_name: file.getName(),
        zip_file_id: file.getId(),
        zip_url: file.getUrl(),
        bundle_folder_id: bundleFolder.getId(),
        bundle_folder_url: bundleFolder.getUrl(),
        file_count: countRealFilesRecursiveSafe_(bundleFolder),
        status: 'REUSED',
        notes: 'Existing ZIP reused'
      });
      return file.getUrl();
    }
  }

  const blobs = collectRealFilesRecursiveForZip_(bundleFolder, '', []);
  if (!blobs.length) throw new Error('No real files found in bundle folder for SKU: ' + sku);
  const zipBlob = Utilities.zip(blobs, zipName);
  const zipFile = upsertBlobFileInFolder_(groupFolder, zipName, zipBlob);
  setAnyoneWithLinkViewerSafe_(zipFile);

  upsertBundleZipRow_({
    sku: sku,
    zip_file_name: zipFile.getName(),
    zip_file_id: zipFile.getId(),
    zip_url: zipFile.getUrl(),
    bundle_folder_id: bundleFolder.getId(),
    bundle_folder_url: bundleFolder.getUrl(),
    file_count: blobs.length,
    status: 'BUILT',
    notes: 'ZIP built/refreshed'
  });

  logRunIfAvailable_('BUNDLE_ZIP_BUILD', sku, zipFile.getUrl(), 'Created ZIP from bundle folder');
  return zipFile.getUrl();
}

function createBundleZipForSkuPrompt_() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('StudyHub — Build bundle ZIP', 'Enter the exact SKU to ZIP (for example SH-G12-ALL-2022-2026-UB):', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const sku = String(res.getResponseText() || '').trim();
  if (!sku) { ui.alert('No SKU entered.'); return; }
  try {
    const url = createOrRefreshBundleZipForSku_(sku, true);
    ui.alert('ZIP created:
' + url);
  } catch (err) {
    ui.alert('ZIP build failed:
' + String(err));
  }
}

function createAllBundleZips_() {
  const payload = getBundleStatus_();
  const items = (payload && payload.items) ? payload.items : [];
  let built = 0;
  const failed = [];
  items.forEach(function (item) {
    try {
      createOrRefreshBundleZipForSku_(item.sku, true);
      built++;
    } catch (err) {
      failed.push({ sku: item.sku, error: String(err) });
      logRunIfAvailable_('BUNDLE_ZIP_BUILD_ERROR', item.sku, '', String(err));
    }
  });
  refreshCatalogDeliveryUrlsFromZipMap_();
  const summary = { ok: failed.length === 0, built: built, failed: failed, ts: nowIso_() };
  logRunIfAvailable_('BUNDLE_ZIP_BUILD_ALL', String(items.length), JSON.stringify(summary), 'Batch ZIP build completed');
  return summary;
}

function getBundleZipUrlMap_() {
  const urlMap = {};
  let zipRoot = null;
  try { zipRoot = ensureBundleZipsRoot_(); } catch (err) { return urlMap; }
  const groupFolders = zipRoot.getFolders();
  while (groupFolders.hasNext()) {
    const group = groupFolders.next();
    const files = group.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      const name = String(file.getName() || '');
      if (!/\.zip$/i.test(name)) continue;
      const sku = name.replace(/\.zip$/i, '');
      if (sku.indexOf('SH-G') === 0) urlMap[sku] = file.getUrl();
    }
  }
  return urlMap;
}

function refreshCatalogDeliveryUrlsFromZipMap_() {
  const sh = requireSheet_('Catalog');
  const rows = sh.getDataRange().getValues();
  if (rows.length <= 1) return { ok: true, updated: 0, ts: nowIso_() };
  const headers = rows[0];
  const skuIdx = headers.indexOf('sku');
  const driveIdx = headers.indexOf('driveUrl');
  const deliveryIdx = headers.indexOf('deliveryUrl');
  if (skuIdx < 0 || driveIdx < 0 || deliveryIdx < 0) throw new Error('Catalog headers are missing sku / driveUrl / deliveryUrl');
  const zipMap = getBundleZipUrlMap_();
  let updated = 0;
  for (let i = 1; i < rows.length; i++) {
    const sku = String(rows[i][skuIdx] || '').trim();
    const driveUrl = String(rows[i][driveIdx] || '').trim();
    const nextDelivery = zipMap[sku] || driveUrl || '';
    const currentDelivery = String(rows[i][deliveryIdx] || '').trim();
    if (currentDelivery !== nextDelivery) {
      sh.getRange(i + 1, deliveryIdx + 1).setValue(nextDelivery);
      updated++;
    }
  }
  logRunIfAvailable_('CATALOG_DELIVERY_REFRESH', String(updated), '', 'Catalog delivery URLs refreshed from bundle ZIP map');
  return { ok: true, updated: updated, zip_count: Object.keys(zipMap).length, ts: nowIso_() };
}

function getBundleZipStatus_() {
  const zipMap = getBundleZipUrlMap_();
  return {
    ok: true,
    zip_count: Object.keys(zipMap).length,
    items: Object.keys(zipMap).sort().map(function (sku) { return { sku: sku, zipUrl: zipMap[sku] }; }),
    ts: nowIso_()
  };
}

function showBundleZipStatus_() {
  SpreadsheetApp.getUi().alert(JSON.stringify(getBundleZipStatus_(), null, 2));
}
