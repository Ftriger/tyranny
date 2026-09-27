// Les og lagre hele varelisten (krever innlogging)
const { getCatalog, saveProducts, guard, body, send, wrap } = require('../_lib');
function clean(p, i) {
  const name = String(p.name || '').trim().slice(0, 80);
  const price = Math.round(Number(p.price));
  if (!name) throw Object.assign(new Error(`Vare ${i + 1} mangler navn.`), { status: 400 });
  if (!(price > 0 && price < 100000)) throw Object.assign(new Error(`«${name}» har ugyldig pris.`), { status: 400 });
  const id = String(p.id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || ('v' + Date.now().toString(36) + i);
  const out = {
    id, name, price,
    desc: String(p.desc || '').slice(0, 400),
    tag: String(p.tag || '').slice(0, 20),
    active: p.active !== false,
    sizes: (Array.isArray(p.sizes) ? p.sizes : []).map((s) => String(s).trim().slice(0, 8)).filter(Boolean).slice(0, 12),
    inStock: p.inStock !== false,
    outSizes: [],
    images: (Array.isArray(p.images) ? p.images : []).map(String).filter((u) => /^img\/[a-z0-9._\/-]+$/i.test(u)).slice(0, 8),
  };
  out.outSizes = (Array.isArray(p.outSizes) ? p.outSizes : []).map(String).filter((x) => out.sizes.includes(x));
  return out;
}
module.exports = wrap(async (req, res) => {
  const me = await guard(req, res, false); if (!me) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') { const c = await getCatalog(true); return send(res, 200, { products: c.products }); }
  if (req.method === 'POST') {
    const { products } = await body(req);
    if (!Array.isArray(products) || products.length > 100) return send(res, 400, { error: 'Ugyldig vareliste.' });
    const list = products.map(clean);
    const ids = new Set(); list.forEach((p) => { while (ids.has(p.id)) p.id += 'x'; ids.add(p.id); });
    await saveProducts(list, me.user);
    return send(res, 200, { products: list });
  }
  send(res, 405, { error: 'Ikke støttet.' });
});
