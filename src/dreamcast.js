// fav — Dreamcast / Y2K version. Bright glossy late-90s 3D in a red / white / black palette, with something wrong in it.
// Smooth: continuous camera moves, crossfades between sections. Every frame is a pure function of t.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const params = new URLSearchParams(location.search);
const W = +(params.get('w') || 540), H = +(params.get('h') || 960);
const CAPTURE = params.has('capture');
const XF = 0.8;   // crossfade length (matches the audio crossfades)

// ---------------- timeline ----------------
let TL = { fps: 30, sections: [
  { scene: 'boot', dur: 15, drop: 1.75 }, { scene: 'city', dur: 15, drop: 1.78 },
  { scene: 'cyber', dur: 15, drop: 2.4 }, { scene: 'bloom', dur: 15.3, drop: 0, out: 11.8 }],
  env: null, bass: null, kicks: [], audio: null };
try { const r = await fetch('./timeline_dc.json', { cache: 'no-store' }); if (r.ok) TL = { ...TL, ...(await r.json()) }; } catch (e) {}
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
const envAt = (t) => arr(TL.env, t, 0.5), bassAt = (t) => arr(TL.bass, t, 0.5);
function kickAt(t, len = 0.3) { let b = 0; for (const o of TL.kicks) { const d = t - o; if (d >= -1e-6 && d < len) b = Math.max(b, Math.pow(1 - d / len, 2)); } return b; }
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------- renderer ----------------
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 0.9;
document.body.appendChild(renderer.domElement);
const mkRT = () => new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: true, samples: 0 });
const rtA = mkRT(), rtB = mkRT();
const pmrem = new THREE.PMREMGenerator(renderer);

// ---------------- textures ----------------
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4; return t;
}
function envFrom(stops, lights) {
  const t = canvasTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); for (const [p, c] of stops) gr.addColorStop(p, c);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (const [x, y, lw, lh, c] of lights) { g.fillStyle = c; g.fillRect(x * w, y * h, lw * w, lh * h); }
  });
  t.mapping = THREE.EquirectangularReflectionMapping;
  return pmrem.fromEquirectangular(t).texture;
}
const ENV_BRIGHT = envFrom([[0, '#ffffff'], [0.42, '#ffe8ea'], [0.5, '#e8102c'], [0.56, '#5a0010'], [1, '#1a1a1e']],
  [[0.1, 0.12, 0.18, 0.08, '#fff'], [0.55, 0.08, 0.1, 0.14, '#fff'], [0.8, 0.2, 0.12, 0.05, '#fff']]);
const ENV_SUNSET = envFrom([[0, '#3a0614'], [0.3, '#ff5040'], [0.48, '#ffe2cc'], [0.52, '#202024'], [1, '#08080a']],
  [[0.45, 0.4, 0.1, 0.06, '#fff8e8'], [0.05, 0.1, 0.1, 0.04, '#fff']]);
const ENV_DARK = envFrom([[0, '#000000'], [0.44, '#120004'], [0.5, '#ff1030'], [0.56, '#120004'], [1, '#000000']],
  [[0.2, 0.15, 0.25, 0.03, '#fff'], [0.6, 0.3, 0.08, 0.02, '#fff'], [0.0, 0.48, 1.0, 0.012, '#fff']]);
const CLOUD = canvasTex(128, 128, (g) => {
  const R = rng(9);
  for (let i = 0; i < 26; i++) {
    const x = 24 + R() * 80, y = 40 + R() * 50, r = 14 + R() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
});
const WINDOWS = canvasTex(64, 128, (g, w, h) => {
  const R = rng(4); g.fillStyle = '#f2eeee'; g.fillRect(0, 0, w, h);
  for (let y = 4; y < h - 4; y += 10) for (let x = 4; x < w - 4; x += 10) { g.fillStyle = R() < .12 ? '#ff2a40' : (R() < .5 ? '#3a3a44' : '#8a8a96'); g.fillRect(x, y, 6, 6); }
  g.fillStyle = '#d0102a'; g.fillRect(0, 0, w, 2);
});
WINDOWS.wrapS = WINDOWS.wrapT = THREE.RepeatWrapping;
const toonRamp = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1);
toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter; toonRamp.needsUpdate = true;

// ---------------- materials ----------------
const MAT = {
  chrome: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1 }),
  red: new THREE.MeshStandardMaterial({ color: 0xc4001c, metalness: 0.25, roughness: 0.18 }),
  black: new THREE.MeshStandardMaterial({ color: 0x0c0c10, metalness: 0.6, roughness: 0.14 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf4f0f0, metalness: 0, roughness: 0.55 }),
  sand: new THREE.MeshStandardMaterial({ color: 0xf6eee6, metalness: 0, roughness: 0.95 }),
  eye: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff1428, emissiveIntensity: 6 }),
  flower: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.42 }),
  outline: new THREE.MeshBasicMaterial({ color: 0x0a0a0a, side: THREE.BackSide }),
};
const PETAL = [new THREE.MeshStandardMaterial({ color: 0xb00018, roughness: 0.35 }), new THREE.MeshStandardMaterial({ color: 0xd8102a, roughness: 0.3 })];
const FLOWER_COLS = [0xc0001a, 0x8a0012, 0xe01030, 0xa00818, 0xf6eeee].map(c => new THREE.Color(c));

// ---------------- flower wizard ----------------
function scatterFlowers(n, sample, r, sizeR = [0.7, 1.4], base = 0.11) {
  const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(base, 0), MAT.flower, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    const p = sample(r); const s = lerp(sizeR[0], sizeR[1], r());
    q.setFromEuler(e.set(r() * 6, r() * 6, r() * 6));
    m.compose(p, q, V3(s, s, s)); im.setMatrixAt(i, m);
    im.setColorAt(i, FLOWER_COLS[r() < 0.07 ? 4 : Math.floor(r() * 4)]);
  }
  return im;
}
function flowerWizard(seed = 1) {
  const r = rng(seed), g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.68, 1.8, 16), new THREE.MeshStandardMaterial({ color: 0x3a0008, roughness: 0.8 }));
  core.position.y = 0.9; g.add(core);
  g.add(scatterFlowers(320, (r) => { const y = r() * 1.8, a = r() * 6.283, rad = lerp(0.72, 0.24, y / 1.8); return V3(Math.cos(a) * rad, y, Math.sin(a) * rad); }, r));
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.3, 1.68, 0); g.add(a);
    a.add(scatterFlowers(40, (r) => { const y = -r() * 0.95, an = r() * 6.283, rad = 0.09 + (-y) * 0.06; return V3(Math.cos(an) * rad, y, Math.sin(an) * rad); }, r, [0.6, 1.1], 0.09));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), MAT.chrome); hand.position.y = -1.0; a.add(hand);
    a.rotation.z = s * 0.12; arms.push(a);
  }
  const headG = new THREE.Group(); headG.position.y = 1.86; g.add(headG);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 32, 20), MAT.chrome); head.scale.set(0.9, 1.15, 0.95); head.position.y = 0.2; headG.add(head);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), MAT.eye); e.position.set(s * 0.085, 0.22, 0.225); e.scale.set(1.3, 0.8, 0.5); headG.add(e); }
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.035, 40), MAT.black); brim.position.y = 0.42; headG.add(brim);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.45, 0.12, 32), MAT.red); band.position.y = 0.5; headG.add(band);
  const hat1 = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.43, 1.0, 32), MAT.black); hat1.position.y = 0.95; headG.add(hat1);
  const tip = new THREE.Group(); tip.position.y = 1.45; tip.rotation.set(0.15, 0, -0.55); headG.add(tip);
  const hat2 = new THREE.Mesh(new THREE.ConeGeometry(0.17, 1.0, 32), MAT.black); hat2.position.y = 0.5; tip.add(hat2);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), MAT.chrome); star.position.y = 1.02; tip.add(star);
  return { group: g, headG, arms };
}
function raiseArms(w, k, spread = 2.3) { w.arms.forEach((a, i) => a.rotation.z = (i ? 1 : -1) * lerp(0.12, spread, k)); }

function skyDome(top, mid, bot, sunDir, sunCol, sunSize = 0.9995) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bot: { value: new THREE.Color(bot) },
      sunDir: { value: sunDir.clone().normalize() }, sunCol: { value: new THREE.Color(sunCol) }, sunSize: { value: sunSize } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 top, mid, bot, sunDir, sunCol; uniform float sunSize; varying vec3 vD;
      void main(){ float y = vD.y; vec3 c = y > 0. ? mix(mid, top, pow(y, .55)) : mix(mid, bot, pow(-y, .4));
        float s = dot(normalize(vD), sunDir); c += sunCol * (smoothstep(sunSize, sunSize + .0003, s) * 4. + pow(max(s, 0.), 60.) * .6 + pow(max(s, 0.), 6.) * .15);
        gl_FragColor = vec4(c, 1.); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat); m.frustumCulled = false; m.renderOrder = -1; return m;
}
function clouds(n, r, area, y, scaleR, opacity = 0.95) {
  const g = new THREE.Group(), mat = new THREE.SpriteMaterial({ map: CLOUD, transparent: true, opacity, depthWrite: false, fog: true });
  for (let i = 0; i < n; i++) { const s = new THREE.Sprite(mat); const sc = lerp(scaleR[0], scaleR[1], r()); s.scale.set(sc * 1.6, sc, 1);
    s.position.set(lerp(area[0], area[1], r()), lerp(y[0], y[1], r()), lerp(area[2], area[3], r())); g.add(s); }
  return g;
}
function spiral(scale = 1) {
  const g = new THREE.Group();
  for (const [arm, mat] of [[0, MAT.red], [Math.PI, MAT.chrome]]) {
    const pts = []; for (let i = 0; i <= 120; i++) { const th = i / 120 * Math.PI * 5; const rr = 0.15 + th * 0.16; pts.push(V3(Math.cos(th + arm) * rr, Math.sin(th + arm) * rr, -th * 0.04)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.16, 12), mat));
  }
  g.scale.setScalar(scale); return g;
}
function palm(r, h = 6) {
  const g = new THREE.Group(); let p = V3(0, 0, 0); const lean = (r() - .5) * 0.5;
  for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.16 - i * 0.012, 0.2 - i * 0.012, h / 7, 10), MAT.chrome);
    p = V3(Math.sin(lean) * i * h / 7 * 0.4 * (i / 7), (i + 0.5) * h / 7, 0); s.position.copy(p); s.rotation.z = -lean * i / 7; g.add(s); }
  const crown = new THREE.Group(); crown.position.set(p.x, h, 0); g.add(crown);
  for (let i = 0; i < 7; i++) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6), MAT.red); leaf.scale.set(1.6, 0.06, 0.32);
    const lg = new THREE.Group(); lg.rotation.y = i / 7 * 6.283; leaf.position.x = 1.4; leaf.rotation.z = -0.5; lg.add(leaf); crown.add(lg); }
  return g;
}
const outlined = (m, k = 1.035) => { const o = new THREE.Mesh(m.geometry, MAT.outline); o.scale.setScalar(k); m.add(o); return m; };

// ======================= SCENES =======================
const SCENES = {};
function makeStage(env, fog) { const s = new THREE.Scene(); s.environment = env; if (fog) s.fog = fog; const cam = new THREE.PerspectiveCamera(55, W / H, 0.1, 1200); return { s, cam }; }

// 1) BOOT → ISLAND: a glossy spiral in white fog; we fly through it and fall onto a white island in a red glossy sea
SCENES.boot = (() => {
  const { s, cam } = makeStage(ENV_BRIGHT, new THREE.Fog(0xffffff, 5, 30)); const r = rng(11);
  const sunDir = V3(-0.5, 0.35, -1);
  s.add(skyDome(0x9ec4ef, 0xf4ecee, 0xffffff, sunDir, 0xfff2e0));
  s.add(new THREE.HemisphereLight(0xffffff, 0x60202a, 0.9));
  const sun = new THREE.DirectionalLight(0xfff0e0, 2.2); sun.position.copy(sunDir).multiplyScalar(50); s.add(sun);
  const sp = spiral(1.2); sp.position.set(0, 60, 30); s.add(sp);
  // sea
  const seaGeo = new THREE.PlaneGeometry(400, 400, 110, 110); seaGeo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: 0x6a000c, metalness: 0.5, roughness: 0.06 })); s.add(sea);
  const base = seaGeo.attributes.position.array.slice();
  // island
  const isl = new THREE.Mesh(new THREE.SphereGeometry(14, 48, 16, 0, 6.283, 0, 0.5), MAT.sand); isl.scale.y = 0.35; isl.position.y = -1.1; s.add(isl);
  for (let i = 0; i < 6; i++) { const p = palm(r, 5 + r() * 3); const a = r() * 6.283, d = 3 + r() * 6; p.position.set(Math.cos(a) * d, 0.3, Math.sin(a) * d); p.rotation.y = r() * 6; s.add(p); }
  for (let i = 0; i < 18; i++) { const a = r() * 6.283, d = 2 + r() * 8; const b = scatterFlowers(40, (rr) => V3((rr() - .5) * 1.4, rr() * 0.7, (rr() - .5) * 1.4), r, [0.8, 1.8], 0.12); b.position.set(Math.cos(a) * d, 0.5, Math.sin(a) * d); s.add(b); }
  const spheres = []; for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(2 + r() * 3, 48, 24), MAT.chrome); m.position.set((r() - .5) * 120, 4 + r() * 10, -30 - r() * 80); s.add(m); spheres.push([m, r() * 6]); }
  s.add(clouds(40, r, [-200, 200, -260, 60], [30, 90], [20, 50]));
  const wiz = flowerWizard(3); wiz.group.position.set(0, 0.55, 6.5); wiz.group.rotation.y = Math.PI; s.add(wiz.group);
  return { s, cam, sunDir,
    update(lt, D, sec, t, e, b, k) {
      for (let i = 0; i < base.length; i += 3) { const x = base[i], z = base[i + 2];
        seaGeo.attributes.position.array[i + 1] = Math.sin(x * 0.12 + t * 1.1) * 0.35 + Math.cos(z * 0.09 - t * 0.8) * 0.4 + Math.sin((x + z) * 0.3 + t * 2) * 0.08 * (1 + b); }
      seaGeo.attributes.position.needsUpdate = true; seaGeo.computeVertexNormals();
      spheres.forEach(([m, ph]) => m.position.y += Math.sin(t * 0.6 + ph) * 0.01);
      sp.rotation.z = -t * 1.4 - k * 0.2;
      const fly = ease(smooth(D - 0.2, D + 2.6, lt));
      s.fog.near = lerp(5, 140, fly); s.fog.far = lerp(30, 700, fly);
      // camera: spiral → dive through → crane around the island → rise into the clouds
      const pSpiral = V3(0, 60, 37 - lt * 0.6), pThrough = V3(0, 58, 18);
      const orbitA = lerp(0.4, 2.4, smooth(D + 2, sec.dur, lt)), rad = lerp(16, 7.5, smooth(D + 2, D + 7, lt));
      const pOrbit = V3(Math.sin(orbitA) * rad, lerp(9, 2.4, smooth(D + 2, D + 7, lt)), 6.5 + Math.cos(orbitA) * rad);
      const rise = ease(smooth(sec.dur - 2.6, sec.dur + XF, lt));
      let pos = lt < D + 1.2 ? pSpiral.clone().lerp(pThrough, fly / smooth(D - 0.2, D + 2.6, D + 1.2) * 0.999) : pThrough.clone().lerp(pOrbit, smooth(D + 1.2, D + 4.5, lt));
      if (lt < D + 1.2) pos = pSpiral.clone().lerp(pThrough, smooth(D - 0.2, D + 1.2, lt));
      pos.y += rise * 45;
      cam.position.copy(pos);
      const look = V3(0, 60, 30).lerp(V3(0, 1.8, 6.5), smooth(D + 0.6, D + 3.6, lt)); look.y += rise * 60;
      cam.lookAt(look);
      cam.fov = 55 - k * 2; cam.updateProjectionMatrix();
      // he turns his head to the camera and keeps looking, a little too long
      const turn = smooth(D + 6.5, D + 7.5, lt);
      wiz.headG.rotation.y = Math.PI * 0.9 * turn; wiz.headG.rotation.z = turn * 0.18;
      raiseArms(wiz, smooth(D + 8.5, D + 10.5, lt) * 0.5);
      return { bloom: 0.2 + e * 0.15 + k * 0.15 };
    } };
})();

// 2) CITY: down through sunset clouds into a cel-shaded white city, skating; the same figure waits on every roof
SCENES.city = (() => {
  const { s, cam } = makeStage(ENV_SUNSET, new THREE.Fog(0xffc8b0, 60, 380)); const r = rng(22);
  const sunDir = V3(0.1, 0.06, -1);
  s.add(skyDome(0x4a0818, 0xffb59a, 0xffe6d6, sunDir, 0xfff0d0, 0.9985));
  s.add(new THREE.HemisphereLight(0xffe0d0, 0x401018, 0.9));
  const sun = new THREE.DirectionalLight(0xffc8a0, 2.0); sun.position.set(30, 25, -40); s.add(sun);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(26, 600), new THREE.MeshToonMaterial({ color: 0x2a2a30, gradientMap: toonRamp })); road.rotation.x = -Math.PI / 2; road.position.z = -260; s.add(road);
  for (let z = 10; z > -560; z -= 6) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 3), MAT.white); l.rotation.x = -Math.PI / 2; l.position.set(0, 0.01, z); s.add(l); }
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(60, 600), new THREE.MeshToonMaterial({ color: 0xf0e8e8, gradientMap: toonRamp })); walk.rotation.x = -Math.PI / 2; walk.position.set(0, -0.01, -260); s.add(walk);
  const roofs = [];
  for (let z = 0; z > -540; z -= 18) for (const side of [-1, 1]) {
    const w = 9 + r() * 7, h = 10 + r() * 34, d = 12 + r() * 4;
    const mat = new THREE.MeshToonMaterial({ color: r() < 0.2 ? 0xd8202e : 0xf6f2f2, gradientMap: toonRamp, map: WINDOWS.clone() });
    mat.map.repeat.set(w / 6, h / 8); mat.map.needsUpdate = true;
    const b = outlined(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), 1.02); b.position.set(side * (13 + w / 2 + r() * 4), h / 2, z - r() * 6); s.add(b);
    roofs.push(b);
    if (r() < 0.5) { const sph = outlined(new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 16), MAT.chrome), 1.06); sph.position.set(b.position.x - side * (w / 2 - 1.5), h + 1.2, b.position.z); s.add(sph); }
  }
  for (let z = -4; z > -540; z -= 14) for (const side of [-1, 1]) { const p = palm(r, 7); p.position.set(side * 10.5, 0, z); s.add(p); }
  s.add(clouds(30, r, [-250, 250, -500, 50], [60, 110], [30, 60], 0.9));
  const wizards = [];
  for (let i = 0; i < 6; i++) {
    const b = roofs[6 + i * 7]; const w = flowerWizard(10 + i); w.group.scale.setScalar(1.6);
    w.group.position.set(b.position.x * 0.92, b.geometry.parameters.height, b.position.z + 4); s.add(w.group); wizards.push(w);
  }
  return { s, cam, sunDir,
    update(lt, D, sec, t, e, b, k) {
      const desc = ease(smooth(-XF, D + 0.4, lt));
      const zSpeed = lt < D ? 0 : (lt - D);
      const z = 30 - zSpeed * 26 - Math.max(0, lt - D) ** 1.25 * 2;
      const x = Math.sin(lt * 0.55) * 4.5;
      cam.position.set(x, lerp(95, 1.6, desc) + Math.abs(Math.sin(lt * 4)) * 0.05 * (lt > D ? 1 : 0), lerp(60, z, desc));
      const tilt = smooth(sec.dur - 2.2, sec.dur + XF * 0.5, lt);
      cam.lookAt(x * 0.6 + Math.sin(lt * 0.55 + 0.6) * 3, lerp(lerp(-40, 3, desc), 30, tilt), cam.position.z - 30);
      cam.rotation.z += -Math.cos(lt * 0.55) * 0.12 * desc;
      cam.fov = lerp(55, 78, desc) - k * 3; cam.updateProjectionMatrix();
      wizards.forEach(w => { w.headG.lookAt(cam.position); w.headG.rotation.x *= 0.6; raiseArms(w, 0.15 + e * 0.1); });
      return { bloom: 0.2 + e * 0.15 + k * 0.15 + tilt * 0.5 };
    } };
})();

// 3) CYBER: black-red Y2K cyberspace, a glowing grid; a giant chrome head rises from the floor
SCENES.cyber = (() => {
  const { s, cam } = makeStage(ENV_DARK, new THREE.Fog(0x050003, 30, 160)); const r = rng(33);
  s.background = new THREE.Color(0x030002);
  s.add(new THREE.HemisphereLight(0xff8090, 0x100004, 0.6));
  const key = new THREE.PointLight(0xff2040, 400, 80); key.position.set(0, 12, 10); s.add(key);
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uB: { value: 0 } }, fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position,1.)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP,1.); }`,
    fragmentShader: `uniform float uT, uB; varying vec3 vP;
      void main(){ vec2 g = abs(fract(vP.xz / 4. + .5) - .5) / fwidth(vP.xz / 4.); float l = 1. - min(min(g.x, g.y), 1.);
        float d = length(vP.xz); float pulse = smoothstep(2., 0., abs(d - mod(uT * 24., 160.)));
        vec3 c = vec3(1., .05, .12) * l * (1.2 + uB * 2.) + vec3(1., .6, .7) * pulse * l * 3.;
        c *= exp(-d * .012); gl_FragColor = vec4(c, 1.); }` }));
  grid.rotation.x = -Math.PI / 2; s.add(grid);
  const blobs = []; for (let i = 0; i < 7; i++) {
    const geo = new THREE.IcosahedronGeometry(1.4 + r() * 1.6, 5); const m = new THREE.Mesh(geo, i % 3 === 0 ? MAT.red : MAT.chrome);
    m.position.set((r() - .5) * 40, 3 + r() * 12, -10 - r() * 30); s.add(m); blobs.push({ m, base: geo.attributes.position.array.slice(), ph: r() * 6 }); }
  const rings = []; for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.TorusGeometry(14 + i * 3, 0.035, 6, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.1, 0.2) })); m.position.set(0, 8, -20); s.add(m); rings.push(m); }
  const giant = new THREE.Group(); s.add(giant);
  const head = new THREE.Mesh(new THREE.SphereGeometry(5, 64, 40), MAT.chrome); head.scale.set(0.9, 1.15, 0.95); giant.add(head);
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 12), MAT.eye), eyeR = eyeL.clone();
  eyeL.position.set(-1.6, 0.4, 4.4); eyeR.position.set(1.6, 0.4, 4.4); eyeL.scale.set(1.4, 0.7, 0.4); eyeR.scale.copy(eyeL.scale); giant.add(eyeL, eyeR);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 0.6, 64), MAT.black); brim.position.y = 4.6; giant.add(brim);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 8.4, 20, 48), MAT.black); hat.position.y = 14.5; giant.add(hat);
  const tipG = new THREE.Group(); tipG.position.y = 24.5; tipG.rotation.z = -0.6; giant.add(tipG);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(3.4, 18, 48), MAT.black); tip.position.y = 9; tipG.add(tip);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.8, 2.2, 48), MAT.red); band.position.y = 6; giant.add(band);
  return { s, cam, sunDir: null,
    update(lt, D, sec, t, e, b, k) {
      grid.material.uniforms.uT.value = t; grid.material.uniforms.uB.value = b;
      blobs.forEach(({ m, base, ph }) => { const a = m.geometry.attributes.position.array;
        for (let i = 0; i < a.length; i += 3) { const x = base[i], y = base[i + 1], z = base[i + 2]; const n = 1 + (Math.sin(x * 1.3 + t * 1.7 + ph) * Math.sin(y * 1.1 + t * 1.3) * Math.sin(z * 1.2 + t)) * (0.12 + b * 0.18);
          a[i] = x * n; a[i + 1] = y * n; a[i + 2] = z * n; }
        m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals(); m.rotation.y = t * 0.2 + ph; m.position.y += Math.sin(t + ph) * 0.01; });
      rings.forEach((m, i) => { m.rotation.set(Math.sin(t * 0.3 + i) * 0.9 + 1.2, t * (0.2 + i * 0.05), 0); m.scale.setScalar(1 + k * 0.06 * (i + 1)); });
      const rise = ease(smooth(D - 0.4, D + 4, lt));
      giant.position.set(0, lerp(-22, 6, rise), -22); giant.rotation.y = Math.sin(lt * 0.4) * 0.25; giant.rotation.z = Math.sin(lt * 0.3) * 0.05;
      giant.scale.setScalar(1 + k * 0.025);
      MAT.eye.emissiveIntensity = 6 + e * 6 + k * 6;
      const a = lerp(-0.6, 0.6, smooth(0, sec.dur, lt)), rad = lerp(34, 22, smooth(D, sec.dur - 3, lt));
      const push = ease(smooth(sec.dur - 2.4, sec.dur + XF, lt));
      const orbit = V3(Math.sin(a) * rad, lerp(4, 9, rise), -22 + Math.cos(a) * rad);
      const eyeW = new THREE.Vector3(); eyeR.getWorldPosition(eyeW);
      cam.position.copy(orbit.lerp(eyeW.clone().add(V3(0, 0, 2.5)), push * 0.98));
      cam.lookAt(V3(0, lerp(2, 8, rise), -22).lerp(eyeW, push));
      cam.fov = 55 - k * 3; cam.updateProjectionMatrix();
      return { bloom: 0.45 + e * 0.3 + k * 0.3, redout: push };
    } };
})();

// 4) BLOOM: white heaven above the clouds; a giant red flower opens — his face is its center. Then calm, and the spiral returns.
SCENES.bloom = (() => {
  const { s, cam } = makeStage(ENV_BRIGHT, new THREE.Fog(0xffffff, 60, 320)); const r = rng(44);
  const sunDir = V3(0.3, 0.5, -1);
  s.add(skyDome(0xb8d2f2, 0xfbf6f6, 0xffffff, sunDir, 0xfff6ea));
  s.add(new THREE.HemisphereLight(0xffffff, 0xa04050, 1.0));
  const dl = new THREE.DirectionalLight(0xffffff, 2.0); dl.position.set(10, 20, 10); s.add(dl);
  s.add(clouds(60, r, [-150, 150, -150, 60], [-14, -4], [18, 40]));
  const flower = new THREE.Group(); s.add(flower);
  const petals = [];
  for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 9; i++) {
    const pg = new THREE.Group(); pg.rotation.y = (i + layer * 0.5) / 9 * 6.283; flower.add(pg);
    const hinge = new THREE.Group(); pg.add(hinge);
    const p = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), layer === 0 ? MAT.chrome : PETAL[layer - 1]);
    const L = 3.2 + layer * 1.3; p.scale.set(L * 0.42, 0.1, L * 0.5); p.position.z = L * 0.5; hinge.add(p);
    petals.push({ hinge, layer, i });
  }
  const face = new THREE.Group(); flower.add(face);
  const fh = new THREE.Mesh(new THREE.SphereGeometry(1.1, 48, 32), MAT.chrome); fh.scale.set(0.9, 1.15, 0.95); face.add(fh);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 8), MAT.eye); e.position.set(sx * 0.36, 0.1, 0.98); e.scale.set(1.3, 0.7, 0.5); face.add(e); }
  const flying = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), MAT.flower, 260);
  const fl = []; for (let i = 0; i < 260; i++) { fl.push({ a: r() * 6.283, rr: 2 + r() * 14, y: r() * 30 - 6, sp: 0.3 + r() * 0.8, s: 0.15 + r() * 0.3 }); flying.setColorAt(i, FLOWER_COLS[r() < 0.15 ? 4 : Math.floor(r() * 4)]); }
  s.add(flying);
  const sp = spiral(1.2); s.add(sp);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler();
  return { s, cam, sunDir,
    update(lt, D, sec, t, e, b, k) {
      const out = sec.out ?? 11.8, dur = sec.dur;
      const calm = smooth(out - 0.2, out + 1.2, lt);
      const open = ease(smooth(0.2, 4.5, lt)) * (1 - calm * 0.65);
      petals.forEach(({ hinge, layer, i }) => { hinge.rotation.x = lerp(-1.45, -0.12 - layer * 0.08, open) + Math.sin(t * 2 + i) * 0.04 + k * 0.08 * (1 - calm); });
      flower.position.set(0, 0, 0); flower.rotation.y = t * 0.15;
      face.position.y = lerp(-0.6, 0.9, open); 
      MAT.eye.emissiveIntensity = 6 + e * 5 + k * 6;
      const speed = 1 - calm * 0.85;
      fl.forEach((f, i) => {
        const tt = t * f.sp * speed; const a = f.a + tt; const y = ((f.y + tt * 2.5) % 30) - 6;
        m4.compose(V3(Math.cos(a) * (f.rr + y * 0.15), y, Math.sin(a) * (f.rr + y * 0.15)), q.setFromEuler(eu.set(tt, tt * 1.3, 0)), V3(f.s * 1.6, f.s * 0.25, f.s));
        flying.setMatrixAt(i, m4);
      });
      flying.instanceMatrix.needsUpdate = true;
      // camera: high spiral down onto the flower, then a slow calm drift; at the very end the spiral fills the frame (= start)
      const a = lt * 0.3 + 0.5, rad = lerp(18, 9, smooth(0, out, lt)), h = lerp(14, 5, smooth(0, out, lt));
      const endK = ease(smooth(dur - 3.2, dur, lt));
      cam.position.set(Math.sin(a) * rad, h, Math.cos(a) * rad);
      cam.lookAt(0, lerp(0.5, 1.2, open), 0);
      flower.updateMatrixWorld(true); face.lookAt(cam.position); face.rotateZ(Math.sin(t * 0.7) * 0.15);
      // final: the spiral comes in front of the camera, as in the opening shot
      const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
      sp.position.copy(cam.position).addScaledVector(fwd, lerp(40, 7, endK)); sp.quaternion.copy(cam.quaternion);
      sp.rotation.z -= 0; sp.rotateZ(-t * 1.4); sp.visible = endK > 0.001;
      s.fog.near = lerp(60, 5, endK); s.fog.far = lerp(320, 30, endK);
      cam.fov = 55 - k * 2 * (1 - calm); cam.updateProjectionMatrix();
      return { bloom: 0.2 + e * 0.15 + k * 0.15 * (1 - calm) };
    } };
})();

// ---------------- compositing: crossfade + lens flare → bloom → output ----------------
const mixMat = new THREE.ShaderMaterial({
  uniforms: { tA: { value: rtA.texture }, tB: { value: rtB.texture }, uMix: { value: 0 }, uWhite: { value: 0 }, uRed: { value: 0 },
    uSun: { value: new THREE.Vector2(-9, -9) }, uSunVis: { value: 0 }, uAspect: { value: W / H } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: /* glsl */`
  uniform sampler2D tA, tB; uniform float uMix, uWhite, uRed, uSunVis, uAspect; uniform vec2 uSun; varying vec2 vUv;
  float disc(vec2 p, vec2 c, float r, float soft){ vec2 d = p - c; d.x *= uAspect; return smoothstep(r, r - soft, length(d)); }
  void main(){
    vec3 a = texture2D(tA, vUv).rgb, b = texture2D(tB, vUv).rgb;
    float m = uMix;                                   // soft radial dissolve: center first
    float rad = length((vUv - .5) * vec2(uAspect, 1.));
    float mm = smoothstep(rad * .6 - .25, rad * .6 + .25, m * 1.5 - .25);
    vec3 c = mix(a, b, mm);
    c = mix(c, vec3(1.6), uWhite);
    c = mix(c, vec3(1.2, .02, .06), uRed);
    if (uSunVis > 0.001) {                            // lens flare (late-90s style)
      vec2 axis = vec2(.5) - uSun; vec3 f = vec3(0.);
      vec2 d = vUv - uSun; d.x *= uAspect; float r = length(d);
      f += vec3(1., .9, .8) * exp(-r * 9.) * .8;
      f += vec3(1., .5, .4) * smoothstep(.012, 0., abs(r - .16)) * .25;
      f += vec3(1., .85, .8) * exp(-abs(d.y) * 160.) * exp(-abs(d.x) * 3.) * .5;
      f += vec3(1., .2, .25) * disc(vUv, uSun + axis * .55, .035, .02) * .35;
      f += vec3(.6, .8, 1.) * disc(vUv, uSun + axis * .8, .06, .05) * .18;
      f += vec3(1., .4, .3) * disc(vUv, uSun + axis * 1.25, .02, .01) * .45;
      f += vec3(1., .9, .6) * disc(vUv, uSun + axis * 1.6, .1, .09) * .12;
      c += f * uSunVis;
    }
    gl_FragColor = vec4(c, 1.);
  }`,
});
const mixScene = new THREE.Scene(); mixScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mixMat));
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }));
composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(mixScene, ortho));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.25, 0.35, 0.97); composer.addPass(bloom);
composer.addPass(new OutputPass());

function renderScene(S, rt, lt, sec, t) {
  const e = envAt(t), b = bassAt(t), k = kickAt(t);
  MAT.eye.emissiveIntensity = 6;
  const fx = S.update(lt, sec.drop || 0, sec, t, e, b, k) || {};
  S.cam.updateMatrixWorld();
  renderer.setRenderTarget(rt); renderer.render(S.s, S.cam);
  let sun = null;
  if (S.sunDir) { const p = S.cam.position.clone().addScaledVector(S.sunDir.clone().normalize(), 400).project(S.cam);
    const inFront = S.cam.getWorldDirection(new THREE.Vector3()).dot(S.sunDir.clone().normalize()) > 0;
    if (inFront && Math.abs(p.x) < 1.3 && Math.abs(p.y) < 1.3) sun = { x: p.x * .5 + .5, y: p.y * .5 + .5, v: 1 - Math.max(Math.abs(p.x), Math.abs(p.y)) / 1.3 }; }
  return { fx, sun };
}
function renderAt(t) {
  t = clamp(t, 0, TOTAL - 1e-4);
  let idx = 0; while (idx < TL.sections.length - 1 && t >= TL.sections[idx].t0 + TL.sections[idx].dur) idx++;
  const sec = TL.sections[idx], lt = t - sec.t0;
  const cur = renderScene(SCENES[sec.scene], rtB, lt, sec, t);
  let mix = 1, prev = null;
  if (idx > 0 && lt < XF) {     // crossfade from the previous scene, which keeps moving during the overlap
    const ps = TL.sections[idx - 1];
    prev = renderScene(SCENES[ps.scene], rtA, ps.dur + lt, ps, t);
    mix = smooth(0, XF, lt);
  }
  const fx = cur.fx, pfx = prev?.fx || {};
  mixMat.uniforms.uMix.value = mix;
  const sun = mix > 0.5 || !prev ? cur.sun : prev.sun;
  mixMat.uniforms.uSunVis.value = sun ? sun.v * 0.9 : 0; if (sun) mixMat.uniforms.uSun.value.set(sun.x, sun.y);
  const darkCut = sec.scene === 'cyber' || TL.sections[idx - 1]?.scene === 'cyber';
  const white = prev ? Math.sin(Math.PI * mix) * (darkCut ? 0.0 : 0.22) : 0;   // soft white lift (bright scenes only)
  mixMat.uniforms.uWhite.value = Math.max(white, fx.white || 0);
  mixMat.uniforms.uRed.value = prev ? (pfx.redout || 0) * (1 - mix) : 0;
  bloom.strength = lerp(pfx.bloom ?? fx.bloom ?? 0.4, fx.bloom ?? 0.4, mix);
  renderer.setRenderTarget(null);
  composer.render();
}
window.renderAt = renderAt;
window.SNIPPET = { total: TOTAL, fps: TL.fps };
window.READY = true;

if (!CAPTURE) {
  let audio = null, t0 = performance.now();
  if (TL.audio) { audio = new Audio(TL.audio); document.body.addEventListener('click', () => { audio.currentTime = 0; audio.play(); t0 = performance.now(); }); }
  const startAt = +(params.get('t') || 0);
  (function loop() { const t = audio && !audio.paused ? audio.currentTime : (startAt + (performance.now() - t0) / 1000) % TOTAL; renderAt(t); requestAnimationFrame(loop); })();
}
