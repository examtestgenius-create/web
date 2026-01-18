# Setup (2 minutes)

## Google Sheet
Your sheet header must include these columns exactly:
Status, Grade, Subject, Province, Year, Term, PaperName, SourceURL, DestFileName, FileId, Link, Notes, CreatedAt, UpdatedAt, Title, Type, PreviewURL, BundleSKU

## Script Properties (Apps Script)
Set these in Project Settings → Script properties:
- SHEET_ID
- FILES_SHEET_NAME (default: Files)
- ORDERS_SHEET_NAME (default: Orders)
- SUPPORT_EMAIL (default: examtestgenius@gmail.com)
- PAYFAST_PASSPHRASE (blank unless enabled)
- PRICES_JSON (optional)
- CATALOG_API_KEY (optional)

Then run setupExamTestGenius() once and redeploy the Web App.

## Website
Upload this site.
If your host domain is not https://examtestpaper.co.za update return_url/cancel_url in assets/js/app.js.
