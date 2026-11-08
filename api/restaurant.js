// GET/PUT/DELETE /api/restaurant?r=<slug> — read/save the editable menu (owner of that restaurant or super admin)
// PUT body: the full menu document, optionally with "newPassword" to change the owner's password.
import { handler, json, bad, readBody, getSession, canEdit, getMenu, saveMenu, cleanMenu, setOwnerPassword, deleteRestaurant, SLUG_RE } from './_lib.js';
const slugOf = req => new URL(req.url).searchParams.get('r') || '';
export const GET = handler(async req => {
  const slug = slugOf(req); if (!SLUG_RE.test(slug)) return bad('Unknown restaurant', 404);
  if (!canEdit(getSession(req), slug)) return bad('Forbidden', 403);
  const doc = await getMenu(slug); return doc ? json(doc) : bad('Unknown restaurant', 404);
});
export const PUT = handler(async req => {
  const slug = slugOf(req); if (!SLUG_RE.test(slug)) return bad('Unknown restaurant', 404);
  if (!canEdit(getSession(req), slug)) return bad('Forbidden', 403);
  if (!await getMenu(slug)) return bad('Unknown restaurant', 404);
  const body = await readBody(req);
  if (body.newPassword) {
    if (String(body.newPassword).length < 8) return bad('Password must have at least 8 characters');
    await setOwnerPassword(slug, String(body.newPassword));
  }
  const doc = cleanMenu(body);
  await saveMenu(slug, doc);
  return json({ ok: true, menu: { ...doc, slug } });
});
export const DELETE = handler(async req => {
  const slug = slugOf(req); if (!SLUG_RE.test(slug)) return bad('Unknown restaurant', 404);
  if (getSession(req)?.role !== 'super') return bad('Forbidden', 403);
  await deleteRestaurant(slug); return json({ ok: true });
});
