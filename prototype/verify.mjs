/* Quick verification harness for the local preview (prototype). */
const base = process.env.BASE || 'http://127.0.0.1:4173';

async function main() {
  for (const path of ['/', '/dashboard', '/assets/styles.css', '/assets/theme-light.css', '/assets/theme.js', '/assets/i18n.js']) {
    const res = await fetch(base + path);
    console.log(path, '→', res.status, res.headers.get('content-type'));
  }

  const home = await (await fetch(base + '/')).text();
  console.log('home inline theme default  :', home.includes('data-theme="light"'));
  console.log('home theme stylesheet      :', home.includes('/assets/theme-light.css'));
  console.log('home theme switcher        :', home.includes('data-theme-option'));
  console.log('home pre-paint script      :', home.includes('comly-theme'));
  console.log('home theme.js loaded       :', home.includes('/assets/theme.js'));

  const dash = await (await fetch(base + '/dashboard')).text();
  console.log('dash theme switcher        :', dash.includes('data-theme-option'));

  const shortenRes = await fetch(base + '/api/shorten', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com/theme-check', expiresIn: 24 })
  });
  const data = await shortenRes.json();
  console.log('shorten                    :', shortenRes.status, data.shortUrl ? 'OK' : 'FAIL');

  const redirect = await fetch(data.shortUrl, { redirect: 'manual' });
  console.log('redirect                   :', redirect.status, redirect.headers.get('location'));
}

main().catch((err) => {
  console.error('VERIFY FAILED:', err);
  process.exit(1);
});
