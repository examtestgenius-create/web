# ExamTestGenius — Static Site + PayFast ITN (Google Apps Script)

## What’s inside
- Static website (HTML/CSS/JS)
- Catalog renders from `assets/data/catalog.json`
- Checkout (`product.html`) posts to PayFast
- PayFast ITN receiver code included as `GoogleAppsScript_ITN_Code.gs.txt` (copy into Apps Script)

## Configure website
1. Open `assets/js/app.js` and set:
   - `CFG.site.whatsappE164`
   - `CFG.payfast.environment` = `live` or `sandbox`
   - `CFG.payfast.merchant_id` and `merchant_key`

2. After you deploy Apps Script, paste your Web App URL into:
   - `CFG.payfast.notify_url`

3. Update WhatsApp links in `index.html` and `contact.html` (search for `wa.me/0000000000`).

## Create and deploy Google Apps Script ITN endpoint
1. Go to https://script.google.com and create a new project.
2. Paste content of `GoogleAppsScript_ITN_Code.gs.txt` into `Code.gs`.
3. Set `CFG.PASSPHRASE`:
   - If you enabled a PayFast passphrase: set the same value
   - Else: set to empty string `""`
4. Deploy → New deployment → Web app.
   - Execute as: Me
   - Who has access: Anyone
5. Copy the Web App URL that ends with `/exec`.
6. Put that URL into `assets/js/app.js` (`CFG.payfast.notify_url`).

## Test
- Run a sandbox payment (recommended).
- Verify you receive:
  - Customer email with links
  - Support email with order details

## Notes
- `return_url` / `cancel_url` are user redirects; ITN is your authoritative confirmation.
