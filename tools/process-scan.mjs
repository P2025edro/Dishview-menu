// Prepare a phone scan (Polycam/KIRI GLB) for the AR menu:
// real-world scale, centred on the table, smooth normals, phone-friendly textures.
// usage: node process-scan.mjs in.glb out.glb <longest-side-in-cm>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { textureCompress, dedup, prune, getBounds } from '@gltf-transform/functions';
import sharp from 'sharp';

const [,, inp, out, cm] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];

await doc.transform(dedup(), prune(),
  textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [2048, 2048], quality: 85, slots: /^baseColor/ }),
  textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [1024, 1024], quality: 85, slots: /^(normal|occlusion|metallicRoughness)/ }));

// smooth vertex normals on the indexed mesh (keeps the file small; scans often ship without normals)
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
  if (prim.getAttribute('NORMAL')) continue;
  const pos = prim.getAttribute('POSITION'), idx = prim.getIndices(); if (!idx) continue;
  const n = new Float32Array(pos.getCount() * 3), a = [0,0,0], b = [0,0,0], c = [0,0,0];
  for (let i = 0; i < idx.getCount(); i += 3) {
    const i0 = idx.getScalar(i), i1 = idx.getScalar(i+1), i2 = idx.getScalar(i+2);
    pos.getElement(i0, a); pos.getElement(i1, b); pos.getElement(i2, c);
    const ux=b[0]-a[0], uy=b[1]-a[1], uz=b[2]-a[2], vx=c[0]-a[0], vy=c[1]-a[1], vz=c[2]-a[2];
    const fx=uy*vz-uz*vy, fy=uz*vx-ux*vz, fz=ux*vy-uy*vx;
    for (const j of [i0,i1,i2]) { n[j*3]+=fx; n[j*3+1]+=fy; n[j*3+2]+=fz; }
  }
  for (let j = 0; j < n.length; j += 3) { const l = Math.hypot(n[j],n[j+1],n[j+2]) || 1; n[j]/=l; n[j+1]/=l; n[j+2]/=l; }
  prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(n).setBuffer(pos.getBuffer()));
}

// longest horizontal extent via PCA over XZ vertex positions (object may sit diagonally)
let pts = [];
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
  const a = prim.getAttribute('POSITION'); const v = [0,0,0];
  for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); pts.push([v[0], v[2]]); }
}
const mx = pts.reduce((s,p)=>s+p[0],0)/pts.length, mz = pts.reduce((s,p)=>s+p[1],0)/pts.length;
let sxx=0,szz=0,sxz=0; for (const [x,z] of pts){ sxx+=(x-mx)**2; szz+=(z-mz)**2; sxz+=(x-mx)*(z-mz); }
const ang = 0.5*Math.atan2(2*sxz, sxx-szz), c=Math.cos(ang), s=Math.sin(ang);
let lo=Infinity, hi=-Infinity; for (const [x,z] of pts){ const u=(x-mx)*c+(z-mz)*s; lo=Math.min(lo,u); hi=Math.max(hi,u); }
const current = hi - lo, k = (Number(cm)/100) / current;

const b0 = getBounds(scene);
for (const node of scene.listChildren()) {
  const t = node.getTranslation(), sc = node.getScale();
  node.setScale([sc[0]*k, sc[1]*k, sc[2]*k]);
  node.setTranslation([(t[0]-(b0.min[0]+b0.max[0])/2)*k, (t[1]-b0.min[1])*k, (t[2]-(b0.min[2]+b0.max[2])/2)*k]);
}
const b = getBounds(scene);
await io.write(out, doc);
console.log(`scan length ${(current*100).toFixed(1)} units -> ${cm} cm (x${k.toFixed(3)}); final size cm:`,
  ((b.max[0]-b.min[0])*100).toFixed(1), ((b.max[1]-b.min[1])*100).toFixed(1), ((b.max[2]-b.min[2])*100).toFixed(1));
