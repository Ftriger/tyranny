// Felles hjelpefunksjoner for API-et (filer som starter med _ blir ikke egne adresser på Vercel).
// Lagring: Upstash Redis (Vercel → Storage → Upstash for Redis). Innlogging: brukere lagret med scrypt-hash.
const crypto = require('crypto');
const fileCatalog = require('../products.json');

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const SECRET = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || KV_TOKEN || '';
const COOKIE = 'ty_s';

function hasKV() { return !!(KV_URL && KV_TOKEN); }

async function kv(cmd) {
  if (!hasKV()) throw Object.assign(new Error('Lagring er ikke satt opp (Upstash Redis mangler).'), { status: 503 });
  const r = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d.result;
}

// ---------- Varer ----------
async function getCatalog() {
  let products = null;
  if (hasKV()) {
    try { const raw = await kv(['GET', 'products']); if (raw) products = JSON.parse(raw); } catch (e) { /* bruk fil */ }
  }
  return { currency: 'NOK', shipping: fileCatalog.shipping, products: products || fileCatalog.products };
}
async function saveProducts(list) { await kv(['SET', 'products', JSON.stringify(list)]); }

// ---------- Brukere ----------
function hashPw(pw, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 32).toString('hex');
  return { salt, hash };
}
function checkPw(pw, rec) {
  const { hash } = hashPw(pw, rec.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(rec.hash, 'hex'));
}
async function getUsers() {
  if (!hasKV()) return {};
  const raw = await kv(['GET', 'users']);
  return raw ? JSON.parse(raw) : {};
}
async function saveUsers(u) { await kv(['SET', 'users', JSON.stringify(u)]); }

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
  const tok = readCookie(req);
  const [payload, sig] = tok.split('.');
  if (!payload || !sig) return null;
  const good = sign(payload);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  let s; try { s = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { return null; }
  if (!s.exp || s.exp < Date.now()) return null;
  if (s.u === 'eier') return process.env.ADMIN_PASSWORD ? { user: 'eier', role: 'admin' } : null;
  const users = await getUsers();
  if (!users[s.u]) return null;
  return { user: s.u, role: users[s.u].role };
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
  if (needAdmin && me.role !== 'admin') { send(res, 403, { error: 'Bare administratorer kan gjøre dette.' }); return null; }
  return me;
}
function wrap(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (e) { send(res, e.status || 500, { error: e.message || 'Noe gikk galt.' }); }
  };
}

module.exports = { kv, hasKV, getCatalog, saveProducts, getUsers, saveUsers, hashPw, checkPw, makeSession, setSession, currentUser, body, send, guard, wrap };
