
Backend setup (Google Apps Script)
1) Create/open a Google Sheet.
2) Extensions -> Apps Script -> paste backend/Code.gs.
3) Set Script Properties:
   PF_ENV (live|sandbox)
   PF_MERCHANT_ID
   PF_MERCHANT_KEY
   PF_PASSPHRASE
   SUPPORT_EMAIL=examtestgenius@gmail.com
   FROM_NAME=StudyHub
   WEBSITE_URL=https://examtestpaper.co.za
4) Deploy as Web App (Anyone) -> copy /exec URL.
5) Put /exec URL into assets/app.js cfg.catalogEndpoint.
6) Create Catalog sheet rows with drive_links (one per line or ; separated).
7) Set PayFast Notify URL to the /exec URL.
