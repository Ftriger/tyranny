// Vercel serverless-funksjon: lager en Stripe Checkout-betaling.
// Krever miljøvariabelen STRIPE_SECRET_KEY i Vercel (Settings → Environment Variables).
// Prisene hentes alltid fra products.json her på serveren, aldri fra nettleseren.
const { getCatalog } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Bruk POST.' });
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return res.status(503).json({ error: 'not_configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const items = Array.isArray(body && body.items) ? body.items : [];
  if (!items.length || items.length > 30) {
    return res.status(400).json({ error: 'Handlekurven er tom.' });
  }

  const catalog = await getCatalog();
  const params = new URLSearchParams();
  let i = 0;
  for (const item of items) {
    const p = catalog.products.find((x) => x.id === item.id && x.active !== false);
    const qty = Math.max(1, Math.min(10, parseInt(item.qty, 10) || 1));
    if (!p) return res.status(400).json({ error: 'Ukjent vare: ' + item.id });
    let name = p.name;
    if (p.sizes && p.sizes.length) {
      if (!p.sizes.includes(item.size)) return res.status(400).json({ error: 'Velg størrelse for ' + p.name });
      name += ' (' + item.size + ')';
    }
    if (p.inStock === false || (p.outSizes || []).includes(item.size)) name += ' – forhåndsbestilling, sendes ved neste produksjon';
    params.append(`line_items[${i}][price_data][currency]`, 'nok');
    params.append(`line_items[${i}][price_data][unit_amount]`, String(p.price * 100));
    params.append(`line_items[${i}][price_data][product_data][name]`, name);
    params.append(`line_items[${i}][quantity]`, String(qty));
    i++;
  }

  const origin = req.headers.origin || `https://${req.headers.host}`;
  params.append('mode', 'payment');
  params.append('locale', 'nb');
  params.append('success_url', `${origin}/?kjop=ok#merch`);
  params.append('cancel_url', `${origin}/#merch`);
  params.append('phone_number_collection[enabled]', 'true');
  ['NO', 'SE', 'DK', 'FI'].forEach((c, n) =>
    params.append(`shipping_address_collection[allowed_countries][${n}]`, c)
  );
  params.append('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
  params.append('shipping_options[0][shipping_rate_data][display_name]', catalog.shipping.name);
  params.append('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(catalog.shipping.price * 100));
  params.append('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'nok');

  try {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: (data.error && data.error.message) || 'Stripe-feil' });
    return res.status(200).json({ url: data.url });
  } catch (e) {
    return res.status(502).json({ error: 'Fikk ikke kontakt med betalingsløsningen.' });
  }
};
