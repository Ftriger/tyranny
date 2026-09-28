// Felles hjelpefunksjoner for API-et (filer som starter med _ blir ikke egne adresser på Vercel).
// Lagring: filer i GitHub-repoet (krever GITHUB_TOKEN). Hver lagring blir en commit, og Vercel publiserer på nytt.
// Brukere lagres kryptert i data/users.enc (nøkkel fra ADMIN_PASSWORD).
const crypto = require('crypto');
const fileCatalog = require('../products.json');

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPO ||
  (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
    ? process.env.VERCEL_GIT_REPO_OWNER + '/' + process.env.VERCEL_GIT_REPO_SLUG
    : 'Ftriger/tyranny');
const BRANCH = process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || 'main';
const OWNER_PW = process.env.ADMIN_PASSWORD || '';
const SECRET = process.env.SESSION_SECRET || OWNER_PW;
const COOKIE = 'ty_s';

function err(msg, status) { return Object.assign(new Error(msg), { status }); }
function hasStorage() { return !!TOKEN; }

// ---------- GitHub ----------
async function gh(path, opt) {
  if (!TOKEN) throw err('Lagring er ikke satt opp (GITHUB_TOKEN mangler i Vercel).', 503);
  const r = await fetch('https://api.github.com/repos/' + REPO + '/contents/' + path + (opt && opt.method ? '' : '?ref=' + encodeURIComponent(BRANCH)), {
    method: (opt && opt.method) || 'GET',
    headers: {
      Authorization: 'Bearer ' + TOKEN,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'tyranny-admin',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opt && opt.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opt && opt.body ? JSON.stringify(opt.body) : undefined,
  });
  if (r.status === 404 && !(opt && opt.method)) return null;
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403) throw err('GitHub avviste nøkkelen (sjekk GITHUB_TOKEN og at den har skrivetilgang).', 502);
  if (r.status === 409) throw err('Noen andre lagret samtidig. Prøv igjen.', 409);
  if (!r.ok) throw err('GitHub-feil: ' + (d.message || r.status), 502);
  return d;
}
async function readFile(path) {
  const d = await gh(path);
  if (!d) return null;
  return { sha: d.sha, text: Buffer.from(d.content || '', 'base64').toString('utf8') };
}
async function writeFile(path, contentBuf, message, sha) {
  if (sha === null) sha = undefined; else if (sha === undefined) { const cur = await gh(path); sha = cur ? cur.sha : undefined; }
  return gh(path, { method: 'PUT', body: { message, content: contentBuf.toString('base64'), branch: BRANCH, ...(sha ? { sha } : {}) } });
}

// ---------- Varer ----------
async function getCatalog(fresh) {
  if (fresh && hasStorage()) {
    const f = await readFile('products.json');
    if (f) return JSON.parse(f.text);
  }
  return fileCatalog;
}
async function saveProducts(list, who) {
  const f = await readFile('products.json');
  const cat = f ? JSON.parse(f.text) : { currency: 'NOK', shipping: fileCatalog.shipping };
  cat.products = list;
  await writeFile('products.json', Buffer.from(JSON.stringify(cat, null, 2) + '\n'), 'Varer oppdatert av ' + who + ' (admin)', f ? f.sha : undefined);
}

// ---------- Brukere (kryptert fil) ----------
function key() { return crypto.createHash('sha256').update('tyranny-users:' + OWNER_PW).digest(); }
function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.from(JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: enc.toString('base64') }));
}
function decrypt(text) {
  const o = JSON.parse(text);
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(o.iv, 'base64'));
  d.setAuthTag(Buffer.from(o.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(o.data, 'base64')), d.final()]).toString('utf8'));
}
async function getUsers() {
  if (!hasStorage() || !OWNER_PW) return {};
  const f = await readFile('data/users.enc');
  if (!f) return {};
  try { return decrypt(f.text); } catch (e) { return {}; } // eier-passordet er byttet → brukerlisten må lages på nytt
}
async function saveUsers(u, who) {
  if (!OWNER_PW) throw err('ADMIN_PASSWORD mangler i Vercel.', 503);
  await writeFile('data/users.enc', encrypt(u), 'Brukere oppdatert av ' + who + ' (admin)');
}

// ---------- Bestillinger (kryptert fil, så ingen bestilling går tapt selv om e-posten feiler) ----------
async function readOrders() {
  if (!hasStorage() || !OWNER_PW) return { list: [], sha: undefined };
  const f = await readFile('data/orders.enc');
  if (!f) return { list: [], sha: undefined };
  try { return { list: decrypt(f.text), sha: f.sha }; } catch (e) { return { list: [], sha: f.sha }; }
}
async function updateOrders(fn, msg) {
  for (let i = 0; i < 3; i++) {
    const { list, sha } = await readOrders();
    const next = fn(list.slice());
    try { await writeFile('data/orders.enc', encrypt(next), msg || 'Bestillinger oppdatert', sha || null); return next; }
    catch (e) { if (e.status !== 409 || i === 2) throw e; }
  }
}

function hashPw(pw, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  return { salt, hash: crypto.scryptSync(String(pw), salt, 32).toString('hex') };
}
function checkPw(pw, rec) {
  const { hash } = hashPw(pw, rec.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(rec.hash, 'hex'));
}

// ---------- Økt (signert informasjonskapsel) ----------
function sign(data) { return crypto.createHmac('sha256', SECRET).update(data).digest('base64url'); }
function makeSession(user, role) {
  const payload = Buffer.from(JSON.stringify({ u: user, r: role, exp: Date.now() + 7 * 864e5 })).toString('base64url');
  return payload + '.' + sign(payload);
}
function readCookie(req) {
  const c = req.headers.cookie || '';
  const m = c.split(';').map((s) => s.trim()).find((s) => s.startsWith(COOKIE + '='));
  return m ? m.slice(COOKIE.length + 1) : '';
}
async function currentUser(req) {
  if (!SECRET) return null;
  const [payload, sig] = readCookie(req).split('.');
  if (!payload || !sig) return null;
  const good = sign(payload);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  let s; try { s = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { return null; }
  if (!s.exp || s.exp < Date.now()) return null;
  if (s.u === 'eier') return OWNER_PW ? { user: 'eier', role: 'admin' } : null;
  // Rollen ligger i den signerte informasjonskapselen; brukerlisten sjekkes ved innlogging og ved endringer.
  return { user: s.u, role: s.r === 'admin' ? 'admin' : 'butikk' };
}
function setSession(res, value, maxAge) {
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
}

// ---------- Diverse ----------
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}
function send(res, status, data) { res.status(status).json(data); }
async function guard(req, res, needAdmin) {
  const me = await currentUser(req);
  if (!me) { send(res, 401, { error: 'Du er ikke logget inn.' }); return null; }
  if (me.user !== 'eier') {
    // Sjekk at brukeren fortsatt finnes (slettede brukere mister tilgang)
    const users = await getUsers();
    if (!users[me.user]) { send(res, 401, { error: 'Brukeren finnes ikke lenger.' }); return null; }
    me.role = users[me.user].role;
  }
  if (needAdmin && me.role !== 'admin') { send(res, 403, { error: 'Bare administratorer kan gjøre dette.' }); return null; }
  return me;
}
function wrap(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (e) { send(res, e.status || 500, { error: e.message || 'Noe gikk galt.' }); }
  };
}

module.exports = { readOrders, updateOrders, REPO, BRANCH, hasStorage, writeFile, getCatalog, saveProducts, getUsers, saveUsers, hashPw, checkPw, makeSession, setSession, currentUser, body, send, guard, wrap };
