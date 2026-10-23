/**
 * Runtime site config — checked into the repo so Pages Functions can be bundled
 * from the repository root (Cloudflare builds functions relative to the project root).
 * When adding a network domain: add it here + in sites/registry.mjs.
 */
export const NETWORK = [
  { id: 'commly', host: 'comm.ly', role: 'main' },
  { id: 'n3', host: '3.com.ly', role: 'engine' },
  { id: 'n4', host: '4.com.ly', role: 'engine' },
  { id: 'n6', host: '6.com.ly', role: 'engine' },
  { id: 'n7', host: '7.com.ly', role: 'engine' },
  { id: 'n8', host: '8.com.ly', role: 'engine' },
  { id: 'n9', host: '9.com.ly', role: 'engine' }
];

export const SITE = { ...NETWORK[0], colors: ['#0f766e', '#6d28d9'] };

export function siteFor(host, fallback = SITE) {
  return NETWORK.find((entry) => entry.host === host) || fallback;
}
