# Dishview — augmented-reality menu

Diners scan the table QR, open the menu and see each dish at real size on their table
(Android: WebXR / Scene Viewer · iPhone: AR Quick Look). No app install; also installable as a PWA.

Live: https://dishview-menu.vercel.app · Table QR cards: `/mesas.html`

## Files
- `index.html` — the menu app (no need to edit)
- `menu.json` — all restaurant content: name, logo, colours, sections, dishes, prices, EU allergens (1–14), pairings
- `models/` — real 3D scans of each dish (`.glb`; optional `.usdz` for iPhone)
- `photos/` — real dish photos (optional thumbnails/posters)
- `manifest.webmanifest`, `sw.js`, icons — PWA (home-screen install, offline cache)
- `tools/process-scan.mjs` — prepares a phone scan for the menu

## Add a dish scan
1. Scan the plated dish (Polycam/KIRI, Photo mode, Photogrammetry, detail Medium, object masking ON). Export GLB/GLTF.
2. Measure the real plate (longest side, cm), then:
   `npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions sharp`
   `node tools/process-scan.mjs scan.glb models/<dish>.glb <cm>`
   (real-world scale, centred on the table, smooth normals, 2048px textures)
3. In `menu.json` set `"model": "models/<dish>.glb"` (and `"photo"` if you have one).
4. Commit and push — Vercel deploys automatically.

Dishes without `model` show as text only (no AR button), so dishes can be added gradually.
