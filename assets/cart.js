(function () {
  const KEY = "studyhub_cart_v1";

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }

  function write(cart) {
    localStorage.setItem(KEY, JSON.stringify(cart));
  }

  function add(item) {
    const cart = read();
    const idx = cart.findIndex(x => x.sku === item.sku);
    if (idx >= 0) cart[idx].qty += (item.qty || 1);
    else cart.push({
      sku: item.sku,
      title: item.title || item.sku,
      priceCents: Number(item.priceCents || 0),
      qty: item.qty || 1
    });
    write(cart);
    return cart;
  }

  function remove(sku) {
    const cart = read().filter(x => x.sku !== sku);
    write(cart);
    return cart;
  }

  function setQty(sku, qty) {
    const q = Math.max(1, Number(qty || 1));
    const cart = read().map(x => x.sku === sku ? { ...x, qty: q } : x);
    write(cart);
    return cart;
  }

  function clear() { write([]); }

  function count() {
    return read().reduce((s, x) => s + Number(x.qty || 0), 0);
  }

  function totalCents() {
    return read().reduce((s, x) => s + (Number(x.priceCents) * Number(x.qty)), 0);
  }

  function summary() {
    return read().map(x => `${x.sku}x${x.qty}`).join(", ");
  }

  window.StudyHubCart = { read, write, add, remove, setQty, clear, count, totalCents, summary };
})();
