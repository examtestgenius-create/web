# ExamTestGenius — Static Site (Prototype)

A fast, SA‑focused front‑end for Grade 8–12 CAPS past exam papers, designed to pair with a Google Apps Script + PayFast backend.

## Contents
- `index.html` — hero, guide, grades grid, value props (brand‑blue hero)
- `catalog.html` — filterable catalog (grade, subject, term, type)
- `product.html` — PayFast handoff (LIVE merchant + ITN URL wired)
- `downloads.html` — free resources
- `contact.html` — support email and WhatsApp CTA (replace number)
- `assets/css/style.css` — responsive UI
- `assets/js/app.js` — filtering + SKU hydration + PayFast wiring
- `assets/data/papers.json` — sample data
- `thankyou.html`, `cancel.html`, `404.html`, `robots.txt`, `sitemap.xml`, `.nojekyll`

## Configure
- Replace WhatsApp number `0000000000` in `index.html` and `contact.html` with your Business number in E.164 (e.g., `+27716816131`).
- `assets/js/app.js` already contains LIVE `merchant_id` and `merchant_key` and your ITN `notify_url`. If you rotate keys, update them here and in `product.html` fallback.

## Publish (GitHub Pages)
1. Create repo `examtestgenius-site`.
2. Copy these files to repo root.
3. Add a file named `.nojekyll` in the repo root (already included here).
4. Settings → Pages → Source: `main` → `/root`. Your site will deploy at `https://<user>.github.io/examtestgenius-site/`.
5. Later: add `CNAME` with `examtestpaper.co.za` once DNS is ready.

## Backend hook
Deploy your Apps Script Web App and paste its URL in `assets/js/app.js` and `product.html` (`notify_url`). Keep your PayFast passphrase on the server only.
