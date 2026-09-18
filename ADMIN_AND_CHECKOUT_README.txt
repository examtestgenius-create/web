STUDYHUB CHECKOUT + ADMIN REV3

WEBSITE FILES REPLACED
- package.html / package.js: corrected logo/header and professional bundle detail page
- checkout.html / checkout.js: customer name, email, optional phone, terms and PayFast handoff
- styles.css: scoped responsive detail and checkout styles
- admin/: order dashboard with payment and delivery controls
- index.html: Admin link added to footer

BACKEND FILES TO REPLACE IN THE CURRENT PRODUCTION APPS SCRIPT PROJECT
- apps_script/admin.gs
- apps_script/payfast.gs
Do not replace the current production bundle_zip.gs, downloader.gs or Code.gs with the old files in this ZIP.

ADMIN SETUP
1. Set ADMIN_API_TOKEN in Apps Script Project Settings > Script Properties.
2. Upload the website to GitHub.
3. Open https://examtestpaper.co.za/admin/
4. Enter the current /exec URL and ADMIN_API_TOKEN, then Connect.
5. Admin can mark paid/unpaid, grant/revoke download, resend delivery email, open customer email and open ZIP.

PAYFAST SETUP
Required Script Properties:
- PAYFAST_MODE = SANDBOX or LIVE
- PAYFAST_MERCHANT_ID
- PAYFAST_MERCHANT_KEY
- PAYFAST_PASSPHRASE
- PAYFAST_NOTIFY_URL = current Apps Script /exec URL
- PAYFAST_RETURN_URL = https://examtestpaper.co.za/success.html
- PAYFAST_CANCEL_URL = https://examtestpaper.co.za/payment-cancelled.html
- SITE_BASE_URL = https://examtestpaper.co.za
- INVOICES_ROOT_ID

DEPLOY
After replacing admin.gs and payfast.gs, deploy the Apps Script Web App as a New version.
