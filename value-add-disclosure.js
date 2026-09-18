/** StudyHub value-added service disclosure REV1 */
(function () {
  const COPY = {
    short: 'The source papers and memos may be available free from their official publishers. StudyHub charges for the work that makes them useful: finding, verifying, matching, classifying, organising, maintaining and delivering them as a convenient revision ZIP.',
    checkout: 'I understand that payment is for StudyHub’s value-added discovery, verification, matching, organisation, ZIP preparation, delivery and support service, and not for ownership of the underlying public examination documents.'
  };

  function addDisclosure() {
    const path = location.pathname.toLowerCase();

    if (path.endsWith('/package.html')) {
      const purchase = document.querySelector('.purchase-card');
      if (purchase && !document.getElementById('valueAddDisclosure')) {
        const box = document.createElement('div');
        box.id = 'valueAddDisclosure';
        box.className = 'value-add-disclosure';
        box.innerHTML = '<strong>What the price covers</strong><p>' + COPY.short + '</p>';
        const firstButton = purchase.querySelector('.btn');
        purchase.insertBefore(box, firstButton || null);
      }
    }

    if (path.endsWith('/checkout.html')) {
      const form = document.getElementById('checkoutForm');
      if (form && !document.getElementById('valueAddConsent')) {
        const field = document.createElement('div');
        field.id = 'valueAddConsent';
        field.className = 'form-field full value-add-consent';
        field.innerHTML = '<label class="check-row"><input id="valueAddCheck" type="checkbox" required><span>' + COPY.checkout + '</span></label>';
        const button = form.querySelector('button[type="submit"]');
        form.insertBefore(field, button || null);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', addDisclosure);
  setTimeout(addDisclosure, 700);
})();
