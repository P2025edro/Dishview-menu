// POST /api/upload — Vercel Blob client-upload handshake. Browsers upload straight to Blob (no 4.5 MB function limit);
// this route only issues a short-lived token after checking the session can edit that restaurant.
import { handleUpload } from '@vercel/blob/client';
import { handler, json, bad, getSession, canEdit, SLUG_RE } from './_lib.js';
const TYPES = { image: ['image/jpeg', 'image/png', 'image/webp'], model: ['model/gltf-binary', 'application/octet-stream'], usdz: ['model/vnd.usdz+zip', 'application/octet-stream', 'application/zip'] };
export const POST = handler(async req => {
  const body = await req.json();
  const session = getSession(req);
  try {
    const result = await handleUpload({
      body, request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { slug, kind } = JSON.parse(clientPayload || '{}');
        if (!SLUG_RE.test(slug || '') || !canEdit(session, slug)) throw new Error('Not allowed');
        if (!pathname.startsWith(`media/${slug}/`) || pathname.includes('..')) throw new Error('Bad path');
        return { allowedContentTypes: TYPES[kind] || TYPES.image, maximumSizeInBytes: (kind === 'image' ? 8 : 40) * 1024 * 1024, addRandomSuffix: true, cacheControlMaxAge: 31536000 };
      },
    });
    return json(result);
  } catch (e) { return bad(e.message || 'Upload refused', 403); }
});
