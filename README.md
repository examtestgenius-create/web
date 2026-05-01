# StudyHub full update package

## What is included
- Updated frontend website files
- Free resources and sample pack files
- backend_appsscript/ with full Apps Script files for PayFast, Orders, invoice PDF generation and buyer email sending

## Go-live steps
1. Upload all website files to your GitHub / live site root.
2. Edit config.js and paste your Apps Script Web App /exec URL.
3. In Apps Script Script Properties set:
   - SITE_BASE_URL = https://examtestpaper.co.za
   - SHEET_ID = your real Google Sheet ID
   - PAYFAST_MERCHANT_ID = your live merchant id
   - PAYFAST_MERCHANT_KEY = your live merchant key
   - PAYFAST_PASSPHRASE = your live passphrase
   - PAYFAST_PROCESS_URL = https://www.payfast.co.za/eng/process
   - NOTIFY_EMAIL = examtestgenius@gmail.com
4. Deploy Apps Script as a Web App with access for anyone.
5. Run setupStudyHub_() once from the Apps Script editor to create/repair sheets.
6. Do one real end-to-end payment test before opening to customers.

## Notes
- success.html and cancel.html aliases are included to avoid broken PayFast redirects if older URLs are still in use.
- The backend now saves orders in Google Sheets, generates a PDF invoice in Drive, stores invoice_url and delivery_url, and emails the buyer once after verified COMPLETE ITN.
- The frontend contact form posts to the backend and stores messages in a Contacts sheet.
