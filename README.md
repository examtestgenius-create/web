# StudyHub — Latest GitHub Ready Package

This package contains:
- Static frontend for GitHub Pages
- Google Apps Script backend in `/apps-script`
- Sheet-driven legal details via `SiteContent`
- Contact form backend support
- Checkout -> PayFast auto-post flow
- Free sample files and fallback catalog for testing

## Upload to GitHub
Upload all root files in this ZIP to your GitHub repository root and publish with GitHub Pages.

## Apps Script deployment
1. Create a new Google Apps Script project.
2. Copy all files from `/apps-script` into the project.
3. Deploy as a Web App.
4. Ensure `config.js` points to the deployed Web App URL.

## Required Script Properties
- SITE_BASE_URL
- SHEET_ID
- NOTIFY_EMAIL
- PAYFAST_MERCHANT_ID
- PAYFAST_MERCHANT_KEY
- PAYFAST_PASSPHRASE
- PAYFAST_PROCESS_URL

## First setup
1. Setup Sheets
2. Setup Drive Roots
3. Fill `SiteContent` sheet for legal/business details
4. Run Full Build Pipeline
5. Build All Bundle ZIPs
6. Refresh Catalog Delivery URLs from ZIPs
