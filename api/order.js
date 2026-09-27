// Tar imot bestilling fra nettbutikken og sender den på e-post til butikken (via FormSubmit – gratis, ingen konto).
// Første bestilling utløser en aktiveringsmail til shop-adressen som må bekreftes én gang.
const crypto = require('crypto');
const { getCatalog, body, send, wrap } = require('./_lib');
const TO = process.env.ORDER_EMAIL || 'shop@tyranny.no';

function s(v, max) { return String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim().slice(0, max || 120); }
const kr = (n) => n.toLocaleString('nb-NO') + ' kr';

module.exports = wrap(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Bruk POST.' });
  const b = await body(req);
  if (b.website) return send(res, 200, { ok: true, order: 'TY-0' }); // skjult felt fylt ut = robot

  const c = b.customer || {};
  const cust = { name: s(c.name, 80), email: s(c.email, 120), phone: s(c.phone, 30), address: s(c.address, 120), zip: s(c.zip, 10), city: s(c.city, 60), note: String(c.note || '').trim().slice(0, 600) };
  const pickup = b.delivery === 'pickup';
  if (!cust.name) return send(res, 400, { error: 'Skriv navnet ditt.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cust.email)) return send(res, 400, { error: 'Skriv en gyldig e-postadresse.' });
  if (cust.phone.replace(/\D/g, '').length < 8) return send(res, 400, { error: 'Skriv et gyldig telefonnummer.' });
  if (!pickup && (!cust.address || !cust.zip || !cust.city)) return send(res, 400, { error: 'Skriv adresse, postnummer og sted.' });

  const catalog = await getCatalog();
  const items = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
  if (!items.length) return send(res, 400, { error: 'Handlekurven er tom.' });
  const lines = []; let sum = 0; let anyPre = false;
  for (const it of items) {
    const p = catalog.products.find((x) => x.id === it.id && x.active !== false);
    if (!p) return send(res, 400, { error: 'En av varene finnes ikke lenger. Tøm kurven og prøv igjen.' });
    const qty = Math.max(1, Math.min(10, parseInt(it.qty, 10) || 1));
    const size = p.sizes && p.sizes.length ? s(it.size, 8) : '';
    if (p.sizes && p.sizes.length && !p.sizes.includes(size)) return send(res, 400, { error: 'Velg størrelse for ' + p.name + '.' });
    const pre = p.inStock === false || (p.outSizes || []).includes(size);
    anyPre = anyPre || pre;
    sum += p.price * qty;
    lines.push(`${qty} × ${p.name}${size ? ' (str. ' + size + ')' : ''} – ${kr(p.price * qty)}${pre ? '  [FORHÅNDSBESTILLING]' : ''}`);
  }
  const ship = pickup ? 0 : catalog.shipping.price;
  const total = sum + ship;
  const d = new Date();
  const order = 'TY-' + d.toISOString().slice(2, 10).replace(/-/g, '') + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

  const payload = {
    _subject: `Ny bestilling ${order} – ${kr(total)} – ${cust.name}`,
    _template: 'box',
    _captcha: 'false',
    _replyto: cust.email,
    _autoresponse: `Takk for bestillingen hos Tyranny! Ordrenummer: ${order}. Totalt: ${kr(total)}. Vi tar kontakt med betalingsinformasjon så snart som mulig.${anyPre ? ' Merk: noen varer er forhåndsbestilt og sendes ved neste produksjon.' : ''} – Tyranny`,
    Ordrenummer: order,
    Varer: lines.join('\n'),
    Varesum: kr(sum),
    Levering: pickup ? 'Hentes på konsert (0 kr)' : `${catalog.shipping.name} (${kr(ship)})`,
    Totalt: kr(total),
    Navn: cust.name,
    email: cust.email,
    Telefon: cust.phone,
    Adresse: pickup ? '–' : `${cust.address}, ${cust.zip} ${cust.city}`,
    Merknad: cust.note || '–',
    Forhåndsbestilling: anyPre ? 'JA – noen varer sendes ved neste produksjon' : 'Nei',
  };

  const origin = req.headers.origin || `https://${req.headers.host}`;
  const r = await fetch('https://formsubmit.co/ajax/' + TO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: origin, Referer: origin + '/' },
    body: JSON.stringify(payload),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok || String(out.success) !== 'true') {
    console.error('FormSubmit', r.status, out);
    if (/activat/i.test(String(out.message || ''))) return send(res, 503, { error: 'Bestilling er ikke aktivert ennå (butikken må bekrefte e-posten sin). Prøv igjen litt senere, eller send DM på Instagram.' });
    return send(res, 502, { error: 'Bestillingen kunne ikke sendes akkurat nå. Prøv igjen, eller send DM på Instagram.' });
  }
  send(res, 200, { ok: true, order, total });
});
