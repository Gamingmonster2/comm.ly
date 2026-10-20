/**
 * Visual QA — captures screenshots of the prototype in light/dark/mobile
 * and functionally tests the 3-state theme engine.
 *
 * Usage: npm run shots   (preview server must be running on :4173)
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE || 'http://127.0.0.1:4173';
const OUT = new URL('../prototype/shots/', import.meta.url);

const SHOTS = [
  { name: 'home-light', url: '/?theme=light', width: 1440, height: 1250 },
  { name: 'home-dark', url: '/?theme=dark', width: 1440, height: 1250 },
  { name: 'home-light-full', url: '/?theme=light', width: 1440, height: 1250, fullPage: true },
  { name: 'home-light-mobile', url: '/?theme=light', width: 390, height: 900, scale: 2 },
  { name: 'dashboard-light', url: '/dashboard?theme=light', width: 1440, height: 1050 },
  { name: 'dashboard-dark', url: '/dashboard?theme=dark', width: 1440, height: 1050 }
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
let failures = 0;

for (const shot of SHOTS) {
  const context = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: shot.scale ?? 1,
    colorScheme: shot.url.includes('dark') ? 'dark' : 'light'
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto(BASE + shot.url, { waitUntil: 'load', timeout: 30_000 });
  await page.evaluate(() => (document.fonts ? document.fonts.ready : null));

  // Trigger scroll-reveal + animated counters before capturing.
  await page.evaluate(async () => {
    const height = document.body.scrollHeight;
    for (let y = 0; y < height; y += 500) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 45));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(900);

  await page.screenshot({
    path: new URL(`${shot.name}.png`, OUT),
    fullPage: Boolean(shot.fullPage)
  });

  if (errors.length) {
    failures += 1;
    console.log(`✖ ${shot.name} — console errors: ${errors.join(' | ')}`);
  } else {
    console.log(`✔ ${shot.name}.png`);
  }
  await context.close();
}

/* ---------- Theme engine functional test ---------- */
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
await page.goto(BASE + '/', { waitUntil: 'load' });

const result = {};
result.defaultTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
await page.click('[data-theme-option="dark"]');
result.afterDark = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
result.stored = await page.evaluate(() => localStorage.getItem('comly-theme'));
await page.click('[data-theme-option="light"]');
result.afterLight = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
await page.click('[data-theme-option="system"]');
result.afterSystem = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
result.systemMode = await page.evaluate(() => document.documentElement.getAttribute('data-theme-mode'));
result.pressedButtons = await page.evaluate(() =>
  [...document.querySelectorAll('[data-theme-option]')].map((b) => `${b.dataset.themeOption}:${b.getAttribute('aria-pressed')}`)
);

const themeOk =
  result.defaultTheme === 'light' &&
  result.afterDark === 'dark' &&
  result.afterLight === 'light' &&
  ['light', 'dark'].includes(result.afterSystem) &&
  result.systemMode === 'system';

console.log('THEME ENGINE:', JSON.stringify(result));
console.log(themeOk ? '✔ 3-state theme engine works' : '✖ theme engine failed');
if (!themeOk) failures += 1;

await browser.close();
process.exit(failures ? 1 : 0);
