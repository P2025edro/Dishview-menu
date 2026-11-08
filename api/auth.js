// POST /api/auth {slug?, password} — log in (no slug = Dishview super admin) · GET — current session · DELETE — log out
import { handler, json, bad, readBody, sessionCookie, clearCookie, getSession, checkOwnerPassword, safeEqual, SLUG_RE } from './_lib.js';
const wait = ms => new Promise(r => setTimeout(r, ms));
export const POST = handler(async req => {
  const { slug = '', password = '' } = await readBody(req, 2000);
  if (!password) return bad('Password required');
  if (!slug) {
    if (process.env.ADMIN_PASSWORD && safeEqual(password, process.env.ADMIN_PASSWORD))
      return json({ role: 'super' }, 200, { 'set-cookie': sessionCookie({ role: 'super' }) });
  } else if (SLUG_RE.test(slug) && await checkOwnerPassword(slug, password)) {
    return json({ role: 'owner', slug }, 200, { 'set-cookie': sessionCookie({ role: 'owner', slug }) });
  }
  await wait(800); // slow down guessing
  return bad('Wrong restaurant or password', 401);
});
export const GET = handler(async req => {
  const s = getSession(req);
  return s ? json({ role: s.role, slug: s.slug || null }) : bad('Not logged in', 401);
});
export const DELETE = handler(async () => json({ ok: true }, 200, { 'set-cookie': clearCookie() }));
