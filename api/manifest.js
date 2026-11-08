// GET /api/manifest?r=<slug> — per-restaurant PWA manifest, so "Add to home screen" opens that restaurant's menu
import { handler, getMenu, SLUG_RE } from './_lib.js';
export const GET = handler(async req => {
  const slug = new URL(req.url).searchParams.get('r') || '';
  const doc = SLUG_RE.test(slug) ? await getMenu(slug).catch(() => null) : null;
  const name = doc?.restaurant?.name || 'Menu', bg = doc?.restaurant?.theme?.bg || '#0d0c0b';
  const m = { name: `${name} — Menu`, short_name: name.slice(0, 12), start_url: SLUG_RE.test(slug) ? `/r/${slug}` : '/', scope: '/', display: 'standalone', orientation: 'portrait', background_color: bg, theme_color: bg,
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] };
  return new Response(JSON.stringify(m), { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=300' } });
});
