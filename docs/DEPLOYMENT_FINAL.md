# StudyHub Final Deployment
1. Upload this ZIP content to the `Study-Hub` GitHub repository root.
2. In Google Apps Script create files matching `/apps_script` and paste each file.
3. Run `CREATE_COMPLETE_STUDYHUB()` once.
4. Add Script Properties: PAYFAST_MODE=SANDBOX, PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY, PAYFAST_PASSPHRASE, PAYFAST_NOTIFY_URL, ADMIN_API_TOKEN.
5. Deploy Apps Script as Web App: execute as owner, access Anyone.
6. Put the /exec URL in `config.js` for apiBaseUrl, webappUrl and liveCatalogUrl.
7. Put the same /exec URL and ADMIN_API_TOKEN into `/admin` when operating it. Do not commit the token.
8. Add approved source pages or existing ScannerLinks data, then scan, download, build ZIPs and publish selected Catalog rows.
9. Test PayFast SANDBOX end to end before changing PAYFAST_MODE to LIVE.
