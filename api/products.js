// Offentlig vareliste (bare aktive varer)
const { getCatalog, wrap } = require('./_lib');
module.exports = wrap(async (req, res) => {
  const c = await getCatalog();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ currency: c.currency, shipping: c.shipping, products: c.products.filter((p) => p.active !== false) });
});
