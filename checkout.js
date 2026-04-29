// StudyHub Cart Core
(function(){
  const KEY = 'STUDYHUB_CART_V1';
  function load(){
    try{ return JSON.parse(localStorage.getItem(KEY) || '[]') || []; }catch(e){ return []; }
  }
  function save(items){
    localStorage.setItem(KEY, JSON.stringify(items || []));
    window.dispatchEvent(new Event('studyhub:cart-changed'));
  }
  function add(sku){
    sku = String(sku||'').trim();
    if(!sku) return;
    const items = load();
    if(items.indexOf(sku) === -1) items.push(sku);
    save(items);
  }
  function remove(sku){
    sku = String(sku||'').trim();
    save(load().filter(x => x !== sku));
  }
  function clear(){ save([]); }
  function count(){ return load().length; }
  function updateBadges(){
    const n = count();
    document.querySelectorAll('[data-cart-count]').forEach(el => {
      el.textContent = String(n);
      el.style.display = n ? 'inline-flex' : 'none';
    });
  }
  window.StudyHubCart = { load, save, add, remove, clear, count };
  document.addEventListener('DOMContentLoaded', updateBadges);
  window.addEventListener('studyhub:cart-changed', updateBadges);
})();
