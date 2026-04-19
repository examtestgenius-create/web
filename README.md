# StudyHub GitHub Pages Pack

This ZIP is ready for GitHub Pages static hosting.

## Before going live
1. Upload all files to a GitHub repository root.
2. Enable GitHub Pages from the main branch/root.
3. Edit `assets/app.js` and set `cfg.catalogEndpoint` to your Google Apps Script `/exec` URL.
4. In Apps Script script properties, set `NOTIFY_EMAIL = examtestgenius@gmail.com`.
5. Optional: add `action=settings` and `action=updateSettings` to Apps Script to power `admin.html`.

## Current business identity in the legal pages
- Trading name: StudyHub (examtestpaper.co.za)
- Legal name / Owner: Janes van Wyk (Sole Proprietor)
- Registration number: N/A
- Support email: examtestgenius@gmail.com
- Telephone: 0785766306
- Physical / service address: 22 Hakea Crescent, Vanderbijlpark, SE 3, 1911, South Africa

## Notes
- `cart.html` is `noindex,follow`.
- `success.html` + `cancel.html` are `noindex,follow`.
- `payment-success.html` and `payment-cancelled.html` are included to match your current Apps Script return/cancel URLs.
