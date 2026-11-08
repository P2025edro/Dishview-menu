// GET /api/restaurants — list (super admin) · POST {slug, name, password} — create a restaurant (super admin)
import { handler, json, bad, readBody, getSession, listMenus, getMenu, saveMenu, setOwnerPassword, cleanMenu, SLUG_RE } from './_lib.js';
export const GET = handler(async req => {
  const s = getSession(req); if (s?.role !== 'super') return bad('Forbidden', 403);
  const slugs = await listMenus();
  const items = await Promise.all(slugs.map(async slug => { const d = await getMenu(slug); return { slug, name: d?.restaurant?.name || slug, dishes: d?.dishes?.length || 0, updatedAt: d?.updatedAt }; }));
  return json(items.sort((a, b) => a.name.localeCompare(b.name)));
});
export const POST = handler(async req => {
  const s = getSession(req); if (s?.role !== 'super') return bad('Forbidden', 403);
  const { slug = '', name = '', password = '' } = await readBody(req, 5000);
  if (!SLUG_RE.test(slug)) return bad('Link name: lowercase letters, numbers and dashes only');
  if (String(password).length < 8) return bad('Password must have at least 8 characters');
  if (await getMenu(slug)) return bad('That link name is already taken', 409);
  const doc = cleanMenu({
    restaurant: { name, city: 'Dublin', languages: ['en'], defaultLanguage: 'en', currency: 'EUR', subtitle: { en: 'Menu' },
      footerNote: { en: 'Please inform your server of any allergies or dietary requirements.' } },
    sections: [{ id: 'starters', name: { en: 'Starters' } }, { id: 'mains', name: { en: 'Main Courses' } }, { id: 'desserts', name: { en: 'Desserts' } }],
    dishes: [],
  });
  await saveMenu(slug, doc);
  await setOwnerPassword(slug, password);
  return json({ ok: true, slug }, 201);
});
