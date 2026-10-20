/** End-to-end verification of a built site served by scripts/serve.mjs. */
const base = process.env.BASE || 'http://127.0.0.1:4174';
let failures = 0;

function check(label, ok, detail = '') {
  if (ok) console.log(`✔ ${label}`);
  else {
    failures += 1;
    console.log(`✖ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

for (const path of ['/', '/en/', '/pricing/', '/en/pricing/', '/privacy/', '/terms/', '/contact/', '/network/', '/en/network/', '/assets/styles.css', '/assets/theme.js', '/sitemap.xml', '/robots.txt', '/_routes.json']) {
  const res = await fetch(base + path);
  check(`GET ${path} → 200`, res.status === 200, String(res.status));
}

const home = await (await fetch(base + '/')).text();
check('home: RTL Arabic dir', home.includes('dir="rtl"'));
check('home: title uses comm.ly', home.includes('<title>comm.ly'));
check('home: shortener form present', home.includes('id="shortenForm"'));
check('home: theme switcher present', home.includes('data-theme-option'));
check('home: network links present', home.includes('3.com.ly'));
check('home: legal links present', home.includes('/privacy/') && home.includes('/terms/'));

const en = await (await fetch(base + '/en/')).text();
check('EN page: LTR dir', en.includes('dir="ltr"'));
check('EN page: English headline', en.includes('Short links,'));

const pricing = await (await fetch(base + '/pricing/')).text();
for (const plan of ['Pro', 'Business', 'Agency', 'Enterprise']) {
  check(`pricing: ${plan} plan listed`, pricing.includes(plan));
}
check('pricing: crypto/regional add-ons listed', pricing.includes('العملات الرقمية'));

const network = await (await fetch(base + '/network/')).text();
for (const host of ['comm.ly', '3.com.ly', '4.com.ly', '6.com.ly', '7.com.ly', '8.com.ly', '9.com.ly']) {
  check(`network: ${host} listed`, network.includes(host));
}

const sitemap = await (await fetch(base + '/sitemap.xml')).text();
check('sitemap: includes ar + en home', sitemap.includes('https://comm.ly/') && sitemap.includes('https://comm.ly/en/'));
check('sitemap: includes pricing', sitemap.includes('https://comm.ly/pricing/'));

const routes = await (await fetch(base + '/_routes.json')).json();
check('_routes.json: static pages excluded from Functions', routes.exclude.includes('/pricing/') && routes.exclude.includes('/privacy/'));

/* API + redirect */
const res = await fetch(base + '/api/shorten', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://example.com/e2e', expiresIn: 24 })
});
const data = await res.json();
check('POST /api/shorten → 201', res.status === 201, String(res.status));
check('short URL returned', typeof data.shortUrl === 'string' && data.shortUrl.startsWith(base));
const redirect = await fetch(data.shortUrl, { redirect: 'manual' });
check('short link redirects (302)', redirect.status === 302, String(redirect.status));
check('redirect location correct', redirect.headers.get('location') === 'https://example.com/e2e');

const bad = await fetch(base + '/api/shorten', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'javascript:alert(1)' })
});
check('invalid URL rejected → 400', bad.status === 400, String(bad.status));

const contact = await fetch(base + '/api/contact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Test', email: 'test@example.com', message: 'Hello from the build test' })
});
check('contact form endpoint → 200', contact.status === 200, String(contact.status));

console.log(failures === 0 ? '\nALL BUILD TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures ? 1 : 0);
