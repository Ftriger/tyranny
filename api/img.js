// Viser et produktbilde lastet opp fra admin
const { kv, wrap } = require('./_lib');
module.exports = wrap(async (req, res) => {
  const id = String(req.query.id || '').replace(/[^a-z0-9]/gi, '');
  if (!id) return res.status(400).end();
  const data = await kv(['GET', 'img:' + id]);
  if (!data) return res.status(404).end();
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(data);
  if (!m) return res.status(500).end();
  res.setHeader('Content-Type', m[1]);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.status(200).send(Buffer.from(m[2], 'base64'));
});
