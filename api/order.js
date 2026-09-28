// Kontrollerer bestillingen (priser fra varelisten) og lager e-posten som sendes til butikken via FormSubmit.
// Første bestilling utløser en aktiveringsmail til shop-adressen som må bekreftes én gang.
const crypto = require('crypto');
const { getCatalog, updateOrders, hasStorage, body, send, wrap } = require('./_lib');
const SMTP = { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), user: process.env.SMTP_USER || process.env.ORDER_EMAIL || 'shop@tyranny.no', pass: process.env.SMTP_PASS };
function esc(t) { return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const TO = process.env.ORDER_EMAIL || 'shop@tyranny.no';

function s(v, max) { return String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim().slice(0, max || 120); }
const kr = (n) => n.toLocaleString('nb-NO') + ' kr';

module.exports = wrap(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Bruk POST.' });
  const b = await body(req);
  if (b.website) return send(res, 200, { ok: true, order: 'TY-0' }); // skjult felt fylt ut = robot

  const EN = b.lang === 'en';
  const t = (no, en) => (EN ? en : no);
  const c = b.customer || {};
  const cust = { name: s(c.name, 80), email: s(c.email, 120), phone: s(c.phone, 30), address: s(c.address, 120), zip: s(c.zip, 10), city: s(c.city, 60), note: String(c.note || '').trim().slice(0, 600) };
  const pickup = b.delivery === 'pickup';
  if (!cust.name) return send(res, 400, { error: t('Skriv navnet ditt.', 'Please enter your name.') });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cust.email)) return send(res, 400, { error: t('Skriv en gyldig e-postadresse.', 'Please enter a valid email address.') });
  if (cust.phone.replace(/\D/g, '').length < 8) return send(res, 400, { error: t('Skriv et gyldig telefonnummer.', 'Please enter a valid phone number.') });
  if (!pickup && (!cust.address || !cust.zip || !cust.city)) return send(res, 400, { error: t('Skriv adresse, postnummer og sted.', 'Please enter your address, postcode and city.') });

  const catalog = await getCatalog();
  const items = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
  if (!items.length) return send(res, 400, { error: t('Handlekurven er tom.', 'Your cart is empty.') });
  const lines = []; let sum = 0; let anyPre = false;
  for (const it of items) {
    const p = catalog.products.find((x) => x.id === it.id && x.active !== false);
    if (!p) return send(res, 400, { error: t('En av varene finnes ikke lenger. Tøm kurven og prøv igjen.', 'One of the items is no longer available. Empty your cart and try again.') });
    const qty = Math.max(1, Math.min(10, parseInt(it.qty, 10) || 1));
    const size = p.sizes && p.sizes.length ? s(it.size, 8) : '';
    if (p.sizes && p.sizes.length && !p.sizes.includes(size)) return send(res, 400, { error: t('Velg størrelse for ', 'Choose a size for ') + p.name + '.' });
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
    _autoresponse: EN
      ? `Thanks for your order from Tyranny! Order number: ${order}. Total: ${total} NOK. We will send you payment details as soon as possible.${anyPre ? ' Note: some items are pre-ordered and ship with the next print run.' : ''} – Tyranny`
      : `Takk for bestillingen hos Tyranny! Ordrenummer: ${order}. Totalt: ${kr(total)}. Vi tar kontakt med betalingsinformasjon så snart som mulig.${anyPre ? ' Merk: noen varer er forhåndsbestilt og sendes ved neste produksjon.' : ''} – Tyranny`,
    Språk: EN ? 'Engelsk (kunden skrev på engelsk – svar på engelsk)' : 'Norsk',
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

  // 0) Lagre bestillingen i admin først (kryptert i GitHub) – da går den aldri tapt
  let saved = false;
  if (hasStorage() && process.env.ADMIN_PASSWORD) {
    try {
      await updateOrders((list) => [{ order, date: d.toISOString(), status: 'ny', lang: EN ? 'en' : 'no', customer: cust, pickup, lines, sum, ship, total, preorder: anyPre }].concat(list).slice(0, 2000), 'Ny bestilling');
      saved = true;
    } catch (e) { console.error('Lagring av bestilling feilet', e && e.message); }
  }

  // 1) Egen e-postkonto (SMTP) – anbefalt, havner ikke i spam
  if (SMTP.host && SMTP.pass) {
    const nodemailer = require('nodemailer');
    const t = nodemailer.createTransport({ host: SMTP.host, port: SMTP.port, secure: SMTP.port === 465, auth: { user: SMTP.user, pass: SMTP.pass } });
    const rows = Object.entries(payload).filter(([k]) => !k.startsWith('_'));
    const text = rows.map(([k, v]) => `${k === 'email' ? 'E-post' : k}: ${v}`).join('\n');
    const html = '<h2 style="font-family:Arial">Ny bestilling ' + esc(order) + '</h2><table style="font-family:Arial;border-collapse:collapse">' +
      rows.map(([k, v]) => '<tr><td style="padding:6px 12px;border-bottom:1px solid #ddd;color:#666;vertical-align:top">' + esc(k === 'email' ? 'E-post' : k) + '</td><td style="padding:6px 12px;border-bottom:1px solid #ddd;white-space:pre-line">' + esc(v) + '</td></tr>').join('') + '</table>';
    try {
      await t.sendMail({ from: `"Tyranny nettbutikk" <${SMTP.user}>`, to: TO, replyTo: `"${cust.name}" <${cust.email}>`, subject: payload._subject, text, html });
    } catch (e) {
      console.error('SMTP', e && e.message);
      if (saved) return send(res, 200, { ok: true, order, total, sent: true });
      return send(res, 502, { error: t('Bestillingen kunne ikke sendes akkurat nå. Prøv igjen, eller send DM på Instagram.', 'Your order could not be sent right now. Please try again, or send us a DM on Instagram.') });
    }
    // Bekreftelse til kunden (feiler stille – butikken har uansett fått bestillingen)
    try {
      await t.sendMail({ from: `"Tyranny" <${SMTP.user}>`, to: cust.email, replyTo: TO, subject: EN ? `Thanks for your order – ${order}` : `Takk for bestillingen – ${order}`,
        text: EN
          ? `Hi ${cust.name}!\n\n${payload._autoresponse}\n\n${payload.Varer}\nDelivery: ${payload.Levering}\nTotal: ${total} NOK\n\nQuestions? Just reply to this email.`
          : `Hei ${cust.name}!\n\n${payload._autoresponse}\n\n${payload.Varer}\nLevering: ${payload.Levering}\nTotalt: ${payload.Totalt}\n\nSpørsmål? Svar på denne e-posten.` });
    } catch (e) { console.error('SMTP kunde', e && e.message); }
    return send(res, 200, { ok: true, order, total, sent: true });
  }
  // 2) Reserve: e-posten sendes fra kundens nettleser via FormSubmit
  send(res, 200, { ok: true, order, total, to: TO, payload, saved });
});
