// Brukeradministrasjon (bare administratorer)
const { getUsers, saveUsers, hashPw, guard, body, send, wrap } = require('../_lib');
module.exports = wrap(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  // Alle innloggede kan bytte sitt eget passord
  if (req.method === 'PUT') {
    const me = await guard(req, res, false); if (!me) return;
    if (me.user === 'eier') return send(res, 400, { error: 'Eier-passordet endres i Vercel (ADMIN_PASSWORD).' });
    const { password } = await body(req);
    if (String(password || '').length < 8) return send(res, 400, { error: 'Passordet må ha minst 8 tegn.' });
    const users = await getUsers();
    users[me.user] = { ...users[me.user], ...hashPw(password) };
    await saveUsers(users, me.user);
    return send(res, 200, { ok: true });
  }
  const me = await guard(req, res, true); if (!me) return;
  const users = await getUsers();
  if (req.method === 'GET') {
    return send(res, 200, { users: Object.keys(users).sort().map((u) => ({ username: u, role: users[u].role, created: users[u].created })) });
  }
  if (req.method === 'POST') {
    const { username, password, role } = await body(req);
    const u = String(username || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(u)) return send(res, 400, { error: 'Brukernavn: 3–30 tegn, bare a–z, tall, punktum, bindestrek.' });
    if (u === 'eier') return send(res, 400, { error: '«eier» er reservert.' });
    if (String(password || '').length < 8) return send(res, 400, { error: 'Passordet må ha minst 8 tegn.' });
    const r = role === 'admin' ? 'admin' : 'butikk';
    users[u] = { role: r, created: users[u] ? users[u].created : new Date().toISOString(), ...hashPw(password) };
    await saveUsers(users, me.user);
    return send(res, 200, { ok: true });
  }
  if (req.method === 'DELETE') {
    const u = String(req.query.u || '').toLowerCase();
    if (u === me.user) return send(res, 400, { error: 'Du kan ikke slette deg selv.' });
    if (!users[u]) return send(res, 404, { error: 'Fant ikke brukeren.' });
    delete users[u];
    await saveUsers(users, me.user);
    return send(res, 200, { ok: true });
  }
  send(res, 405, { error: 'Ikke støttet.' });
});
