/**
 * DOM-level functional tests (jsdom) for the prototype:
 * - default theme = light
 * - 3-state theme switcher (light / dark / system) + persistence
 * - pre-paint theme restore
 * - AR <-> EN language switch (direction, title, content)
 *
 * Preview server must be running on :4173.
 */
import { JSDOM } from 'jsdom';

const BASE = process.env.BASE || 'http://127.0.0.1:4173';
let failures = 0;

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`✔ ${label}`);
  } else {
    failures += 1;
    console.log(`✖ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function loadPage(path, beforeParse) {
  const html = await (await fetch(BASE + path)).text();
  const dom = new JSDOM(html, {
    url: BASE + path,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.matchMedia = window.matchMedia || function (query) {
        return {
          matches: false,
          media: query,
          addEventListener() {},
          removeEventListener() {},
          addListener() {},
          removeListener() {}
        };
      };
      if (beforeParse) beforeParse(window);
    }
  });

  await new Promise((resolve) => {
    const done = () => resolve();
    dom.window.addEventListener('load', done);
    setTimeout(done, 6000);
  });
  await new Promise((resolve) => setTimeout(resolve, 700));
  return dom;
}

function click(win, selector) {
  const el = win.document.querySelector(selector);
  if (!el) throw new Error(`missing selector: ${selector}`);
  el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
}

/* ---------------- Home page ---------------- */
{
  const dom = await loadPage('/');
  const win = dom.window;
  const doc = win.document;
  const root = doc.documentElement;

  const errors = [];
  win.addEventListener('error', (e) => errors.push(String(e.message || e.error)));

  check('home: default theme is light', root.getAttribute('data-theme') === 'light', root.getAttribute('data-theme'));
  check('home: theme stylesheet loaded', !!doc.querySelector('link[href*="theme-light.css"]'));
  check('home: theme.js executed (API exposed)', typeof win.comlyTheme === 'object');
  check('home: i18n executed', typeof win.comlyI18n === 'object');
  check('home: app.js executed (toast helper)', typeof win.comlyToast === 'function');

  const pressedLight = doc.querySelector('[data-theme-option="light"]').getAttribute('aria-pressed');
  check('home: light button marked pressed by default', pressedLight === 'true', pressedLight);

  click(win, '[data-theme-option="dark"]');
  check('home: switch to dark works', root.getAttribute('data-theme') === 'dark', root.getAttribute('data-theme'));
  check('home: dark persisted to localStorage', win.localStorage.getItem('comly-theme') === 'dark');
  check(
    'home: pressed state follows dark',
    doc.querySelector('[data-theme-option="dark"]').getAttribute('aria-pressed') === 'true'
  );

  click(win, '[data-theme-option="system"]');
  check('home: system mode set', root.getAttribute('data-theme-mode') === 'system');
  check('home: system resolves to light when OS prefers light', root.getAttribute('data-theme') === 'light', root.getAttribute('data-theme'));

  click(win, '[data-theme-option="light"]');
  check('home: back to light works', root.getAttribute('data-theme') === 'light');

  /* Language */
  click(win, '#langToggle');
  check('home: EN dir = ltr', root.getAttribute('dir') === 'ltr', root.getAttribute('dir'));
  check('home: EN lang attribute', root.getAttribute('lang') === 'en');
  const heroEn = doc.querySelector('.hero-title span').textContent.trim();
  check('home: hero copy translated to EN', heroEn === 'Short links.', heroEn);
  check('home: html title translated', doc.title.includes('Short links'), doc.title);
  check('home: placeholder translated', doc.querySelector('#urlInput').getAttribute('placeholder').includes('Paste your long link'));
  check('home: nav link translated', doc.querySelector('.nav-links a').textContent.trim() === 'Features');
  check('home: theme button tooltip translated', doc.querySelector('[data-theme-option="dark"]').getAttribute('title') === 'Dark mode');

  click(win, '#langToggle');
  check('home: back to AR dir = rtl', root.getAttribute('dir') === 'rtl');
  const heroAr = doc.querySelector('.hero-title span').textContent.trim();
  check('home: hero copy back to AR', heroAr === 'روابط أقصر.', heroAr);

  check('home: no runtime script errors', errors.length === 0, errors.join(' | '));

  dom.window.close();
}

/* ---------------- Dashboard page ---------------- */
{
  const dom = await loadPage('/dashboard');
  const win = dom.window;
  const doc = win.document;
  const root = doc.documentElement;

  check('dash: default theme is light', root.getAttribute('data-theme') === 'light');
  check('dash: theme switch present', !!doc.querySelector('[data-theme-option="dark"]'));
  click(win, '[data-theme-option="dark"]');
  check('dash: dark works', root.getAttribute('data-theme') === 'dark');

  click(win, '#langToggle');
  check('dash: EN dir = ltr', root.getAttribute('dir') === 'ltr');
  check('dash: EN title translated', doc.title.includes('Dashboard'), doc.title);
  check('dash: page heading translated', doc.querySelector('.dash-page-head h1').textContent.trim() === 'Overview');
  check('dash: table header translated', doc.querySelector('table.links th').textContent.trim() === 'Short link');

  dom.window.close();
}

/* ---------------- Persistence / pre-paint restore ---------------- */
{
  const dom = await loadPage('/', (window) => {
    window.localStorage.setItem('comly-theme', 'dark');
  });
  const root = dom.window.document.documentElement;
  check('persistence: saved dark theme restored before paint', root.getAttribute('data-theme') === 'dark', root.getAttribute('data-theme'));
  dom.window.close();
}

/* ---------------- URL override (?theme=dark) ---------------- */
{
  const dom = await loadPage('/?theme=dark');
  const root = dom.window.document.documentElement;
  check('url override: ?theme=dark applies dark', root.getAttribute('data-theme') === 'dark');
  dom.window.close();
}

console.log(failures === 0 ? '\nALL DOM TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures ? 1 : 0);
