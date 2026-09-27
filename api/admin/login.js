const { getUsers, checkPw, makeSession, setSession, body, send, wrap } = require('../_lib');
const crypto = require('crypto');
module.exports = wrap(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Bruk POST.' });
  const { username, password } = await body(req);
  const u = String(username || '').trim().toLowerCase();
  const pw = String(password || '');
  if (!u || !pw) return send(res, 400, { error: 'Skriv brukernavn og passord.' });
  // Eier-innlogging fra miljøvariabelen ADMIN_PASSWORD (brukes første gang og som reserve)
  const owner = process.env.ADMIN_PASSWORD;
  if (u === 'eier' && owner) {
    const a = Buffer.from(crypto.createHash('sha256').update(pw).digest('hex'));
    const b = Buffer.from(crypto.createHash('sha256').update(owner).digest('hex'));
    if (crypto.timingSafeEqual(a, b)) { setSession(res, makeSession('eier', 'admin'), 7 * 86400); return send(res, 200, { user: 'eier', role: 'admin' }); }
  }
  const users = await getUsers();
  const rec = users[u];
  if (rec && checkPw(pw, rec)) {
    setSession(res, makeSession(u, rec.role), 7 * 86400);
    return send(res, 200, { user: u, role: rec.role });
  }
  await new Promise((r) => setTimeout(r, 600));
  send(res, 401, { error: 'Feil brukernavn eller passord.' });
});
