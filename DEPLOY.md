# Deploy checklist

## Frontend
- Edit `config.js`
- Edit `robots.txt`
- Edit `sitemap.xml`
- Push to GitHub
- Enable GitHub Pages

## Backend
- Copy `backend_appsscript/*` into Apps Script
- Set Script Properties
- Run `setupStudyHub_()`
- Run `setupDriveRoots_()`
- Run `runFullBuildPipeline()`
- Deploy as Web App
- Paste `/exec` URL into `config.js`

## PayFast
- Use sandbox URL first for testing
- Confirm `return_url`, `cancel_url`, `notify_url`
- Test ITN and order status before switching live
