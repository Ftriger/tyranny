const { currentUser, hasStorage, REPO, BRANCH, send, wrap } = require('../_lib');
module.exports = wrap(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const me = await currentUser(req);
  send(res, 200, { me, storage: hasStorage(), ownerLogin: !!process.env.ADMIN_PASSWORD, raw: 'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/' });
});
