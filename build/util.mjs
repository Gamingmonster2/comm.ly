/** Tiny shared helpers for the static build. */

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Localize either a plain string or an { ar, en } object. */
export function loc(value, lang) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[lang] !== undefined ? value[lang] : value.ar;
}
