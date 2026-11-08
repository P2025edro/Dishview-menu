# Dishview — augmented-reality menus for restaurants

Guests scan the table QR, open the restaurant's menu and see each dish at real size on their table
(Android: WebXR / Scene Viewer · iPhone: AR Quick Look). No app install; installable as a PWA.

| URL | What |
|---|---|
| `/` | Sales site with "Request a demo" form |
| `/r/<slug>` | A restaurant's live menu (`/r/demo` = built-in demo) |
| `/mesas.html?r=<slug>` | Print-ready table QR cards |
| `/admin` | Admin panel (team login or restaurant login) |

## How it works
- **API** (`/api`, Vercel Functions): `menu` (public), `auth`, `restaurants`, `restaurant`, `upload`, `leads`, `manifest`.
- **Storage**: Vercel Blob store `dishview-media` — menus as JSON (`data/r/<slug>.json`), photos/3D under `media/<slug>/`,
  owner password hashes (scrypt) under unguessable URLs, demo requests under `leads/`.
- **Logins**: team admin = no link name + `ADMIN_PASSWORD`; each restaurant = its link name + its own password.
  Sessions are HMAC-signed cookies (`SESSION_SECRET`).
- **3D scans**: uploaded from the admin panel. The browser fixes real-world size (enter the plate size in cm),
  centres the dish on the table, adds normals and caps textures at 2048 px before uploading straight to Blob.

## Environment variables (Vercel project `dishview`)
- `BLOB_READ_WRITE_TOKEN` — set automatically by the Blob store
- `SESSION_SECRET`, `ADMIN_PASSWORD` — required
- `RESEND_API_KEY`, `LEAD_EMAIL` (optional `LEAD_FROM`) — email each demo request; without them requests are listed in the admin panel

## Scanning a dish
Polycam or KIRI Engine, Photo mode → Photogrammetry, detail Medium, object masking ON → export GLB/GLTF.
Measure the plate's longest side, then upload it in the admin panel with that size.

## Development
`npm install` · rebuild the admin browser bundle with `npm run vendor` (gltf-transform + Blob client → `vendor/admin-libs.js`).
`tools/process-scan.mjs` does the same scan preparation from the command line.
