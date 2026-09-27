// Last opp produktbilde (ferdig nedskalert JPEG fra admin-siden) til img/uploads/ i GitHub-repoet
const crypto = require('crypto');
const { writeFile, REPO, BRANCH, guard, body, send, wrap } = require('../_lib');
module.exports = wrap(async (req, res) => {
  const me = await guard(req, res, false); if (!me) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'Bruk POST.' });
  const { data } = await body(req);
  const m = typeof data === 'string' && /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(data);
  if (!m) return send(res, 400, { error: 'Ugyldig bilde.' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 1200000) return send(res, 413, { error: 'Bildet er for stort.' });
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const path = 'img/uploads/' + Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex') + '.' + ext;
  await writeFile(path, buf, 'Bilde lastet opp av ' + me.user + ' (admin)');
  send(res, 200, { url: path, preview: 'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/' + path });
});
