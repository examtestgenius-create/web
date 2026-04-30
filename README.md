# StudyHub — GitHub Ready Rebuild

This package is a clean rebuild of the **StudyHub frontend + Google Apps Script backend**.
It is designed to be dropped into a GitHub repository root and deployed on **GitHub Pages**, with the backend deployed separately as a Google Apps Script Web App.

## What is included

### Frontend (GitHub Pages)
- Landing page, free resources page, package detail page, checkout page
- Order created page, PayFast success page, PayFast cancelled page
- Legal pages (Terms, Privacy, Refunds)
- `config.js`, `app.js`, `package.js`, `checkout.js`, `success.js`
- `data/catalog.sample.json` for static/offline testing
- SVG logo and hero artwork
- Placeholder free PDFs and sample ZIP

### Backend (Apps Script)
Located in `backend_appsscript/`:
- `Code.gs`
- `admin.gs`
- `scanner.gs`
- `catalog.gs`
- `bundle_zip_delivery_patch.gs`
- `payfast.gs`
- `appsscript.json`
- `README.md`

## Quick start
1. Upload all frontend files to the root of your GitHub repository
2. Enable **GitHub Pages**
3. Create a new Apps Script project from the contents of `backend_appsscript/`
4. Set Script Properties as described in `backend_appsscript/README.md`
5. Run the setup/build sequence
6. Paste the Apps Script `/exec` URL into `config.js`

## Important placeholders to replace
- `config.js` → `siteBaseUrl`, `webappUrl`, `supportEmail`
- `robots.txt` → sitemap base URL
- `sitemap.xml` → base URLs

## Folder map
```text
/
├─ index.html
├─ free.html
├─ package.html
├─ checkout.html
├─ order-created.html
├─ payment-success.html
├─ payment-cancelled.html
├─ terms.html
├─ privacy.html
├─ refunds.html
├─ styles.css
├─ config.js
├─ app.js
├─ package.js
├─ checkout.js
├─ success.js
├─ data/catalog.sample.json
├─ assets/img/*.svg
├─ free/*
└─ backend_appsscript/*
```

## Notes
- The included backend defaults to **sample discovery mode** so you can test the complete queue → download → bundle → ZIP → catalog → checkout flow safely.
- PayFast is wired properly, but requires valid PayFast Script Properties to go live.
