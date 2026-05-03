// Common helpers (StudyHub v1.1)
(() => {
  const y = document.getElementById('y');
  if (y) y.textContent = new Date().getFullYear();
  const today = document.getElementById('today');
  if (today) today.textContent = new Date().toISOString().slice(0,10);

  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.style.display === 'flex';
      nav.style.display = open ? 'none' : 'flex';
      toggle.setAttribute('aria-expanded', String(!open));
    });
  }
})();
