// Les og lagre hele konsertlisten (krever innlogging). Hver lagring blir en commit av events.json, og siden bygges på nytt.
const { getEvents, saveEvents, guard, body, send, wrap } = require('../_lib');
const TYPES = ['tickets', 'info', 'facebook'];
function bad(msg) { return Object.assign(new Error(msg), { status: 400 }); }
function clean(e, i) {
  const title = String(e.title || '').trim().slice(0, 80);
  if (!title) throw bad(`Konsert ${i + 1} mangler tittel.`);
  const date = String(e.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) throw bad(`«${title}» har ugyldig dato.`);
  const time = String(e.time || '').trim();
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw bad(`«${title}» har ugyldig klokkeslett.`);
  const link = String(e.link || '').trim().slice(0, 300);
  if (link && !/^https?:\/\/[^\s]+$/i.test(link)) throw bad(`«${title}»: lenken må starte med https://`);
  const image = String(e.image || '').trim();
  if (image && !/^img\/[a-z0-9._\/-]+$/i.test(image)) throw bad(`«${title}» har ugyldig plakat.`);
  const id = String(e.id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 50) || ('k' + Date.now().toString(36) + i);
  return {
    id, title, date, time,
    venue: String(e.venue || '').trim().slice(0, 80),
    city: String(e.city || '').trim().slice(0, 60),
    lineup: String(e.lineup || '').trim().slice(0, 200),
    note: String(e.note || '').trim().slice(0, 200),
    noteEn: String(e.noteEn || '').trim().slice(0, 200),
    free: e.free === true,
    link,
    linkType: TYPES.includes(e.linkType) ? e.linkType : 'info',
    image,
  };
}
module.exports = wrap(async (req, res) => {
  const me = await guard(req, res, false); if (!me) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return send(res, 200, { events: await getEvents(true) });
  if (req.method === 'POST') {
    const { events } = await body(req);
    if (!Array.isArray(events) || events.length > 300) return send(res, 400, { error: 'Ugyldig konsertliste.' });
    const list = events.map(clean);
    const ids = new Set(); list.forEach((e) => { while (ids.has(e.id)) e.id += 'x'; ids.add(e.id); });
    await saveEvents(list, me.user);
    return send(res, 200, { events: list });
  }
  send(res, 405, { error: 'Ikke støttet.' });
});
