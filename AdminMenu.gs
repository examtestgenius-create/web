function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('StudyHub Admin')
    .addItem('Setup Sheets', 'setupStudyHub_')
    .addItem('Setup Drive Roots', 'setupDriveRoots_')
    .addItem('Drive Root Status', 'showDriveRootStatus_')
    .addSeparator()
    .addItem('Run Discovery Refresh', 'runDiscoveryRefresh')
    .addItem('Generate Catalog', 'generateCatalog_')
    .addItem('Refresh ZIP Delivery URLs', 'refreshCatalogDeliveryUrlsFromZipMap_')
    .addItem('Diagnostics', 'showDiagnostics_')
    .addToUi();
}
function showDriveRootStatus_() { SpreadsheetApp.getUi().alert(JSON.stringify(getDriveRootStatus_(), null, 2)); }
function showDiagnostics_() { SpreadsheetApp.getUi().alert(JSON.stringify(getDiagnostics_(), null, 2)); }
