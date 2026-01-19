// PayFast configuration (EDIT THIS FILE)
// Set mode to 'sandbox' for testing or 'live' for production.
window.PAYFAST = {
  mode: 'sandbox',
  merchant_id: 'REPLACE_ME',
  merchant_key: 'REPLACE_ME',
  // Only set if you enabled a passphrase in PayFast account:
  passphrase: '',
  notify_url: 'https://script.google.com/macros/s/AKfycbzwE4xmXVI4oIbo_hDU4CXT9ZS1skIuUhelCAmBhUP35Q5C51v0Emtk5KnAj0Pb3V6E/exec',
  return_url: 'https://examtestpaper.co.za/success.html',
  cancel_url: 'https://examtestpaper.co.za/cancel.html'
};
