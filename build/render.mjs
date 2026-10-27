/**
 * Comly Network — HTML renderer
 * Generates bilingual (AR root + /en/) static pages per site.
 * Pure Node, zero dependencies.
 */
import { escapeHtml as esc, loc } from './util.mjs';

const l = (obj, lang) => loc(obj, lang);
const pick = (lang, ar, en) => (lang === 'ar' ? ar : en);
const today = () => new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ */
/* Brand marks                                                         */
/* ------------------------------------------------------------------ */
const SHAPES = {
  comet: (g) =>
    `<circle cx="24" cy="24" r="6.5" fill="none" stroke="url(#${g})" stroke-width="2.6"/><ellipse cx="24" cy="24" rx="15.5" ry="6" transform="rotate(-25 24 24)" fill="none" stroke="url(#${g})" stroke-width="1.8"/><circle cx="35.2" cy="17.6" r="2.2" fill="url(#${g})"/>`,
  triangle: (g) => `<path d="M24 11 38 35H10Z" fill="none" stroke="url(#${g})" stroke-width="2.6" stroke-linejoin="round"/>`,
  diamond: (g) => `<path d="M24 10 38 24 24 38 10 24Z" fill="none" stroke="url(#${g})" stroke-width="2.5" stroke-linejoin="round"/>`,
  hexagon: (g) => `<polygon points="37,24 30.5,35.26 17.5,35.26 11,24 17.5,12.74 30.5,12.74" fill="none" stroke="url(#${g})" stroke-width="2.4" stroke-linejoin="round"/>`,
  heptagon: (g) => `<polygon points="37,24 32.11,34.16 21.11,36.67 12.29,29.64 12.29,18.36 21.11,11.33 32.11,13.84" fill="none" stroke="url(#${g})" stroke-width="2.4" stroke-linejoin="round"/>`,
  octagon: (g) => `<polygon points="36.01,28.97 28.97,36.01 19.03,36.01 11.99,28.97 11.99,19.03 19.03,11.99 28.97,11.99 36.01,19.03" fill="none" stroke="url(#${g})" stroke-width="2.4" stroke-linejoin="round"/>`,
  nonagon: (g) => `<polygon points="37,24 33.96,32.36 26.26,36.8 17.5,35.26 11.78,28.45 11.78,19.55 17.5,12.74 26.26,11.2 33.96,15.64" fill="none" stroke="url(#${g})" stroke-width="2.4" stroke-linejoin="round"/>`
};

export function markSvg(site, size = 38, suffix = 'nav') {
  const [c1, c2] = site.colors;
  const id = `g-${site.id}-${suffix}`;
  const shape = (SHAPES[site.mark] || SHAPES.triangle)(id);
  return `<svg class="brand-mark" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
    <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="url(#${id})" fill-opacity=".14" stroke="url(#${id})" stroke-opacity=".55"/>
    ${shape}
  </svg>`;
}

/* ------------------------------------------------------------------ */
/* Shared URL helpers                                                  */
/* ------------------------------------------------------------------ */
function urlFor(site, key, lang) {
  const map = {
    home: { ar: '/', en: '/en/' },
    network: { ar: '/network/', en: '/en/network/' },
    pricing: { ar: '/pricing/', en: '/en/pricing/' },
    privacy: { ar: '/privacy/', en: '/en/privacy/' },
    login: { ar: '/login/', en: '/en/login/' },
    register: { ar: '/register/', en: '/en/register/' },
    app: { ar: '/app/', en: '/en/app/' },
    terms: { ar: '/terms/', en: '/en/terms/' },
    contact: { ar: '/contact/', en: '/en/contact/' }
  };
  return map[key][lang];
}

function absolute(site, key, lang) {
  return `https://${site.host}${urlFor(site, key, lang)}`;
}

function pricingHref(site, brand, lang) {
  if (site.role === 'main') return urlFor(site, 'pricing', lang);
  return lang === 'ar' ? `${brand.url}/pricing/` : `${brand.url}/en/pricing/`;
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */
function head({ site, lang, title, description, path, siteCss, jsonLd, extraHead = '' }) {
  const arUrl = absolute(site, path.key, 'ar');
  const enUrl = absolute(site, path.key, 'en');
  const canonical = lang === 'ar' ? arUrl : enUrl;
  const alternates = `<link rel="alternate" hreflang="ar" href="${arUrl}" />
  <link rel="alternate" hreflang="en" href="${enUrl}" />
  <link rel="alternate" hreflang="x-default" href="${arUrl}" />`;

  const navFaq = lang === 'ar' ? '/#faq' : '/en/#faq';
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}" data-theme="light" data-theme-mode="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="theme-color" content="#ffffff" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${canonical}" />
  ${alternates}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="comm.ly network" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:locale" content="${lang === 'ar' ? 'ar_LY' : 'en_US'}" />
  <meta property="og:locale:alternate" content="${lang === 'ar' ? 'en_US' : 'ar_LY'}" />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect x='1.5' y='1.5' width='45' height='45' rx='13' fill='%2305060a' stroke='%23${site.colors[0].replace('#', '')}' stroke-width='2'/%3E%3Ccircle cx='24' cy='24' r='7' fill='none' stroke='%23${site.colors[0].replace('#', '')}' stroke-width='3'/%3E%3C/svg%3E" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/styles.css" />
  <link rel="stylesheet" href="/assets/theme-light.css" />
  <link rel="stylesheet" href="/assets/extra.css" />
  <style>${siteCss}</style>
  <script>
    (function () {
      try {
        var q = new URLSearchParams(location.search).get('theme');
        var valid = ['light', 'dark', 'system'];
        var m = (q && valid.indexOf(q) >= 0) ? q : (localStorage.getItem('comly-theme') || 'light');
        if (valid.indexOf(m) < 0) m = 'light';
        var t = m === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : m;
        document.documentElement.setAttribute('data-theme', t);
        document.documentElement.setAttribute('data-theme-mode', m);
      } catch (e) { /* ignore */ }
    })();
  </script>
  ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
  ${extraHead}
</head>`;
}

function nav({ site, lang, brand, pageKey }) {
  const home = urlFor(site, 'home', lang);
  const otherLang = lang === 'ar' ? 'en' : 'ar';
  const langHref = urlFor(site, pageKey || 'home', otherLang);
  const links = [
    { href: urlFor(site, 'network', lang), label: pick(lang, 'الشبكة', 'Network') },
    { href: pricingHref(site, brand, lang), label: pick(lang, 'الأسعار', 'Pricing') },
    { href: lang === 'ar' ? '/#features' : '/en/#features', label: pick(lang, 'المزايا', 'Features') },
    { href: lang === 'ar' ? '/#faq' : '/en/#faq', label: pick(lang, 'الأسئلة', 'FAQ') },
    { href: urlFor(site, 'contact', lang), label: pick(lang, 'اتصل بنا', 'Contact') }
  ];
  return `<header class="site-nav">
    <div class="container">
      <div class="nav-inner">
        <a class="brand" href="${home}" aria-label="${site.host}">
          ${markSvg(site, 38)}
          <span class="brand-name">${site.host}
            ${site.role === 'main'
              ? `<span class="brand-chip">${pick(lang, 'العلامة الأساسية', 'Home brand')}</span>`
              : `<span class="brand-chip">${pick(lang, 'جزء من comm.ly', 'Part of comm.ly')}</span>`}
          </span>
        </a>
        <nav class="nav-links" aria-label="Navigation">
          ${links.map((link) => `<a href="${link.href}">${esc(link.label)}</a>`).join('')}
        </nav>
        <div class="nav-actions">
          <div class="theme-switch" role="group" aria-label="${pick(lang, 'مظهر الموقع', 'Color theme')}">
            <button type="button" data-theme-option="light" title="${pick(lang, 'الوضع النهاري', 'Light mode')}" aria-label="${pick(lang, 'الوضع النهاري', 'Light mode')}" aria-pressed="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
            </button>
            <button type="button" data-theme-option="dark" title="${pick(lang, 'الوضع الليلي', 'Dark mode')}" aria-label="${pick(lang, 'الوضع الليلي', 'Dark mode')}" aria-pressed="false">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>
            </button>
            <button type="button" data-theme-option="system" title="${pick(lang, 'حسب النظام', 'System theme')}" aria-label="${pick(lang, 'حسب النظام', 'System theme')}" aria-pressed="false">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            </button>
          </div>
          <a class="lang-toggle" href="${langHref}" hreflang="${otherLang}" aria-label="${pick(lang, 'Switch to English', 'التبديل إلى العربية')}">${pick(lang, 'EN', 'عربي')}</a>
          <a class="btn btn-primary btn-sm" href="${lang === 'ar' ? '/#shorten' : '/en/#shorten'}">${pick(lang, 'اختصر رابطاً', 'Shorten a link')}</a>
          <button class="nav-burger" type="button" aria-label="${pick(lang, 'القائمة', 'Menu')}" aria-expanded="false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
        </div>
      </div>
      <div class="nav-mobile" id="navMobile">
        ${links.map((link) => `<a href="${link.href}">${esc(link.label)}</a>`).join('')}
        <a href="${langHref}" hreflang="${otherLang}">${pick(lang, 'English version', 'النسخة العربية')}</a>
      </div>
    </div>
  </header>`;
}

function footer({ site, lang, brand, sites }) {
  const legal = [
    { href: urlFor(site, 'privacy', lang), label: pick(lang, 'سياسة الخصوصية', 'Privacy policy') },
    { href: urlFor(site, 'terms', lang), label: pick(lang, 'شروط الاستخدام العادل', 'Fair use terms') },
    { href: urlFor(site, 'contact', lang), label: pick(lang, 'اتصل بنا', 'Contact us') }
  ];
  const network = sites.map((s) => {
    const href = s.id === site.id ? '#' : `https://${s.host}${lang === 'ar' ? '/' : '/en/'}`;
    const label = s.id === site.id
      ? `${s.host} ${pick(lang, '(أنت هنا)', '(you are here)')}`
      : `${s.host} — ${l(s.tool, lang)}`;
    return `<li><a href="${href}">${esc(label)}</a></li>`;
  }).join('');

  return `<footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <a class="brand" href="${urlFor(site, 'home', lang)}">
            ${markSvg(site, 34, 'footer')}
            <span class="brand-name">${site.host}</span>
          </a>
          <p>${pick(lang,
            `${site.host} محرك ضمن شبكة comm.ly لاختصار الروابط — هوية مستقلة، ومحرك مشترك، وبيانات موحدة.`,
            `${site.host} is an engine in the comm.ly link-shortening network — its own identity, one shared engine and database.`)}</p>
          <div class="social">
            <a href="https://comm.ly/" aria-label="comm.ly"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/></svg></a>
            <a href="https://x.com/" aria-label="X"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.2-9.4L1 2h7l4.8 6.4L18.9 2Z"/></svg></a>
            <a href="https://github.com/" aria-label="GitHub"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2A10 10 0 0 0 2 12c0 4.4 2.9 8.2 6.8 9.5.5.1.7-.2.5-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2Z"/></svg></a>
          </div>
        </div>
        <div>
          <div class="footer-title">${pick(lang, 'المنتج', 'Product')}</div>
          <ul class="footer-links">
            <li><a href="${urlFor(site, 'home', lang)}#features">${pick(lang, 'المزايا', 'Features')}</a></li>
            <li><a href="${pricingHref(site, brand, lang)}">${pick(lang, 'الأسعار', 'Pricing')}</a></li>
            <li><a href="${urlFor(site, 'network', lang)}">${pick(lang, 'صفحة الشبكة', 'Network page')}</a></li>
            <li><a href="https://7.com.ly/">${pick(lang, 'توثيق API', 'API docs')}</a></li>
            <li><a href="${urlFor(site, 'contact', lang)}">${pick(lang, 'اتصل بنا', 'Contact')}</a></li>
          </ul>
        </div>
        <div>
          <div class="footer-title">${pick(lang, 'شبكة comm.ly', 'comm.ly network')}</div>
          <ul class="footer-links">${network}</ul>
        </div>
        <div>
          <div class="footer-title">${pick(lang, 'القانوني', 'Legal')}</div>
          <ul class="footer-links">${legal.map((a) => `<li><a href="${a.href}">${esc(a.label)}</a></li>`).join('')}</ul>
        </div>
      </div>
      <div class="foot-bottom">
        <span class="mono">© ${new Date().getFullYear()} ${site.host} — ${pick(lang, 'جزء من شبكة comm.ly', 'part of the comm.ly network')}</span>
        <span class="mono">${pick(lang, 'صُنع للسرعة. بُني على الحافة.', 'Made for speed. Built on the edge.')}</span>
      </div>
    </div>
  </footer>`;
}

/* ------------------------------------------------------------------ */
/* Shared blocks                                                       */
/* ------------------------------------------------------------------ */
function shortenCard({ site, lang }) {
  const t = (ar, en) => pick(lang, ar, en);
  return `<div class="shorten-card" id="shorten">
    <form class="shorten-form" id="shortenForm" novalidate>
      <div class="shorten-main">
        <label class="field-url" for="urlInput">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <input type="url" id="urlInput" inputmode="url" autocomplete="off" spellcheck="false" placeholder="${t('الصق الرابط الطويل هنا…', 'Paste your long link here…')}" required />
        </label>
        <button class="btn btn-primary shorten-submit" type="submit" id="submitBtn">
          <span class="spinner" aria-hidden="true"></span>
          <span class="btn-label">${t('اختصر الرابط', 'Shorten link')}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="flip-rtl" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
        </button>
      </div>
      <div class="shorten-options">
        <label class="opt-field" for="slugInput">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9h16M4 15h16"/></svg>
          <span class="suffix">${site.host}/</span>
          <input id="slugInput" type="text" maxlength="24" pattern="[A-Za-z0-9_-]+" autocomplete="off" spellcheck="false" placeholder="${t('كود مخصص (اختياري)', 'custom-code (optional)')}" />
        </label>
        <label class="opt-field" for="expirySelect">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <select id="expirySelect">
            <option value="24">${t('ينتهي خلال 24 ساعة', 'Expires in 24 hours')}</option>
            <option value="168">${t('ينتهي خلال 7 أيام', 'Expires in 7 days')}</option>
            <option value="720">${t('ينتهي خلال 30 يوماً', 'Expires in 30 days')}</option>
            <option value="0">${t('بلا انتهاء', 'Never expires')}</option>
          </select>
        </label>
        <div class="opt-field" style="flex:.8;cursor:default">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>
          <span style="font-size:12.5px;color:var(--ok)">${t('حماية ذكية من التصيّد', 'Smart phishing protection')}</span>
        </div>
      </div>
    </form>
    <p class="error-msg" id="errorMsg" role="alert"></p>
    <div class="result-card is-hidden" id="resultCard">
      <div class="qr-box"><img id="qrImg" width="92" height="92" alt="QR code" /></div>
      <div class="result-info">
        <p class="result-label">${t('رابطك المختصر', 'Your short link')}</p>
        <a class="result-link" id="shortLink" href="#" target="_blank" rel="noopener">—</a>
        <p class="result-meta" id="resultMeta"></p>
      </div>
      <div class="result-actions">
        <button class="btn btn-primary btn-sm" id="copyBtn" type="button">${t('نسخ', 'Copy')}</button>
        <a class="btn btn-ghost btn-sm" id="openBtn" href="#" target="_blank" rel="noopener">${t('فتح', 'Open')}</a>
      </div>
    </div>
    <div class="trust-note">
      <span class="ok">${t('✓ مجاني', '✓ Free')}</span><span class="sep"></span>
      <span>${t('بلا تسجيل', 'No sign-up')}</span><span class="sep"></span>
      <span>${t('يعمل على كل نطاقات الشبكة', 'Works on every network domain')}</span><span class="sep"></span>
      <span>${t('بلا إعلانات', 'No ads')}</span>
    </div>
  </div>`;
}

function statsStrip({ site, lang, sites }) {
  const t = (ar, en) => pick(lang, ar, en);
  return `<div class="stats-strip">
    <div class="stat"><div class="stat-value">${sites.length}</div><div class="stat-label">${t('نطاقاً في الشبكة', 'domains in the network')}</div></div>
    <div class="stat"><div class="stat-value">0</div><div class="stat-label">${t('إعلانات بينية', 'interstitial ads')}</div></div>
    <div class="stat"><div class="stat-value">&lt;60<span class="unit">ms</span></div><div class="stat-label">${t('هدف استجابة الحافة', 'target edge latency')}</div></div>
    <div class="stat"><div class="stat-value">100<span class="unit">%</span></div><div class="stat-label">${t('SSL تلقائي', 'automatic SSL')}</div></div>
  </div>`;
}

function featuresGrid({ site, lang }) {
  return `<div class="features-grid">
    ${site.features.map((feature) => `<article class="feature-card reveal">
      <div class="feature-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m13 2-3 7h6l-3 7"/><path d="M5 13 2 22h20l-3-9"/></svg></div>
      <h3>${esc(l(feature.title, lang))}</h3>
      <p>${esc(l(feature.desc, lang))}</p>
    </article>`).join('')}
  </div>`;
}

function networkGrid({ site, lang, sites }) {
  return `<div class="network-grid">
    ${sites.map((s) => {
      const here = s.id === site.id;
      const href = here ? '#' : `https://${s.host}${lang === 'ar' ? '/' : '/en/'}`;
      return `<article class="network-card reveal" style="--c1:${s.colors[0]};--c2:${s.colors[1]}">
        <div class="network-card-head">${markSvg(s, 40, `net-${s.id}-${site.id}`)}
          <span class="status-pill ${here ? 'live' : 'soon'}">${here ? pick(lang, 'أنت هنا', 'you are here') : pick(lang, 'مباشر', 'live')}</span>
        </div>
        <h3><a href="${href}">${s.host}</a></h3>
        <p>${esc(l(s.tool, lang))}</p>
      </article>`;
    }).join('')}
  </div>`;
}

function faqBlock({ site, lang }) {
  return `<div class="faq reveal">
    ${site.faq.map((item, index) => `<details class="faq-item"${index === 0 ? ' open' : ''}>
      <summary class="faq-q"><span>${esc(l(item.q, lang))}</span><span class="plus">+</span></summary>
      <div class="faq-a">${esc(l(item.a, lang))}</div>
    </details>`).join('')}
  </div>`;
}

function ctaBand({ site, lang, brand }) {
  const href = site.role === 'main'
    ? (lang === 'ar' ? '/pricing/' : '/en/pricing/')
    : (lang === 'ar' ? `${brand.url}/pricing/` : `${brand.url}/en/pricing/`);
  return `<div class="cta-band reveal">
    <h2>${pick(lang, 'جاهز تختصر أول رابط؟', 'Ready to shorten your first link?')}</h2>
    <p>${pick(lang,
      'بلا حساب وبلا بطاقة. الصق الرابط واختصر وشارك — على أي نطاق من الشبكة.',
      'No account, no credit card. Paste, shorten and share — on any network domain.')}</p>
    <a class="btn btn-primary" href="${href}">${pick(lang, 'اطّلع على الخطط', 'See the plans')}</a>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Home page                                                           */
/* ------------------------------------------------------------------ */
function homePage({ site, lang, brand, sites, plans }) {
  const t = (ar, en) => pick(lang, ar, en);
  const networkLine = sites
    .filter((s) => s.id !== site.id)
    .map((s) => `<a href="https://${s.host}/" class="mono" style="color:var(--accent)">${s.host.replace('.com.ly', '')}</a>`)
    .join(' · ');

  const analyticsMock = site.role === 'main' ? `<section class="section" id="analytics">
    <div class="container">
      <div class="split">
        <div class="reveal">
          <span class="eyebrow">${t('لوحة التحكم', 'The dashboard')}</span>
          <h2>${t('كل نقرة… على خريطة واحدة.', 'Every click, on one map.')}</h2>
          <p class="lead">${t(
            'لوحة كثيفة المعلومات تُخفي التعقيد خلف الوضوح: نقرات، دول، أجهزة، مصادر — وقرارات مبنية على بيانات حقيقية.',
            'A dense, fast dashboard that hides complexity behind clarity: clicks, countries, devices and referrers — decisions on real data.')}</p>
          <ul class="bullets">
            <li><span class="check">✓</span><span>${t('ملخص فوري للنقرات والدول والمصادر.', 'Instant overview of clicks, countries and referrers.')}</span></li>
            <li><span class="check">✓</span><span>${t('جدول روابط عالي الكثافة مع فلاتر وتصدير CSV.', 'High-density links table with filters and CSV export.')}</span></li>
            <li><span class="check">✓</span><span>${t('نطاقات مخصصة وإحصاءات على كل نطاقات الشبكة.', 'Custom domains and stats across every network domain.')}</span></li>
          </ul>
          <a class="link-arrow" href="${pricingHref(site, brand, lang)}" style="margin-top:28px">
            ${t('اطّلع على الخطط', 'See the plans')}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" class="flip-rtl"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
          </a>
        </div>
        <div class="dash-mock reveal" aria-hidden="true">
          <div class="dash-top"><div class="dash-dots"><i></i><i></i><i></i></div><span class="dash-title">${site.host} / overview</span></div>
          <div class="dash-body">
            <div class="dash-kpis">
              <div class="dash-kpi"><span>Clicks</span><strong>48.2K</strong><em>+18%</em></div>
              <div class="dash-kpi"><span>Links</span><strong>1,204</strong><em>+6%</em></div>
              <div class="dash-kpi"><span>CTR</span><strong>7.4%</strong><em>+1.2%</em></div>
            </div>
            <div class="dash-chart">
              <svg viewBox="0 0 420 120" role="img">
                <path d="M0 96 C 40 92, 60 70, 95 74 S 150 96, 185 66 S 250 30, 285 46 S 350 64, 420 18" fill="none" stroke="#0f766e" stroke-width="2.2" stroke-linecap="round" />
                <path d="M0 96 C 40 92, 60 70, 95 74 S 150 96, 185 66 S 250 30, 285 46 S 350 64, 420 18 L 420 120 L 0 120 Z" fill="rgba(15,118,110,.18)" />
                <path d="M0 108 C 50 100, 90 96, 130 88 S 210 78, 260 62 S 340 52, 420 40" fill="none" stroke="#6d28d9" stroke-width="1.6" stroke-dasharray="4 4" opacity=".8" />
              </svg>
            </div>
            <div class="country-list">
              <div class="country-row"><span>🇱🇾 Libya</span><div class="bar"><i style="width:86%"></i></div><span>38%</span></div>
              <div class="country-row"><span>🇸🇦 KSA</span><div class="bar"><i style="width:58%"></i></div><span>22%</span></div>
              <div class="country-row"><span>🇦🇪 UAE</span><div class="bar"><i style="width:41%"></i></div><span>14%</span></div>
              <div class="country-row"><span>🌍 ${t('أخرى', 'Other')}</span><div class="bar"><i style="width:33%"></i></div><span>26%</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>` : '';

  return `<main>
    <section class="hero">
      <div class="container">
        <div class="hero-badge reveal"><span class="dot" aria-hidden="true"></span>
          <span>${site.role === 'main'
            ? t('العلامة الأساسية لشبكة اختصار الروابط · خطة مجانية للأبد', 'The home brand of the network · free forever plan')
            : t(`محرك ضمن شبكة comm.ly · ${l(site.tool, lang)}`, `A comm.ly network engine · ${l(site.tool, lang)}`)}</span>
        </div>
        <h1 class="hero-title reveal">${esc(l(site.heroA, lang))}<br /><span class="gradient-text">${esc(l(site.heroB, lang))}</span></h1>
        <p class="hero-lead reveal">${esc(l(site.lead, lang))}</p>
        <div class="hero-network-line reveal">
          <span>${t('جزء من', 'Part of')}</span> <a class="mono" style="color:var(--accent)" href="https://comm.ly/">comm.ly</a>
          <span class="hero-net-dot"></span>
          <span>${t('يعمل على', 'resolves on')}</span> ${networkLine}
        </div>
        ${shortenCard({ site, lang })}
        ${statsStrip({ site, lang, sites })}
      </div>
    </section>

    <section class="section" id="features">
      <div class="container">
        <div class="section-head reveal">
          <span class="eyebrow">${t('لماذا نحن', 'Why us')}</span>
          <h2>${esc(l(site.tagline, lang))}</h2>
          <p class="lead">${esc(l(site.lead, lang))}</p>
        </div>
        ${featuresGrid({ site, lang })}
      </div>
    </section>

    <section class="section section-tight" id="tool">
      <div class="container">
        <div class="network-note reveal" style="padding:26px 30px">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m13 2-3 7h6l-3 7"/><path d="M5 13 2 22h20l-3-9"/></svg>
          <div>
            <strong style="display:block;margin-bottom:4px;color:var(--text)">${esc(l(site.toolTitle, lang))}</strong>
            <span>${esc(l(site.toolDesc, lang))}</span>
          </div>
          <a class="btn btn-ghost btn-sm" style="margin-inline-start:auto" href="${lang === 'ar' ? '/#shorten' : '/en/#shorten'}">${t('جرّب الآن', 'Try now')}</a>
        </div>
      </div>
    </section>

    ${analyticsMock}

    <section class="section" id="network">
      <div class="container">
        <div class="section-head center reveal">
          <span class="eyebrow">${t('البنية التحتية', 'Infrastructure')}</span>
          <h2>${t(`${sites.length} نطاقات. محرك واحد.`, `${sites.length} domains. One engine.`)}</h2>
          <p class="lead">${t(
            'كل نطاق هوية ومحتوى وأداة مستقلة، لكنها جميعاً تتشارك نفس المحرك وقاعدة البيانات — فيصبح المجموع أقوى من مجموع أجزائه.',
            'Each domain is an independent identity, content set and tool, yet all share the same engine and database — the whole becomes stronger than the sum of its parts.')}</p>
        </div>
        ${networkGrid({ site, lang, sites })}
        <div class="network-note reveal" style="margin-top:24px">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
          <span>${t(
            'شبكة comm.ly تُدار من العلامة الأساسية comm.ly — ويمكن إضافة نطاقات جديدة إلى الشبكة في أي وقت دون التأثير على بقية المواقع.',
            'The comm.ly network is led by the home brand comm.ly — new domains can join the network at any time without affecting the other sites.')}</span>
        </div>
      </div>
    </section>

    <section class="section" id="faq">
      <div class="container">
        <div class="section-head center reveal">
          <span class="eyebrow">${t('الأسئلة الشائعة', 'FAQ')}</span>
          <h2>${t('أسئلة… مُجابة.', 'Questions, answered.')}</h2>
        </div>
        ${faqBlock({ site, lang })}
      </div>
    </section>

    <section class="section section-tight">
      <div class="container">${ctaBand({ site, lang, brand })}</div>
    </section>
  </main>`;
}

/* ------------------------------------------------------------------ */
/* Network page                                                        */
/* ------------------------------------------------------------------ */
function networkPage({ site, lang, brand, sites }) {
  const t = (ar, en) => pick(lang, ar, en);
  return `<main>
    <section class="section">
      <div class="container">
        <div class="section-head reveal">
          <span class="eyebrow">${t('شبكة comm.ly', 'comm.ly network')}</span>
          <h2>${t('شبكة واحدة، هويات متعددة.', 'One network, many identities.')}</h2>
          <p class="lead">${t(
            'هذه صفحة الشبكة الموحدة: كل نطاق يعمل بمحرك الاختصار نفسه ويقرأ من نفس قاعدة البيانات، لكن بهويته ومحتواه وأدواته الخاصة. أضفنا مرونة، احتياطاً، وفرص ظهور أكثر في محركات البحث.',
            'This is the network page: every domain runs the same shortening engine and reads the same database, with its own identity, content and tools. That adds resilience, redundancy and search visibility.')}</p>
        </div>
        ${networkGrid({ site, lang, sites })}
        <div class="network-note reveal" style="margin-top:26px">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/></svg>
          <span>${t(
            `العلامة الأساسية للمشروع هي comm.ly. إذا كنت تبحث عن الخطط والأسعار والحساب، فانتقل إلى هناك.`,
            `The project home brand is comm.ly. For plans, pricing and your account, head there.`)}</span>
          <a class="btn btn-ghost btn-sm" style="margin-inline-start:auto" href="${brand.url}${lang === 'ar' ? '/' : '/en/'}">comm.ly</a>
        </div>
      </div>
    </section>
  </main>`;
}

/* ------------------------------------------------------------------ */
/* Pricing page (main site only)                                       */
/* ------------------------------------------------------------------ */
function pricingPage({ site, lang, brand, plans, addons }) {
  const t = (ar, en) => pick(lang, ar, en);
  return `<main>
    <section class="section">
      <div class="container">
        <div class="section-head center reveal">
          <span class="eyebrow">${t('الأسعار', 'Pricing')}</span>
          <h2>${t('خطط أقل سعراً… وجودة أعلى.', 'Lower prices… better service.')}</h2>
          <p class="lead">${t(
            'ابدأ مجاناً وبلا تسجيل. ترقّى عندما تحتاج نطاقك الخاص أو تحليلات أعمق أو فريقاً. أسعارنا أقل من المنافسين بنسبة 40–80% مع دعم عربي حقيقي.',
            'Start free with no sign-up. Upgrade when you need your own domain, deeper analytics or a team. Our prices are 40–80% below competitors, with real Arabic-first support.')}</p>
        </div>
        <div class="pricing-grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">
          ${plans.map((plan) => `<article class="price-card${plan.featured ? ' featured' : ''} reveal">
            <div class="price-tag"><span>${esc(l(plan.name, lang))}</span>${plan.featured ? `<span class="price-badge">${t('موصى به', 'Recommended')}</span>` : ''}</div>
              <div class="price-amount">${esc(l(plan.price, lang))} <span>${esc(l(plan.period, lang))}</span></div>
            <p class="price-desc">${esc(l(plan.desc, lang))}</p>
            <ul class="plan-list">${plan.features.map((feature) => `<li><span class="check">✓</span><span>${esc(l(feature, lang))}</span></li>`).join('')}</ul>
            <a class="btn ${plan.featured ? 'btn-primary' : 'btn-ghost'} plan-cta" href="${plan.href === '#' ? urlFor(site, 'register', lang) : plan.href === '#contact' ? urlFor(site, 'contact', lang) : plan.href}">${esc(l(plan.cta, lang))}</a>
          </article>`).join('')}
        </div>

        <div class="network-note reveal" style="margin-top:28px;align-items:flex-start">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-top:3px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>
          <div>
            <strong style="display:block;color:var(--text);margin-bottom:6px">${t('الإضافات وخيارات الدفع', 'Add-ons & payment options')}</strong>
            <ul class="plan-list" style="margin:0">${addons.map((addon) => `<li><span class="check">✓</span><span>${esc(l(addon, lang))}</span></li>`).join('')}</ul>
          </div>
        </div>
      </div>
    </section>
    <section class="section section-tight">
      <div class="container">${ctaBand({ site, lang, brand })}</div>
    </section>
  </main>`;
}

/* ------------------------------------------------------------------ */
/* Legal + contact pages                                               */
/* ------------------------------------------------------------------ */
function legalContent(kind, { site, lang, brand }) {
  const ar = lang === 'ar';
  const intro = {
    privacy: ar ? 'نلتزم بحماية خصوصيتك. توضح هذه السياسة ما نجمعه وكيف نستخدمه ونحميه.' : 'We are committed to protecting your privacy. This policy explains what we collect, how we use it and how we protect it.',
    terms: ar ? 'شروط الاستخدام العادل تحمي الخدمة والمستخدمين معاً: استخدام مسؤول، حدود واضحة، وإجراءات ضد الإساءة.' : 'Fair use terms protect both the service and its users: responsible usage, clear limits and action against abuse.'
  };

  const privacyBody = ar ? `
    <h2>1. ما نجمعه</h2>
    <ul>
      <li><strong>الروابط التي تنشئها:</strong> الرابط الأصلي، الكود المختصر، تاريخ الإنشاء والانتهاء.</li>
      <li><strong>بيانات النقرات المجمّعة:</strong> عدد النقرات، الدولة التقريبية (من طبقة الشبكة)، نوع المتصفح، والمصدر — دون تخزين عنوان IP كاملاً في الإحصاءات.</li>
      <li><strong>بيانات الحساب (للخطط المدفوعة):</strong> البريد الإلكتروني وبيانات الفاتورة.</li>
    </ul>
    <h2>2. كيف نستخدمها</h2>
    <ul>
      <li>تشغيل خدمة الاختصار والتحويل وعرض الإحصاءات.</li>
      <li>حماية الخدمة من التصيّد والبرمجيات الخبيثة والاختراق.</li>
      <li>إدارة الاشتراكات والدعم والفوترة.</li>
    </ul>
    <h2>3. المشاركة</h2>
    <p>لا نبيع بياناتك. نشاركها فقط مع مزوّدي البنية التحتية الضروريين (مثل Cloudflare للاستضافة والشبكة) والالتزامات القانونية.</p>
    <h2>4. الكوكيز والتخزين المحلي</h2>
    <p>نستخدم التخزين المحلي لحفظ تفضيلاتك (اللغة والثيم) فقط، وكوكي جلسة آمنة عند تسجيل الدخول. لا إعلانات تتبعية.</p>
    <h2>5. الاحتفاظ والحقوق</h2>
    <p>يمكنك طلب حذف روابطك وحسابك عبر <a href="mailto:${brand.legalEmail}">${brand.legalEmail}</a>. نحتفظ بالسجلات للمدة اللازمة لتشغيل الخدمة والامتثال.</p>
    <h2>6. التغييرات</h2>
    <p>قد نحدّث هذه السياسة وننشر تاريخ التحديث هنا.</p>` : `
    <h2>1. What we collect</h2>
    <ul>
      <li><strong>Links you create:</strong> destination URL, short code, creation and expiry dates.</li>
      <li><strong>Aggregated click data:</strong> click counts, approximate country (network layer), browser type and referrer — without storing full IP addresses in analytics.</li>
      <li><strong>Account data (paid plans):</strong> email address and billing details.</li>
    </ul>
    <h2>2. How we use it</h2>
    <ul>
      <li>Running the shortening and redirect service and showing analytics.</li>
      <li>Protecting the service against phishing, malware and abuse.</li>
      <li>Managing subscriptions, support and billing.</li>
    </ul>
    <h2>3. Sharing</h2>
    <p>We do not sell your data. We share it only with essential infrastructure providers (such as Cloudflare for hosting and networking) and where legally required.</p>
    <h2>4. Cookies & local storage</h2>
    <p>We use local storage only for your preferences (language and theme), and a secure session cookie when signed in. No tracking ads.</p>
    <h2>5. Retention & rights</h2>
    <p>You can request deletion of your links and account at <a href="mailto:${brand.legalEmail}">${brand.legalEmail}</a>. We retain records only as long as needed to run the service and comply with law.</p>
    <h2>6. Changes</h2>
    <p>We may update this policy and will post the updated date here.</p>`;

  const termsBody = ar ? `
    <h2>1. الاستخدام المسموح</h2>
    <p>يمكنك استخدام الخدمة لاختصار الروابط المشروعة ومشاركتها. أنت مسؤول عن محتوى الروابط التي تنشئها.</p>
    <h2>2. الاستخدام غير العادل والمحظور</h2>
    <ul>
      <li>التصيّد أو انتحال العلامات التجارية أو خداع المستخدمين.</li>
      <li>البرمجيات الخبيثة والملفات الخطرة والاحتيال المالي.</li>
      <li>الأوامر والتهديد والعنف والمحتوى غير القانوني.</li>
      <li>الرسائل المزعجة الجماعية (Spam) وإساءة الاستخدام الآلي.</li>
      <li>تكرار المحاولات لتجاوز الحدود أو اختبار الاختراق دون إذن.</li>
    </ul>
    <h2>3. الحدود والإساءة</h2>
    <p>لدينا حدود معدل ذكية وفحص ضد قوائم الحظر. قد نعطّل أي رابط أو حساب يخالف هذه الشروط فوراً وعلى مستوى الشبكة، وقد نُلغي أي اشتراك منتهك دون استرداد.</p>
    <h2>4. الخطة المجانية</h2>
    <p>الخطة المجانية سخية للاستخدام الشخصي والتجاري المعتاد، لكنها ليست للاختصار الآلي الضخم. راقب حدود خطتك أو رقّها.</p>
    <h2>5. الملكية والمحتوى</h2>
    <p>تحتفظ بملكية روابطك ومحتواك. نحن نملك المنصة والعلامة والواجهات. لا يحق لك إعادة بيع الخدمة دون اتفاق علامة بيضاء مخصص.</p>
    <h2>6. التعويض وتحديد المسؤولية</h2>
    <p>الخدمة تُقدَّم «كما هي». لا نتحمل المسؤولية عن أضرار غير مباشرة ناتجة عن استخدام الروابط أو انقطاع الخدمة، وفق ما يسمح به القانون.</p>
    <h2>7. التعديلات</h2>
    <p>قد نحدّث هذه الشروط، ويسري التحديث عند نشره مع تاريخه.</p>` : `
    <h2>1. Permitted use</h2>
    <p>You may use the service to shorten and share legitimate links. You are responsible for the content you link to.</p>
    <h2>2. Prohibited & unfair use</h2>
    <ul>
      <li>Phishing, brand impersonation or deceiving users.</li>
      <li>Malware, malicious files and financial fraud.</li>
      <li>Threats, harassment, violence and illegal content.</li>
      <li>Bulk spam and automated abuse.</li>
      <li>Repeated attempts to bypass limits or unauthorised penetration testing.</li>
    </ul>
    <h2>3. Limits & abuse</h2>
    <p>We use smart rate limits and blocklist checks. We may disable any violating link or account immediately network-wide, and may terminate violating subscriptions without refund.</p>
    <h2>4. Free plan</h2>
    <p>The free plan is generous for personal and normal commercial use, but is not intended for massive automated shortening. Monitor your plan limits or upgrade.</p>
    <h2>5. Ownership & content</h2>
    <p>You retain ownership of your links and content. We own the platform, brand and interfaces. Reselling the service requires a dedicated white-label agreement.</p>
    <h2>6. Indemnity & limitation of liability</h2>
    <p>The service is provided “as is”. We are not liable for indirect damages arising from link usage or service interruption, to the extent permitted by law.</p>
    <h2>7. Changes</h2>
    <p>We may update these terms; the update is effective when published with its date.</p>`;

  const title = kind === 'privacy' ? (ar ? 'سياسة الخصوصية' : 'Privacy policy') : (ar ? 'شروط الاستخدام العادل' : 'Fair use terms');
  const body = kind === 'privacy' ? privacyBody : termsBody;

  return `<main>
    <section class="section">
      <div class="container legal">
        <span class="eyebrow">${ar ? 'القانوني' : 'Legal'}</span>
        <h1>${title}</h1>
        <p class="lead">${intro[kind]}</p>
        <p class="mono" style="font-size:12px;color:var(--muted-2)">${ar ? 'الموقع:' : 'Site:'} ${site.host} · ${ar ? 'آخر تحديث:' : 'Last updated:'} ${today()}</p>
        ${body}
        <p style="margin-top:28px;color:var(--muted)">${ar ? 'لأي استفسار قانوني:' : 'For legal enquiries:'} <a href="mailto:${brand.legalEmail}">${brand.legalEmail}</a></p>
      </div>
    </section>
  </main>`;
}

function contactPage({ site, lang, brand }) {
  const ar = lang === 'ar';
  return `<main>
    <section class="section">
      <div class="container legal">
        <span class="eyebrow">${ar ? 'تواصل' : 'Contact'}</span>
        <h1>${ar ? 'اتصل بنا' : 'Contact us'}</h1>
        <p class="lead">${ar
          ? `فريق ${site.host} (شبكة comm.ly) يقرأ كل رسالة. للدعم الفني، أو الأسئلة التجارية، أو الإبلاغ عن رابط مسيء.`
          : `The ${site.host} team (comm.ly network) reads every message — technical support, business questions, or reporting an abusive link.`}</p>
        <form class="contact-form" id="contactForm">
          <div class="contact-grid">
            <label class="opt-field" for="nameInput"><span>${ar ? 'الاسم' : 'Name'}</span><input id="nameInput" name="name" type="text" required maxlength="80" autocomplete="name" /></label>
            <label class="opt-field" for="emailInput"><span>${ar ? 'البريد' : 'Email'}</span><input id="emailInput" name="email" type="email" required maxlength="120" autocomplete="email" /></label>
          </div>
          <label class="opt-field" for="messageInput" style="margin-top:10px"><span>${ar ? 'الرسالة' : 'Message'}</span><textarea id="messageInput" name="message" required maxlength="3000" rows="6"></textarea></label>
          <button class="btn btn-primary" type="submit" style="margin-top:14px">${ar ? 'أرسل الرسالة' : 'Send message'}</button>
          <p id="contactStatus" style="margin-top:12px;font-size:13.5px;color:var(--muted)"></p>
        </form>
        <p style="margin-top:22px;color:var(--muted);font-size:13.5px">${ar ? 'أو راسلنا مباشرة:' : 'Or email us directly:'} <a href="mailto:${brand.supportEmail}">${brand.supportEmail}</a></p>
        <script>
          (function () {
            var form = document.getElementById('contactForm');
            if (!form) return;
            var status = document.getElementById('contactStatus');
            form.addEventListener('submit', function (event) {
              event.preventDefault();
              status.textContent = '${ar ? 'جارٍ الإرسال…' : 'Sending…'}';
              fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: document.getElementById('nameInput').value,
                  email: document.getElementById('emailInput').value,
                  message: document.getElementById('messageInput').value,
                  site: '${site.id}'
                })
              }).then(function (res) {
                if (!res.ok) throw new Error('failed');
                status.textContent = '${ar ? 'تم إرسال رسالتك ✓' : 'Message sent ✓'}';
                form.reset();
              }).catch(function () {
                status.textContent = '${ar ? 'تعذّر الإرسال الآن — راسلنا بالبريد.' : 'Could not send right now — please email us.'}';
              });
            });
          })();
        </script>
      </div>
    </section>
  </main>`;
}

/* ------------------------------------------------------------------ */
/* Site renderer                                                       */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* Accounts: login / register / app dashboard                          */
/* ------------------------------------------------------------------ */
function authPage({ kind, site, lang }) {
  const ar = lang === 'ar';
  const isLogin = kind === 'login';
  const other = isLogin ? urlFor(site, 'register', lang) : urlFor(site, 'login', lang);
  return `<main>
    <section class="section">
      <div class="container legal" style="max-width:520px">
        <span class="eyebrow">${ar ? 'الحساب' : 'Account'}</span>
        <h1>${isLogin ? (ar ? 'تسجيل الدخول' : 'Sign in') : (ar ? 'إنشاء حساب' : 'Create account')}</h1>
        <p class="lead">${isLogin
          ? (ar ? 'ادخل لإدارة روابطك وتحليلاتك.' : 'Sign in to manage your links and analytics.')
          : (ar ? 'حساب مجاني: 200 رابط شهرياً وتحليلات 30 يوماً.' : 'Free account: 200 links/month and 30-day analytics.')}</p>
        <form class="contact-form" id="authForm" data-kind="${kind}">
          ${isLogin ? '' : `<label class="opt-field" for="nameInput"><span>${ar ? 'الاسم' : 'Name'}</span><input id="nameInput" name="name" type="text" autocomplete="name" maxlength="80" required /></label>`}
          <label class="opt-field" for="emailInput" style="margin-top:10px"><span>${ar ? 'البريد' : 'Email'}</span><input id="emailInput" name="email" type="email" autocomplete="email" required /></label>
          <label class="opt-field" for="passwordInput" style="margin-top:10px"><span>${ar ? 'كلمة المرور' : 'Password'}</span><input id="passwordInput" name="password" type="password" minlength="8" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required /></label>
          <button class="btn btn-primary" type="submit" style="margin-top:16px">${isLogin ? (ar ? 'دخول' : 'Sign in') : (ar ? 'إنشاء الحساب' : 'Create account')}</button>
          <p id="authStatus" style="margin-top:12px;font-size:13.5px;color:var(--muted)"></p>
        </form>
        <p style="margin-top:20px;font-size:13.5px"><a href="${other}" style="color:var(--accent)">${isLogin
          ? (ar ? 'ليس لديك حساب؟ سجّل الآن' : 'No account? Register now')
          : (ar ? 'لديك حساب؟ سجّل الدخول' : 'Have an account? Sign in')}</a></p>
      </div>
    </section>
  </main>`;
}

function appPage({ site, lang }) {
  const ar = lang === 'ar';
  const t = (arText, enText) => (ar ? arText : enText);
  return `<main>
    <section class="section">
      <div class="container">
        <div class="dash-page-head" style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap">
          <div>
            <span class="eyebrow">${t('لوحة الحساب', 'Account dashboard')}</span>
            <h1 style="font-size:1.7rem;margin:10px 0 4px" id="who">…</h1>
            <p style="color:var(--muted-2);font-size:13px;margin:0">comm.ly</p>
          </div>
          <div style="display:flex;gap:8px">
            <a class="btn btn-ghost btn-sm" href="${urlFor(site, 'home', lang)}">${t('الموقع', 'Site')}</a>
            <button class="btn btn-ghost btn-sm" id="logoutBtn" type="button">${t('خروج', 'Log out')}</button>
          </div>
        </div>

        <div class="kpi-grid" style="margin-top:22px">
          <div class="kpi"><div class="kpi-label">${t('الروابط', 'Links')}</div><div class="kpi-value" id="statLinks">0</div></div>
          <div class="kpi"><div class="kpi-label">${t('النقرات', 'Clicks')}</div><div class="kpi-value" id="statClicks">0</div></div>
          <div class="kpi"><div class="kpi-label">${t('حد الخطة', 'Plan limit')}</div><div class="kpi-value" id="statPlan">—</div></div>
          <div class="kpi"><div class="kpi-label">${t('روابط هذا الشهر', 'Links this month')}</div><div class="kpi-value" id="statMonth">0</div></div>
        </div>

        <div class="links-table-wrap" style="margin-top:20px">
          <div class="links-table-head">
            <h2>${t('روابطك', 'Your links')}</h2>
            <span class="mono" style="font-size:11px;color:var(--muted-2)">comm.ly</span>
          </div>
          <div style="overflow-x:auto">
            <table class="links">
              <thead><tr>
                <th>${t('الرابط', 'Link')}</th>
                <th>${t('الوجهة', 'Destination')}</th>
                <th>${t('النقرات', 'Clicks')}</th>
                <th>${t('أُنشئ', 'Created')}</th>
                <th></th>
              </tr></thead>
              <tbody id="linksBody"></tbody>
            </table>
          </div>
          <p id="emptyState" style="padding:18px;color:var(--muted-2);font-size:13.5px;display:none">${t('لا توجد روابط بعد — أنشئ أول رابط.', 'No links yet — create your first one.')}</p>
        </div>

        <form id="newLinkForm" class="shorten-card" style="margin-top:20px;padding:16px">
          <div class="shorten-main">
            <label class="field-url"><input id="linkUrl" type="url" required placeholder="${t('الصق الرابط الطويل…', 'Paste the long link…')}" /></label>
            <button class="btn btn-primary" type="submit">${t('أنشئ الرابط', 'Create link')}</button>
          </div>
          <div class="shorten-options">
            <label class="opt-field"><span class="suffix">comm.ly/</span><input id="linkSlug" type="text" maxlength="24" placeholder="${t('كود مخصص (اختياري)', 'custom-code (optional)')}" /></label>
            <label class="opt-field"><select id="linkExpiry">
              <option value="0">${t('بلا انتهاء', 'Never')}</option>
              <option value="24">${t('24 ساعة', '24 hours')}</option>
              <option value="168">${t('7 أيام', '7 days')}</option>
              <option value="720">${t('30 يوماً', '30 days')}</option>
            </select></label>
          </div>
          <p id="dashStatus" style="margin:12px 4px 0;font-size:13px;color:var(--muted)"></p>
        </form>
      </div>
    </section>
  </main>`;
}

export function renderSite({ site, brand, sites, plans, addons }) {
  const siteCss = `
    :root { --c1: ${site.colors[0]}; --c2: ${site.colors[1]}; --accent: ${site.colors[0]}; --accent-2: ${site.colors[1]}; --accent-3: ${site.accent3}; --grad: linear-gradient(96deg, ${site.colors[0]}, ${site.colors[1]} 60%, ${site.accent3}); }
    html[data-theme="light"] { --accent: color-mix(in srgb, ${site.colors[0]} 62%, #0f172a); --accent-2: color-mix(in srgb, ${site.colors[1]} 72%, #0f172a); }
  `;

  const pages = [];
  const defs = [
    { key: 'home', titleKey: 'metaTitle', descKey: 'metaDesc' },
    { key: 'network', titleAr: `صفحة الشبكة — ${site.host} | شبكة comm.ly`, titleEn: `Network — ${site.host} | comm.ly network`, descAr: `تعرّف على شبكة comm.ly: ${sites.length} نطاقات تعمل بمحرك اختصار مشترك.`, descEn: `Meet the comm.ly network: ${sites.length} domains sharing one shortening engine.` },
    { key: 'privacy', titleAr: `سياسة الخصوصية — ${site.host}`, titleEn: `Privacy policy — ${site.host}`, descAr: 'كيف نجمع بياناتك ونحميها.', descEn: 'How we collect and protect your data.' },
    { key: 'terms', titleAr: `شروط الاستخدام العادل — ${site.host}`, titleEn: `Fair use terms — ${site.host}`, descAr: 'شروط استخدام عادلة تحمي الخدمة والمستخدمين.', descEn: 'Fair terms that protect the service and its users.' },
    { key: 'contact', titleAr: `اتصل بنا — ${site.host}`, titleEn: `Contact — ${site.host}`, descAr: 'تواصل مع فريق شبكة comm.ly.', descEn: 'Get in touch with the comm.ly network team.' }
  ];
  if (site.role === 'main') {
    defs.push({ key: 'pricing', titleAr: 'الأسعار والخطط — comm.ly', titleEn: 'Pricing & plans — comm.ly', descAr: 'خطط مجانية وسخية، وأسعار أقل من المنافسين بنسبة 40–80%.', descEn: 'Generous free plan and pricing 40–80% below competitors.' });
    defs.push({ key: 'login', titleAr: 'تسجيل الدخول — comm.ly', titleEn: 'Sign in — comm.ly', descAr: 'ادخل إلى حسابك في شبكة comm.ly.', descEn: 'Sign in to your comm.ly network account.' });
    defs.push({ key: 'register', titleAr: 'إنشاء حساب — comm.ly', titleEn: 'Create account — comm.ly', descAr: 'حساب مجاني: 200 رابط شهرياً وتحليلات.', descEn: 'Free account: 200 links/month and analytics.' });
    defs.push({ key: 'app', titleAr: 'لوحة الحساب — comm.ly', titleEn: 'Account dashboard — comm.ly', descAr: 'إدارة روابطك وتحليلاتك.', descEn: 'Manage your links and analytics.' });
  }

  for (const def of defs) {
    for (const lang of ['ar', 'en']) {
      const title = def.titleAr ? pick(lang, def.titleAr, def.titleEn) : l(site[def.titleKey], lang);
      const description = def.descAr ? pick(lang, def.descAr, def.descEn) : l(site[def.descKey], lang);
      const path = { key: def.key, lang };
      let body;
      if (def.key === 'home') body = homePage({ site, lang, brand, sites, plans });
      else if (def.key === 'network') body = networkPage({ site, lang, brand, sites });
      else if (def.key === 'pricing') body = pricingPage({ site, lang, brand, plans, addons });
      else if (def.key === 'login' || def.key === 'register') body = authPage({ kind: def.key, site, lang });
      else if (def.key === 'app') body = appPage({ site, lang });
      else if (def.key === 'privacy' || def.key === 'terms') body = legalContent(def.key, { site, lang, brand });
      else body = contactPage({ site, lang, brand });

      const jsonLd = def.key === 'home' ? {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'Organization', name: site.host, url: `https://${site.host}/`, parentOrganization: { '@type': 'Organization', name: 'comm.ly', url: brand.url }, sameAs: sites.map((s) => `https://${s.host}/`) },
          { '@type': 'WebSite', name: site.host, url: `https://${site.host}/`, inLanguage: ['ar', 'en'] },
          { '@type': 'FAQPage', mainEntity: site.faq.map((item) => ({ '@type': 'Question', name: l(item.q, lang), acceptedAnswer: { '@type': 'Answer', text: l(item.a, lang) } })) }
        ]
      } : null;

      const html = `${head({ site, lang, title, description, path, siteCss, jsonLd })}
<body>
  <div class="bg-grid" aria-hidden="true"></div>
  <div class="bg-glow bg-glow-1" aria-hidden="true"></div>
  <div class="bg-glow bg-glow-2" aria-hidden="true"></div>
  ${nav({ site, lang, brand, pageKey: def.key })}
  ${body}
  ${footer({ site, lang, brand, sites })}
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <script src="/assets/theme.js"></script>
  <script src="/assets/app.js"></script>
  ${site.role === 'main' && ['login', 'register', 'app'].includes(def.key) ? '<script src="/assets/account.js"></script>' : ''}
</body>
</html>`;

      pages.push({ key: def.key, lang, path: urlFor(site, def.key, lang), html });
    }
  }

  return pages;
}

export function renderNotFound({ site, lang = 'ar' }) {
  return `<!DOCTYPE html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404 — ${site.host}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05060a;color:#eef1f6;font-family:system-ui,sans-serif;text-align:center;padding:24px}
h1{font-size:4rem;margin:0;background:linear-gradient(96deg,${site.colors[0]},${site.colors[1]});-webkit-background-clip:text;background-clip:text;color:transparent}
p{color:#9aa4b8;max-width:440px;margin:14px auto 26px;line-height:1.8}
a{display:inline-block;padding:12px 22px;border-radius:12px;background:linear-gradient(135deg,${site.colors[0]},${site.colors[1]});color:#fff;text-decoration:none;font-weight:700}</style>
</head><body><main><h1>404</h1><p>${lang === 'ar' ? 'هذا الرابط غير موجود أو انتهت صلاحيته. جرّب إنشاء رابط جديد من الصفحة الرئيسية.' : 'This link does not exist or has expired. Try creating a new one from the homepage.'}</p>
<a href="/">${lang === 'ar' ? 'العودة للرئيسية' : 'Back home'}</a></main></body></html>`;
}

export function renderGone({ site, lang = 'ar' }) {
  return `<!DOCTYPE html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>410 — ${site.host}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05060a;color:#eef1f6;font-family:system-ui,sans-serif;text-align:center;padding:24px}
h1{font-size:3.2rem;margin:0;background:linear-gradient(96deg,${site.colors[0]},${site.colors[1]});-webkit-background-clip:text;background-clip:text;color:transparent}
p{color:#9aa4b8;max-width:440px;margin:14px auto 26px;line-height:1.8}
a{display:inline-block;padding:12px 22px;border-radius:12px;background:linear-gradient(135deg,${site.colors[0]},${site.colors[1]});color:#fff;text-decoration:none;font-weight:700}</style>
</head><body><main><h1>410</h1><p>${lang === 'ar' ? 'انتهت صلاحية هذا الرابط.' : 'This link has expired.'}</p>
<a href="/">${lang === 'ar' ? 'العودة للرئيسية' : 'Back home'}</a></main></body></html>`;
}
