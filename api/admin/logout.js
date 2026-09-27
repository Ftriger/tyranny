const { setSession, send } = require('../_lib');
module.exports = (req, res) => { setSession(res, '', 0); send(res, 200, { ok: true }); };
