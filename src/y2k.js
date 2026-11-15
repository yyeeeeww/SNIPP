// favdotcom / 4RM — Y2K web-3D snippet (Bryce / Poser / PS2-era renders): photo textures, photo skies,
// Phong highlights, hard shadows, chrome WordArt. Red roses growing out of concrete. No camera shake.
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const params = new URLSearchParams(location.search);
const W = +(params.get('w') || 405), H = +(params.get('h') || 720);
const CAPTURE = params.has('capture');
const XF = 0.8;

// ---------------- timeline ----------------
let TL = { fps: 30, sections: [
  { scene: 'kingdom', dur: 15, drop: 1.75 }, { scene: 'eyehouse', dur: 8.4, drop: 1.78 }, { scene: 'bridge', dur: 6.6, drop: 0 },
  { scene: 'clocktown', dur: 8, drop: 2.4 }, { scene: 'temple', dur: 7, drop: 0 }, { scene: 'pool', dur: 15.3, drop: 0, out: 11.8 }],
  env: null, bass: null, kicks: [], audio: null };
try { const r = await fetch('./timeline_y2k.json', { cache: 'no-store' }); if (r.ok) TL = { ...TL, ...(await r.json()) }; } catch (e) {}
const TOTAL = TL.sections.reduce((a, s) => a + s.dur, 0);
{ let a = 0; for (const s of TL.sections) { s.t0 = a; a += s.dur; } }

// ---------------- helpers ----------------
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const ease = (k) => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const frameOf = (t) => Math.floor(t * TL.fps + 1e-6);
const arr = (a, t, d) => a ? (a[clamp(frameOf(t), 0, a.length - 1)] ?? 0) : d;
const envAt = (t) => arr(TL.env, t, 0.5);
function envSmooth(t) { let s = 0; for (let i = -4; i <= 4; i++) s += envAt(t + i / TL.fps); return s / 9; }
function kickAt(t, len = 0.35) { let b = 0; for (const o of TL.kicks) { const d = t - o; if (d >= -1e-6 && d < len) b = Math.max(b, Math.pow(1 - d / len, 2)); } return b; }
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------- renderer ----------------
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);
const mkRT = () => new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 0 });
const rtA = mkRT(), rtB = mkRT();

// ---------------- assets ----------------
const loader = new THREE.TextureLoader();
const cache = {};
async function load(name) {
  if (!cache[name]) cache[name] = await loader.loadAsync(`./assets_dc/${name}`);
  return cache[name];
}
async function tex(name, rx = 1, ry = rx) {
  const t = (await load(name)).clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 1; t.needsUpdate = true; return t;
}
async function sky(name) { const t = (await load(name)).clone(); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; }
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const font = await new FontLoader().loadAsync('./assets_dc/gentilis_bold.typeface.json');
try { await document.fonts.load('bold 64px "WenQuanYi Zen Hei"'); } catch (e) {}

// ---------------- procedural textures (painted, Y2K clip-art style) ----------------
const R0 = rng(77);
const EYE = canvasTex(512, 512, (g, w, h) => {
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#c2343c'); bg.addColorStop(.5, '#f0b0a8'); bg.addColorStop(1, '#b02028');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${R0() < .5 ? '255,255,255' : '120,0,10'},${R0() * .08})`; g.fillRect(R0() * w, R0() * h, 3, 3); }
  g.save(); g.beginPath(); g.ellipse(256, 256, 220, 120, 0, 0, 7); g.clip();
  const wh = g.createRadialGradient(256, 240, 20, 256, 256, 230); wh.addColorStop(0, '#ffffff'); wh.addColorStop(.7, '#e8dcd8'); wh.addColorStop(1, '#b08880'); g.fillStyle = wh; g.fillRect(0, 0, w, h);
  const ir = g.createRadialGradient(256, 256, 10, 256, 256, 105); ir.addColorStop(0, '#0a1a40'); ir.addColorStop(.35, '#2a68c0'); ir.addColorStop(.85, '#4a8ad8'); ir.addColorStop(1, '#0a1a38');
  g.fillStyle = ir; g.beginPath(); g.arc(256, 256, 105, 0, 7); g.fill();
  for (let i = 0; i < 160; i++) { const a = R0() * 7, r1 = 35 + R0() * 20, r2 = 80 + R0() * 25; g.strokeStyle = `rgba(${R0() < .5 ? '180,220,255' : '10,30,80'},.35)`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(256 + Math.cos(a) * r1, 256 + Math.sin(a) * r1); g.lineTo(256 + Math.cos(a) * r2, 256 + Math.sin(a) * r2); g.stroke(); }
  g.fillStyle = '#020204'; g.beginPath(); g.arc(256, 256, 40, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(225, 222, 18, 12, -.5, 0, 7); g.fill();
  g.restore();
  g.strokeStyle = '#3a0a10'; g.lineWidth = 8; g.beginPath(); g.ellipse(256, 256, 220, 120, 0, 0, 7); g.stroke();
});
function mouthTex(open) {
  return canvasTex(256, 512, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, w, 0); bg.addColorStop(0, '#d04048'); bg.addColorStop(.5, '#f4b8b0'); bg.addColorStop(1, '#c03038');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const oh = open ? 170 : 40;
    g.fillStyle = '#b8101e'; g.beginPath(); g.ellipse(128, 256, 112, oh + 40, 0, 0, 7); g.fill();
    g.fillStyle = '#1a0004'; g.beginPath(); g.ellipse(128, 256, 92, oh, 0, 0, 7); g.fill();
    g.fillStyle = '#7a0010'; g.beginPath(); g.ellipse(128, 256 + oh * .55, 60, oh * .35, 0, 0, 7); g.fill();
    g.fillStyle = '#f6f2ea';
    for (let i = 0; i < 6; i++) { const x = 52 + i * 26; g.beginPath(); g.roundRect(x, 256 - oh - 2, 22, 34, 6); g.fill(); g.beginPath(); g.roundRect(x, 256 + oh - 32, 22, 34, 6); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(90, 256 - oh - 28, 30, 8, 0, 0, 7); g.fill();
  });
}
const MOUTH = [mouthTex(false), mouthTex(true)];
const CLOCK = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#141414'; g.fillRect(0, 0, w, h);
  const f = g.createRadialGradient(256, 256, 10, 256, 256, 230); f.addColorStop(0, '#fffbe8'); f.addColorStop(1, '#e8dcb0');
  g.fillStyle = f; g.beginPath(); g.arc(256, 256, 225, 0, 7); g.fill();
  g.strokeStyle = '#111'; g.lineWidth = 10; g.beginPath(); g.arc(256, 256, 225, 0, 7); g.stroke();
  const RN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  g.fillStyle = '#151515'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 44px serif';
  RN.forEach((n, i) => { const a = i / 12 * Math.PI * 2 - Math.PI / 2; g.save(); g.translate(256 + Math.cos(a) * 180, 256 + Math.sin(a) * 180); g.rotate(a + Math.PI / 2); g.fillText(n, 0, 0); g.restore(); });
});
const WINDOWS = canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = '#e8e6e2'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${R0() * .06})`; g.fillRect(R0() * w, R0() * h, 2, 2); }
  for (let y = 30; y < h - 40; y += 80) for (let x = 30; x < w - 40; x += 70) { g.fillStyle = '#2a2a30'; g.fillRect(x, y, 34, 50); g.fillStyle = '#55555e'; g.fillRect(x, y, 34, 8); }
});
WINDOWS.wrapS = WINDOWS.wrapT = THREE.RepeatWrapping;
const TREE = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#4a3020'; g.fillRect(118, 140, 20, 116);
  for (let i = 0; i < 260; i++) { const a = R0() * 7, r = Math.sqrt(R0()) * 90; const x = 128 + Math.cos(a) * r, y = 100 + Math.sin(a) * r * .8;
    const gg = 70 + R0() * 110; g.fillStyle = `rgb(${20 + R0() * 40},${gg},${10 + R0() * 30})`; g.beginPath(); g.ellipse(x, y, 6 + R0() * 9, 4 + R0() * 6, R0() * 3, 0, 7); g.fill(); }
});
const TILES = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#9cc8bc'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { const v = 150 + R0() * 40; g.fillStyle = `rgb(${v * .62},${v * .95},${v * .88})`; g.fillRect(x + 3, y + 3, 58, 58); }
  for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(255,255,255,${R0() * .06})`; g.fillRect(R0() * w, R0() * h, 2, 2); }
});
TILES.wrapS = TILES.wrapT = THREE.RepeatWrapping;
const LEOPARD = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#e8e4dc'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { g.fillStyle = '#1a1a1a'; g.beginPath(); const x = R0() * w, y = R0() * h; g.ellipse(x, y, 10 + R0() * 18, 6 + R0() * 10, R0() * 3, 0, 7); g.fill(); }
});
LEOPARD.wrapS = LEOPARD.wrapT = THREE.RepeatWrapping;
const STARS = canvasTex(2048, 1024, (g, w, h) => {
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#000004'); bg.addColorStop(.48, '#05061a'); bg.addColorStop(.5, '#10101e'); bg.addColorStop(1, '#000000');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) { const y = Math.pow(R0(), 1.3) * h * .5; const b = R0(); g.fillStyle = `rgba(255,${200 + b * 55},${200 + b * 55},${.3 + b * .7})`; g.fillRect(R0() * w, y, b > .93 ? 3 : 2, b > .93 ? 3 : 2); }
});
STARS.mapping = THREE.EquirectangularReflectionMapping;
const FLAME = canvasTex(1024, 256, (g) => {    // 8-frame flame sheet
  for (let f = 0; f < 8; f++) {
    const ox = f * 128;
    for (let k = 0; k < 7; k++) {
      const x = ox + 64 + (R0() - .5) * 50, top = 20 + R0() * 90, wid = 18 + R0() * 22;
      const gr = g.createLinearGradient(0, 256, 0, top); gr.addColorStop(0, 'rgba(255,240,170,1)'); gr.addColorStop(.35, 'rgba(255,170,30,.95)'); gr.addColorStop(.8, 'rgba(230,50,0,.7)'); gr.addColorStop(1, 'rgba(160,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - wid, 256);
      g.bezierCurveTo(x - wid * 1.1, 180, x - wid * .3 + (R0() - .5) * 30, top + 60, x + (R0() - .5) * 20, top);
      g.bezierCurveTo(x + wid * .4 + (R0() - .5) * 30, top + 70, x + wid * 1.1, 170, x + wid, 256); g.fill();
    }
  }
});
FLAME.wrapS = THREE.ClampToEdgeWrapping; FLAME.repeat.set(1 / 8, 1);

// ---------------- roses ----------------
function petalGeo(len, wid, cup, curl) {
  const nu = 6, nv = 6, pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const v = j / nv, u = i / nu * 2 - 1, w = wid * Math.sin(Math.PI * (0.12 + 0.86 * v)) * (0.55 + 0.45 * v);
    pos.push(u * w, v * len, cup * u * u * w * 1.3 - curl * v * v * len); uv.push(i / nu, v);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
}
function colorize(g, fn) { const p = g.attributes.position, c = []; for (let i = 0; i < p.count; i++) c.push(...fn(p.getX(i), p.getY(i), p.getZ(i))); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return g; }
function roseGeometry(withStem = true) {
  const parts = [];
  const layers = [[3, .15, .10, .12, .9, .25], [5, .19, .13, .42, .75, .35], [6, .23, .16, .82, .55, .5], [7, .25, .18, 1.2, .35, .65]];
  layers.forEach(([n, len, wid, tilt, cup, shade], li) => {
    for (let i = 0; i < n; i++) {
      const g = petalGeo(len, wid, cup, li > 1 ? 0.25 : 0.05); g.rotateX(tilt); g.translate(0, 0, 0.015 * li); g.rotateY(i / n * Math.PI * 2 + li * 0.7);
      colorize(g, (x, y) => { const k = clamp(0.5 + y * 2.2); const g = lerp(.55, 1.05, shade) * k + .12; return [g, g, g]; });
      g.computeVertexNormals(); parts.push(g);
    }
  });
  const bud = new THREE.SphereGeometry(0.06, 8, 6); bud.scale(1, 1.4, 1); bud.translate(0, 0.08, 0); colorize(bud, () => [.45, .45, .45]); parts.push(bud);
  if (withStem) {
    const stem = new THREE.CylinderGeometry(0.014, 0.018, 0.6, 5); stem.translate(0, -0.3, 0); colorize(stem, () => [.08, .28, .06]); parts.push(stem);
    for (const [y, a] of [[-0.25, 0.4], [-0.42, 3.6]]) { const l = new THREE.SphereGeometry(1, 8, 4); l.scale(0.09, 0.012, 0.045); l.translate(0.08, 0, 0); l.rotateZ(0.4); l.rotateY(a); l.translate(0, y, 0); colorize(l, () => [.1, .35, .07]); parts.push(l); }
  }
  for (const p of parts) { if (!p.index) p.setIndex([...Array(p.attributes.position.count).keys()]); if (!p.attributes.normal) p.computeVertexNormals(); }
  return mergeGeometries(parts.map(p => { const q = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'uv', 'color']) q.setAttribute(k, p.attributes[k]); q.setIndex(p.index); return q; }));
}
const ROSE_GEO = roseGeometry(true), ROSE_HEAD = roseGeometry(false);
const VELVET = await tex('velvet.jpg', 1);
const ROSE_MAT = new THREE.MeshPhongMaterial({ map: VELVET, vertexColors: true, side: THREE.DoubleSide, shininess: 55, specular: 0x886666 });
function roses(n, place, geo = ROSE_GEO, sizeR = [0.8, 1.4]) {
  const im = new THREE.InstancedMesh(geo, ROSE_MAT, n); im.castShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), base = [], times = [];
  for (let i = 0; i < n; i++) { const p = place(i); const s = lerp(sizeR[0], sizeR[1], p.r ?? Math.random()) * (p.s ?? 1);
    q.setFromEuler(e.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0)); m.compose(p.v, q, V3(s, s, s)); im.setMatrixAt(i, m); base.push(m.clone()); times.push(Math.random()); }
  im.userData.grow = { base, times, pivot: geo === ROSE_GEO ? -0.6 : 0 };
  return im;
}
function roseField(n, r, area, avoid, yBase = 0.45) {
  const centers = []; for (let i = 0; i < n / 14; i++) centers.push([lerp(area[0], area[1], r()), lerp(area[2], area[3], r())]);
  return roses(n, () => { const c = centers[Math.floor(r() * centers.length)]; let x = c[0] + (r() - .5) * 2.6, z = c[1] + (r() - .5) * 2.6;
    if (avoid && avoid(x, z)) x += 4; const tall = 0.35 + r() * 0.25;
    return { v: V3(x, yBase * tall / 0.45 + r() * 0.1, z), ry: r() * 6, rx: (r() - .5) * 0.5, rz: (r() - .5) * 0.5, r: r() }; }, ROSE_GEO, [0.9, 1.6]);
}

// roses sprouting out of any surface of an object (walls, towers, hands, heads...)
function growRoses(target, n, seed, sizeR = [1, 1.6], reject = null) {
  target.updateMatrixWorld(true);
  const inv = target.matrixWorld.clone().invert(), r = rng(seed), items = [];
  target.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.geometry.attributes.normal && !o.material.transparent) {
    const bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new THREE.Vector3());
    items.push({ smp: new MeshSurfaceSampler(o).build(), rel: inv.clone().multiply(o.matrixWorld), area: sz.x * sz.y + sz.y * sz.z + sz.x * sz.z + 1e-3 }); } });
  const total = items.reduce((a, b) => a + b.area, 0);
  const im = new THREE.InstancedMesh(ROSE_HEAD, ROSE_MAT, n); im.castShadow = true;
  const base = [], times = [], p = new THREE.Vector3(), nr = new THREE.Vector3(), up = V3(0, 1, 0), q = new THREE.Quaternion(), tw = new THREE.Quaternion(), m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    for (let tries = 0; tries < 40; tries++) { let x = r() * total, it = items[0]; for (const c of items) { x -= c.area; if (x <= 0) { it = c; break; } }
      it.smp.sample(p, nr); p.applyMatrix4(it.rel); nr.transformDirection(it.rel); if (!reject || !reject(p)) break; }
    q.setFromUnitVectors(up, nr).multiply(tw.setFromAxisAngle(up, r() * 6.283));
    const sc = lerp(sizeR[0], sizeR[1], r()); m.compose(p.clone().addScaledVector(nr, 0.03), q, V3(sc, sc, sc));
    base.push(m.clone()); times.push(r()); im.setMatrixAt(i, m);
  }
  im.userData.grow = { base, times, pivot: 0 }; target.add(im); return im;
}
const _gm = new THREE.Matrix4(), _gs = new THREE.Matrix4(), _gt = new THREE.Matrix4(), _gt2 = new THREE.Matrix4();
function growUpdate(im, lt, start, spread, dur = 0.9) {
  const { base, times, pivot } = im.userData.grow;
  for (let i = 0; i < base.length; i++) {
    const t0 = start + times[i] * spread, k = Math.max(1e-4, ease(smooth(t0, t0 + dur, lt)));
    _gm.copy(base[i]).multiply(_gt.makeTranslation(0, pivot, 0)).multiply(_gs.makeScale(k, k, k)).multiply(_gt2.makeTranslation(0, -pivot, 0));
    im.setMatrixAt(i, _gm);
  }
  im.instanceMatrix.needsUpdate = true;
}

// ---------------- shared builders ----------------
function scaleUV(g, sx, sy) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); return g; }
function shadowSun(s, color, intensity, pos, size = 60) {
  const d = new THREE.DirectionalLight(color, intensity); d.position.copy(pos); d.castShadow = true;
  d.shadow.mapSize.set(2048, 2048); Object.assign(d.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far: 400 });
  d.shadow.bias = -0.0005; d.shadow.normalBias = 0.02; s.add(d); s.add(d.target); return d;
}
function flame(mats, size) { const s = new THREE.Sprite(mats[Math.floor(Math.random() * mats.length)]); s.scale.set(size, size * 2, 1); s.center.set(0.5, 0.05); return s; }
function flameMats(n = 4) { return [...Array(n)].map((_, i) => { const t = FLAME.clone(); t.needsUpdate = true; t.repeat.set(1 / 8, 1); return new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, userData: { ph: i * 2 } }); }); }
function animateFlames(mats, t) { mats.forEach((m, i) => { m.map.offset.x = (Math.floor(t * 14 + i * 3) % 8) / 8; }); }
function wordArt(str, size, opts = {}) {
  const g = new TextGeometry(str, { font, size, depth: size * 0.32, curveSegments: 8, bevelEnabled: true, bevelThickness: size * 0.07, bevelSize: size * 0.045, bevelSegments: 4 });
  g.center(); g.computeBoundingBox(); { const w = g.boundingBox.max.x - g.boundingBox.min.x, maxW = opts.maxW ?? 2.3; if (w > maxW) g.scale(maxW / w, maxW / w, maxW / w); }
  const front = new THREE.MeshPhongMaterial({ color: opts.color ?? 0x8a9ad8, specular: 0xffffff, shininess: 110, envMap: opts.env, reflectivity: opts.reflect ?? 0.75, combine: THREE.MixOperation });
  const side = new THREE.MeshPhongMaterial({ color: opts.side ?? 0x101a40, specular: 0xaabbff, shininess: 80, envMap: opts.env, reflectivity: 0.4, combine: THREE.MixOperation });
  return new THREE.Mesh(g, [front, side]);
}
function titleStage(env) {
  const s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100); cam.position.set(0, 0, 10);
  s.add(new THREE.AmbientLight(0xffffff, 0.6)); const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(-3, 5, 8); s.add(d);
  const d2 = new THREE.DirectionalLight(0xff8080, 0.8); d2.position.set(4, -2, 5); s.add(d2);
  return { s, cam, env };
}
function roseBorder(stage) {    // like the skull border, but roses
  const hh = Math.tan(THREE.MathUtils.degToRad(15)) * 10, hw = hh * W / H, m = 0.16, pts = [];
  const nx = 9, ny = Math.round((2 * hh - 2 * m) / ((2 * hw - 2 * m) / (nx - 1)));
  for (let i = 0; i < nx; i++) { const x = -hw + m + i * (2 * hw - 2 * m) / (nx - 1); pts.push([x, hh - m]); pts.push([x, -hh + m]); }
  for (let j = 1; j < ny; j++) { const y = -hh + m + j * (2 * hh - 2 * m) / ny; pts.push([-hw + m, y]); pts.push([hw - m, y]); }
  const im = roses(pts.length, (i) => ({ v: V3(pts[i][0], pts[i][1], 0), rx: Math.PI / 2 - 0.25, ry: 0.4, rz: 0, r: 0.5 }), ROSE_HEAD, [0.95, 0.95]);
  im.castShadow = false; stage.s.add(im); return im;
}
function ovCanvas(draw) { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); draw(g); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const JP = 'ファブドットコム', RM = '４ＲＭ';
function redText(g, str, x, y, px, align = 'left') { const k = W / 720; x *= k; y *= k; px = Math.round(px * k); g.font = `bold ${px}px "WenQuanYi Zen Hei", sans-serif`; g.textAlign = align; g.textBaseline = 'top'; g.fillStyle = '#ff1414'; g.fillText(str, x, y); }

function headGeo(sock = 0.2) {
  const geo = new THREE.SphereGeometry(1, 96, 72); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (z > 0) { z *= 0.86;
      z += 0.24 * Math.exp(-(x * x / 0.008 + (y + 0.02) ** 2 / 0.05)) * (y < 0.15 ? 1 : 0.6);
      for (const sx of [-1, 1]) { z -= sock * Math.exp(-((x - sx * 0.34) ** 2 + (y - 0.16) ** 2) / 0.018); z -= 0.07 * Math.exp(-((x - sx * 0.45) ** 2 / 0.02 + (y + 0.18) ** 2 / 0.03)); }
      z += 0.06 * Math.exp(-(x * x / 0.12 + (y - 0.32) ** 2 / 0.004));
      z -= 0.035 * Math.exp(-(x * x / 0.025 + (y + 0.4) ** 2 / 0.0012)); }
    x *= 1 - 0.25 * Math.max(0, -y); y *= 1.28;
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals(); return geo;
}
async function mouthDecal(map, w, h) {
  const mask = canvasTex(256, 128, (c, W_, H_) => { const gr = c.createRadialGradient(W_ / 2, H_ / 2, 10, W_ / 2, H_ / 2, W_ / 2); gr.addColorStop(0, '#fff'); gr.addColorStop(.6, '#fff'); gr.addColorStop(1, '#000'); c.fillStyle = '#000'; c.fillRect(0, 0, W_, H_); c.save(); c.scale(1, H_ / W_); c.fillStyle = gr; c.fillRect(0, 0, W_, W_); c.restore(); }, false);
  const m = new THREE.MeshPhongMaterial({ map, alphaMap: mask, transparent: true, depthWrite: false, shininess: 40, polygonOffset: true, polygonOffsetFactor: -4 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 8, 4), m);
  { const mp = mesh.geometry.attributes.position; for (let i = 0; i < mp.count; i++) mp.setZ(i, -0.7 * mp.getX(i) ** 2 - 0.4 * mp.getY(i) ** 2); }
  return mesh;
}
// REAL head scan (Lee Perry-Smith, Infinite Realities, CC BY 3.0) with dead pale skin, empty black eyes, blood tears
const gltfLoader = new GLTFLoader();
const LEE = (await gltfLoader.loadAsync('./assets_dc/models/LeePerrySmith.glb')).scene.getObjectByName('LeePerrySmith').geometry;
const BUST = (await gltfLoader.loadAsync('./assets_dc/models/marble_bust_01_1k.gltf')).scene;
async function dollHead(env) {
  const g = new THREE.Group();
  const skinT = (await load('models/Map-COL-dead.jpg')).clone(); skinT.colorSpace = THREE.SRGBColorSpace; skinT.needsUpdate = true;
  const norT = (await load('models/Infinite-Level_02_Tangent_SmoothUV.jpg')).clone(); norT.needsUpdate = true;
  const skin = new THREE.MeshPhongMaterial({ map: skinT, normalMap: norT, normalScale: new THREE.Vector2(0.9, 0.9), specular: 0x333333, shininess: 25 });
  const head = new THREE.Mesh(LEE, skin); head.castShadow = true;
  const inner = new THREE.Group(); inner.scale.setScalar(0.62); inner.position.y = -0.4; inner.add(head); g.add(inner);
  const ringM = new THREE.MeshPhongMaterial({ color: 0x300004, emissive: 0xff1018, emissiveIntensity: 1, shininess: 100 });
  const voidM = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const bloodM = new THREE.MeshPhongMaterial({ color: 0x8a000e, specular: 0xffaaaa, shininess: 120 });
  const eyes = [], tears = [];
  for (const sx of [-1, 1]) {
    const hole = new THREE.Mesh(new THREE.SphereGeometry(0.33, 24, 16), voidM); hole.position.set(sx * 0.7, 1.68, 1.82); hole.scale.set(1.25, 0.72, 0.55); inner.add(hole);
    const e = new THREE.Group(); e.position.set(sx * 0.7, 1.68, 1.86); inner.add(e);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), ringM); pupil.position.z = 0.12; e.add(pupil);
    eyes.push(e);
    for (let k = 0; k < 2; k++) { const tg = new THREE.Group(); tg.position.set(sx * (0.62 + k * 0.16), 1.45, 1.98 - k * 0.05); inner.add(tg);
      const len = 1.4 + k * 0.8; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, len, 8), bloodM); c.position.y = -len / 2; tg.add(c);
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), bloodM); d.position.y = -len; tg.add(d); tg.rotation.x = -0.12; tears.push(tg); }
  }
  const r = rng(8);
  inner.add(roses(16, () => { const a = r() * 6.283, b = r() * 0.8; return { v: V3(Math.cos(a) * Math.sin(b) * 2.2, 3.1 + Math.cos(b) * 0.6, Math.sin(a) * Math.sin(b) * 1.8 - 0.4), rx: (r() - .5), ry: r() * 6, rz: (r() - .5), r: r() }; }, ROSE_HEAD, [2.2, 3.2]));
  const mouth = new THREE.Object3D(), mouthM = { map: null };
  return { group: g, inner, ringM, eyes, mouth, mouthM, MA: null, MB: null, tears };
}
// the temple face: a REAL scanned marble bust (Poly Haven, CC0), weeping blood
async function giantFace() {
  const g = new THREE.Group();
  const bust = BUST.clone(true); bust.traverse(o => { if (o.isMesh) { o.castShadow = true; o.material = o.material.clone(); o.material.color?.setHex(0xe8dcd4); } });
  bust.scale.setScalar(2.1 / 0.5); bust.position.y = -1.3; g.add(bust);
  return { group: g, balls: [], lids: [], mouth: new THREE.Object3D() };
}

let HAND_MAT = null;
let EYEBALL_MAT = null;
function hand() {
  const g = new THREE.Group(), m = HAND_MAT;
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), m); palm.scale.set(0.95, 1.05, 0.32); palm.position.y = 1.15; g.add(palm);
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 1.2, 16), m); wrist.position.y = 0.4; g.add(wrist);
  [[-0.33, 0.62, 0.11], [-0.11, 0.7, 0.03], [0.11, 0.68, -0.03], [0.32, 0.55, -0.12]].forEach(([x, len, rz]) => {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, len, 6, 12), m); f.position.set(x, 1.6 + len / 2, 0); f.rotation.z = rz; f.castShadow = true; g.add(f); });
  const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.45, 6, 12), m); th.position.set(-0.55, 1.15, 0.05); th.rotation.z = 0.9; g.add(th);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ======================= SCENES =======================
const SCENES = {};

// 1) KINGDOM — a white castle on a sea of cracked concrete, roses growing out of every crack; on the drop the towers catch fire
SCENES.kingdom = await (async () => {
  const s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 2000), r = rng(11);
  const sk = await sky('sky_kloofendal_48d.jpg'); s.background = sk; s.backgroundRotation.y = 1.2; s.fog = new THREE.Fog(0xc8d4ec, 120, 600);
  s.add(new THREE.HemisphereLight(0xbcd2ff, 0x605850, 1.1));
  shadowSun(s, 0xfff4e4, 2.6, V3(50, 70, 40), 70);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshPhongMaterial({ map: await tex('concrete_grey.jpg', 160), shininess: 4 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; s.add(ground);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(7, 90), new THREE.MeshPhongMaterial({ map: await tex('path_grey.jpg', 2, 24), shininess: 6 }));
  path.rotation.x = -Math.PI / 2; path.position.set(0, 0.02, -35); path.receiveShadow = true; s.add(path);
  // castle
  const stone = new THREE.MeshPhongMaterial({ map: await tex('castle_grey.jpg', 1), color: 0xf2f2f4, shininess: 12 });
  const roofM = new THREE.MeshPhongMaterial({ map: await tex('roof_tiles.jpg', 3, 2), color: 0xf0f0f4, specular: 0x666666, shininess: 40 });
  const darkM = new THREE.MeshPhongMaterial({ map: await tex('wood.jpg', 1), color: 0x403028, shininess: 10 });
  const metalM = new THREE.MeshPhongMaterial({ map: await tex('metal.jpg', 1), color: 0x8a8a90, specular: 0xaaaaaa, shininess: 60 });
  const castle = new THREE.Group(); castle.position.set(0, 0, -82); s.add(castle);
  const roofTops = [];
  function tower(x, z, rad, h, roofH) {
    const t = new THREE.Group(); t.position.set(x, 0, z); castle.add(t);
    const c = new THREE.Mesh(scaleUV(new THREE.CylinderGeometry(rad, rad, h, 28), rad * 2, h / 2.5), stone); c.position.y = h / 2; t.add(c);
    const n = Math.max(8, Math.round(rad * 7));
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const b = new THREE.Mesh(new THREE.BoxGeometry(rad * 0.4, 0.7, 0.45), stone); b.position.set(Math.cos(a) * rad * 1.02, h + 0.35, Math.sin(a) * rad * 1.02); b.rotation.y = -a; t.add(b); }
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(rad * 1.1, rad * 1.1, 0.4, 28), stone); ring.position.y = h - 0.2; t.add(ring);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(rad * 1.12, roofH, 28), roofM); roof.position.y = h + 0.7 + roofH / 2; t.add(roof);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 1.5, 6), metalM); sp.position.y = h + 0.7 + roofH + 0.7; t.add(sp);
    for (let i = 0; i < 3; i++) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, 0.1), darkM); const a = i * 2.1 + 0.5; w.position.set(Math.cos(a) * rad * 1.001, h * (0.45 + i * 0.15), Math.sin(a) * rad * 1.001); w.lookAt(x + Math.cos(a) * 99, w.position.y, z + Math.sin(a) * 99); t.add(w); }
    t.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    roofTops.push(V3(x, h + 0.7 + roofH * 0.35, z).add(castle.position));
  }
  tower(0, -4, 3.2, 20, 10);
  [[-7, -8], [7, -8], [-9, 2], [9, 2]].forEach(([x, z]) => tower(x, z, 2.2, 15, 8));
  [[-4.2, 6], [4.2, 6], [-12, 8], [12, 8]].forEach(([x, z]) => tower(x, z, 1.4, 10, 5.5));
  for (const [x, z, w, d] of [[0, 7, 7, 1.6], [-8, 5, 1.6, 7], [8, 5, 1.6, 7], [0, -9, 13, 1.6]]) {
    const wall = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(w, 8, d), Math.max(w, d) / 2.5, 3), stone); wall.position.set(x, 4, z); wall.castShadow = wall.receiveShadow = true; castle.add(wall);
    const n = Math.round(Math.max(w, d) / 0.9); for (let i = 0; i < n; i += 2) { const b = new THREE.Mesh(new THREE.BoxGeometry(w > d ? 0.5 : d * 1.02, 0.7, w > d ? d * 1.02 : 0.5), stone); b.position.set(x + (w > d ? -w / 2 + (i + .5) * w / n : 0), 8.35, z + (w > d ? 0 : -d / 2 + (i + .5) * d / n)); b.castShadow = true; castle.add(b); }
  }
  const gate = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.8, 24, 1, false, 0, Math.PI), darkM); gate.rotation.set(Math.PI / 2, 0, Math.PI / 2); gate.position.set(0, 2.2, 7.9); castle.add(gate);
  const gate2 = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 1.8), darkM); gate2.position.set(0, 1.1, 7.9); castle.add(gate2);
  // fire
  const fm = flameMats(5); const fires = [];
  roofTops.forEach((p, i) => { if (i % 2 === 0 || i === 0) for (let k = 0; k < 3; k++) { const f = flame(fm, 3 + r() * 2.5); f.position.copy(p).add(V3((r() - .5) * 2, r() * 2, (r() - .5) * 2)); s.add(f); fires.push([f, f.scale.x]); } });
  // roses out of the concrete
  const fieldR = roseField(900, r, [-30, 30, -70, 14], (x) => Math.abs(x) < 3.8); s.add(fieldR);
  const castleR = growRoses(castle, 560, 101, [2.6, 4.4]);
  const sideR = roses(140, () => ({ v: V3((r() < .5 ? -1 : 1) * (3.9 + r() * 2.5), 0.35 + r() * 0.15, 6 - r() * 16), ry: r() * 6, rx: (r() - .5) * .5, rz: (r() - .5) * .5, r: r() }), ROSE_GEO, [1.1, 1.9]); s.add(sideR);
  // title
  const T = titleStage(sk); const fav = new THREE.Group(); T.s.add(fav);
  ['F A V', 'D O T', 'C O M'].forEach((w, i) => { const m = wordArt(w, 0.46, { env: sk, maxW: 1.9 }); m.position.y = 1.95 - i * 0.62; fav.add(m); });
  const border = roseBorder(T);
  return { s, cam, T,
    update(lt, D, sec, t, e, k) {
      const p = ease(clamp(lt / (sec.dur + XF)));
      cam.position.set(Math.sin(p * 1.4) * 2.2, lerp(1.1, 7, p), lerp(9, -26, p));
      cam.lookAt(Math.sin(p * 1.4) * 0.8, lerp(2.2, 9, p), -82);
      const ign = smooth(D, D + 2.2, lt);
      animateFlames(fm, t);
      fires.forEach(([f, s0], i) => { const fl = 0.85 + 0.15 * Math.sin(t * 9 + i * 1.7) + e * 0.2; f.scale.set(s0 * ign * fl, s0 * 2 * ign * fl, 1); });
      fav.rotation.y = Math.sin(lt * 0.5) * 0.25; fav.rotation.x = Math.sin(lt * 0.37) * 0.08;
      border.visible = lt > D;
      growUpdate(fieldR, lt, -0.6, 6); growUpdate(sideR, lt, -0.3, 4); growUpdate(castleR, lt, D + 0.3, 9);
      return { title: smooth(D, D + 1.2, lt), ov: 0 };
    } };
})();

// 2) EYE HOUSE — orange evening, green photo grass; a little house with an eye on its roof, a stone wall with a mouth for a door
SCENES.eyehouse = await (async () => {
  const s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 2000), r = rng(22);
  const sk = await sky('sky_orange.jpg'); s.background = sk; s.fog = new THREE.Fog(0xf0a060, 60, 380);
  s.add(new THREE.HemisphereLight(0xffd0a0, 0x305020, 1.2));
  shadowSun(s, 0xffc890, 2.3, V3(-30, 28, 22), 40);
  const geo = new THREE.PlaneGeometry(600, 600, 120, 120); geo.rotateX(-Math.PI / 2);
  const gp = geo.attributes.position; for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), z = gp.getZ(i), d = Math.hypot(x, z); gp.setY(i, (Math.sin(x * 0.05) * Math.cos(z * 0.04) * 2.5 + Math.sin(x * 0.13 + z * 0.1) * 0.8) * smooth(14, 40, d) + smooth(80, 200, d) * 18 * (0.5 + 0.5 * Math.sin(Math.atan2(z, x) * 5))); }
  geo.computeVertexNormals();
  const grass = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ map: await tex('grass_ground_green.jpg', 90), shininess: 3 })); grass.receiveShadow = true; s.add(grass);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 9), new THREE.MeshPhongMaterial({ map: await tex('concrete_grey.jpg', 1.5), shininess: 5 })); slab.position.y = 0.1; slab.receiveShadow = true; s.add(slab);
  // house
  const house = new THREE.Group(); house.position.y = 0.25; s.add(house);
  const skin = new THREE.MeshPhongMaterial({ map: await tex('skin.jpg', 1.5), shininess: 30, specular: 0x553333 });
  const MA = await tex('mouth_a.jpg'), MB = await tex('mouth_b.jpg');
  const front = new THREE.MeshPhongMaterial({ map: MA, shininess: 40, specular: 0x553333 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 3.2), [skin, skin, skin, skin, front, skin]); box.position.y = 1.2; box.castShadow = box.receiveShadow = true; house.add(box);
  const roofShape = new THREE.Shape(); roofShape.moveTo(-2, 0); roofShape.lineTo(0, 1.7); roofShape.lineTo(2, 0); roofShape.lineTo(-2, 0);
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 3.8, bevelEnabled: false }); roofGeo.translate(0, 0, -1.9);
  // map the eye across both roof planes
  { const p = roofGeo.attributes.position, uv = roofGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getZ(i) + 1.9) / 3.8, Math.abs(p.getX(i)) < 1e-3 ? 1 : 1 - Math.abs(p.getX(i)) / 2); }
  const roofEye = new THREE.MeshPhongMaterial({ map: await tex('eye_photo.jpg'), shininess: 50, specular: 0x664444 });
  const roof = new THREE.Mesh(roofGeo, [skin, roofEye]); roof.position.y = 2.4; roof.rotation.y = Math.PI / 2; roof.castShadow = true; house.add(roof);
  // mouth door in a rock wall
  const wall = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(5, 7, 2.2), 1.5, 2), new THREE.MeshPhongMaterial({ map: await tex('rock_grey.jpg', 1), color: 0xd8d4cc, shininess: 6 }));
  wall.position.set(-7.5, 3.5, -6); wall.rotation.y = 0.45; wall.castShadow = wall.receiveShadow = true; s.add(wall);
  const frameM = new THREE.MeshPhongMaterial({ map: await tex('wood.jpg', 1), shininess: 12 });
  const fr = new THREE.Mesh(new THREE.BoxGeometry(1.7, 3.0, 0.2), frameM); fr.position.set(0, -1.9, 1.12); wall.add(fr);
  const doorMat = new THREE.MeshPhongMaterial({ map: MB, shininess: 40 });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.7), doorMat); door.position.set(0, -1.9, 1.23); wall.add(door);
  // trees, bushes, rocks
  const treeT = await load('tree_photo.png'); treeT.colorSpace = THREE.SRGBColorSpace;
  const treeM = new THREE.MeshPhongMaterial({ map: treeT, alphaTest: 0.5, side: THREE.DoubleSide, shininess: 0 });
  for (let i = 0; i < 46; i++) { const a = r() * 6.283, d = 14 + r() * 60; const sc = 4 + r() * 5; const tg = new THREE.Group();
    for (const ry of [0, Math.PI / 2]) { const q = new THREE.Mesh(new THREE.PlaneGeometry(sc, sc), treeM); q.position.y = sc / 2 - 0.2; q.rotation.y = ry; q.castShadow = true; tg.add(q); }
    tg.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); tg.position.y = 0; s.add(tg); }
  const rockM = new THREE.MeshPhongMaterial({ map: await tex('rock_grey.jpg', 1), color: 0x9a948c, shininess: 8 });
  for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + r() * 1.2, 0), rockM); const a = r() * 6.283, d = 7 + r() * 18; m.position.set(Math.cos(a) * d, 0.2, Math.sin(a) * d); m.rotation.set(r(), r(), r()); m.castShadow = true; s.add(m); }
  // roses on the concrete slab around the house
  const slabR = roses(220, () => { let x = (r() - .5) * 8.4, z = (r() - .5) * 8.4; if (Math.abs(x) < 2.1 && Math.abs(z) < 2.1) x = Math.sign(x || 1) * (2.2 + r() * 2); return { v: V3(x, 0.62 + r() * 0.08, z), ry: r() * 6, rx: (r() - .5) * .4, rz: (r() - .5) * .4, r: r() }; }, ROSE_GEO, [1.0, 1.6]); s.add(slabR);
  const houseR = growRoses(house, 140, 202, [0.9, 1.5], (p) => p.y > 2.35 || (p.z > 1.55 && Math.abs(p.x) < 1.2 && p.y > 0.5 && p.y < 2.0)), wallR = growRoses(wall, 120, 203, [1.0, 1.7]);
  const T = titleStage(sk);
  const ov = ovCanvas(g => { redText(g, 'favfavfav', 34, 40, 78); redText(g, 'fav', 720 - 34, 1280 - 180, 120, 'right'); });
  return { s, cam, T, ov,
    update(lt, D, sec, t, e, k) {
      const p = clamp(lt / (sec.dur + XF));
      const a = lerp(-0.9, 1.1, ease(p)), rad = lerp(13, 8.5, ease(p));
      cam.position.set(Math.sin(a) * rad, lerp(4.5, 2.2, ease(p)), Math.cos(a) * rad);
      cam.lookAt(1.2, 1.9, -1.2);
      front.map = k > 0.3 && lt > D ? MB : MA; doorMat.map = k > 0.3 ? MA : MB;
      growUpdate(slabR, lt, -0.6, 5); growUpdate(houseR, lt, D, 9); growUpdate(wallR, lt, D + 1, 9);
      return { title: 0, ov: smooth(D, D + 1.0, lt) };
    } };
})();

// 3) CLOCK TOWN — night, white buildings dripping red paint, a clock tower; grey hands rise out of the dirt, one by one with the kicks
SCENES.clocktown = await (async () => {
  const s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(52, W / H, 0.1, 2000), r = rng(33);
  s.background = STARS; s.fog = new THREE.Fog(0x05061a, 40, 160);
  s.add(new THREE.HemisphereLight(0x8090c0, 0x302018, 0.7));
  shadowSun(s, 0xc8d4ff, 1.8, V3(25, 40, 30), 45);
  const lamp = new THREE.PointLight(0xffe0b0, 60, 30); lamp.position.set(0, 6, 4); s.add(lamp);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshPhongMaterial({ map: await tex('dirt.jpg', 50), color: 0xa08060, shininess: 3 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; s.add(ground);
  const pathM = new THREE.MeshPhongMaterial({ map: await tex('leopard.jpg', 1, 10), shininess: 20 });
  const path = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 50), pathM); path.rotation.x = -Math.PI / 2; path.position.set(-4.5, 0.02, -10); path.receiveShadow = true; s.add(path);
  const conc = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshPhongMaterial({ map: await tex('concrete_grey.jpg', 2), shininess: 4 })); conc.rotation.x = -Math.PI / 2; conc.position.set(2, 0.03, 2); conc.receiveShadow = true; s.add(conc);
  const bM = new THREE.MeshPhongMaterial({ map: await tex('facade.jpg', 1), shininess: 10 });
  const dripM = new THREE.MeshPhongMaterial({ color: 0xc00010, specular: 0xffaaaa, shininess: 110 });
  function drips(parent, w, y, z, n) { for (let i = 0; i < n; i++) { const len = 0.6 + r() * 2.8; const x = (r() - .5) * w;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 10), dripM); c.position.set(x, y - len / 2, z); parent.add(c);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), dripM); b.position.set(x, y - len, z); parent.add(b); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.4, 0.3), dripM); top.position.set(0, y + 0.05, z); parent.add(top); }
  const blds = [[-12, -14, 6, 14], [-14, -26, 7, 20], [9, -16, 6, 12], [13, -28, 8, 22], [-6, -40, 7, 16], [4, -44, 6, 26], [18, -6, 5, 9], [-19, -4, 5, 10]];
  const town = new THREE.Group(); s.add(town);
  blds.forEach(([x, z, w, h], i) => { const b = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(w, h, w), w / 4, h / 8), bM); b.position.set(x, h / 2, z); b.castShadow = b.receiveShadow = true; town.add(b);
    if (i % 3 !== 1) drips(b, w * 0.7, h / 2 - 1.5 - r() * 3, w / 2 + 0.16, 4 + Math.floor(r() * 4)); });
  // clock tower
  const towerG = new THREE.Group(); towerG.position.set(-1, 0, -20); town.add(towerG);
  const shaft = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(3.4, 14, 3.4), 1, 3), bM); shaft.position.y = 7; towerG.add(shaft);
  const head = new THREE.Mesh(new THREE.BoxGeometry(4.6, 4.6, 4.6), new THREE.MeshPhongMaterial({ map: await tex('plaster.jpg', 1), color: 0xf4f0ea, shininess: 20 })); head.position.y = 16.3; towerG.add(head);
  const roofT = new THREE.Mesh(new THREE.ConeGeometry(3.6, 4, 4), new THREE.MeshPhongMaterial({ map: await tex('metal.jpg', 2), color: 0x505058, shininess: 60 })); roofT.position.y = 20.6; roofT.rotation.y = Math.PI / 4; towerG.add(roofT);
  const faceM = new THREE.MeshPhongMaterial({ map: await tex('clockface.jpg'), shininess: 30 }); const handsCl = [];
  for (let i = 0; i < 4; i++) { const f = new THREE.Group(); f.rotation.y = i * Math.PI / 2; f.position.y = 16.3; towerG.add(f);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 4.0), faceM); face.position.z = 2.31; f.add(face);
    const hm = new THREE.MeshPhongMaterial({ map: await tex('metal.jpg'), color: 0x303030, shininess: 50 });
    const hh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 0.05), hm); hh.geometry.translate(0, 0.45, 0); hh.position.z = 2.36; f.add(hh);
    const mh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.05), hm); mh.geometry.translate(0, 0.7, 0); mh.position.z = 2.38; f.add(mh); handsCl.push([hh, mh]); }
  towerG.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  drips(head, 3.5, -0.4, 2.34, 5);
  // hands out of the ground
  HAND_MAT = new THREE.MeshPhongMaterial({ map: await tex('skin_grey.jpg', 1.5), color: 0xe0e0e0, specular: 0x555555, shininess: 30 });
  const hands = []; const hr = rng(4);
  for (let i = 0; i < 16; i++) { const h = hand(); const row = Math.floor(i / 4); h.position.set((i % 4 - 1.5) * 2.4 + (hr() - .5) * 1.2 + 1, -3.4, 2 - row * 3.2 - hr()); h.rotation.y = (hr() - .5) * 0.8; h.scale.setScalar(0.9 + hr() * 0.6); s.add(h); hands.push({ h, ph: hr() * 6, delay: hr() }); }
  hands.sort((a, b) => a.delay - b.delay);
  const fieldR = roseField(260, r, [-6, 8, -9, 7], null); s.add(fieldR);
  const townR = growRoses(town, 700, 303, [2.0, 3.4]);
  hands.forEach((o, i) => { o.h.position.y = 0; o.roses = growRoses(o.h, 10, 310 + i, [0.8, 1.3]); o.h.position.y = -3.4; });
  const T = titleStage(STARS); const rm = wordArt('fav', 1.0, { env: STARS, color: 0xd0d4e0, side: 0x200008, reflect: 0.3 }); rm.position.set(0, 1.7, 0); T.s.add(rm);
  const ov = ovCanvas(g => { redText(g, 'favcom', 360, 330, 72, 'center'); });
  return { s, cam, T, ov,
    update(lt, D, sec, t, e, k) {
      const p = clamp(lt / (sec.dur + XF));
      cam.position.set(lerp(3, 0.5, ease(p)), lerp(1.4, 2.4, ease(p)), lerp(10, 5, ease(p)));
      cam.lookAt(lerp(1, -1, p), lerp(1.8, 12.5, smooth(0.35, 1, p)), -20);
      const sp = t * 0.6 + Math.max(0, lt - D) * 2.5;
      handsCl.forEach(([hh, mh]) => { hh.rotation.z = -sp * 0.4; mh.rotation.z = -sp * 4; });
      hands.forEach((o, i) => { const st = D + 0.25 + i * 0.3; const up = ease(smooth(st, st + 1.3, lt));
        o.h.position.y = lerp(-3.4, -0.2, up); o.h.rotation.z = Math.sin(t * 0.8 + o.ph) * 0.06 * up; growUpdate(o.roses, lt, st + 0.7, 1.6); });
      growUpdate(fieldR, lt, -0.6, 6); growUpdate(townR, lt, D, 10);
      lamp.intensity = 50 + envSmooth(t) * 40;
      rm.rotation.y = Math.sin(lt * 0.6) * 0.35;
      return { title: smooth(D + 0.5, D + 1.7, lt), ov: smooth(D + 1, D + 2, lt) };
    } };
})();

// 2b) BRIDGE — night canal, deep navy sky, a red lacquered bridge; a ghost with long black hair stands in a boat
SCENES.bridge = await (async () => {
  const s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 2000), r = rng(55);
  const NAVY = canvasTex(1024, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#04062e'); gr.addColorStop(.45, '#121a6a'); gr.addColorStop(.52, '#1a2276'); gr.addColorStop(1, '#020310'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  NAVY.mapping = THREE.EquirectangularReflectionMapping; s.background = NAVY; s.fog = new THREE.Fog(0x141c68, 16, 70);
  s.add(new THREE.HemisphereLight(0x7080e0, 0x202010, 1.1));
  shadowSun(s, 0xb0b8ff, 1.4, V3(-20, 30, 15), 30);
  const lantern = new THREE.PointLight(0xff4020, 30, 16); lantern.position.set(3, 2.6, -12); s.add(lantern);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(60, 120), new THREE.MeshPhongMaterial({ map: await tex('grass_ground_green.jpg', 20), color: 0xd8d070, shininess: 2 }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(-30.8, 0, -30); grass.receiveShadow = true; s.add(grass);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(60, 120), new THREE.MeshPhongMaterial({ map: await tex('dirt.jpg', 20), color: 0x505060 }));
  far.rotation.x = -Math.PI / 2; far.position.set(37.3, 0, -30); s.add(far);
  const walls = new THREE.Group(); s.add(walls);
  const wallM = new THREE.MeshPhongMaterial({ map: await tex('rock_grey.jpg', 1), color: 0x9098a8, shininess: 6 });
  for (const x of [-0.4, 6.9]) { const w = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(0.8, 1.6, 120), 60, 1), wallM); w.position.set(x, -0.75, -30); w.castShadow = w.receiveShadow = true; walls.add(w); }
  for (let i = 0; i < 9; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.8), wallM); st.position.set(0.5, -0.85, 2 - i * 1.4); st.rotation.y = (r() - .5) * 0.3; walls.add(st); }
  const waterMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uT; varying vec2 vUv; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){ vec2 c = floor(vUv * vec2(160., 2400.)); float sp = step(.9, h(c + floor(uT * 6.))); float w = .5 + .5 * sin(vUv.y * 900. + uT * 2. + vUv.x * 20.);
        vec3 col = vec3(.10, .13, .42) * (.8 + .2 * w) + vec3(.45, .5, .95) * sp * .55; gl_FragColor = vec4(pow(col, vec3(2.2)), 1.); }` });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 120), waterMat); water.rotation.x = -Math.PI / 2; water.position.set(3.25, -1.1, -30); s.add(water);
  // the red bridge
  const lacquer = new THREE.MeshPhongMaterial({ map: await tex('wood.jpg', 1), color: 0xff2020, shininess: 70, specular: 0x664444 });
  const bridge = new THREE.Group(); bridge.position.z = -14; s.add(bridge);
  const N = 16, bx = (u) => lerp(-1.2, 7.7, u), by = (u) => 0.12 + 1.35 * (1 - (2 * u - 1) ** 2);
  for (let i = 0; i < N; i++) { const u0 = i / N, u1 = (i + 1) / N; const dx = bx(u1) - bx(u0), dy = by(u1) - by(u0);
    const d = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(dx, dy) + 0.02, 0.18, 2.4), lacquer); d.position.set((bx(u0) + bx(u1)) / 2, (by(u0) + by(u1)) / 2, 0); d.rotation.z = Math.atan2(dy, dx); d.castShadow = true; bridge.add(d); }
  for (const zs of [-1.15, 1.15]) for (let i = 0; i <= N; i += 2) { const u = i / N;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.0, 0.13), lacquer); post.position.set(bx(u), by(u) + 0.5, zs); post.castShadow = true; bridge.add(post);
    if (i < N) { const u2 = (i + 2) / N; for (const hgt of [0.95, 0.5]) { const dx = bx(u2) - bx(u), dy = by(u2) - by(u);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(dx, dy), 0.09, 0.11), lacquer); rail.position.set((bx(u) + bx(u2)) / 2, (by(u) + by(u2)) / 2 + hgt, zs); rail.rotation.z = Math.atan2(dy, dx); bridge.add(rail); } } }
  // boat + ghost
  const woodM = new THREE.MeshPhongMaterial({ map: await tex('wood.jpg', 1), color: 0x6a5040, shininess: 10 });
  const boat = new THREE.Group(); boat.position.set(4.7, -1.0, -7.5); boat.rotation.y = 0.15; s.add(boat);
  boat.add(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 4.0), woodM));
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.2, 4), woodM); bow.rotation.set(Math.PI / 2, Math.PI / 4, 0); bow.scale.set(1, 1, 0.35); bow.position.z = -2.5; boat.add(bow);
  const ghostM = new THREE.MeshPhongMaterial({ map: await tex('plaster.jpg', 1), color: 0xf0f0f4, shininess: 10 });
  const hairM = new THREE.MeshPhongMaterial({ color: 0x050505, specular: 0x666688, shininess: 90 });
  const ghost = new THREE.Group(); ghost.position.set(0, 0.17, 0.8); boat.add(ghost);
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.38, 1.55, 16), ghostM); robe.position.y = 0.78; ghost.add(robe);
  for (const sx of [-1, 1]) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.8, 8), ghostM); a.position.set(sx * 0.22, 1.12, 0.05); a.rotation.z = sx * 0.12; ghost.add(a); }
  const headG = new THREE.Group(); headG.position.y = 1.72; ghost.add(headG);
  headG.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), ghostM));
  const hair = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.26, 1.15, 18, 1, true), hairM); hair.position.y = -0.38; hair.material.side = THREE.DoubleSide; headG.add(hair);
  const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.175, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), hairM); headG.add(hairTop);
  ghost.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // background: a dark pagoda and a black tree line
  const darkM = new THREE.MeshPhongMaterial({ map: await tex('wood.jpg', 1), color: 0x302830 }), roofM = new THREE.MeshPhongMaterial({ map: await tex('metal.jpg', 1), color: 0x404050, shininess: 30 });
  const pag = new THREE.Group(); pag.position.set(-13, 0, -42); s.add(pag);
  for (let k = 0; k < 4; k++) { const sz = 4 - k * 0.8; const b = new THREE.Mesh(new THREE.BoxGeometry(sz, 1.6, sz), darkM); b.position.y = k * 2.1 + 0.8; pag.add(b);
    const rf = new THREE.Mesh(new THREE.ConeGeometry(sz * 0.95, 0.9, 4), roofM); rf.rotation.y = Math.PI / 4; rf.position.y = k * 2.1 + 2.0; pag.add(rf); }
  const treeT = await load('tree_photo.png'); treeT.colorSpace = THREE.SRGBColorSpace;
  const treeM = new THREE.MeshPhongMaterial({ map: treeT, alphaTest: 0.5, side: THREE.DoubleSide, color: 0x283050 });
  for (let i = 0; i < 16; i++) { const sc = 7 + r() * 6; const q = new THREE.Mesh(new THREE.PlaneGeometry(sc, sc), treeM); q.position.set(9 + r() * 10, sc / 2 - 0.3, -6 - i * 3.5); q.rotation.y = -0.5 - r() * 0.6; s.add(q); }
  const fieldR = roseField(220, r, [-10, -1.2, -30, 6], null); s.add(fieldR);
  const wallR = growRoses(walls, 300, 501, [0.9, 1.5]), bridgeR = growRoses(bridge, 130, 502, [0.8, 1.3]);
  const T = titleStage(NAVY);
  const ov = ovCanvas(g => { redText(g, JP, 22, 30, 72); redText(g, RM, 720 - 22, 1280 - 175, 124, 'right'); });
  return { s, cam, T, ov,
    update(lt, D, sec, t, e, k) {
      const p = clamp(lt / (sec.dur + XF));
      cam.position.set(lerp(0.9, 2.0, p), lerp(1.5, 1.1, p), lerp(6, -1.5, ease(p)));
      cam.lookAt(lerp(3.4, 4.6, p), 0.6, -14);
      waterMat.uniforms.uT.value = t;
      boat.position.y = -1.0 + Math.sin(t * 1.2) * 0.04; boat.rotation.z = Math.sin(t * 0.9) * 0.03;
      headG.rotation.y = lerp(-2.4, 0.1, ease(smooth(1.5, sec.dur, lt))); headG.rotation.z = Math.sin(t * 0.6) * 0.08;
      lantern.intensity = 24 + Math.sin(t * 11) * 4 + envSmooth(t) * 12;
      growUpdate(fieldR, lt, -0.6, 4); growUpdate(wallR, lt, -0.2, 6); growUpdate(bridgeR, lt, 1, 5);
      return { title: 0, ov: smooth(0.2, 1.0, lt) };
    } };
})();

// 3b) TEMPLE — a room of flesh; a giant pale face in a halo of splinters opens its eyes; eyeballs float on bloody veins
SCENES.temple = await (async () => {
  const s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(52, W / H, 0.1, 2000), r = rng(66);
  s.background = new THREE.Color(0x120203); s.fog = new THREE.Fog(0x1c0405, 14, 60);
  s.add(new THREE.HemisphereLight(0xff9080, 0x200000, 0.7));
  const key = new THREE.PointLight(0xff8a70, 450, 60); key.position.set(0, 12, -8); s.add(key);
  shadowSun(s, 0xffc0a0, 0.9, V3(10, 30, 20), 30);
  const fleshM = new THREE.MeshPhongMaterial({ map: await tex('flesh.jpg', 1), color: 0x8a4a48, specular: 0x664444, shininess: 80 });
  const grateM = new THREE.MeshPhongMaterial({ map: await tex('metal.jpg', 2), color: 0x9a9a9a, shininess: 40 });
  const floor = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(80, 80), 12, 12), fleshM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; s.add(floor);
  const walk = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(3, 0.25, 14), 1, 5), grateM); walk.position.set(0, 0.12, -1); walk.receiveShadow = true; s.add(walk);
  for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 0.6), grateM); st.position.set(0, 0.1 - i * 0.0, 6.3 + i * 0.6); s.add(st); }
  const plat = new THREE.Mesh(scaleUV(new THREE.CylinderGeometry(4.2, 4.5, 0.7, 8), 4, 1), fleshM); plat.position.set(0, 0.35, -9.5); plat.receiveShadow = true; s.add(plat);
  const pillars = new THREE.Group(); s.add(pillars);
  for (const [x, z] of [[-5, 1], [5, 1], [-6, -6], [6, -6], [-6.5, -13], [6.5, -13]]) {
    const pl = new THREE.Mesh(scaleUV(new THREE.CylinderGeometry(1.3, 1.5, 3.4, 8), 3, 1.5), fleshM); pl.position.set(x, 1.7, z); pl.castShadow = pl.receiveShadow = true; pillars.add(pl);
    for (const y of [0.8, 2.5]) { const b = new THREE.Mesh(scaleUV(new THREE.CylinderGeometry(1.48, 1.55, 0.35, 8), 4, 0.3), grateM); b.position.set(x, y, z); pillars.add(b); }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.4, 0.4, 8), fleshM); cap.position.set(x, 3.6, z); pillars.add(cap); }
  const back = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(50, 36, 1), 8, 6), fleshM); back.position.set(0, 16, -21.5); back.receiveShadow = true; s.add(back);
  for (const x of [-17, 17]) { const sw = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(1, 36, 44), 8, 6), fleshM); sw.position.set(x, 16, -1); s.add(sw); }
  // halo of splinters
  const woodM = new THREE.MeshPhongMaterial({ map: await tex('wood.jpg', 1), color: 0xd0a888, shininess: 15 });
  const halo = new THREE.Group(); halo.position.set(0, 9.5, -20.6); s.add(halo);
  for (let i = 0; i < 80; i++) { const len = 6 + r() * 7; const g = new THREE.BoxGeometry(len, 0.28 + r() * 0.25, 0.08); g.translate(len / 2 + 4.2, 0, 0);
    const m = new THREE.Mesh(g, woodM); m.rotation.set((r() - .5) * 0.3, (r() - .5) * 0.3, i / 80 * Math.PI * 2 + (r() - .5) * 0.08); m.position.z = r() * 0.5; m.castShadow = true; halo.add(m); }
  // meat lumps around the face
  for (let i = 0; i < 26; i++) { const a = r() * 6.283, rr = 4.6 + r() * 2.6; const m = new THREE.Mesh(new THREE.SphereGeometry(0.6 + r() * 1.1, 16, 12), fleshM); m.position.set(Math.cos(a) * rr, 9.5 + Math.sin(a) * rr * 1.1, -20 + r() * 0.8); m.scale.set(1, 0.7 + r() * 0.6, 0.6); s.add(m); }
  if (!EYEBALL_MAT) EYEBALL_MAT = new THREE.MeshPhongMaterial({ map: await tex('eyeball.jpg'), shininess: 120, specular: 0xffffff });
  const face = await giantFace(); face.group.scale.setScalar(7.5); face.group.position.set(0, 5.6, -19.2); s.add(face.group);
  const faceR = growRoses(face.group, 60, 603, [0.3, 0.5], (p) => p.z > 0.25 && p.y > -0.5);
  // floating eyeballs on veins
  const bloodM = new THREE.MeshPhongMaterial({ color: 0x8a0010, specular: 0xff8888, shininess: 110 });
  const floaters = [[-4.6, 5.2, -12.5, 0.95], [4.6, 5.6, -12.5, 0.95], [0, 4.2, -13.8, 1.15]].map(([x, y, z, rad], i) => {
    const g = new THREE.Group(); g.position.set(x, y, z); s.add(g);
    const b = new THREE.Mesh(new THREE.SphereGeometry(rad, 32, 20), EYEBALL_MAT); g.add(b);
    for (let k = 0; k < 5; k++) { const len = 2 + r() * 3; const v = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, len, 6), bloodM); v.geometry.translate(0, -len / 2, 0);
      v.position.set((r() - .5) * rad, -rad * 0.6, (r() - .5) * rad - rad * 0.3); v.rotation.set((r() - .5) * 0.5, 0, (r() - .5) * 0.5); g.add(v); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return { g, b, ph: i * 2.1, y };
  });
  // a small figure made of roses, seen from behind
  const fig = new THREE.Group(); fig.position.set(0, 0.25, -3.6); s.add(fig);
  const bodyM = new THREE.MeshPhongMaterial({ map: VELVET, color: 0x602020, shininess: 20 });
  [[0, 1.25, 0, 0.26, 0.6, 0], [0, 1.95, 0, 0.19, 0.0, 0], [-0.13, 0.45, 0, 0.11, 0.6, 0.03], [0.13, 0.45, 0, 0.11, 0.6, -0.03], [-0.38, 1.3, 0, 0.08, 0.6, 0.2], [0.38, 1.3, 0, 0.08, 0.6, -0.2]].forEach(([x, y, z, rad, len, rz]) => {
    const m = new THREE.Mesh(len ? new THREE.CapsuleGeometry(rad, len, 6, 12) : new THREE.SphereGeometry(rad, 16, 12), bodyM); m.position.set(x, y, z); m.rotation.z = rz; m.castShadow = true; fig.add(m); });
  const figR = growRoses(fig, 150, 601, [0.45, 0.7]);
  const pillarR = growRoses(pillars, 220, 602, [1.0, 1.6]);
  const fieldR = roseField(220, r, [-13, 13, -17, 6], (x) => Math.abs(x) < 1.8); s.add(fieldR);
  const T = titleStage(s.background);
  const ov = ovCanvas(g => { redText(g, 'favfavfav', 360, 40, 80, 'center'); });
  return { s, cam, T, ov,
    update(lt, D, sec, t, e, k) {
      const p = ease(clamp(lt / (sec.dur + XF)));
      cam.position.set(Math.sin(lt * 0.25) * 0.5, lerp(2.3, 3.4, p), lerp(4.5, -1.2, p));
      cam.lookAt(0, lerp(5.5, 8.5, p), -19);
      cam.updateMatrixWorld();
      const open = ease(smooth(1.6, 2.8, lt));
      face.lids.forEach(l => { l.scale.set(1.1, 1, 0.9); l.position.y = 0.2 + open * 0.07; l.rotation.x = Math.PI / 2 + 0.05 - open * 0.55; });
      face.group.updateMatrixWorld(true);
      face.balls.forEach(b => b.lookAt(cam.position));
      face.mouth.scale.set(1, 1 + smooth(4, 6.5, lt) * 0.7 + envSmooth(t) * 0.2, 1);
      face.group.rotation.z = Math.sin(t * 0.4) * 0.04;
      floaters.forEach(f => { f.g.position.y = f.y + Math.sin(t * 0.9 + f.ph) * 0.35; f.g.updateMatrixWorld(true); f.b.lookAt(cam.position); });
      key.intensity = 420 + envSmooth(t) * 300;
      growUpdate(figR, lt, -10, 1); growUpdate(pillarR, lt, -0.4, 5); growUpdate(fieldR, lt, -0.6, 4); growUpdate(faceR, lt, 3, 4);
      return { title: 0, ov: smooth(0.3, 1.1, lt) };
    } };
})();

// 4) POOL — a tiled pool on a concrete deck under a purple sky; the chrome doll head with roses rises from the water, a wall of fire behind
SCENES.pool = await (async () => {
  const s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 2000), r = rng(44);
  const sk = await sky('sky_purple.jpg'); s.background = sk; s.fog = new THREE.Fog(0x9080c8, 80, 500);
  s.add(new THREE.HemisphereLight(0xd0c0ff, 0x403040, 1.0));
  shadowSun(s, 0xffffff, 2.4, V3(30, 50, 25), 40);
  const deckM = new THREE.MeshPhongMaterial({ map: await tex('concrete_grey.jpg', 12), shininess: 4 });
  const PW = 12, PL = 18, PD = 3;
  // deck with a hole: 4 slabs around the pool
  for (const [x, z, w, d] of [[0, -PL / 2 - 40, 200, 80], [0, PL / 2 + 40, 200, 80], [-PW / 2 - 50, 0, 100, PL], [PW / 2 + 50, 0, 100, PL]]) {
    const m = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(w, 0.4, d), w / 16, d / 16), deckM); m.position.set(x, -0.2, z); m.receiveShadow = true; s.add(m); }
  const tileT = await tex('pool_tiles.jpg', 1);
  const tileM = new THREE.MeshPhongMaterial({ map: tileT, shininess: 80, specular: 0x557766 });
  const poolG = new THREE.Group(); s.add(poolG);
  const floor = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(PW, PL), PW / 2, PL / 2), tileM); floor.rotation.x = -Math.PI / 2; floor.position.y = -PD; floor.receiveShadow = true; poolG.add(floor);
  for (const [x, z, ry, w] of [[0, -PL / 2, 0, PW], [0, PL / 2, Math.PI, PW], [-PW / 2, 0, Math.PI / 2, PL], [PW / 2, 0, -Math.PI / 2, PL]]) {
    const m = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(w, PD), w / 2, PD / 2), tileM); m.position.set(x, -PD / 2, z); m.rotation.y = ry; m.receiveShadow = true; poolG.add(m); }
  const causticMat = new THREE.ShaderMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, uniforms: { uT: { value: 0 } },
    vertexShader: `varying vec2 vP; void main(){ vP = (modelMatrix * vec4(position,1.)).xz; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uT; varying vec2 vP;
      vec2 h2(vec2 p){ p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
      float vor(vec2 p){ vec2 i = floor(p), f = fract(p); float m1 = 9., m2 = 9.;
        for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++){ vec2 g = vec2(x,y); vec2 o = h2(i+g); o = .5+.45*sin(uT*1.3+6.2831*o); float d = length(g+o-f); if (d<m1){ m2=m1; m1=d; } else if (d<m2) m2=d; }
        return m2 - m1; }
      void main(){ float c = smoothstep(.12, .0, vor(vP*.9)) * .55 + smoothstep(.1, .0, vor(vP*1.7 + 3.)) * .3; gl_FragColor = vec4(vec3(.75,1.,.9)*c, 1.); }` });
  const caus = new THREE.Mesh(new THREE.PlaneGeometry(PW, PL), causticMat); caus.rotation.x = -Math.PI / 2; caus.position.y = -PD + 0.02; s.add(caus);
  const waterMat = new THREE.MeshPhongMaterial({ color: 0x3aa890, transparent: true, opacity: 0.55, shininess: 140, specular: 0xffffff, envMap: sk, reflectivity: 0.35, combine: THREE.MixOperation });
  const wgeo = new THREE.PlaneGeometry(PW, PL, 48, 72); wgeo.rotateX(-Math.PI / 2); const wbase = wgeo.attributes.position.array.slice();
  const water = new THREE.Mesh(wgeo, waterMat); water.position.y = -0.45; s.add(water);
  // petals on the water
  const petals = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), new THREE.MeshPhongMaterial({ map: VELVET, shininess: 60, specular: 0x884444 }), 160);
  const pd = []; for (let i = 0; i < 160; i++) pd.push({ x: (r() - .5) * (PW - 1), z: (r() - .5) * (PL - 1), a: r() * 6, s: 0.08 + r() * 0.1 }); s.add(petals);
  // doll head
  const doll = await dollHead(sk); doll.group.scale.setScalar(1.0); s.add(doll.group);
  // fire wall
  const fm = flameMats(5); const fires = [];
  for (let i = 0; i < 26; i++) { const f = flame(fm, 6 + r() * 6); f.position.set(-36 + i * 2.9 + (r() - .5) * 2, -0.1, -PL / 2 - 14 - r() * 6); s.add(f); fires.push([f, f.scale.x, r() * 6]); }
  const deckR = roseField(320, r, [-20, 20, -30, 26], (x, z) => Math.abs(x) < PW / 2 + 0.6 && Math.abs(z) < PL / 2 + 0.6, 0.45); s.add(deckR);
  const poolR = growRoses(poolG, 180, 404, [1.2, 2.0]);
  const headR = growRoses(doll.group, 45, 405, [1.1, 1.7], (p) => (p.z > 0.6 && p.y > -1.6 && p.y < 1.5) || p.y < -1.9);
  const T = titleStage(sk);
  const fav = wordArt('Favdotcom', 0.4, { env: sk }); fav.position.set(0, 2.0, 0); T.s.add(fav);
  const rm = wordArt('4RM', 0.5, { env: sk, color: 0xd8d8e8, side: 0x300010 }); rm.position.set(0, 1.35, 0); T.s.add(rm);
  const border = roseBorder(T);
  const ov = ovCanvas(g => { redText(g, JP, 360, 1280 - 290, 56, 'center'); });
  return { s, cam, T, ov,
    update(lt, D, sec, t, e, k) {
      const out = sec.out ?? 11.8, dur = sec.dur;
      for (let i = 0; i < wbase.length; i += 3) wgeo.attributes.position.array[i + 1] = Math.sin(wbase[i] * 0.9 + t * 1.6) * 0.04 + Math.cos(wbase[i + 2] * 0.7 - t * 1.2) * 0.05;
      wgeo.attributes.position.needsUpdate = true; wgeo.computeVertexNormals();
      causticMat.uniforms.uT.value = t;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler();
      pd.forEach((p, i) => { const x = p.x + Math.sin(t * 0.2 + p.a) * 0.4, z = p.z + Math.cos(t * 0.17 + p.a) * 0.4;
        m.compose(V3(x, -0.42, z), q.setFromEuler(eu.set(0, p.a + t * 0.1, 0)), V3(p.s * 1.5, p.s * 0.15, p.s)); petals.setMatrixAt(i, m); });
      petals.instanceMatrix.needsUpdate = true;
      const rise = ease(smooth(0.6, 6.5, lt));
      doll.group.position.set(0, lerp(-2.9, 2.0, rise) + Math.sin(t * 0.9) * 0.08, -1.5);
      // slow sway + sudden unnatural twitches of the head
      const tw = (t % 2.3) / 2.3, twK = tw < 0.05 ? Math.sin(tw / 0.05 * Math.PI) : 0, twDir = Math.floor(t / 2.3) % 2 ? 1 : -1;
      doll.group.rotation.y = Math.sin(t * 0.35) * 0.3; doll.group.rotation.z = Math.sin(t * 0.5) * 0.08 + twK * 0.45 * twDir + smooth(out, out + 2, lt) * 0.5; doll.group.rotation.x = -0.05 + Math.sin(t * 0.27) * 0.06;
      doll.tears.forEach((tg, i) => tg.scale.set(1, Math.max(0.001, smooth(4 + i * 0.6, 9 + i * 0.6, lt)), 1));
      doll.group.updateMatrixWorld(true);
      const blink = 1 - 0.92 * Math.max(0, 1 - Math.abs(((t + 0.4) % 3.1) - 0.08) / 0.08);
      doll.mouthM.map = k > 0.3 ? doll.MA : doll.MB; doll.mouth.scale.set(1 + envSmooth(t) * 0.15, 1 + envSmooth(t) * 0.5 + smooth(out, out + 2, lt) * 0.6, 1);
      doll.ringM.emissiveIntensity = 1.2 + envSmooth(t) * 2.5;
      const calm = smooth(out, out + 2, lt);
      const heat = smooth(3.5, 6, lt) * (1 - calm * 0.85);
      animateFlames(fm, t);
      fires.forEach(([f, s0, ph]) => { const fl = (0.85 + 0.15 * Math.sin(t * 8 + ph)) * heat * (0.8 + envSmooth(t) * 0.4); f.scale.set(s0 * fl, s0 * 2 * fl, 1); });
      // camera: from straight above the pool down to eye level with the head
      const p = ease(smooth(0, 9, lt));
      cam.position.set(lerp(0.01, 0, p), lerp(26, 3.0, p), lerp(0.5, 12.5, p));
      cam.lookAt(0, lerp(-3, 2.6, p), lerp(0, -1.5, p));
      cam.updateMatrixWorld(); doll.group.updateMatrixWorld(true); doll.eyes.forEach(e => { e.lookAt(cam.position); e.scale.set(1, blink, 1); });
      border.visible = lt > 7;
      growUpdate(deckR, lt, -0.6, 6); growUpdate(poolR, lt, 0.5, 8); growUpdate(headR, lt, 3, 7);
      fav.rotation.y = Math.sin(lt * 0.5) * 0.25; rm.rotation.y = -Math.sin(lt * 0.5) * 0.3;
      return { title: smooth(7, 8.2, lt), ov: smooth(8, 9, lt), fade: smooth(dur - 0.5, dur, lt) };
    } };
})();

// ---------------- compositing ----------------
const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); blank.needsUpdate = true;
const mixMat = new THREE.ShaderMaterial({
  uniforms: { tA: { value: rtA.texture }, tB: { value: rtB.texture }, oA: { value: blank }, oB: { value: blank }, uOA: { value: 0 }, uOB: { value: 0 }, uMix: { value: 1 }, uFade: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: /* glsl */`
  uniform sampler2D tA, tB, oA, oB; uniform float uOA, uOB, uMix, uFade; varying vec2 vUv;
  vec3 toSRGB(vec3 c){ c = clamp(c, 0., 1.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
  void main(){
    vec3 a = toSRGB(texture2D(tA, vUv).rgb), b = toSRGB(texture2D(tB, vUv).rgb);
    vec4 ova = texture2D(oA, vUv), ovb = texture2D(oB, vUv);
    a = mix(a, ova.rgb, ova.a * uOA); b = mix(b, ovb.rgb, ovb.a * uOB);
    vec3 c = mix(a, b, uMix);
    float l = dot(c, vec3(.299, .587, .114)); c = clamp(mix(vec3(l), c, 1.3) * 1.04, 0., 1.);
    gl_FragColor = vec4(c * (1. - uFade), 1.);
  }`,
});
const mixScene = new THREE.Scene(); mixScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mixMat));
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

function renderScene(S, rt, lt, sec, t) {
  const fx = S.update(lt, sec.drop || 0, sec, t, envAt(t), kickAt(t)) || {};
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear();
  renderer.render(S.s, S.cam);
  if (fx.title > 0.001) {
    S.T.s.traverse(o => { if (o.material) { for (const m of [].concat(o.material)) { m.transparent = fx.title < 0.999; m.opacity = fx.title; } } });
    renderer.clearDepth(); renderer.render(S.T.s, S.T.cam);
  }
  return fx;
}
function renderAt(t) {
  t = clamp(t, 0, TOTAL - 1e-4);
  let idx = 0; while (idx < TL.sections.length - 1 && t >= TL.sections[idx].t0 + TL.sections[idx].dur) idx++;
  const sec = TL.sections[idx], lt = t - sec.t0, S = SCENES[sec.scene];
  const fx = renderScene(S, rtB, lt, sec, t);
  let mix = 1, pfx = {}, PS = null;
  if (idx > 0 && lt < XF) { const ps = TL.sections[idx - 1]; PS = SCENES[ps.scene]; pfx = renderScene(PS, rtA, ps.dur + lt, ps, t); mix = smooth(0, XF, lt); }
  const u = mixMat.uniforms;
  u.uMix.value = mix; u.oB.value = S.ov || blank; u.uOB.value = fx.ov || 0;
  u.oA.value = PS?.ov || blank; u.uOA.value = pfx.ov || 0; u.uFade.value = fx.fade || 0;
  renderer.setRenderTarget(null); renderer.clear(); renderer.render(mixScene, ortho);
}
window.renderAt = renderAt; window.DBG = { SCENES };
window.SNIPPET = { total: TOTAL, fps: TL.fps };
window.READY = true;

if (!CAPTURE) {
  let audio = null, t0 = performance.now();
  if (TL.audio) { audio = new Audio(TL.audio); document.body.addEventListener('click', () => { audio.currentTime = 0; audio.play(); t0 = performance.now(); }); }
  const startAt = +(params.get('t') || 0);
  (function loop() { const t = audio && !audio.paused ? audio.currentTime : (startAt + (performance.now() - t0) / 1000) % TOTAL; renderAt(t); requestAnimationFrame(loop); })();
}
