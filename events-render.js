// Konsertene (events.json) → HTML, JSON-LD og tekst. Brukes både av build.js (Node) og av nettsiden (nettleseren),
// slik at siden alltid viser riktig «neste konsert», også når datoen passerer mellom to publiseringer.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TyEvents = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var FB = 'https://www.facebook.com/profile.php?id=61597088812839';
  var IG = 'https://www.instagram.com/tyranny.official/';
  var HOLD_MS = 6 * 36e5; // en konsert regnes som «kommende» til 6 timer etter start
  var L = {
    no: {
      months: ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'],
      mon3: ['JAN', 'FEB', 'MAR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DES'],
      days: ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'],
      next: 'Neste konsert', stamp: 'Neste', played: 'Spilt', soon: 'Kommer',
      more: 'Flere kommende konserter', posterOf: 'Plakat for ', cdOf: 'Nedtelling til ',
      cd: ['DAGER', 'TIMER', 'MIN', 'SEK'], at: 'kl. ', w: 'med ', W: 'Med ',
      noneLabel: 'Ingen konserter annonsert', noneTitle: 'Nye datoer kommer',
      noneText: 'Følg oss på Facebook og Instagram for nye konserter.',
      btn: { tickets: 'Billetter', info: 'Mer info', facebook: 'Se på Facebook' },
      metaPre: ' – neste er ', inw: ' i ', onw: ' ', metaPost: ' –',
      faqPre: 'Neste konsert er ', faqNone: 'Det er ingen konserter annonsert akkurat nå. Følg Tyranny på Facebook og Instagram for nye datoer.',
    },
    en: {
      months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      mon3: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      next: 'Next show', stamp: 'Next', played: 'Played', soon: 'Upcoming',
      more: 'More upcoming shows', posterOf: 'Poster for ', cdOf: 'Countdown to ',
      cd: ['DAYS', 'HRS', 'MIN', 'SEC'], at: '', w: 'with ', W: 'With ',
      noneLabel: 'No shows announced', noneTitle: 'New dates coming',
      noneText: 'Follow us on Facebook and Instagram for new shows.',
      btn: { tickets: 'Tickets', info: 'More info', facebook: 'View on Facebook' },
      metaPre: ' – next is ', inw: ' in ', onw: ' on ', metaPost: ' –',
      faqPre: 'The next show is ', faqNone: 'There are no shows announced right now. Follow Tyranny on Facebook and Instagram for new dates.',
    },
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // ---- Tid (Europe/Oslo, med sommer-/vintertid) ----
  function tzOffset(ts) {
    var o = {};
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Oslo', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
      .formatToParts(new Date(ts)).forEach(function (x) { o[x.type] = +x.value; });
    return Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute) - ts;
  }
  function osloTs(date, time) {
    var p = (date + 'T' + (time || '20:00')).split(/[-T:]/).map(Number);
    var guess = Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4]);
    var off1 = tzOffset(guess);
    return guess - tzOffset(guess - off1);
  }
  function valid(e) { return e && e.title && /^\d{4}-\d{2}-\d{2}$/.test(e.date || ''); }
  function startTs(e) { return osloTs(e.date, /^\d{2}:\d{2}$/.test(e.time || '') ? e.time : ''); }
  function idOf(e) { return e.id || (e.date + '-' + e.title); }

  function split(events, now) {
    var list = (events || []).filter(valid).map(function (e) { return { e: e, t: startTs(e) }; });
    return {
      up: list.filter(function (x) { return now < x.t + HOLD_MS; }).sort(function (a, b) { return a.t - b.t; }).map(function (x) { return x.e; }),
      past: list.filter(function (x) { return now >= x.t + HOLD_MS; }).sort(function (a, b) { return b.t - a.t; }).map(function (x) { return x.e; }),
    };
  }

  // ---- Tekst ----
  function parts(e) { var m = e.date.split('-').map(Number); return { y: m[0], m: m[1], d: m[2], wd: new Date(Date.UTC(m[0], m[1] - 1, m[2])).getUTCDay() }; }
  function dateText(e, lang) { var p = parts(e), t = L[lang]; return lang === 'en' ? p.d + ' ' + t.months[p.m - 1] + ' ' + p.y : p.d + '. ' + t.months[p.m - 1] + ' ' + p.y; }
  function weekday(e, lang) { return L[lang].days[parts(e).wd]; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function hasTime(e) { return /^\d{2}:\d{2}$/.test(e.time || ''); }
  function longDate(e, lang) { return cap(weekday(e, lang)) + ' ' + dateText(e, lang) + (hasTime(e) ? ' · ' + L[lang].at + e.time : ''); }
  function shortDate(e) { var p = parts(e); return pad(p.d) + '.' + pad(p.m) + '.' + p.y; }
  function place(e) { return [e.venue, e.city].filter(Boolean).join(', '); }
  function noteOf(e, lang) { return String(lang === 'en' ? (e.noteEn || e.note || '') : (e.note || '')).trim(); }
  function sentence(s) { s = String(s || '').trim(); return s && !/[.!?]$/.test(s) ? s + '.' : s; }
  function bare(s) { return String(s || '').replace(/[.\s]+$/, ''); }
  function href(e) { return /^https?:\/\//i.test(e.link || '') ? e.link : ''; }
  function btnLabel(e, lang) { return L[lang].btn[e.linkType] || L[lang].btn.info; }
  function lineupLc(e, lang) { return e.lineup ? L[lang].w + e.lineup : ''; }
  function lineupCap(e, lang) { return e.lineup ? L[lang].W + e.lineup + '.' : ''; }
  function ext(u) { return ' target="_blank" rel="noopener"'; }

  // ---- HTML ----
  function renderNext(e, lang) {
    var t = L[lang];
    if (!e) return '<div class="next" style="grid-template-columns:1fr"><div><span class="label">' + esc(t.noneLabel) + '</span><h3>' + esc(t.noneTitle) + '</h3><p>' + esc(t.noneText) + '</p></div></div>';
    var p = parts(e), line = [place(e), bare(noteOf(e, lang)), lineupLc(e, lang)].filter(Boolean).join(' · ');
    var ids = ['d', 'h', 'm', 's'];
    return '<div class="next"><div class="date"><strong>' + p.d + '</strong><span>' + t.mon3[p.m - 1] + ' ' + p.y + '</span></div><div>' +
      '<span class="label">' + esc(t.next) + '</span><h3>' + esc(e.title) + '</h3>' + (line ? '<p>' + esc(line) + '</p>' : '') +
      '<div class="cd" id="cd" data-ts="' + startTs(e) + '" aria-label="' + esc(t.cdOf + e.title) + '">' +
      ids.map(function (k, i) { return '<div><b id="cd-' + k + '">–</b><span>' + t.cd[i] + '</span></div>'; }).join('') +
      '</div></div></div>';
  }
  function renderPoster(e, lang) {
    if (!e || !e.image) return '';
    var t = L[lang], h = href(e), tag = h ? 'a' : 'div';
    return '<' + tag + ' class="poster"' + (h ? ' href="' + esc(h) + '"' + ext() : '') + ' aria-label="' + esc(e.title) + '">' +
      '<img src="/' + esc(String(e.image).replace(/^\//, '')) + '" alt="' + esc(t.posterOf + e.title) + '" loading="lazy">' +
      '<span class="stamp">' + esc(t.stamp) + '</span></' + tag + '>';
  }
  function rowHtml(e, chip, dyn) {
    return '<li' + (dyn ? ' data-dyn="1"' : '') + '><span class="when">' + shortDate(e) + '</span><span class="what">' + esc(e.title) +
      (place(e) ? '<small>' + esc(place(e)) + '</small>' : '') + '</span>' + chip + '</li>';
  }
  function renderMain(up, lang) {
    var t = L[lang], e = up[0];
    if (!e) {
      return '<span class="label">' + esc(t.noneLabel) + '</span><h3>' + esc(t.noneTitle) + '</h3><p>' + esc(t.noneText) + '</p>' +
        '<div><a class="btn" href="' + FB + '"' + ext() + '>Facebook</a> <a class="btn ghost" href="' + IG + '"' + ext() + '>Instagram</a></div>';
    }
    var p = [sentence(place(e)), sentence(noteOf(e, lang)), lineupCap(e, lang)].filter(Boolean).join(' ');
    var h = href(e);
    var more = up.slice(1).map(function (x) {
      var hx = href(x);
      var chip = hx ? '<a class="chip win" href="' + esc(hx) + '"' + ext() + '>' + esc(btnLabel(x, lang)) + '</a>' : '<span class="chip win">' + esc(t.soon) + '</span>';
      return rowHtml(x, chip, false);
    }).join('');
    return '<span class="label">' + esc(longDate(e, lang)) + '</span><h3>' + esc(e.title) + '</h3>' + (p ? '<p>' + esc(p) + '</p>' : '') +
      (h ? '<div><a class="btn" href="' + esc(h) + '"' + ext() + '>' + esc(btnLabel(e, lang)) + '</a></div>' : '') +
      (more ? '<ul class="past" aria-label="' + esc(t.more) + '">' + more + '</ul>' : '');
  }
  function renderPast(past, lang) {
    return past.map(function (e) { return rowHtml(e, '<span class="chip">' + esc(L[lang].played) + '</span>', true); }).join('');
  }

  // ---- JSON-LD og tekster ----
  function offsetStr(ts) { var m = Math.round(tzOffset(ts) / 6e4), s = m < 0 ? '-' : '+'; m = Math.abs(m); return s + pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function ldEvents(events, lang, site) {
    var split_ = split(events, Date.now());
    return split_.up.concat(split_.past).map(function (e) {
      var o = {
        '@type': 'MusicEvent',
        name: (lang === 'en' ? 'Tyranny at ' : 'Tyranny på ') + e.title,
        startDate: hasTime(e) ? e.date + 'T' + e.time + ':00' + offsetStr(startTs(e)) : e.date,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: { '@type': 'Place', name: e.venue || e.city || 'Norge', address: { '@type': 'PostalAddress', addressLocality: e.city || undefined, addressCountry: 'NO' } },
        performer: [{ '@id': site + '/#band' }].concat(String(e.lineup || '').split(',').map(function (n) { return n.trim(); }).filter(Boolean).map(function (n) { return { '@type': 'MusicGroup', name: n }; })),
      };
      if (e.image) o.image = site + '/' + String(e.image).replace(/^\//, '');
      if (noteOf(e, lang)) o.description = noteOf(e, lang);
      if (e.free) { o.isAccessibleForFree = true; o.offers = { '@type': 'Offer', price: '0', priceCurrency: 'NOK', url: href(e) || site + '/#live', availability: 'https://schema.org/InStock' }; }
      else if (href(e)) o.offers = { '@type': 'Offer', url: href(e), availability: 'https://schema.org/InStock' };
      return o;
    });
  }
  function faqText(e, lang) {
    var t = L[lang];
    if (!e) return t.faqNone;
    return t.faqPre + e.title + (place(e) ? ' – ' + place(e) : '') + ', ' + weekday(e, lang) + ' ' + dateText(e, lang) + '.' + (noteOf(e, lang) ? ' ' + sentence(noteOf(e, lang)) : '');
  }
  function faqHtml(e, lang) {
    var h = e ? href(e) : '', txt = faqText(e, lang);
    if (e && h) return esc(txt) + ' <a href="' + esc(h) + '"' + ext() + '>' + esc(btnLabel(e, lang)) + '</a>.';
    if (!e) return esc(txt);
    return esc(txt);
  }
  function metaNext(e, lang) {
    if (!e) return '';
    var t = L[lang];
    return t.metaPre + e.title + (e.city ? t.inw + e.city : '') + t.onw + dateText(e, lang) + t.metaPost;
  }
  function enSentence(e) {
    if (!e) return 'Follow us on Facebook and Instagram for new dates.';
    var n = bare(noteOf(e, 'en'));
    return 'Next show: ' + e.title + (place(e) ? ', ' + place(e) : '') + ', ' + dateText(e, 'en') + (n ? ' (' + n.charAt(0).toLowerCase() + n.slice(1) + ')' : '') + '.';
  }
  function llmsLines(up) {
    if (!up.length) return '- Ingen konserter er annonsert akkurat nå. Følg Tyranny på Facebook (' + FB + ') og Instagram (' + IG + ').';
    return up.map(function (e) {
      return '- ' + e.title + (place(e) ? ', ' + place(e) : '') + ' – ' + longDate(e, 'no').toLowerCase().replace(/^./, function (c) { return c; }) + '.' +
        (noteOf(e, 'no') ? ' ' + sentence(noteOf(e, 'no')) : '') + (e.lineup ? ' ' + lineupCap(e, 'no') : '') + (href(e) ? ' Info: ' + href(e) : '');
    }).join('\n');
  }
  function marquee(e) { if (!e) return ''; var p = parts(e); return esc(e.title) + ' ' + pad(p.d) + '.' + pad(p.m) + '<i>✠</i>'; }

  function renderAll(events, lang, now, site) {
    lang = lang === 'en' ? 'en' : 'no';
    var s = split(events, now), e = s.up[0];
    return {
      sig: s.up.map(idOf).join(','),
      next: renderNext(e, lang), poster: renderPoster(e, lang), main: renderMain(s.up, lang), past: renderPast(s.past, lang),
      marq: marquee(e), meta: metaNext(e, lang), faqText: faqText(e, lang), faqHtml: faqHtml(e, lang),
      enSentence: enSentence(e), llms: llmsLines(s.up), up: s.up, past_: s.past,
      ld: site ? ldEvents(events, lang, site) : [],
    };
  }
  return { renderAll: renderAll, split: split, valid: valid, startTs: startTs, osloTs: osloTs, enSentence: enSentence, llmsLines: llmsLines };
});
