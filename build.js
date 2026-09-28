// Kjøres av Vercel ved hver publisering. Resultatet legges i mappen public/ som Vercel viser (også når admin lagrer varer).
// Skriver varene rett inn i index.html (synlig for Google/AI uten JavaScript), lager Product-schema,
// sitemap.xml og setter riktig adresse (SITE_URL, f.eks. https://tyranny.no).
const fs = require('fs');
const path = require('path');
const OUT = 'public';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
for (const f of ['admin.html', 'products.json']) fs.copyFileSync(f, path.join(OUT, f));
fs.cpSync('img', path.join(OUT, 'img'), { recursive: true });
const SITE = (process.env.SITE_URL || 'https://tyranny-five.vercel.app').replace(/\/$/, '');
const OLD = 'https://tyranny-five.vercel.app';
const cat = JSON.parse(fs.readFileSync('products.json', 'utf8'));
const products = cat.products.filter((p) => p.active !== false);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kr = (n, en) => en ? n.toLocaleString('en-GB') + ' NOK' : n.toLocaleString('nb-NO') + ' kr';
const TAG_EN = { Ny: 'New', Bestselger: 'Bestseller', Begrenset: 'Limited', Utsolgt: 'Sold out', Tilbud: 'Sale' };
const abs = (u) => SITE + '/' + String(u).replace(/^\//, '');

// Statiske varekort (JavaScript bytter dem ut med interaktive kort)
const cardsFor = (en) => products.map((p) => {
  const src = p.images && p.images[0] ? (/^(\/|https?:)/.test(p.images[0]) ? p.images[0] : '/' + p.images[0]) : '';
  const img = src ? `<img src="${esc(src)}" alt="${esc(p.name)}" loading="lazy">` : '';
  return `<article class="item"><div class="pic">${img}</div><div class="row"><h3>${esc(p.name)}</h3><span class="price">${kr(p.price, en)}</span></div><p class="desc">${esc(p.desc || '')}</p></article>`;
}).join('');
const cards = cardsFor(false);

const ld = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Tyranny – offisiell merch',
  itemListElement: products.map((p, i) => ({
    '@type': 'ListItem', position: i + 1,
    item: {
      '@type': 'Product', name: 'Tyranny ' + p.name, sku: p.id, description: p.desc || '',
      image: (p.images || []).map(abs), brand: { '@type': 'Brand', name: 'Tyranny' },
      ...(p.sizes && p.sizes.length ? { size: p.sizes.join(', ') } : {}),
      offers: {
        '@type': 'Offer', price: String(p.price), priceCurrency: 'NOK', url: SITE + '/#merch',
        availability: p.inStock === false ? 'https://schema.org/PreOrder' : 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition', seller: { '@type': 'MusicGroup', name: 'Tyranny' },
        shippingDetails: { '@type': 'OfferShippingDetails', shippingRate: { '@type': 'MonetaryAmount', value: String(cat.shipping.price), currency: 'NOK' }, shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'NO' } },
      },
    },
  })),
};

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<!--PRODUCTS-->[\s\S]*?<!--\/PRODUCTS-->/, `<!--PRODUCTS-->${cards}<!--/PRODUCTS-->`);
html = html.replace(/<script type="application\/ld\+json" id="ld-products">[\s\S]*?<\/script>/, `<script type="application/ld+json" id="ld-products">${JSON.stringify(ld)}</script>`);
html = html.replace(/  var FALLBACK = .*;\n/, '  var FALLBACK = ' + JSON.stringify({ shipping: cat.shipping, products: cat.products }) + ';\n');
if (SITE !== OLD) html = html.split(OLD).join(SITE);
fs.writeFileSync(path.join(OUT, 'index.html'), html);

// Engelsk versjon på /en/
let en = html;
const missing = [];
for (const [no, eng] of require('./i18n-en.js')) {
  const a = no.split('SITE').join(SITE), b = eng.split('SITE').join(SITE);
  if (!en.includes(a)) { missing.push(a.slice(0, 70)); continue; }
  en = en.split(a).join(b);
}
en = en.replace(/<!--PRODUCTS-->[\s\S]*?<!--\/PRODUCTS-->/, `<!--PRODUCTS-->${cardsFor(true)}<!--/PRODUCTS-->`);
fs.mkdirSync(path.join(OUT, 'en'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'en', 'index.html'), en);
if (missing.length) console.warn('Engelsk: fant ikke disse norske tekstene (oppdater i18n-en.js):\n - ' + missing.join('\n - '));

const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url><loc>${SITE}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="no" href="${SITE}/"/><xhtml:link rel="alternate" hreflang="en" href="${SITE}/en/"/>
${products.flatMap((p) => p.images || []).concat(['img/live-midgardsblot-1.jpg', 'img/plakat-spetakkel.jpg']).map((u) => `    <image:image><image:loc>${esc(abs(u))}</image:loc></image:image>`).join('\n')}
  </url>
  <url><loc>${SITE}/en/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority>
    <xhtml:link rel="alternate" hreflang="no" href="${SITE}/"/><xhtml:link rel="alternate" hreflang="en" href="${SITE}/en/"/></url>
  <url><loc>${SITE}/llms.txt</loc><lastmod>${today}</lastmod></url>
</urlset>
`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

# AI-søk og -assistenter er velkomne
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-User
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /

Sitemap: ${SITE}/sitemap.xml
`);
let llms = fs.readFileSync('llms.txt', 'utf8');
llms = llms.replace(/## Merch[\s\S]*?(?=\n## )/, '## Merch\n' + products.map((p) => `- ${p.name}: ${kr(p.price)}${p.inStock === false ? ' (forhåndsbestilling)' : ''}`).join('\n') + `\n- Frakt i Norge: ${kr(cat.shipping.price)}, eller hent på konsert\n- Bestilling: ${SITE}/#merch\n`);
if (SITE !== OLD) llms = llms.split(OLD).join(SITE);
fs.writeFileSync(path.join(OUT, 'llms.txt'), llms);
console.log('Bygget for', SITE, '–', products.length, 'varer');
