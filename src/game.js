// FAVDOTCOM / 4RM — a tiny open-world walk (5–10 min). Same Y2K web-3D look as the snippet:
// photo skies & textures, Phong + hard shadows, chrome WordArt, roses growing out of concrete wherever you walk.
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $ = (id) => document.getElementById(id);
const IS_TOUCH = matchMedia('(pointer: coarse)').matches;
const RES = IS_TOUCH ? 0.45 : 0.5;            // deliberately low internal resolution (Y2K crunch)

// ---------------- helpers ----------------
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const ease = (k) => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------- renderer ----------------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(RES);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 1500);

// ---------------- assets ----------------
const loader = new THREE.TextureLoader(), cache = {};
async function load(name) { if (!cache[name]) cache[name] = await loader.loadAsync(`./assets_dc/${name}`); return cache[name]; }
async function tex(name, rx = 1, ry = rx) { const t = (await load(name)).clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; }
async function sky(name) { const t = (await load(name)).clone(); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; }
function canvasTex(w, h, draw, srgb = true) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
const font = await new FontLoader().loadAsync('./assets_dc/gentilis_bold.typeface.json');
const gltf = new GLTFLoader();

const SKY = {
  day: await sky('sky_kloofendal_48d.jpg'), orange: await sky('sky_orange.jpg'), purple: await sky('sky_purple.jpg'),
  navy: (() => { const t = canvasTex(1024, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#04062e'); gr.addColorStop(.47, '#141c70'); gr.addColorStop(.52, '#1a2276'); gr.addColorStop(1, '#020310'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }); t.mapping = THREE.EquirectangularReflectionMapping; return t; })(),
  stars: (() => { const R = rng(3); const t = canvasTex(2048, 1024, (g, w, h) => { const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#000004'); bg.addColorStop(.48, '#05061a'); bg.addColorStop(1, '#000'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { const b = R(); g.fillStyle = `rgba(255,240,240,${.3 + b * .7})`; g.fillRect(R() * w, Math.pow(R(), 1.3) * h * .5, b > .93 ? 3 : 2, b > .93 ? 3 : 2); } }); t.mapping = THREE.EquirectangularReflectionMapping; return t; })(),
  flesh: new THREE.Color(0x120203),
};

// ---------------- roses ----------------
function petalGeo(len, wid, cup, curl) {
  const nu = 5, nv = 5, pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const v = j / nv, u = i / nu * 2 - 1, w = wid * Math.sin(Math.PI * (0.12 + 0.86 * v)) * (0.55 + 0.45 * v);
    pos.push(u * w, v * len, cup * u * u * w * 1.3 - curl * v * v * len); uv.push(i / nu, v); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
}
function colorize(g, fn) { const p = g.attributes.position, c = []; for (let i = 0; i < p.count; i++) c.push(...fn(p.getX(i), p.getY(i), p.getZ(i))); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return g; }
function roseGeometry(withStem) {
  const parts = [];
  [[3, .15, .10, .12, .9, .25], [5, .19, .13, .42, .75, .35], [6, .23, .16, .82, .55, .5], [7, .25, .18, 1.2, .35, .65]].forEach(([n, len, wid, tilt, cup, shade], li) => {
    for (let i = 0; i < n; i++) { const g = petalGeo(len, wid, cup, li > 1 ? 0.25 : 0.05); g.rotateX(tilt); g.translate(0, 0, 0.015 * li); g.rotateY(i / n * Math.PI * 2 + li * 0.7);
      colorize(g, (x, y) => { const k = clamp(0.5 + y * 2.2); const v = lerp(.55, 1.05, shade) * k + .12; return [v, v, v]; }); g.computeVertexNormals(); parts.push(g); } });
  const bud = new THREE.SphereGeometry(0.06, 8, 6); bud.scale(1, 1.4, 1); bud.translate(0, 0.08, 0); colorize(bud, () => [.45, .45, .45]); parts.push(bud);
  if (withStem) { const stem = new THREE.CylinderGeometry(0.014, 0.018, 0.6, 5); stem.translate(0, -0.3, 0); colorize(stem, () => [.15, .5, .1]); parts.push(stem);
    for (const [y, a] of [[-0.25, 0.4], [-0.42, 3.6]]) { const l = new THREE.SphereGeometry(1, 8, 4); l.scale(0.09, 0.012, 0.045); l.translate(0.08, 0, 0); l.rotateZ(0.4); l.rotateY(a); l.translate(0, y, 0); colorize(l, () => [.18, .55, .12]); parts.push(l); } }
  return mergeGeometries(parts.map(p => { const q = new THREE.BufferGeometry(); if (!p.attributes.normal) p.computeVertexNormals(); for (const k of ['position', 'normal', 'uv', 'color']) q.setAttribute(k, p.attributes[k]); q.setIndex(p.index); return q; }));
}
const ROSE_GEO = roseGeometry(true), ROSE_HEAD = roseGeometry(false);
const ROSE_MAT = new THREE.MeshPhongMaterial({ map: await tex('velvet.jpg'), vertexColors: true, side: THREE.DoubleSide, shininess: 55, specular: 0x886666 });
function roses(list, geo = ROSE_GEO) {
  const im = new THREE.InstancedMesh(geo, ROSE_MAT, list.length); im.castShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  list.forEach((p, i) => { q.setFromEuler(e.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0)); m.compose(p.v, q, V3(p.s, p.s, p.s)); im.setMatrixAt(i, m); });
  return im;
}
function roseField(n, r, cx, cz, rad, avoid) {
  const list = [], centers = []; for (let i = 0; i < n / 12; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * rad; centers.push([cx + Math.cos(a) * d, cz + Math.sin(a) * d]); }
  for (let i = 0; i < n; i++) { const c = centers[Math.floor(r() * centers.length)]; const x = c[0] + (r() - .5) * 2.6, z = c[1] + (r() - .5) * 2.6; if (avoid && avoid(x, z)) continue;
    const s = 0.9 + r() * 0.8; list.push({ v: V3(x, 0.57 * s, z), ry: r() * 6, rx: (r() - .5) * .5, rz: (r() - .5) * .5, s }); }
  return roses(list);
}
// the rose trail: roses sprout from the concrete where you walk
const TRAIL_N = 2400, trail = new THREE.InstancedMesh(ROSE_GEO, ROSE_MAT, TRAIL_N); trail.castShadow = true; trail.frustumCulled = false;
const trailData = []; let trailIdx = 0; { const m = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < TRAIL_N; i++) { trail.setMatrixAt(i, m); trailData.push(null); } }
scene.add(trail);
function sprout(x, z, t, s = 1) { trailData[trailIdx] = { x, z, t, s: s * (0.8 + Math.random() * 0.9), ry: Math.random() * 6, rx: (Math.random() - .5) * .5, rz: (Math.random() - .5) * .5 }; trailIdx = (trailIdx + 1) % TRAIL_N; }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function updateTrail(t) {
  for (let i = 0; i < TRAIL_N; i++) { const d = trailData[i]; if (!d) continue; const k = ease(clamp((t - d.t) / 0.9)); if (k >= 1 && d.done) continue;
    const s = Math.max(1e-4, k * d.s); _q.setFromEuler(_e.set(d.rx, d.ry, d.rz)); _m.compose(V3(d.x, 0.6 * s * 0.6 * 0.6 / 0.6 * 0.6 + 0.02 + 0.32 * s, d.z), _q, V3(s, s, s)); trail.setMatrixAt(i, _m); if (k >= 1) d.done = true; }
  trail.instanceMatrix.needsUpdate = true;
}

// ---------------- builders ----------------
function scaleUV(g, sx, sy) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); return g; }
function setp(o, props) { for (const k in props) { if (o[k] && o[k].copy) o[k].copy(props[k]); else o[k] = props[k]; } return o; }
function mesh(geo, mat, shadow = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; return m; }
function wordArt(str, size, env, opts = {}) {
  const g = new TextGeometry(str, { font, size, depth: size * 0.32, curveSegments: 6, bevelEnabled: true, bevelThickness: size * 0.07, bevelSize: size * 0.045, bevelSegments: 3 }); g.center();
  const front = new THREE.MeshPhongMaterial({ color: opts.color ?? 0x9aaae8, specular: 0xffffff, shininess: 110, envMap: env, reflectivity: 0.75, combine: THREE.MixOperation, emissive: opts.emissive ?? 0x000000 });
  const side = new THREE.MeshPhongMaterial({ color: 0x101a40, specular: 0xaabbff, shininess: 80, envMap: env, reflectivity: 0.4, combine: THREE.MixOperation });
  return new THREE.Mesh(g, [front, side]);
}
const FLAME = canvasTex(1024, 256, (g) => { const R = rng(7); for (let f = 0; f < 8; f++) { const ox = f * 128; for (let k = 0; k < 7; k++) { const x = ox + 64 + (R() - .5) * 50, top = 20 + R() * 90, wid = 18 + R() * 22;
  const gr = g.createLinearGradient(0, 256, 0, top); gr.addColorStop(0, 'rgba(255,240,170,1)'); gr.addColorStop(.35, 'rgba(255,170,30,.95)'); gr.addColorStop(.8, 'rgba(230,50,0,.7)'); gr.addColorStop(1, 'rgba(160,0,0,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(x - wid, 256); g.bezierCurveTo(x - wid * 1.1, 180, x - wid * .3, top + 60, x, top); g.bezierCurveTo(x + wid * .4, top + 70, x + wid * 1.1, 170, x + wid, 256); g.fill(); } } });
const flameMats = [0, 1, 2, 3].map(() => { const t = FLAME.clone(); t.needsUpdate = true; t.repeat.set(1 / 8, 1); return new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }); });
function flame(size, i) { const s = new THREE.Sprite(flameMats[i % 4]); s.scale.set(size, size * 2, 1); s.center.set(0.5, 0.05); return s; }

// colliders (XZ boxes) and walkable bounds
const colliders = [];
const addBox = (x, z, hw, hd, tag) => colliders.push({ x, z, hw, hd, tag });
const addCircle = (x, z, r, tag) => colliders.push({ x, z, r, tag });

// ---------------- the world ----------------
const R = rng(11);
const world = new THREE.Group(); scene.add(world);
const hemi = new THREE.HemisphereLight(0xbcd2ff, 0x605850, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e4, 2.4); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 300 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);

// ground: endless cracked concrete
const ground = mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshPhongMaterial({ map: await tex('concrete_grey.jpg', 120), shininess: 4 }), false);
ground.rotation.x = -Math.PI / 2; world.add(ground);
world.add(roseField(700, R, 0, 0, 90, (x, z) => Math.hypot(x, z) < 12));

const ZP = { eye: V3(130, 0, 0), canal: V3(-130, 0, 0), clock: V3(0, 0, 140), castle: V3(0, 0, -150), temple: V3(1000, 0, 1000) };

// ---- center: the pool, with the sign
const poolG = new THREE.Group(); world.add(poolG);
const PW = 8, PL = 12, PD = 2.6;
const tileM = new THREE.MeshPhongMaterial({ map: await tex('pool_tiles.jpg', 1), shininess: 80, specular: 0x557766 });
const pf = mesh(scaleUV(new THREE.PlaneGeometry(PW, PL), PW / 2, PL / 2), tileM, false); pf.rotation.x = -Math.PI / 2; pf.position.y = -PD; poolG.add(pf);
for (const [x, z, ry, w] of [[0, -PL / 2, 0, PW], [0, PL / 2, Math.PI, PW], [-PW / 2, 0, Math.PI / 2, PL], [PW / 2, 0, -Math.PI / 2, PL]]) { const m = mesh(scaleUV(new THREE.PlaneGeometry(w, PD), w / 2, PD / 2), tileM, false); m.position.set(x, -PD / 2, z); m.rotation.y = ry; poolG.add(m); }
const rim = new THREE.MeshPhongMaterial({ map: await tex('concrete_grey.jpg', 1), color: 0xdddddd });
for (const [x, z, w, d] of [[0, -PL / 2 - 0.4, PW + 1.6, 0.8], [0, PL / 2 + 0.4, PW + 1.6, 0.8], [-PW / 2 - 0.4, 0, 0.8, PL], [PW / 2 + 0.4, 0, 0.8, PL]]) { const m = mesh(new THREE.BoxGeometry(w, 0.25, d), rim); m.position.set(x, 0.12, z); poolG.add(m); }
const ground2 = ground; // hole is faked: the ground plane is hidden over the pool by a slab with a hole
ground2.geometry.dispose(); ground2.geometry = new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(-450, -450); s.lineTo(450, -450); s.lineTo(450, 450); s.lineTo(-450, 450); s.lineTo(-450, -450);
  const h = new THREE.Path(); h.moveTo(-PW / 2, -PL / 2); h.lineTo(-PW / 2, PL / 2); h.lineTo(PW / 2, PL / 2); h.lineTo(PW / 2, -PL / 2); h.lineTo(-PW / 2, -PL / 2); s.holes.push(h); return s; })());
{ const uv = ground2.geometry.attributes.uv, p = ground2.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 900 + 0.5, p.getY(i) / 900 + 0.5); }
ground2.material.map.repeat.set(120, 120);
const waterMat = new THREE.MeshPhongMaterial({ color: 0x3aa890, transparent: true, opacity: 0.6, shininess: 140, specular: 0xffffff, envMap: SKY.day, reflectivity: 0.3, combine: THREE.MixOperation });
const water = new THREE.Mesh(new THREE.PlaneGeometry(PW, PL, 24, 36), waterMat); water.rotation.x = -Math.PI / 2; water.position.y = -0.5; poolG.add(water);
const wbase = water.geometry.attributes.position.array.slice();
addBox(0, 0, PW / 2 + 0.6, PL / 2 + 0.6, 'pool');
const sign = wordArt('favdotcom', 1.6, SKY.day); sign.position.set(0, 7, 0); world.add(sign);
// the head in the pool (real head scan, Lee Perry-Smith by Infinite Realities, CC BY 3.0)
const headG = new THREE.Group(); headG.position.set(0, -7, 0); world.add(headG);
{
  const geo = (await gltf.loadAsync('./assets_dc/models/LeePerrySmith.glb')).scene.getObjectByName('LeePerrySmith').geometry;
  const skinT = (await load('models/Map-COL-dead.jpg')).clone(); skinT.colorSpace = THREE.SRGBColorSpace; skinT.needsUpdate = true;
  const norT = (await load('models/Infinite-Level_02_Tangent_SmoothUV.jpg')).clone(); norT.needsUpdate = true;
  const inner = new THREE.Group(); inner.scale.setScalar(0.75); headG.add(inner);
  inner.add(mesh(geo, new THREE.MeshPhongMaterial({ map: skinT, normalMap: norT, specular: 0x333333, shininess: 25 })));
  const voidM = new THREE.MeshBasicMaterial({ color: 0 }), bloodM = new THREE.MeshPhongMaterial({ color: 0x8a000e, specular: 0xffaaaa, shininess: 120 });
  for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.33, 20, 14), voidM); h.position.set(sx * 0.7, 1.68, 1.82); h.scale.set(1.25, 0.72, 0.55); inner.add(h);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 8), bloodM); c.position.set(sx * 0.66, 0.4, 2.0); inner.add(c); }
  const r = rng(8); inner.add(roses([...Array(16)].map(() => { const a = r() * 6.283, b = r() * 0.8; return { v: V3(Math.cos(a) * Math.sin(b) * 2.2, 3.1 + Math.cos(b) * 0.6, Math.sin(a) * Math.sin(b) * 1.8 - 0.4), ry: r() * 6, rx: r() - .5, rz: r() - .5, s: 2.2 + r() }; }), ROSE_HEAD));
}

// ---- north: the castle (its gate leads into the flesh temple)
const castle = new THREE.Group(); castle.position.copy(ZP.castle); world.add(castle);
{
  const stone = new THREE.MeshPhongMaterial({ map: await tex('castle_grey.jpg', 1), color: 0xf2f2f4, shininess: 12 });
  const roofM = new THREE.MeshPhongMaterial({ map: await tex('roof_tiles.jpg', 3, 2), color: 0xf0f0f4, specular: 0x666666, shininess: 40 });
  const darkM = new THREE.MeshPhongMaterial({ color: 0x0a0204 });
  const tower = (x, z, rad, h, roofH) => {
    const t = new THREE.Group(); t.position.set(x, 0, z); castle.add(t);
    t.add(setp(mesh(scaleUV(new THREE.CylinderGeometry(rad, rad, h, 24), rad * 2, h / 2.5), stone), { position: V3(0, h / 2, 0) }));
    const n = Math.max(8, Math.round(rad * 6)); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const b = mesh(new THREE.BoxGeometry(rad * 0.4, 0.7, 0.45), stone); b.position.set(Math.cos(a) * rad, h + 0.35, Math.sin(a) * rad); b.rotation.y = -a; t.add(b); }
    t.add(setp(mesh(new THREE.ConeGeometry(rad * 1.12, roofH, 24), roofM), { position: V3(0, h + 0.7 + roofH / 2, 0) }));
    addCircle(castle.position.x + x, castle.position.z + z, rad + 0.3);
    return V3(x, h + 0.7 + roofH * 0.35, z).add(castle.position);
  };
  const tops = [tower(0, -4, 3.2, 20, 10), ...[[-7, -8], [7, -8], [-9, 2], [9, 2]].map(([x, z]) => tower(x, z, 2.2, 15, 8)), ...[[-4.2, 6], [4.2, 6]].map(([x, z]) => tower(x, z, 1.4, 10, 5.5))];
  for (const [x, z, w, d] of [[-2.6, 7, 2.2, 1.6], [2.6, 7, 2.2, 1.6], [-8, 5, 1.6, 7], [8, 5, 1.6, 7], [0, -9, 13, 1.6]]) {
    const wall = mesh(scaleUV(new THREE.BoxGeometry(w, 8, d), Math.max(w, d) / 2.5, 3), stone); wall.position.set(x, 4, z); castle.add(wall); addBox(castle.position.x + x, castle.position.z + z, w / 2, d / 2); }
  const lintel = mesh(new THREE.BoxGeometry(3, 2.8, 1.6), stone); lintel.position.set(0, 6.6, 7); castle.add(lintel);
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(3, 5.2), darkM); gate.position.set(0, 2.6, 7.75); castle.add(gate);
  addBox(castle.position.x, castle.position.z - 1, 9, 8, 'castle');
  tops.forEach((p, i) => { if (i % 2 === 0) for (let k = 0; k < 3; k++) { const f = flame(3 + R() * 2.5, k + i); f.position.copy(p).add(V3((R() - .5) * 2, R() * 2, (R() - .5) * 2)); world.add(f); } });
}
const CASTLE_GATE = V3(ZP.castle.x, 0, ZP.castle.z + 8.6);

// ---- east: the eye house on a patch of green grass under an orange sky
const eyeZone = new THREE.Group(); eyeZone.position.copy(ZP.eye); world.add(eyeZone);
let houseMouth, MA, MB;
{
  const grass = mesh(new THREE.CircleGeometry(48, 48), new THREE.MeshPhongMaterial({ map: await tex('grass_ground_green.jpg', 30), shininess: 2 }), false); grass.rotation.x = -Math.PI / 2; grass.position.y = 0.03; eyeZone.add(grass);
  const slab = mesh(new THREE.BoxGeometry(10, 0.3, 10), new THREE.MeshPhongMaterial({ map: await tex('concrete_grey.jpg', 1.5), shininess: 5 })); slab.position.y = 0.12; eyeZone.add(slab);
  MA = await tex('mouth_a.jpg'); MB = await tex('mouth_b.jpg');
  const skin = new THREE.MeshPhongMaterial({ map: await tex('skin.jpg', 1.5), shininess: 30, specular: 0x553333 });
  houseMouth = new THREE.MeshPhongMaterial({ map: MA, shininess: 40, specular: 0x553333 });
  const house = new THREE.Group(); house.position.set(0, 0.27, 0); house.rotation.y = -Math.PI / 2; eyeZone.add(house); // front faces -x (towards the hub)
  house.add(setp(mesh(new THREE.BoxGeometry(3.6, 2.7, 3.6), [skin, skin, skin, skin, houseMouth, skin]), { position: V3(0, 1.35, 0) }));
  const sh = new THREE.Shape(); sh.moveTo(-2.3, 0); sh.lineTo(0, 1.9); sh.lineTo(2.3, 0); sh.lineTo(-2.3, 0);
  const rg = new THREE.ExtrudeGeometry(sh, { depth: 4.2, bevelEnabled: false }); rg.translate(0, 0, -2.1);
  { const p = rg.attributes.position, uv = rg.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getZ(i) + 2.1) / 4.2, 1 - Math.abs(p.getX(i)) / 2.3); }
  const roof = mesh(rg, [skin, new THREE.MeshPhongMaterial({ map: await tex('eye_photo.jpg'), shininess: 50 })]); roof.position.y = 2.7; roof.rotation.y = Math.PI / 2; house.add(roof);
  addBox(ZP.eye.x, ZP.eye.z, 2.0, 2.0);
  const treeT = await load('tree_photo.png'); treeT.colorSpace = THREE.SRGBColorSpace;
  const treeM = new THREE.MeshPhongMaterial({ map: treeT, alphaTest: 0.5, side: THREE.DoubleSide });
  for (let i = 0; i < 26; i++) { const a = R() * 6.283, d = 14 + R() * 30, sc = 5 + R() * 5; const tg = new THREE.Group(); for (const ry of [0, Math.PI / 2]) { const q = mesh(new THREE.PlaneGeometry(sc, sc), treeM); q.position.y = sc / 2 - 0.2; q.rotation.y = ry; tg.add(q); }
    tg.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); eyeZone.add(tg); addCircle(ZP.eye.x + tg.position.x, ZP.eye.z + tg.position.z, 0.5); }
  eyeZone.add(roseField(260, R, 0, 0, 14, (x, z) => Math.abs(x) < 2.4 && Math.abs(z) < 2.4));
}

// ---- west: the night canal with the red bridge and the ghost in the boat
const canal = new THREE.Group(); canal.position.copy(ZP.canal); world.add(canal);
let ghostHead;
{
  const wallM = new THREE.MeshPhongMaterial({ map: await tex('rock_grey.jpg', 1), color: 0x9098a8, shininess: 6 });
  // canal runs along z; water at x in [-3.5, 3.5]
  const waterC = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uT; varying vec2 vUv; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){ vec2 c = floor(vUv * vec2(120., 1600.)); float sp = step(.9, h(c + floor(uT * 6.))); vec3 col = vec3(.10, .13, .42) + vec3(.45, .5, .95) * sp * .55; gl_FragColor = vec4(pow(col, vec3(2.2)), 1.); }` });
  canal.userData.water = waterC;
  const wtr = new THREE.Mesh(new THREE.PlaneGeometry(7, 90), waterC); wtr.rotation.x = -Math.PI / 2; wtr.position.y = 0.035; canal.add(wtr);
  for (const x of [-3.9, 3.9]) { const w = mesh(scaleUV(new THREE.BoxGeometry(0.8, 1.2, 90), 45, 1), wallM); w.position.set(x, -0.45, 0); canal.add(w); }
  // block walking into the canal except over the bridge
  addBox(ZP.canal.x, ZP.canal.z - 23.2, 3.5, 21.8); addBox(ZP.canal.x, ZP.canal.z + 23.2, 3.5, 21.8);
  const lacquer = new THREE.MeshPhongMaterial({ map: await tex('wood.jpg', 1), color: 0xff2020, shininess: 70, specular: 0x664444 });
  const bridge = new THREE.Group(); canal.add(bridge); // spans x, across the canal
  const N = 14, bx = (u) => lerp(-6, 6, u), by = (u) => 0.1 + 1.3 * (1 - (2 * u - 1) ** 2);
  canal.userData.bridgeY = by;
  for (let i = 0; i < N; i++) { const u0 = i / N, u1 = (i + 1) / N, dx = bx(u1) - bx(u0), dy = by(u1) - by(u0); const d = mesh(new THREE.BoxGeometry(Math.hypot(dx, dy) + 0.02, 0.18, 2.6), lacquer); d.position.set((bx(u0) + bx(u1)) / 2, (by(u0) + by(u1)) / 2, 0); d.rotation.z = Math.atan2(dy, dx); bridge.add(d); }
  for (const zs of [-1.25, 1.25]) for (let i = 0; i <= N; i += 2) { const u = i / N; const post = mesh(new THREE.BoxGeometry(0.13, 1.0, 0.13), lacquer); post.position.set(bx(u), by(u) + 0.5, zs); bridge.add(post);
    if (i < N) { const u2 = (i + 2) / N, dx = bx(u2) - bx(u), dy = by(u2) - by(u); const rail = mesh(new THREE.BoxGeometry(Math.hypot(dx, dy), 0.09, 0.11), lacquer); rail.position.set((bx(u) + bx(u2)) / 2, (by(u) + by(u2)) / 2 + 0.95, zs); rail.rotation.z = Math.atan2(dy, dx); bridge.add(rail); } }
  // boat + ghost
  const woodM = new THREE.MeshPhongMaterial({ map: await tex('wood.jpg', 1), color: 0x6a5040 });
  const boat = new THREE.Group(); boat.position.set(1.2, 0.12, -9); canal.add(boat); canal.userData.boat = boat;
  boat.add(mesh(new THREE.BoxGeometry(1.3, 0.35, 4.0), woodM));
  const ghostM = new THREE.MeshPhongMaterial({ map: await tex('plaster.jpg', 1), color: 0xf0f0f4 }), hairM = new THREE.MeshPhongMaterial({ color: 0x050505, specular: 0x666688, shininess: 90, side: THREE.DoubleSide });
  const ghost = new THREE.Group(); ghost.position.set(0, 0.17, 0.6); boat.add(ghost);
  ghost.add(setp(mesh(new THREE.CylinderGeometry(0.17, 0.38, 1.55, 14), ghostM), { position: V3(0, 0.78, 0) }));
  ghostHead = new THREE.Group(); ghostHead.position.y = 1.72; ghost.add(ghostHead);
  ghostHead.add(mesh(new THREE.SphereGeometry(0.15, 14, 10), ghostM));
  ghostHead.add(setp(mesh(new THREE.CylinderGeometry(0.17, 0.26, 1.15, 16, 1, true), hairM), { position: V3(0, -0.38, 0) }));
  ghostHead.add(mesh(new THREE.SphereGeometry(0.175, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hairM));
  // pagoda + dark trees
  const darkM = new THREE.MeshPhongMaterial({ map: await tex('wood.jpg', 1), color: 0x302830 }), roofM = new THREE.MeshPhongMaterial({ map: await tex('metal.jpg', 1), color: 0x404050 });
  const pag = new THREE.Group(); pag.position.set(-16, 0, -22); canal.add(pag); addCircle(ZP.canal.x - 16, ZP.canal.z - 22, 2.4);
  for (let k = 0; k < 4; k++) { const sz = 4 - k * 0.8; pag.add(setp(mesh(new THREE.BoxGeometry(sz, 1.6, sz), darkM), { position: V3(0, k * 2.1 + 0.8, 0) }));
    const rf = mesh(new THREE.ConeGeometry(sz * 0.95, 0.9, 4), roofM); rf.rotation.y = Math.PI / 4; rf.position.y = k * 2.1 + 2.0; pag.add(rf); }
  const treeT = await load('tree_photo.png'); const treeM = new THREE.MeshPhongMaterial({ map: treeT, alphaTest: 0.5, side: THREE.DoubleSide, color: 0x283050 });
  for (let i = 0; i < 18; i++) { const sc = 7 + R() * 6; const q = mesh(new THREE.PlaneGeometry(sc, sc), treeM); q.position.set(10 + R() * 12, sc / 2 - 0.3, -40 + i * 4.5); q.rotation.y = -0.6 - R() * 0.5; canal.add(q); }
  canal.add(roseField(260, R, -10, 0, 16, (x) => x > -4.5 && x < 4.5));
}

// ---- south: the night clock town with hands rising out of the dirt
const town = new THREE.Group(); town.position.copy(ZP.clock); world.add(town);
const hands = [];
{
  const dirt = mesh(new THREE.CircleGeometry(50, 40), new THREE.MeshPhongMaterial({ map: await tex('dirt.jpg', 16), color: 0xa08060 }), false); dirt.rotation.x = -Math.PI / 2; dirt.position.y = 0.03; town.add(dirt);
  const path = mesh(new THREE.PlaneGeometry(3, 40), new THREE.MeshPhongMaterial({ map: await tex('leopard.jpg', 1, 8) }), false); path.rotation.x = -Math.PI / 2; path.position.set(0, 0.05, -10); town.add(path);
  const bM = new THREE.MeshPhongMaterial({ map: await tex('facade.jpg', 1), shininess: 10 });
  const dripM = new THREE.MeshPhongMaterial({ color: 0xc00010, specular: 0xffaaaa, shininess: 110 });
  const drips = (parent, w, y, z, n) => { for (let i = 0; i < n; i++) { const len = 0.6 + R() * 2.8, x = (R() - .5) * w; parent.add(setp(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 8), dripM), { position: V3(x, y - len / 2, z) })); parent.add(setp(new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), dripM), { position: V3(x, y - len, z) })); } };
  [[-14, 6, 7, 14], [-15, 18, 8, 20], [14, 4, 7, 12], [15, 18, 8, 22], [-8, 30, 7, 16], [8, 32, 6, 26]].forEach(([x, z, w, h], i) => {
    const b = mesh(scaleUV(new THREE.BoxGeometry(w, h, w), w / 4, h / 8), bM); b.position.set(x, h / 2, z); town.add(b); addBox(ZP.clock.x + x, ZP.clock.z + z, w / 2, w / 2);
    if (i % 3 !== 1) drips(b, w * 0.7, h / 2 - 1.5 - R() * 3, (x < 0 ? 1 : 1) * w / 2 + 0.16, 5); });
  const tw = new THREE.Group(); tw.position.set(0, 0, 14); town.add(tw); addBox(ZP.clock.x, ZP.clock.z + 14, 1.8, 1.8);
  tw.add(setp(mesh(scaleUV(new THREE.BoxGeometry(3.4, 14, 3.4), 1, 3), bM), { position: V3(0, 7, 0) }));
  tw.add(setp(mesh(new THREE.BoxGeometry(4.6, 4.6, 4.6), new THREE.MeshPhongMaterial({ map: await tex('plaster.jpg', 1), color: 0xf4f0ea })), { position: V3(0, 16.3, 0) }));
  const roofT = mesh(new THREE.ConeGeometry(3.6, 4, 4), new THREE.MeshPhongMaterial({ map: await tex('metal.jpg', 2), color: 0x505058 })); roofT.position.y = 20.6; roofT.rotation.y = Math.PI / 4; tw.add(roofT);
  const faceM = new THREE.MeshPhongMaterial({ map: await tex('clockface.jpg') }), hm = new THREE.MeshPhongMaterial({ color: 0x151515 });
  town.userData.clockHands = [];
  for (let i = 0; i < 4; i++) { const f = new THREE.Group(); f.rotation.y = i * Math.PI / 2; f.position.y = 16.3; tw.add(f);
    f.add(setp(new THREE.Mesh(new THREE.PlaneGeometry(4, 4), faceM), { position: V3(0, 0, 2.31) }));
    const hh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 0.05), hm); hh.geometry.translate(0, 0.45, 0); hh.position.z = 2.36; f.add(hh);
    const mh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.05), hm); mh.geometry.translate(0, 0.7, 0); mh.position.z = 2.38; f.add(mh); town.userData.clockHands.push(hh, mh); }
  const handM = new THREE.MeshPhongMaterial({ map: await tex('skin_grey.jpg', 1.5), color: 0xe0e0e0, specular: 0x555555, shininess: 30 });
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    g.add(setp(mesh(new THREE.SphereGeometry(0.5, 20, 14), handM), { position: V3(0, 1.15, 0), scale: V3(0.95, 1.05, 0.32) }));
    g.add(setp(mesh(new THREE.CylinderGeometry(0.3, 0.34, 1.2, 14), handM), { position: V3(0, 0.4, 0) }));
    [[-0.33, 0.62, 0.11], [-0.11, 0.7, 0.03], [0.11, 0.68, -0.03], [0.32, 0.55, -0.12]].forEach(([x, len, rz]) => g.add(setp(mesh(new THREE.CapsuleGeometry(0.095, len, 4, 10), handM), { position: V3(x, 1.6 + len / 2, 0), rotation: new THREE.Euler(0, 0, rz) })));
    g.add(setp(mesh(new THREE.CapsuleGeometry(0.1, 0.45, 4, 10), handM), { position: V3(-0.55, 1.15, 0.05), rotation: new THREE.Euler(0, 0, 0.9) }));
    const side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
    g.position.set(side * (2.6 + R() * 2.5), -3.6, -14 + row * 3.6); g.rotation.y = (R() - .5) * 0.8; g.scale.setScalar(1.1 + R() * 0.7); town.add(g);
    hands.push({ g, k: 0, wx: ZP.clock.x + g.position.x, wz: ZP.clock.z + g.position.z });
  }
  town.add(roseField(240, R, 0, 0, 18, (x) => Math.abs(x) < 2));
}

// ---- the flesh temple (an interior, reached through the castle gate)
const temple = new THREE.Group(); temple.position.copy(ZP.temple); world.add(temple);
const floaters = []; let templeFaceEyes = [];
{
  const fleshM = new THREE.MeshPhongMaterial({ map: await tex('flesh.jpg', 1), color: 0x8a4a48, specular: 0x664444, shininess: 80 });
  const grateM = new THREE.MeshPhongMaterial({ map: await tex('metal.jpg', 2), color: 0x9a9a9a, shininess: 40 });
  const fl = mesh(scaleUV(new THREE.PlaneGeometry(40, 50), 6, 8), fleshM, false); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0.02, -8); temple.add(fl);
  temple.add(setp(mesh(scaleUV(new THREE.BoxGeometry(3, 0.2, 22), 1, 7), grateM), { position: V3(0, 0.1, -2) }));
  temple.add(setp(mesh(scaleUV(new THREE.BoxGeometry(50, 36, 1), 8, 6), fleshM), { position: V3(0, 16, -24) }));
  for (const x of [-16, 16]) temple.add(setp(mesh(scaleUV(new THREE.BoxGeometry(1, 36, 50), 8, 6), fleshM), { position: V3(x, 16, -1) }));
  temple.add(setp(mesh(scaleUV(new THREE.BoxGeometry(34, 36, 1), 6, 6), fleshM), { position: V3(0, 16, 16) }));
  temple.add(setp(mesh(scaleUV(new THREE.BoxGeometry(34, 1, 50), 6, 8), fleshM), { position: V3(0, 30, -4) }));
  const exitM = new THREE.Mesh(new THREE.PlaneGeometry(3, 5), new THREE.MeshBasicMaterial({ color: 0xfff4e0 })); exitM.position.set(0, 2.5, 15.4); exitM.rotation.y = Math.PI; temple.add(exitM);
  addBox(ZP.temple.x, ZP.temple.z - 24.5, 30, 1); addBox(ZP.temple.x - 16.5, ZP.temple.z, 1, 30); addBox(ZP.temple.x + 16.5, ZP.temple.z, 1, 30); addBox(ZP.temple.x, ZP.temple.z + 16.5, 30, 1);
  for (const [x, z] of [[-6, 4], [6, 4], [-6.5, -6], [6.5, -6], [-7, -15], [7, -15]]) {
    temple.add(setp(mesh(scaleUV(new THREE.CylinderGeometry(1.3, 1.5, 3.4, 8), 3, 1.5), fleshM), { position: V3(x, 1.7, z) }));
    for (const y of [0.8, 2.5]) temple.add(setp(mesh(new THREE.CylinderGeometry(1.48, 1.55, 0.35, 8), grateM), { position: V3(x, y, z) }));
    addCircle(ZP.temple.x + x, ZP.temple.z + z, 1.6); }
  const woodM = new THREE.MeshPhongMaterial({ map: await tex('wood.jpg', 1), color: 0xd0a888 });
  const halo = new THREE.Group(); halo.position.set(0, 10, -23); temple.add(halo);
  for (let i = 0; i < 70; i++) { const len = 6 + R() * 7; const g = new THREE.BoxGeometry(len, 0.3 + R() * 0.25, 0.08); g.translate(len / 2 + 4.6, 0, 0); const m = new THREE.Mesh(g, woodM); m.rotation.set((R() - .5) * .3, (R() - .5) * .3, i / 70 * Math.PI * 2); m.position.z = R() * 0.5; halo.add(m); }
  for (let i = 0; i < 22; i++) { const a = R() * 6.283, rr = 5 + R() * 2.5; const m = mesh(new THREE.SphereGeometry(0.6 + R() * 1.1, 14, 10), fleshM); m.position.set(Math.cos(a) * rr, 10 + Math.sin(a) * rr * 1.1, -22.6); m.scale.set(1, 0.8, 0.6); temple.add(m); }
  const bust = (await gltf.loadAsync('./assets_dc/models/marble_bust_01_1k.gltf')).scene;
  bust.traverse(o => { if (o.isMesh) { o.castShadow = true; o.material = new THREE.MeshPhongMaterial({ map: o.material.map, normalMap: o.material.normalMap, color: 0xe8dcd4, shininess: 30 }); } });
  bust.scale.setScalar(7.5 * 4.2); bust.position.set(0, 10 - 7.5 * 1.3 - 4, -22); temple.add(bust);
  const eyeM = new THREE.MeshPhongMaterial({ map: await tex('eyeball.jpg'), shininess: 120, specular: 0xffffff }), bloodM = new THREE.MeshPhongMaterial({ color: 0x8a0010, specular: 0xff8888, shininess: 110 });
  [[-4.6, 5.2, -13, 0.95], [4.6, 5.6, -13, 0.95], [0, 4.4, -15, 1.15]].forEach(([x, y, z, rad], i) => {
    const g = new THREE.Group(); g.position.set(x, y, z); temple.add(g);
    const b = mesh(new THREE.SphereGeometry(rad, 28, 18), eyeM); g.add(b);
    for (let k = 0; k < 5; k++) { const len = 2 + R() * 3; const v = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, len, 6), bloodM); v.geometry.translate(0, -len / 2, 0); v.position.set((R() - .5) * rad, -rad * 0.6, (R() - .5) * rad - rad * .3); v.rotation.set((R() - .5) * .5, 0, (R() - .5) * .5); g.add(v); }
    floaters.push({ g, b, y, ph: i * 2.1 }); });
  temple.add(roseField(200, R, 0, -6, 12, (x) => Math.abs(x) < 1.8));
  const key = new THREE.PointLight(0xff8a70, 450, 70); key.position.set(0, 14, -10); temple.add(key);
}
const TEMPLE_EXIT = V3(ZP.temple.x, 0, ZP.temple.z + 14.5);

// ---------------- letters (the collectibles) ----------------
const LET = [
  { ch: 'F', zone: 'eye', pos: V3(ZP.eye.x - 3.2, 1.6, ZP.eye.z), hidden: true },
  { ch: 'A', zone: 'canal', pos: V3(ZP.canal.x, 3.0, ZP.canal.z), hidden: true },
  { ch: 'V', zone: 'clock', pos: V3(ZP.clock.x, 1.8, ZP.clock.z + 10.5), hidden: true },
  { ch: '.', zone: 'temple', pos: V3(ZP.temple.x, 2.2, ZP.temple.z - 12), hidden: false },
];
for (const L of LET) {
  L.mesh = L.ch === '.' ? new THREE.Mesh(new THREE.SphereGeometry(0.45, 32, 20), new THREE.MeshPhongMaterial({ color: 0xc0c8ff, specular: 0xffffff, shininess: 120, envMap: SKY.day, reflectivity: 0.85, combine: THREE.MixOperation }))
    : wordArt(L.ch, 1.2, SKY.day);
  L.mesh.position.copy(L.pos); L.mesh.visible = !L.hidden; world.add(L.mesh);
  L.light = new THREE.PointLight(0xff3040, 0, 8); L.light.position.copy(L.pos); world.add(L.light);
  L.got = false; L.appear = L.hidden ? -1 : 0;
}

// ---------------- zones: sky, fog, light, music ----------------
const ZONES = {
  hub: { sky: SKY.day, fog: [0xc8d4ec, 80, 420], hemi: [0xbcd2ff, 0x605850, 1.1], sun: [0xfff4e4, 2.4], seg: 0 },
  eye: { sky: SKY.orange, fog: [0xf0a060, 40, 260], hemi: [0xffd0a0, 0x305020, 1.2], sun: [0xffc890, 2.2], seg: 1 },
  canal: { sky: SKY.navy, fog: [0x141c68, 14, 80], hemi: [0x7080e0, 0x202010, 1.1], sun: [0xb0b8ff, 1.2], seg: 1 },
  clock: { sky: SKY.stars, fog: [0x05061a, 25, 120], hemi: [0x8090c0, 0x302018, 0.8], sun: [0xc8d4ff, 1.4], seg: 2 },
  temple: { sky: SKY.flesh, fog: [0x1c0405, 12, 60], hemi: [0xff9080, 0x200000, 0.7], sun: [0xffc0a0, 0.6], seg: 2 },
  final: { sky: SKY.purple, fog: [0x9080c8, 80, 500], hemi: [0xd0c0ff, 0x403040, 1.0], sun: [0xffffff, 2.2], seg: 3 },
};
function zoneAt(p) {
  if (Math.abs(p.x - ZP.temple.x) < 60 && Math.abs(p.z - ZP.temple.z) < 60) return 'temple';
  if (state.ending) return 'final';
  for (const k of ['eye', 'canal', 'clock']) if (Math.hypot(p.x - ZP[k].x, p.z - ZP[k].z) < 55) return k;
  return 'hub';
}
let curZone = null;
function applyZone(z) {
  const Z = ZONES[z]; curZone = z;
  scene.background = Z.sky; scene.fog = new THREE.Fog(...Z.fog);
  hemi.color.set(Z.hemi[0]); hemi.groundColor.set(Z.hemi[1]); hemi.intensity = Z.hemi[2];
  sun.color.set(Z.sun[0]); sun.intensity = Z.sun[1];
  music.play(Z.seg);
}

// ---------------- music: loops of the four hooks from the snippet mix (if present) ----------------
const music = (() => {
  let ctx = null, buf = null, src = null, gain = null, seg = -1;
  const SEGS = [[0.9, 15], [16.6, 30], [32.5, 45], [45.2, 56.8]];
  return {
    async init() {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); gain = ctx.createGain(); gain.connect(ctx.destination);
        for (const f of ['audio/fav_mix.mp3', 'audio/mix_dc.wav', 'audio/mix.wav']) { const r = await fetch(f); if (r.ok) { buf = await ctx.decodeAudioData(await r.arrayBuffer()); break; } }
      } catch (e) { buf = null; }
      if (seg >= 0) { const s = seg; seg = -1; this.play(s); }
    },
    play(s) {
      if (s === seg) return; seg = s; if (!ctx || !buf) return;
      const now = ctx.currentTime;
      if (src) { const old = src, og = gain; og.gain.setTargetAtTime(0, now, 0.25); setTimeout(() => { try { old.stop(); } catch (e) {} }, 1500); }
      gain = ctx.createGain(); gain.gain.value = 0; gain.connect(ctx.destination); gain.gain.setTargetAtTime(0.9, now, 0.4);
      src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = SEGS[s][0]; src.loopEnd = SEGS[s][1]; src.connect(gain); src.start(0, SEGS[s][0]);
    },
    resume() { ctx?.resume(); },
  };
})();

// ---------------- player & input ----------------
const state = { yaw: Math.PI, pitch: 0, pos: V3(0, 0, 22), started: false, ending: false, endT: 0, lastSprout: V3(0, 0, 22), got: 0, msgT: 0, inTemple: false, fading: false, t: 0 };
const keys = {};
addEventListener('keydown', (e) => { keys[e.code] = true; });
addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('click', () => { if (state.started && !IS_TOUCH) canvas.requestPointerLock?.(); });
addEventListener('mousemove', (e) => { if (document.pointerLockElement === canvas) { state.yaw -= e.movementX * 0.0024; state.pitch = clamp(state.pitch - e.movementY * 0.0024, -1.2, 1.2); } });
// touch: left half = joystick, right half = look
const joy = { id: null, x: 0, y: 0, ox: 0, oy: 0 }, look = { id: null, x: 0, y: 0 };
if (IS_TOUCH) $('joy').style.display = 'block';
addEventListener('touchstart', (e) => { for (const t of e.changedTouches) { if (t.clientX < innerWidth / 2 && joy.id === null) { joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.x = joy.y = 0; } else if (look.id === null) { look.id = t.identifier; look.x = t.clientX; look.y = t.clientY; } } }, { passive: true });
addEventListener('touchmove', (e) => { for (const t of e.changedTouches) { if (t.identifier === joy.id) { joy.x = clamp((t.clientX - joy.ox) / 50, -1, 1); joy.y = clamp((t.clientY - joy.oy) / 50, -1, 1); $('joy').firstElementChild.style.transform = `translate(${joy.x * 40}px,${joy.y * 40}px)`; }
  if (t.identifier === look.id) { state.yaw -= (t.clientX - look.x) * 0.006; state.pitch = clamp(state.pitch - (t.clientY - look.y) * 0.006, -1.2, 1.2); look.x = t.clientX; look.y = t.clientY; } } }, { passive: true });
addEventListener('touchend', (e) => { for (const t of e.changedTouches) { if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; $('joy').firstElementChild.style.transform = ''; } if (t.identifier === look.id) look.id = null; } });

function collide(p) {
  for (const c of colliders) {
    if (c.tag === 'pool' && state.ending) continue;
    if (c.r) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + 0.4; if (d < m && d > 1e-6) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; } }
    else { const dx = p.x - c.x, dz = p.z - c.z, ox = c.hw + 0.4 - Math.abs(dx), oz = c.hd + 0.4 - Math.abs(dz); if (ox > 0 && oz > 0) { if (ox < oz) p.x += Math.sign(dx || 1) * ox; else p.z += Math.sign(dz || 1) * oz; } }
  }
  if (!state.inTemple) { const d = Math.hypot(p.x, p.z); if (d > 400) { p.x *= 400 / d; p.z *= 400 / d; } }
}
function groundY(p) {
  // walk up and over the canal bridge
  const lx = p.x - ZP.canal.x, lz = p.z - ZP.canal.z;
  if (!state.inTemple && Math.abs(lz) < 1.3 && Math.abs(lx) < 6) return canal.userData.bridgeY((lx + 6) / 12) + 0.1;
  return 0;
}

// ---------------- story ----------------
let msgQueue = [];
function say(text, dur = 4.5) { msgQueue.push({ text, dur }); }
function updateDialog(dt) {
  const d = $('dialog');
  if (state.msgT > 0) { state.msgT -= dt; if (state.msgT <= 0) d.style.opacity = 0; }
  else if (msgQueue.length && d.style.opacity !== '1') { const m = msgQueue.shift(); d.textContent = m.text; d.style.opacity = 1; state.msgT = m.dur; }
}
const visited = {};
const ZONE_LINES = {
  eye: 'у дома есть глаз. он смотрит на тебя. подойди ко рту.',
  canal: 'вода не двигается. в лодке кто-то стоит.',
  clock: 'часы спешат. земля под ногами шевелится.',
  temple: 'здесь всё живое. на полу лежит точка.',
};
function fadeTo(fn) { if (state.fading) return; state.fading = true; $('fade').style.opacity = 1; setTimeout(() => { fn(); $('fade').style.opacity = 0; setTimeout(() => state.fading = false, 450); }, 480); }
function nearestTarget() {
  if (state.got >= 4) return V3(0, 0, 0);
  let best = null, bd = 1e9; for (const L of LET) { if (L.got) continue; const tgt = L.zone === 'temple' ? (state.inTemple ? L.pos : CASTLE_GATE) : L.pos; const d = tgt.distanceTo(state.pos); if (d < bd) { bd = d; best = tgt; } }
  return best;
}
function collect(L) {
  L.got = true; L.mesh.visible = false; L.light.intensity = 0; state.got++;
  $('letters').children[LET.indexOf(L)].classList.add('got');
  for (let i = 0; i < 40; i++) { const a = Math.random() * 6.283, d = 1 + Math.random() * 6; sprout(state.pos.x + Math.cos(a) * d, state.pos.z + Math.sin(a) * d, state.t + Math.random() * 1.5, 1.3); }
  const left = 4 - state.got;
  say(left ? `ты нашёл «${L.ch}». осталось ${left}.` : 'F A V . — всё собрано. вернись к бассейну в центре.');
  if (L.zone === 'temple') setTimeout(() => fadeTo(() => { state.inTemple = false; state.pos.copy(CASTLE_GATE).add(V3(0, 0, 4)); state.yaw = 0; }), 2200);
}
function startEnding() {
  state.ending = true; state.endT = state.t; applyZone('final');
  say('favdotcom открыт.', 5);
  const r = rng(99); for (let i = 0; i < TRAIL_N; i++) { const a = r() * 6.283, d = 4 + Math.pow(r(), 0.6) * 160; sprout(Math.cos(a) * d, Math.sin(a) * d, state.t + 1 + d / 30 + r(), 1.2 + r()); }
}

// ---------------- main loop ----------------
const clock = new THREE.Clock(); let stepAcc = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta()); state.t += dt; const t = state.t;
  if (state.started && !state.ending) {
    let mx = 0, mz = 0;
    if (keys.KeyW || keys.ArrowUp) mz -= 1; if (keys.KeyS || keys.ArrowDown) mz += 1; if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
    mx += joy.x; mz += joy.y;
    const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
    const speed = (keys.ShiftLeft || keys.ShiftRight || Math.hypot(joy.x, joy.y) > 0.95) ? 11 : 6;
    const s = Math.sin(state.yaw), c = Math.cos(state.yaw);
    state.pos.x += (mx * c + mz * s) * speed * dt; state.pos.z += (-mx * s + mz * c) * speed * dt;
    collide(state.pos);
    stepAcc += len * speed * dt;
    // roses sprout behind you
    if (!state.inTemple && state.pos.distanceTo(state.lastSprout) > 0.9) { for (let i = 0; i < 2; i++) sprout(state.pos.x + (Math.random() - .5) * 2.4, state.pos.z + (Math.random() - .5) * 2.4, t, 1); state.lastSprout.copy(state.pos); }
  }
  if (state.ending) {
    const k = ease(smooth(0, 9, t - state.endT));
    const a = (t - state.endT) * 0.12;
    state.pos.set(Math.sin(a) * lerp(14, 11, k), 0, Math.cos(a) * lerp(14, 11, k));
    state.yaw = Math.atan2(state.pos.x, state.pos.z); state.pitch = lerp(0, 0.18, k);
    headG.position.y = lerp(-7, 2.2, ease(smooth(1, 8, t - state.endT))); headG.rotation.y = state.yaw + Math.sin(t * 0.4) * 0.2; headG.rotation.z = (t % 2.3) < 0.1 ? 0.4 : Math.sin(t * 0.5) * 0.06;
    sign.position.y = lerp(7, 9, k);
    if (t - state.endT > 12 && $('end').style.display !== 'flex') {
      $('endtext').innerHTML = 'спасибо, что прошёл.<br><br>favdotcom · 4RM<br>музыка: favdotcom<br><span style="font-size:12px;opacity:.7">head scan: Lee Perry-Smith by Infinite Realities (CC BY 3.0) · textures & bust: Poly Haven (CC0)</span>';
      $('end').style.display = 'flex';
    }
  }
  const gy = groundY(state.pos);
  camera.position.set(state.pos.x, gy + 1.7 + (state.ending ? 0.8 : Math.sin(stepAcc * 1.7) * 0.03), state.pos.z);
  camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
  // zones, triggers
  const z = zoneAt(state.pos);
  if (z !== curZone) { applyZone(z); if (ZONE_LINES[z] && !visited[z]) { visited[z] = 1; say(ZONE_LINES[z]); } }
  if (!state.inTemple && !state.ending && state.pos.distanceTo(CASTLE_GATE) < 2.4) fadeTo(() => { state.inTemple = true; state.pos.copy(TEMPLE_EXIT).add(V3(0, 0, -2)); state.yaw = 0; });
  if (state.inTemple && state.pos.distanceTo(TEMPLE_EXIT) < 1.6) fadeTo(() => { state.inTemple = false; state.pos.copy(CASTLE_GATE).add(V3(0, 0, 3)); state.yaw = 0; });
  if (!state.ending && state.got >= 4 && Math.hypot(state.pos.x, state.pos.z) < 11) startEnding();
  // zone events that reveal letters
  const dEye = Math.hypot(state.pos.x - ZP.eye.x, state.pos.z - ZP.eye.z);
  houseMouth.map = (dEye < 9 && Math.sin(t * 9) > 0) ? MB : MA;
  if (dEye < 8 && LET[0].appear < 0) LET[0].appear = t;
  const lx = state.pos.x - ZP.canal.x, lz = state.pos.z - ZP.canal.z, dCanal = Math.hypot(lx, lz);
  const boat = canal.userData.boat; boat.position.y = 0.12 + Math.sin(t * 1.2) * 0.04;
  const wantYaw = Math.atan2(state.pos.x - (ZP.canal.x + boat.position.x), state.pos.z - (ZP.canal.z + boat.position.z));
  ghostHead.rotation.y = lerp(ghostHead.rotation.y, dCanal < 20 ? wantYaw : Math.PI, 0.02);
  if (dCanal < 12 && LET[1].appear < 0) LET[1].appear = t + 1.5;
  canal.userData.water.uniforms.uT.value = t;
  const dClock = Math.hypot(state.pos.x - ZP.clock.x, state.pos.z - ZP.clock.z);
  hands.forEach((h, i) => { const near = Math.hypot(state.pos.x - h.wx, state.pos.z - h.wz) < 14 || dClock < 6; h.k = clamp(h.k + (near ? dt * 0.9 : -dt * 0.3)); h.g.position.y = lerp(-3.6, -0.2, ease(h.k)); h.g.rotation.z = Math.sin(t * 0.8 + i) * 0.06 * h.k; });
  town.userData.clockHands.forEach((m, i) => m.rotation.z = -t * (i % 2 ? 3 : 0.3) * (dClock < 40 ? 3 : 1));
  if (dClock < 18 && LET[2].appear < 0) LET[2].appear = t + 1;
  floaters.forEach(f => { f.g.position.y = f.y + Math.sin(t * 0.9 + f.ph) * 0.35; f.g.updateMatrixWorld(true); f.b.lookAt(camera.position); });
  // letters
  for (const L of LET) {
    if (L.got) continue;
    if (L.appear >= 0 && t >= L.appear) { L.mesh.visible = true; const k = ease(clamp((t - L.appear) / 1.2)); L.mesh.scale.setScalar(Math.max(0.01, k)); L.light.intensity = 6 * k; }
    L.mesh.rotation.y = t * 1.4; L.mesh.position.y = L.pos.y + Math.sin(t * 2) * 0.15;
    if (L.mesh.visible && L.mesh.scale.x > 0.6 && L.mesh.position.distanceTo(V3(state.pos.x, L.mesh.position.y, state.pos.z)) < 1.8 + (L.zone === 'canal' ? 1 : 0)) collect(L);
  }
  // water, sign
  { const a = water.geometry.attributes.position.array; for (let i = 0; i < wbase.length; i += 3) a[i + 2] = Math.sin(wbase[i] * 0.9 + t * 1.6) * 0.04 + Math.cos(wbase[i + 1] * 0.7 - t * 1.2) * 0.05; water.geometry.attributes.position.needsUpdate = true; }
  sign.rotation.y = t * 0.3;
  flameMats.forEach((m, i) => m.map.offset.x = (Math.floor(t * 14 + i * 3) % 8) / 8);
  updateTrail(t);
  // shadows follow the player
  sun.position.set(state.pos.x + 40, 70, state.pos.z + 30); sun.target.position.set(state.pos.x, 0, state.pos.z);
  // navigation arrow
  const tgt = nearestTarget();
  if (tgt) { const ang = Math.atan2(tgt.x - state.pos.x, tgt.z - state.pos.z) - Math.atan2(-Math.sin(state.yaw), -Math.cos(state.yaw)); $('arrow').style.transform = `rotate(${-ang}rad)`; $('arrow').style.opacity = state.ending ? 0 : 1; }
  updateDialog(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

applyZone('hub');
$('loading').remove();
$('start').addEventListener('click', async () => {
  $('start').style.display = 'none'; state.started = true;
  if (!IS_TOUCH) canvas.requestPointerLock?.();
  await music.init(); music.resume(); music.play(ZONES[curZone].seg);
  say('ты проснулся на бетоне. там, где ты идёшь, растут розы.', 5);
  say('собери F, A, V и точку — и favdotcom откроется. стрелка справа покажет путь.', 6);
});
window.__game = { state, LET, ZP, CASTLE_GATE, TEMPLE_EXIT };
frame();
