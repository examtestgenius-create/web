# Pre-upload checklist

- [ ] Upload `public/` contents to GitHub Pages root
- [ ] Confirm `/index.html` exists at root
- [ ] Confirm `/admin/` opens
- [ ] Confirm `CNAME` contains `examtestpaper.co.za`
- [ ] Confirm Apps Script Web App is deployed as Anyone
- [ ] Replace API URL in `public/app.js` and `public/admin/admin.js` if Apps Script URL changed
- [ ] Set PayFast key/passphrase only in Script Properties
- [ ] Run `setupSheets()`
- [ ] Confirm Catalog has `price_cents` and `zip_url` before live PayFast test
