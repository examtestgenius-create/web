(function(){
  const cfg = window.STUDYHUB_CONFIG || {};
  const api = cfg.apiBaseUrl || cfg.webappUrl || '';
  async function getSiteContent(){
    if(!api) return null;
    try{
      const url = api + (api.indexOf('?') >= 0 ? '&' : '?') + 'action=site-content';
      const res = await fetch(url, { cache: 'no-store' });
      if(!res.ok) return null;
      return await res.json();
    }catch(e){ return null; }
  }
  function fill(data){
    if(!data || typeof data !== 'object') return;
    document.querySelectorAll('[data-site-key]').forEach(el => {
      const key = el.getAttribute('data-site-key');
      const val = data[key];
      if(val !== undefined && val !== null && String(val).trim() !== '') {
        el.textContent = String(val);
      }
    });
  }
  document.addEventListener('DOMContentLoaded', async function(){
    const payload = await getSiteContent();
    if(payload && payload.ok && payload.items) fill(payload.items);
  });
})();