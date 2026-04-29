FINAL FRONTEND HOTFIX ZIP

Overwrite these files on the live site root:
- config.js
- checkout.js
- success.js
- success.html
- cancel.html
- order-created.html

Optional compatibility aliases included:
- payment-success.html
- payment-cancelled.html

What this hotfix fixes:
1. The missing success.html / cancel.html 404 problem.
2. The checkout flow now calls the backend createCheckout action and then POSTS to PayFast.
3. The success page polls the backend order-status endpoint before showing delivery links.
