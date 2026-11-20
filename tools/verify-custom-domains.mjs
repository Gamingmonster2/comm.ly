#!/usr/bin/env node
/** Public check of every custom domain (and its www variant): DNS + HTTP + served title. */
const map = [
  ['3.com.ly', 'comly-n3.pages.dev'],
  ['4.com.ly', 'comly-n4.pages.dev'],
  ['6.com.ly', 'comly-n6.pages.dev'],
  ['7.com.ly', 'comly-n7.pages.dev'],
  ['8.com.ly', 'comly-n8.pages.dev'],
  ['9.com.ly', 'comly-n9.pages.dev']
];

async function dns(name, type) {
  const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${name}&type=${type}`, {
    headers: { Accept: 'application/dns-json' }
  });
  const j = await r.json();
  const code = { A: 1, CNAME: 5, AAAA: 28 }[type];
  return (j.Answer || []).filter((a) => a.type === code).map((a) => a.data);
}

async function http(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: controller.signal });
    const html = await r.text();
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || '';
    const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]?.replace(/<[^>]+>/g, '').trim().slice(0, 60) || '';
    return { status: r.status, final: r.url, title, h1 };
  } catch (e) {
    return { error: e.cause?.code || e.name || String(e).slice(0, 80) };
  } finally {
    clearTimeout(timer);
  }
}

for (const [domain, target] of map) {
  console.log(`\n--- ${domain} → ${target} ---`);
  for (const host of [domain, `www.${domain}`]) {
    let cname = [], a = [];
    try { cname = await dns(host, 'CNAME'); } catch {}
    try { a = await dns(host, 'A'); } catch {}
    const httpsResult = await http(`https://${host}/`);
    console.log(JSON.stringify({
      host,
      cname,
      a: a.slice(0, 2),
      https: httpsResult
    }));
  }
}
