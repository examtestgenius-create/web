# ExamTestGenius — Static Site (Prototype)

A fast, SA‑focused front‑end for Grade 8–12 CAPS past exam papers, designed to pair with the Apps Script + PayFast backend.

## Contents
- `index.html` — hero, guide, grades grid, value props (brand‑blue hero)
- `catalog.html` — filterable catalog (grade, subject, term, type)
- `product.html` — PayFast handoff (placeholders for Merchant + ITN URL)
- `downloads.html` — free resources
- `contact.html` — support email and WhatsApp CTA
- `assets/css/style.css` — responsive UI in ~7KB
- `assets/js/app.js` — filtering + SKU hydration
- `assets/data/papers.json` — sample data

## Configure
- Replace WhatsApp number `0000000000` in `index.html` and `contact.html` with your Business number in E.164 (e.g., `27716816131`).
- In `product.html`, set `merchant_id`, `merchant_key`, and `notify_url` to your **ExamTestGenius** PayFast details + Apps Script ITN URL.

## Publish (GitHub Pages)
1. Create repo `examtestgenius-site`.
2. Copy these files to repo root.
3. Add a file named `.nojekyll` in the repo root (already included below).
4. Settings → Pages → Source: `main` → `/root`. Your site will deploy at `https://<user>.github.io/examtestgenius-site/`.
5. Later: add `CNAME` with `examtestpaper.co.za` once DNS is ready.

## Backend hook
Use the provided `delivery.gs` and `invoice_template.html` in your Apps Script project to enable email + WhatsApp instant delivery.
