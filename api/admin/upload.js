// Last opp produktbilde (sendes som ferdig nedskalert JPEG fra admin-siden)
const crypto = require('crypto');
const { kv, guard, body, send, wrap } = require('../_lib');
module.exports = wrap(async (req, res) => {
  const me = await guard(req, res, false); if (!me) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'Bruk POST.' });
  const { data } = await body(req);
  if (typeof data !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(data)) return send(res, 400, { error: 'Ugyldig bilde.' });
  if (data.length > 1500000) return send(res, 413, { error: 'Bildet er for stort.' });
  const id = crypto.randomBytes(8).toString('hex');
  await kv(['SET', 'img:' + id, data]);
  send(res, 200, { url: '/api/img?id=' + id });
});
