# StudyHub / Exam Test Paper v4.2 RC7 merged build

This is the GitHub-ready merged build. It includes public site, admin dashboard, price editor, grade pricing, bulk discounts, cart checkout, PayFast hardening, and Apps Script backend.

## GitHub Pages upload
Upload the contents of `public/` as the site root. Keep Apps Script files out of the public website unless intentionally documenting them.

## Apps Script
Copy `apps-script/StudyHub_RC7_FullBackend.gs` into Apps Script, set properties from `config/script-properties-template.json`, then run `setupSheets()`.

## Important
Do not commit real PayFast Merchant Key or Passphrase. Store those only in Apps Script Script Properties.
