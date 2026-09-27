const { currentUser, hasKV, send, wrap } = require('../_lib');
module.exports = wrap(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const me = await currentUser(req);
  send(res, 200, { me, storage: hasKV(), ownerLogin: !!process.env.ADMIN_PASSWORD });
});
