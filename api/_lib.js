// Shared helpers for the Dishview API (Vercel Node functions, Web Request/Response signature).
import { put, list, del } from '@vercel/blob';
import crypto from 'node:crypto';

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const SECRET = process.env.SESSION_SECRET || '';
const COOKIE = 'dv_session';

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
export const bad = (msg, status = 400) => json({ error: msg }, status);

export async function readBody(req, max = 300_000) {
  const text = await req.text();
  if (text.length > max) throw Object.assign(new Error('Payload too large'), { status: 413 });
  try { return JSON.parse(text || '{}'); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}

// ---------- blob-backed JSON documents
async function findBlob(prefix) {
  const { blobs } = await list({ prefix, limit: 100 });
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  return blobs;
}
export async function readJSON(pathname) {
  const [b] = (await findBlob(pathname)).filter(x => x.pathname === pathname);
  if (!b) return null;
  const r = await fetch(`${b.url}?v=${Date.parse(b.uploadedAt)}`, { cache: 'no-store' });
  return r.ok ? r.json() : null;
}
export const writeJSON = (pathname, data) =>
  put(pathname, JSON.stringify(data), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });

// restaurant documents (public by nature: they are the published menu)
export const menuPath = slug => `data/r/${slug}.json`;
export const getMenu = slug => readJSON(menuPath(slug));
export const saveMenu = (slug, doc) => writeJSON(menuPath(slug), { ...doc, slug, updatedAt: new Date().toISOString() });
export async function listMenus() {
  const blobs = await findBlob('data/r/');
  return blobs.map(b => b.pathname.replace(/^data\/r\/|\.json$/g, '')).filter(s => SLUG_RE.test(s));
}

// owner credentials live under unguessable URLs (random suffix) and are only located server-side via list()
export async function setOwnerPassword(slug, password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  const old = await findBlob(`auth/${slug}/`);
  await put(`auth/${slug}/cred.json`, JSON.stringify({ salt, hash, at: Date.now() }), { access: 'public', contentType: 'application/json', addRandomSuffix: true, cacheControlMaxAge: 60 });
  if (old.length) await del(old.map(b => b.url));
}
export async function checkOwnerPassword(slug, password) {
  const [b] = await findBlob(`auth/${slug}/`);
  if (!b) return false;
  const r = await fetch(b.url, { cache: 'no-store' }); if (!r.ok) return false;
  const { salt, hash } = await r.json();
  const test = crypto.scryptSync(String(password), salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}
export async function deleteRestaurant(slug) {
  const blobs = [...await findBlob(`auth/${slug}/`), ...await findBlob(menuPath(slug)), ...await findBlob(`media/${slug}/`)];
  if (blobs.length) await del(blobs.map(b => b.url));
}

// ---------- sessions (HMAC-signed cookie)
const b64u = b => Buffer.from(b).toString('base64url');
function sign(payload) {
  const body = b64u(JSON.stringify(payload));
  return `${body}.${crypto.createHmac('sha256', SECRET).update(body).digest('base64url')}`;
}
function verify(token) {
  if (!token || !SECRET) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  const p = JSON.parse(Buffer.from(body, 'base64url').toString());
  return p.exp > Date.now() ? p : null;
}
export function sessionCookie(payload) {
  const days = 14, token = sign({ ...payload, exp: Date.now() + days * 864e5 });
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${days * 86400}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
export function getSession(req) {
  const m = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  return m ? verify(m[1]) : null;
}
export const canEdit = (s, slug) => !!s && (s.role === 'super' || (s.role === 'owner' && s.slug === slug));
export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ---------- restaurant document sanitising (keeps the stored shape predictable)
const str = (v, n = 500) => (typeof v === 'string' ? v.slice(0, n) : '');
const i18n = (v, n) => { const o = {}; if (v && typeof v === 'object') for (const [k, t] of Object.entries(v)) if (/^[a-z]{2}$/.test(k)) o[k] = str(t, n); return o; };
const url = v => (typeof v === 'string' && /^(https:\/\/|\/)[^\s"'<>]*$/.test(v) ? v.slice(0, 600) : '');
const color = v => (typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\))$/i.test(v) ? v : undefined);
export function cleanMenu(d) {
  const R = d.restaurant || {};
  const langs = Array.isArray(R.languages) ? R.languages.filter(l => /^[a-z]{2}$/.test(l)).slice(0, 4) : ['en'];
  const theme = {}; for (const k of ['bg', 'surface', 'text', 'muted', 'accent', 'line']) { const c = color(R.theme?.[k]); if (c) theme[k] = c; }
  const sections = (Array.isArray(d.sections) ? d.sections : []).slice(0, 40).map(s => ({ id: str(s.id, 40).replace(/[^a-z0-9-]/gi, '') || crypto.randomUUID().slice(0, 8), name: i18n(s.name, 80) }));
  const ids = new Set(sections.map(s => s.id));
  const dishes = (Array.isArray(d.dishes) ? d.dishes : []).slice(0, 300).map(x => ({
    id: str(x.id, 40).replace(/[^a-z0-9-]/gi, '') || crypto.randomUUID().slice(0, 8),
    section: ids.has(x.section) ? x.section : (sections[0]?.id || ''),
    price: Number.isFinite(+x.price) ? Math.max(0, Math.round(+x.price * 100) / 100) : 0,
    hidePrice: !!x.hidePrice, chef: !!x.chef, hidden: !!x.hidden,
    name: i18n(x.name, 120), desc: i18n(x.desc, 600), pairing: i18n(x.pairing, 120),
    allergens: (Array.isArray(x.allergens) ? x.allergens : []).map(Number).filter(n => n >= 1 && n <= 14).slice(0, 14),
    model: url(x.model), usdz: url(x.usdz), photo: url(x.photo), size: str(x.size, 20),
  }));
  return {
    restaurant: {
      name: str(R.name, 80) || 'Restaurant', subtitle: i18n(R.subtitle, 80), city: str(R.city, 60), logo: url(R.logo),
      languages: langs.length ? langs : ['en'], defaultLanguage: langs.includes(R.defaultLanguage) ? R.defaultLanguage : (langs[0] || 'en'),
      currency: str(R.currency, 3) || 'EUR', theme, footerNote: i18n(R.footerNote, 300),
    },
    sections, dishes,
  };
}

export function handler(fn) {
  return async req => {
    try { return await fn(req); }
    catch (e) { console.error(e); return bad(e.status ? e.message : 'Server error', e.status || 500); }
  };
}
