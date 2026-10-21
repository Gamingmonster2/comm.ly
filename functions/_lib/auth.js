/**
 * Auth helpers — users, sessions, password hashing (Web Crypto PBKDF2).
 * Cookie: HttpOnly session id stored in D1.
 */
const SESSION_COOKIE = 'commly_session';
const SESSION_TTL_DAYS = 30;
const PBKDF2_ITERATIONS = 120_000;

function b64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
function fromB64(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(bits)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('pbkdf2$')) return false;
  const [, iterations, saltB64, hashB64] = stored.split('$');
  try {
    const salt = fromB64(saltB64);
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: Number(iterations), hash: 'SHA-256' },
      keyMaterial,
      256
    );
    const a = new Uint8Array(bits);
    const b = fromB64(hashB64);
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
    return diff === 0;
  } catch {
    return false;
  }
}

export function randomId(bytes = 32) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function parseCookies(request) {
  const header = request.headers.get('cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

export function sessionCookie(id, maxAge = SESSION_TTL_DAYS * 86_400) {
  return `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearedSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function createSession(env, request, userId) {
  const id = randomId();
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000).toISOString();
  const country = (request.cf && request.cf.country) || null;
  const agent = (request.headers.get('user-agent') || '').slice(0, 200);
  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, ip_country, user_agent) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, userId, expires, country, agent).run();
  return id;
}

export async function getSessionUser(env, request) {
  const id = parseCookies(request)[SESSION_COOKIE];
  if (!id) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.plan, w.id AS workspace_id, w.plan AS workspace_plan
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN workspaces w ON w.owner_id = u.id
     WHERE s.id = ? AND s.expires_at > ?`
  ).bind(id, new Date().toISOString()).first();
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    plan: row.workspace_plan || row.plan || 'free',
    workspaceId: row.workspace_id
  };
}

export async function destroySession(env, request) {
  const id = parseCookies(request)[SESSION_COOKIE];
  if (id) {
    try {
      await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
    } catch { /* ignore */ }
  }
}

export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function tooManyAttempts(key, store, limit = 12, windowMs = 600_000) {
  const now = Date.now();
  const bucket = store.get(key) || { count: 0, reset: now + windowMs };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + windowMs;
  }
  bucket.count += 1;
  store.set(key, bucket);
  if (store.size > 5_000) store.clear();
  return bucket.count > limit;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
