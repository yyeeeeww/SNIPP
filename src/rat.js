// fav dot rat — a short Y2K-crunch snippet: a man under a street lamp turns into a rat while hundreds of rats swarm him.
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

const params = new URLSearchParams(location.search);
const W = +(params.get('w') || 405), H = +(params.get('h') || 720);
const CAPTURE = params.has('capture');
let TL = { fps: 30, sections: [{ scene: 'rat', dur: 24, drop: 17.83 }], env: null, bass: null, kicks: [] };
try { const r = await fetch('./timeline_rat.json', { cache: 'no-store' }); if (r.ok) TL = { ...TL, ...(await r.json()) }; } catch (e) {}
const TOTAL = TL.sections[0].dur, D = TL.sections[0].drop;

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const ease = (k) => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const fr = (t) => clamp(Math.floor(t * TL.fps), 0, (TL.env?.length || 1) - 1);
const envAt = (t) => TL.env ? TL.env[fr(t)] : 0.5;
function kickAt(t, len = 0.3) { let b = 0; for (const o of TL.kicks) { const d = t - o; if (d >= 0 && d < len) b = Math.max(b, (1 - d / len) ** 2); } return b; }

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(55, W / H, 0.05, 800);

const loader = new THREE.TextureLoader(), cache = {};
async function load(n) { if (!cache[n]) cache[n] = await loader.loadAsync(`./assets_dc/${n}`); return cache[n]; }
async function tex(n, rx = 1, ry = rx) { const t = (await load(n)).clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; }
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
const font = await new FontLoader().loadAsync('./assets_dc/gentilis_bold.typeface.json');
try { await document.fonts.load('bold 64px "WenQuanYi Zen Hei"'); } catch (e) {}

// ---- night sky with stars
const R0 = rng(3);
const STARS = canvasTex(2048, 1024, (g, w, h) => { const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#000004'); bg.addColorStop(.48, '#0a0616'); bg.addColorStop(.52, '#140a10'); bg.addColorStop(1, '#000'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) { const b = R0(); g.fillStyle = `rgba(255,235,235,${.3 + b * .7})`; g.fillRect(R0() * w, Math.pow(R0(), 1.3) * h * .5, b > .93 ? 3 : 2, b > .93 ? 3 : 2); } });
STARS.mapping = THREE.EquirectangularReflectionMapping;
scene.background = STARS; scene.fog = new THREE.Fog(0x080408, 10, 60);
// ---- fur texture (grey-brown strokes over a photo base)
const FUR = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#2e2a28'; g.fillRect(0, 0, w, h); const R = rng(9);
  for (let i = 0; i < 9000; i++) { const x = R() * w, y = R() * h, l = 4 + R() * 9, a = 1.2 + (R() - .5) * .6, v = 25 + R() * 70;
    g.strokeStyle = `rgba(${v + 20},${v + 8},${v},${.35 + R() * .5})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } });

// ---- lights
scene.add(new THREE.HemisphereLight(0x6070a0, 0x201010, 0.55));
const lamp = new THREE.SpotLight(0xffb060, 900, 40, 0.75, 0.5, 1.6); lamp.position.set(1.5, 8.5, 1.5); lamp.target.position.set(0, 0, 0); lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); scene.add(lamp, lamp.target);
const redLight = new THREE.PointLight(0xff1020, 0, 25); redLight.position.set(0, 3, 3); scene.add(redLight);

// ---- ground: wet cracked concrete, drains, roses, a street lamp post
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshPhongMaterial({ map: await tex('concrete_grey.jpg', 30), color: 0x9a9aa4, specular: 0x666666, shininess: 40 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const drainM = new THREE.MeshPhongMaterial({ map: await tex('metal.jpg', 1), color: 0x303034, shininess: 50 });
const drains = [[-4, -3], [5, -5], [-6, 4], [4.5, 3.5], [0, -9], [-9, -8], [9, 1]].map(([x, z]) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 20), drainM); d.position.set(x, 0.02, z); scene.add(d);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ color: 0 })); hole.rotation.x = -Math.PI / 2; hole.position.set(x, 0.05, z); scene.add(hole); return V3(x, 0, z); });
const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 9, 10), drainM); post.position.set(2.2, 4.5, 2.2); post.castShadow = true; scene.add(post);
const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.5), drainM); head.position.set(1.8, 8.9, 1.8); scene.add(head);
const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd090 })); bulb.position.set(1.5, 8.7, 1.5); scene.add(bulb);

// roses (same velvet roses as the main snippet)
function petalGeo(len, wid, cup, curl) { const nu = 5, nv = 5, pos = [], uv = [], idx = []; for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const v = j / nv, u = i / nu * 2 - 1, w = wid * Math.sin(Math.PI * (0.12 + 0.86 * v)) * (0.55 + 0.45 * v); pos.push(u * w, v * len, cup * u * u * w * 1.3 - curl * v * v * len); uv.push(i / nu, v); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g; }
function colorize(g, fn) { const p = g.attributes.position, c = []; for (let i = 0; i < p.count; i++) c.push(...fn(p.getX(i), p.getY(i), p.getZ(i))); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return g; }
function clean(parts) { return mergeGeometries(parts.map(p => { if (!p.attributes.normal) p.computeVertexNormals(); const q = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'uv', 'color']) q.setAttribute(k, p.attributes[k]); q.setIndex(p.index); return q; })); }
const roseParts = [];
[[3, .15, .10, .12, .9, .25], [5, .19, .13, .42, .75, .35], [6, .23, .16, .82, .55, .5], [7, .25, .18, 1.2, .35, .65]].forEach(([n, len, wid, tilt, cup, shade], li) => { for (let i = 0; i < n; i++) { const g = petalGeo(len, wid, cup, li > 1 ? .25 : .05); g.rotateX(tilt); g.translate(0, 0, .015 * li); g.rotateY(i / n * Math.PI * 2 + li * .7); colorize(g, (x, y) => { const v = lerp(.55, 1.05, shade) * clamp(.5 + y * 2.2) + .12; return [v, v, v]; }); g.computeVertexNormals(); roseParts.push(g); } });
{ const s = new THREE.CylinderGeometry(0.014, 0.018, 0.6, 5); s.translate(0, -0.3, 0); colorize(s, () => [.15, .5, .1]); roseParts.push(s); }
const ROSE_GEO = clean(roseParts);
const ROSE_MAT = new THREE.MeshPhongMaterial({ map: await tex('velvet.jpg'), vertexColors: true, side: THREE.DoubleSide, shininess: 55 });
{ const r = rng(5), n = 380, im = new THREE.InstancedMesh(ROSE_GEO, ROSE_MAT, n), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) { const a = r() * 6.283, d = 2.2 + Math.pow(r(), 0.7) * 20, s = 0.9 + r() * 0.8; q.setFromEuler(e.set((r() - .5) * .5, r() * 6, (r() - .5) * .5)); m.compose(V3(Math.cos(a) * d, 0.57 * s, Math.sin(a) * d), q, V3(s, s, s)); im.setMatrixAt(i, m); }
  im.castShadow = true; scene.add(im); }

// ---- rat geometry (one merged mesh, fur + pink skin via vertex colors) and glowing eyes
function ratGeometry() {
  const fur = [.5, .48, .46], pink = [.85, .5, .52], parts = [];
  const body = new THREE.SphereGeometry(0.5, 16, 12); body.scale(0.75, 0.6, 1.25); body.translate(0, 0.32, 0); colorize(body, () => fur); parts.push(body);
  const hd = new THREE.SphereGeometry(0.26, 14, 10); hd.scale(0.9, 0.85, 1.1); hd.translate(0, 0.42, 0.62); colorize(hd, () => fur); parts.push(hd);
  const sn = new THREE.ConeGeometry(0.16, 0.42, 12); sn.rotateX(Math.PI / 2); sn.translate(0, 0.36, 0.95); colorize(sn, () => fur); parts.push(sn);
  const nose = new THREE.SphereGeometry(0.045, 8, 6); nose.translate(0, 0.36, 1.16); colorize(nose, () => pink); parts.push(nose);
  for (const sx of [-1, 1]) { const ear = new THREE.SphereGeometry(0.13, 10, 8); ear.scale(1, 1, 0.3); ear.translate(sx * 0.17, 0.66, 0.55); colorize(ear, () => pink); parts.push(ear);
    for (const z of [0.3, -0.35]) { const leg = new THREE.CylinderGeometry(0.05, 0.04, 0.22, 6); leg.translate(sx * 0.24, 0.1, z); colorize(leg, () => pink); parts.push(leg); } }
  const pts = []; for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push(V3(Math.sin(u * 5) * 0.25 * u, 0.25 - u * 0.2, -0.55 - u * 1.3)); }
  const tail = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.04, 6); const tp = tail.attributes.position; for (let i = 0; i < tp.count; i++) {} colorize(tail, () => pink); parts.push(tail);
  return clean(parts);
}
const RAT_GEO = ratGeometry();
const EYE_GEO = (() => { const a = new THREE.SphereGeometry(0.06, 8, 6); a.translate(-0.12, 0.5, 0.82); const b = new THREE.SphereGeometry(0.06, 8, 6); b.translate(0.12, 0.5, 0.82); return mergeGeometries([a, b]); })();
const RAT_MAT = new THREE.MeshPhongMaterial({ map: FUR, vertexColors: true, shininess: 30, specular: 0x333333 });
const EYE_MAT = new THREE.MeshBasicMaterial({ color: 0xff1a1a });

// ---- the swarm
const N = 520, rats = new THREE.InstancedMesh(RAT_GEO, RAT_MAT, N), ratEyes = new THREE.InstancedMesh(EYE_GEO, EYE_MAT, N);
rats.castShadow = true; rats.frustumCulled = ratEyes.frustumCulled = false; scene.add(rats, ratEyes);
const rr = rng(21); const RD = [...Array(N)].map((_, i) => ({ drain: drains[i % drains.length], birth: Math.pow(rr(), 0.8) * (D - 1), rad: 0.9 + rr() * 7, sp: (0.4 + rr() * 0.9) * (rr() < .5 ? -1 : 1), ph: rr() * 6.283, s: 0.24 + rr() * 0.26, climb: i < 70 ? rr() : -1 }));
// the man: real head scan on a dark coat; climbing points sampled on the coat
const gl = new GLTFLoader();
const LEE = (await gl.loadAsync('./assets_dc/models/LeePerrySmith.glb')).scene.getObjectByName('LeePerrySmith').geometry;
const skinT = (await load('models/Map-COL-dead.jpg')).clone(); skinT.colorSpace = THREE.SRGBColorSpace; skinT.needsUpdate = true;
const norT = (await load('models/Infinite-Level_02_Tangent_SmoothUV.jpg')).clone(); norT.needsUpdate = true;
const man = new THREE.Group(); scene.add(man);
const coatM = new THREE.MeshPhongMaterial({ map: await tex('plaster.jpg', 1), color: 0x24222a, shininess: 15 });
const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 1.6, 18), coatM); coat.position.y = 0.8; coat.castShadow = true; man.add(coat);
const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), coatM); shoulders.scale.set(1.15, 0.5, 0.75); shoulders.position.y = 1.58; man.add(shoulders);
for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.95, 10), coatM); arm.position.set(sx * 0.45, 1.12, 0); arm.rotation.z = sx * 0.12; arm.castShadow = true; man.add(arm); }
const headG = new THREE.Group(); headG.position.y = 1.95; man.add(headG);
const skinM = new THREE.MeshPhongMaterial({ map: skinT, normalMap: norT, shininess: 25, specular: 0x333333 });
const face = new THREE.Mesh(LEE, skinM); face.scale.setScalar(0.085); face.castShadow = true; headG.add(face);
// transformation parts (grow over time): snout, ears, whiskers, incisors, red eyes, fur cap
const furM = new THREE.MeshPhongMaterial({ map: FUR, color: 0x8a7a70, shininess: 20 }), pinkM = new THREE.MeshPhongMaterial({ color: 0xe89a9a, shininess: 40 });
const snout = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.38, 14), furM); snout.rotation.x = Math.PI / 2; snout.position.set(0, 0.09, 0.36); headG.add(snout);
const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), pinkM); nose.position.set(0, 0.09, 0.56); headG.add(nose);
const ears = [-1, 1].map(sx => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), pinkM); e.scale.set(1, 1.1, 0.3); e.position.set(sx * 0.2, 0.36, -0.02); e.rotation.z = -sx * 0.4; headG.add(e); return e; });
const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.02), new THREE.MeshPhongMaterial({ color: 0xf2e6b0, shininess: 90 })); teeth.position.set(0, 0.0, 0.42); headG.add(teeth);
const whisk = new THREE.Group(); whisk.position.set(0, 0.08, 0.5); headG.add(whisk);
for (let i = 0; i < 6; i++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.38, 3), new THREE.MeshBasicMaterial({ color: 0xdddddd })); const sx = i < 3 ? -1 : 1; w.rotation.z = Math.PI / 2 + (i % 3 - 1) * 0.18 * sx; w.position.x = sx * 0.19; whisk.add(w); }
const furCap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), furM); furCap.scale.set(1.05, 1.15, 1.2); furCap.position.set(0, 0.16, -0.09); headG.add(furCap);
const eyesRed = [-1, 1].map(sx => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), EYE_MAT); e.position.set(sx * 0.06, 0.143, 0.17); headG.add(e); return e; });
man.updateMatrixWorld(true);
const climbSmp = new MeshSurfaceSampler(coat).build();
const climbPts = RD.map(d => { if (d.climb < 0) return null; const p = new THREE.Vector3(), n = new THREE.Vector3(); climbSmp.sample(p, n); p.applyMatrix4(coat.matrixWorld); n.transformDirection(coat.matrixWorld); return { p, n }; });
// the giant rat that is left after the drop
const giant = new THREE.Group(); giant.visible = false; scene.add(giant);
const gRat = new THREE.Mesh(RAT_GEO, RAT_MAT); gRat.castShadow = true; giant.add(gRat);
const gEyes = new THREE.Mesh(EYE_GEO, EYE_MAT); giant.add(gEyes);
const gTeeth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.02), teeth.material); gTeeth.position.set(0, 0.27, 1.13); giant.add(gTeeth);

// ---- text: chrome WordArt + red japanese overlay
function wordArt(str, size) {
  const g = new TextGeometry(str, { font, size, depth: size * 0.32, curveSegments: 6, bevelEnabled: true, bevelThickness: size * 0.07, bevelSize: size * 0.045, bevelSegments: 3 }); g.center();
  g.computeBoundingBox(); const w = g.boundingBox.max.x - g.boundingBox.min.x; if (w > 2.4) g.scale(2.4 / w, 2.4 / w, 2.4 / w);
  return new THREE.Mesh(g, [new THREE.MeshPhongMaterial({ color: 0x9aaae8, specular: 0xffffff, shininess: 110, envMap: STARS, reflectivity: 0.7, combine: THREE.MixOperation, transparent: true }),
    new THREE.MeshPhongMaterial({ color: 0x200008, specular: 0xff8888, shininess: 80, transparent: true })]);
}
const tScene = new THREE.Scene(), tCam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100); tCam.position.z = 10;
tScene.add(new THREE.AmbientLight(0xffffff, 0.6)); { const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(-3, 5, 8); tScene.add(d); const d2 = new THREE.DirectionalLight(0xff4040, 1); d2.position.set(4, -2, 5); tScene.add(d2); }
const title = new THREE.Group(); tScene.add(title);
['fav', 'dot', 'rat'].forEach((w, i) => { const m = wordArt(w, 0.62); m.position.y = 1.85 - i * 0.68; title.add(m); });
const ovC = document.createElement('canvas'); ovC.width = W; ovC.height = H;
{ const g = ovC.getContext('2d'), k = W / 720; g.fillStyle = '#ff1414'; g.textBaseline = 'top';
  g.font = `bold ${Math.round(66 * k)}px "WenQuanYi Zen Hei", sans-serif`; g.textAlign = 'center'; g.fillText('ファブドットラット', W / 2, H - 170 * k); }
const ovTex = new THREE.CanvasTexture(ovC); ovTex.colorSpace = THREE.SRGBColorSpace;
const ovScene = new THREE.Scene(), ovCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const ovMat = new THREE.MeshBasicMaterial({ map: ovTex, transparent: true, opacity: 0, depthTest: false }); ovScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ovMat));
const flashScene = new THREE.Scene(), flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false }); flashScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), flashMat));

// ---------------- frame ----------------
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), up = V3(0, 1, 0);
function renderAt(t) {
  t = clamp(t, 0, TOTAL - 1e-4);
  const e = envAt(t), k = kickAt(t), post = t >= D, pk = clamp((t - D) / (TOTAL - D));
  // transformation: 0 → 1 from 4 s to the drop
  const tr = ease(smooth(4, D - 0.3, t));
  [snout, nose, teeth, whisk, furCap].forEach(o => o.scale.setScalar(Math.max(0.001, tr)));
  snout.scale.set(tr, tr, tr); furCap.scale.set(1.05 * tr + 0.001, 1.15 * tr + 0.001, 1.2 * tr + 0.001);
  ears.forEach(o => o.scale.set(Math.max(0.001, tr), 1.1 * tr + 0.001, 0.3));
  eyesRed.forEach(o => o.scale.setScalar(0.001 + smooth(6, 10, t) * (1 + k * 0.8)));
  skinM.color.setRGB(lerp(1, 0.55, tr), lerp(1, 0.5, tr), lerp(1, 0.48, tr));
  headG.rotation.set(Math.sin(t * 0.7) * 0.05 + tr * 0.25, Math.sin(t * 0.4) * 0.15, ((t % 1.9) < 0.08 && t > 6 ? 0.35 : 0) + Math.sin(t * 0.5) * 0.04);
  man.scale.set(1, lerp(1, 0.82, tr), 1); man.visible = !post;
  giant.visible = post; const gs = lerp(0.2, 3.0, ease(smooth(D, D + 0.6, t)));
  giant.scale.setScalar(gs); giant.position.set(0, 0, 0); giant.rotation.set(-0.12 + Math.sin(t * 1.3) * 0.04, Math.sin(t * 0.5) * 0.3, 0);
  // the swarm
  const swarmOut = post ? ease(smooth(D, D + 2.5, t)) : 0;
  for (let i = 0; i < N; i++) {
    const d = RD[i], age = t - d.birth;
    if (age < 0) { m4.makeScale(0, 0, 0); rats.setMatrixAt(i, m4); ratEyes.setMatrixAt(i, m4); continue; }
    let pos, yaw, s = d.s * clamp(age / 0.5);
    const cp = climbPts[i];
    if (cp && t > 6 + d.climb * 8 && !post) { pos = cp.p.clone().addScaledVector(cp.n, 0.08); pos.y *= lerp(1, 0.82, tr); q4.setFromUnitVectors(up, cp.n).multiply(new THREE.Quaternion().setFromAxisAngle(up, d.ph + Math.sin(t * 3 + d.ph) * 0.3)); s *= 0.9; m4.compose(pos, q4, V3(s, s, s)); }
    else {
      // come out of a drain, then circle the man; after the drop: scatter outwards
      const out = clamp(age / 1.4), a = d.ph + t * d.sp * (1 + e * 0.6), rad = lerp(0, d.rad, ease(out)) + swarmOut * (3.2 + d.rad * 0.6);
      const center = d.drain.clone().lerp(V3(0, 0, 0), ease(out));
      pos = V3(center.x + Math.cos(a) * rad * out, Math.abs(Math.sin(t * 14 + d.ph)) * 0.04, center.z + Math.sin(a) * rad * out);
      yaw = Math.atan2(-Math.sin(a) * d.sp, Math.cos(a) * d.sp) + Math.PI / 2 * Math.sign(d.sp) * 0 + (d.sp > 0 ? 0 : Math.PI);
      
      q4.setFromEuler(e4.set(0, yaw, Math.sin(t * 16 + d.ph) * 0.06)); m4.compose(pos, q4, V3(s, s, s));
    }
    rats.setMatrixAt(i, m4); ratEyes.setMatrixAt(i, m4);
  }
  rats.instanceMatrix.needsUpdate = true; ratEyes.instanceMatrix.needsUpdate = true;
  // light & camera (slow, no shake)
  lamp.intensity = (900 + e * 300) * (post ? 0.7 : 1) * (t > 12 && t < D && Math.sin(t * 37) > 0.6 ? 0.25 : 1);
  redLight.intensity = post ? 60 + e * 80 : smooth(8, D, t) * 25;
  const pre = ease(smooth(0, D, t)), a = lerp(0.35, -0.6, pre) + pk * 0.6;
  const rad = post ? lerp(8, 11.5, ease(smooth(D, D + 3, t))) : lerp(7, 2.4, pre), hy = post ? lerp(1.6, 2.6, pk) : lerp(2.6, 2.05, pre);
  cam.position.set(Math.sin(a) * rad, hy, Math.cos(a) * rad);
  cam.lookAt(0, post ? lerp(1.6, 2.4, pk) : lerp(1.4, 1.95, pre), 0);
  cam.fov = 55; cam.updateProjectionMatrix();
  // render: scene, title, overlay, flash
  renderer.autoClear = true; renderer.render(scene, cam);
  renderer.autoClear = false;
  const ta = smooth(D + 0.4, D + 1.4, t); if (ta > 0) { title.traverse(o => { if (o.material) [].concat(o.material).forEach(mm => mm.opacity = ta); }); title.rotation.y = Math.sin(t * 0.6) * 0.3; renderer.clearDepth(); renderer.render(tScene, tCam); }
  ovMat.opacity = smooth(D + 0.8, D + 1.8, t); if (ovMat.opacity > 0) renderer.render(ovScene, ovCam);
  flashMat.opacity = clamp(1 - Math.abs(t - D) / 0.25) * 0.95 + (post ? 0 : k * 0.08 * smooth(10, D, t)); if (flashMat.opacity > 0.001) renderer.render(flashScene, ovCam);
  flashMat.color.set(t > D ? 0xff2020 : 0xffffff);
}
window.renderAt = renderAt; window.SNIPPET = { total: TOTAL, fps: TL.fps }; window.READY = true;
if (!CAPTURE) { const t0 = performance.now(); (function loop() { renderAt(((performance.now() - t0) / 1000) % TOTAL); requestAnimationFrame(loop); })(); }
