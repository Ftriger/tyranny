// Bestillinger i admin + test av e-post
const { readOrders, updateOrders, guard, body, send, wrap } = require('../_lib');
const STATUSES = ['ny', 'betalt', 'sendt', 'hentet', 'kansellert'];

module.exports = wrap(async (req, res) => {
  const me = await guard(req, res, false); if (!me) return;
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const { list } = await readOrders();
    return send(res, 200, { orders: list, mail: { smtp: !!(process.env.SMTP_HOST && process.env.SMTP_PASS), host: process.env.SMTP_HOST || null, to: process.env.ORDER_EMAIL || 'shop@tyranny.no' } });
  }

  const b = await body(req);

  // Test av e-post (SMTP)
  if (req.method === 'POST' && b.action === 'mailtest') {
    const host = process.env.SMTP_HOST, pass = process.env.SMTP_PASS;
    const user = process.env.SMTP_USER || process.env.ORDER_EMAIL || 'shop@tyranny.no';
    const to = process.env.ORDER_EMAIL || 'shop@tyranny.no';
    if (!host || !pass) return send(res, 200, { ok: false, message: 'SMTP er ikke satt opp i Vercel (SMTP_HOST og SMTP_PASS mangler). Bestillinger sendes da via FormSubmit, som ofte havner i spam.' });
    const port = Number(process.env.SMTP_PORT || 587);
    const nodemailer = require('nodemailer');
    const t = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    try {
      await t.verify();
      await t.sendMail({ from: `"Tyranny nettbutikk" <${user}>`, to, subject: 'Testmail fra tyranny.no', text: `Dette er en test sendt fra admin av ${me.user}. Kommer denne fram, virker bestillingsmailene.` });
      return send(res, 200, { ok: true, message: `Testmail sendt til ${to} via ${host}:${port}. Sjekk innboksen (og søppelpost).` });
    } catch (e) {
      return send(res, 200, { ok: false, message: `E-posten feilet (${host}:${port}, bruker ${user}): ${e && e.message}` });
    }
  }

  // Endre status
  if (req.method === 'POST') {
    const status = STATUSES.includes(b.status) ? b.status : null;
    if (!b.order || !status) return send(res, 400, { error: 'Ugyldig forespørsel.' });
    const list = await updateOrders((l) => l.map((o) => (o.order === b.order ? { ...o, status, updated: new Date().toISOString(), by: me.user } : o)), 'Bestilling ' + b.order + ' → ' + status);
    return send(res, 200, { orders: list });
  }

  // Slett
  if (req.method === 'DELETE') {
    const id = String(req.query.order || '');
    const list = await updateOrders((l) => l.filter((o) => o.order !== id), 'Bestilling slettet');
    return send(res, 200, { orders: list });
  }
  send(res, 405, { error: 'Ikke støttet.' });
});
