// GET /api/menu?r=<slug> — public, published menu for a restaurant
import { handler, json, bad, getMenu, SLUG_RE } from './_lib.js';
export const GET = handler(async req => {
  const slug = new URL(req.url).searchParams.get('r') || '';
  if (!SLUG_RE.test(slug)) return bad('Unknown restaurant', 404);
  let doc = await getMenu(slug);
  // the public demo works out of the box from the bundled /demo-menu.json until a real "demo" restaurant is saved
  if (!doc && slug === 'demo') doc = await fetch(new URL('/demo-menu.json', req.url)).then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!doc) return bad('Unknown restaurant', 404);
  doc.dishes = (doc.dishes || []).filter(d => !d.hidden);
  return json(doc, 200, { 'cache-control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300' });
});
