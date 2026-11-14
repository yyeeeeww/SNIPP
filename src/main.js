// PS1 / Dreamcast-style creepy wizard snippet.
// Deterministic: every frame is a pure function of time t, so it can be captured offline.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
THREE.ColorManagement.enabled = false;   // hex colors = raw values (no hidden sRGB->linear darkening)

const params = new URLSearchParams(location.search);
const W = +(params.get('w') || 270), H = +(params.get('h') || 480);
const CAPTURE = params.has('capture');

// ---------- timeline (overridable by timeline.json once real audio is in) ----------
let TL = {
  fps: 30,
  sections: [
    { scene: 'field', dur: 15 },
    { scene: 'circle', dur: 15 },
    { scene: 'tower', dur: 15 },
    { scene: 'head', dur: 15 },
  ],
  env: null,      // per-frame loudness 0..1
  onsets: null,   // seconds of strong hits
  audio: null,
};
try {
  const r = await fetch('./timeline.json', { cache: 'no-store' });
  if (r.ok) TL = { ...TL, ...(await r.json()) };
} catch (e) { /* defaults */ }
const TOTAL = TL.sections.reduce((a, s) => a + s.dur, 0);

// ---------- helpers ----------
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const ease = (k) => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

function env(t) {
  if (TL.env) { const i = Math.floor(t * TL.fps); return TL.env[clamp(i, 0, TL.env.length - 1)] || 0; }
  const b = (t * 2) % 1; return 0.25 + 0.75 * Math.exp(-b * 6);   // fake 120bpm pulse
}
function hit(t, win = 0.12) {   // 1 right on an onset, decaying
  const list = TL.onsets || [];
  let best = 0;
  for (const o of list) { const d = t - o; if (d >= 0 && d < win) best = Math.max(best, 1 - d / win); }
  return best;
}

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
document.body.appendChild(renderer.domElement);

const rt = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, W / H, 0.1, 200);

// ---------- textures ----------
const loader = new THREE.TextureLoader();
const TEX = {};
const texNames = ['mandala', 'flowerman', 'redF', 'claydoll', 'creature', 'dollhead', 'fieldman', 'sackdoll',
  'glitchshrine', 'flowers', 'ghostline', 'redsmear', 'stone', 'ground'];
await Promise.all(texNames.map(n => new Promise(res => loader.load(`./assets/${n}.png`, t => {
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; TEX[n] = t; res();
}))));
function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t;
}
TEX.glow = canvasTex(32, (g, s) => {
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
});
TEX.moon = canvasTex(64, (g, s) => {
  g.fillStyle = '#e8e0d0'; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.fill();
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(44, 26, 24, 0, 7); g.fill();
});
TEX.flame = canvasTex(32, (g, s) => {
  const gr = g.createRadialGradient(16, 20, 0, 16, 18, 14);
  gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(.4, 'rgba(255,60,20,.9)'); gr.addColorStop(1, 'rgba(120,0,0,0)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(16, 18, 9, 14, 0, 0, 7); g.fill();
});

// ---------- PS1 material ----------
const G = {   // shared uniforms
  uSnap: { value: new THREE.Vector2(W / 2.2, H / 2.2) },
  uTime: { value: 0 },
  uFogColor: { value: new THREE.Color(0, 0, 0) },
  uFogNear: { value: 5 }, uFogFar: { value: 30 },
  uLightDir: { value: new THREE.Vector3(0.3, 1, 0.4).normalize() },
  uLightColor: { value: new THREE.Color(0.25, 0.22, 0.28) },
  uAmbient: { value: new THREE.Color(0.12, 0.08, 0.1) },
  uOrbPos: { value: new THREE.Vector3() },
  uOrbColor: { value: new THREE.Color(1, 0.1, 0.05) },
  uOrbRange: { value: 8 },
};
const VERT = /* glsl */`
uniform vec2 uSnap; uniform float uFogNear, uFogFar; uniform vec3 uLightDir, uLightColor, uAmbient;
uniform vec3 uOrbPos, uOrbColor; uniform float uOrbRange, uLit, uTime, uWobble;
varying vec3 vUvw; varying vec3 vLight; varying float vFog;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  wp.x += sin(uTime * 2.0 + wp.y * 3.0 + wp.z) * uWobble * 0.06 * max(position.y, 0.0);
  vec4 mv = viewMatrix * wp;
  vec4 p = projectionMatrix * mv;
  p.xy = floor(p.xy / p.w * uSnap + 0.5) / uSnap * p.w;      // vertex snapping
  gl_Position = p;
  vUvw = vec3(uv * p.w, p.w);                               // affine texture mapping
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vec3 L = uAmbient + uLightColor * max(dot(n, uLightDir), 0.0);
  vec3 to = uOrbPos - wp.xyz; float d = length(to);
  float att = clamp(1.0 - d / uOrbRange, 0.0, 1.0);
  L += uOrbColor * att * att * (0.35 + 0.65 * max(dot(n, to / max(d, 1e-3)), 0.0)) * 2.2;
  vLight = mix(vec3(1.0), L, uLit);
  vFog = clamp((-mv.z - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
}`;
const FRAG = /* glsl */`
uniform sampler2D map; uniform float uHasMap, uAlphaTest, uAdd, uOpacity, uFogAmt;
uniform vec3 uColor, uEmissive, uFogColor; uniform vec2 uRepeat, uScroll;
varying vec3 vUvw; varying vec3 vLight; varying float vFog;
void main(){
  vec2 uv = vUvw.xy / vUvw.z * uRepeat + uScroll;
  vec4 tx = uHasMap > 0.5 ? texture2D(map, uv) : vec4(1.0);
  if (tx.a < uAlphaTest) discard;
  vec3 c = tx.rgb * uColor * vLight + uEmissive * tx.rgb;
  float f = vFog * uFogAmt;
  if (uAdd > 0.5) { gl_FragColor = vec4(c * (1.0 - f) * uOpacity * tx.a, 1.0); return; }
  gl_FragColor = vec4(mix(c, uFogColor, f), tx.a * uOpacity);
}`;
function M(o = {}) {
  const u = {
    ...G,
    map: { value: o.map || null }, uHasMap: { value: o.map ? 1 : 0 },
    uColor: { value: new THREE.Color(o.color ?? 0xffffff) },
    uEmissive: { value: new THREE.Color(o.emissive ?? 0x000000) },
    uAlphaTest: { value: o.alphaTest ?? (o.add ? 0 : 0.02) },
    uAdd: { value: o.add ? 1 : 0 }, uOpacity: { value: o.opacity ?? 1 },
    uFogAmt: { value: o.fog ?? 1 }, uLit: { value: o.lit ?? 1 }, uWobble: { value: o.wobble ?? 0 },
    uRepeat: { value: new THREE.Vector2(...(o.repeat || [1, 1])) },
    uScroll: { value: new THREE.Vector2() },
  };
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG,
    side: o.side ?? THREE.FrontSide, transparent: !!(o.add || o.transparent),
    depthWrite: !o.add, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending });
  return m;
}
const mesh = (geo, mat) => new THREE.Mesh(geo, mat);
const billboards = [];
function glow(size, color, tex = TEX.glow) {
  const m = mesh(new THREE.PlaneGeometry(size, size), M({ map: tex, emissive: color, color: 0x000000, add: true, lit: 0, fog: 0.6 }));
  m.userData.billboard = true; billboards.push(m); return m;
}

// ---------- wizard ----------
function makeWizard() {
  const g = new THREE.Group();
  const robeM = M({ map: TEX.sackdoll, color: 0x6a6a70, repeat: [2, 1], wobble: 0.6 });
  const robe = mesh(new THREE.CylinderGeometry(0.22, 0.72, 1.8, 7, 3), robeM); robe.position.y = 0.9; g.add(robe);
  const flowerM = M({ color: 0xc0101a, emissive: 0x300000 });
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const f = mesh(new THREE.IcosahedronGeometry(0.09 + hash(i + s) * 0.06, 0), flowerM);
    f.position.set(s * (0.25 + hash(i * 3 + s) * 0.12), 1.68 + hash(i * 7) * 0.12, (hash(i * 11 + s) - .5) * 0.2); g.add(f);
  }
  const headG = new THREE.Group(); headG.position.y = 1.86; g.add(headG);
  const head = mesh(new THREE.IcosahedronGeometry(0.24, 1), M({ color: 0x141016 })); head.position.y = 0.14; headG.add(head);
  const eyeM = M({ color: 0x000000, emissive: 0xff1010, lit: 0, fog: 0.3 });
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = mesh(new THREE.PlaneGeometry(0.075, 0.03), eyeM); e.position.set(s * 0.085, 0.17, 0.235); headG.add(e);
    const eg = glow(0.16, 0xff1010); eg.position.copy(e.position); eg.position.z += 0.02; headG.add(eg); eyes.push(eg);
  }
  const hatM = M({ map: TEX.redsmear, color: 0x3a2a30, repeat: [1, 2] });
  const brim = mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.04, 8), hatM); brim.position.y = 0.32; headG.add(brim);
  const hat1 = mesh(new THREE.CylinderGeometry(0.16, 0.42, 1.0, 6), hatM); hat1.position.y = 0.82; headG.add(hat1);
  const tipG = new THREE.Group(); tipG.position.y = 1.3; tipG.rotation.z = -0.55; tipG.rotation.x = 0.15; headG.add(tipG);
  const hat2 = mesh(new THREE.ConeGeometry(0.16, 1.0, 6), hatM); hat2.position.y = 0.5; tipG.add(hat2);
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.3, 1.66, 0); g.add(a);
    const sleeve = mesh(new THREE.CylinderGeometry(0.07, 0.14, 0.85, 5), robeM); sleeve.position.y = -0.42; a.add(sleeve);
    const hand = mesh(new THREE.IcosahedronGeometry(0.06, 0), M({ color: 0x8a8090 })); hand.position.y = -0.88; a.add(hand);
    a.rotation.z = s * 0.18; arms.push(a);
  }
  const staff = new THREE.Group(); staff.position.set(0.62, 0, 0.12); g.add(staff);
  const pole = mesh(new THREE.CylinderGeometry(0.025, 0.035, 2.6, 5), M({ color: 0x2a1a14 })); pole.position.y = 1.3; staff.add(pole);
  const orb = mesh(new THREE.IcosahedronGeometry(0.13, 1), M({ color: 0x000000, emissive: 0xff2010, lit: 0, fog: 0.4 })); orb.position.y = 2.72; staff.add(orb);
  const orbGlow = glow(1.6, 0xff2010); orbGlow.position.y = 2.72; staff.add(orbGlow);
  return { group: g, headG, eyes, eyeM, arms, staff, orb, orbGlow };
}
function setEyes(w, k) { for (const e of w.eyes) e.scale.setScalar(0.3 + Math.min(k, 2) * 0.9); w.eyeM.uniforms.uEmissive.value.setRGB(0.3 + k, 0.03, 0.03); }
function setOrb(w, k) { w.orbGlow.scale.setScalar(0.4 + k * 1.6); w.orb.material.uniforms.uEmissive.value.setRGB(0.6 + k, 0.1 + 0.3 * k, 0.05 + 0.2 * k); }
function orbWorld(w) { const v = new THREE.Vector3(); w.orb.getWorldPosition(v); return v; }

function crossQuads(n, area, sizeR, mat, r, avoid) {
  const geos = [];
  for (let i = 0; i < n; i++) {
    let x = lerp(area[0], area[1], r()), z = lerp(area[2], area[3], r());
    if (avoid && Math.abs(x) < avoid) x += Math.sign(x || 1) * avoid;
    const s = lerp(sizeR[0], sizeR[1], r());
    for (const rot of [0, Math.PI / 2]) {
      const p = new THREE.PlaneGeometry(s, s); p.translate(0, s / 2, 0); p.rotateY(rot + r() * 0.6); p.translate(x, 0, z); geos.push(p);
    }
  }
  return mesh(mergeGeometries(geos), mat);
}
function framedArt(tex, w, h, frameColor = 0x2a0508) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(w + 0.18, h + 0.18, 0.08), M({ color: frameColor })));
  const p = mesh(new THREE.PlaneGeometry(w, h), M({ map: tex, emissive: 0x1a1a1a })); p.position.z = 0.045; g.add(p);
  return g;
}

// ======================= SCENES =======================
const SCENES = {};

// 1) FIELD — a red flower field at night, a faceless wizard waits with his back turned
SCENES.field = (() => {
  const r = rng(11), g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(90, 90, 45, 45); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, Math.sin(x * 0.3) * 0.25 + Math.cos(z * 0.21 + x * 0.1) * 0.35 - (Math.abs(x) > 12 ? (Math.abs(x) - 12) * -0.15 : 0)); }
  geo.computeVertexNormals();
  g.add(mesh(geo, M({ map: TEX.ground, repeat: [22, 22] })));
  g.add(crossQuads(1100, [-22, 22, -46, 10], [0.35, 0.9], M({ map: TEX.flowers, alphaTest: 0.5, lit: 0.45, color: 0xffb0b0, emissive: 0x401010, side: THREE.DoubleSide, wobble: 1 }), r, 0.9));
  const barkM = M({ color: 0x1a1214 });
  for (let i = 0; i < 16; i++) {
    const t = new THREE.Group(); const h = 3 + r() * 4;
    const tr = mesh(new THREE.CylinderGeometry(0.06, 0.2, h, 5), barkM); tr.position.y = h / 2; t.add(tr);
    for (let b = 0; b < 4; b++) { const bl = 1 + r() * 1.6; const br = mesh(new THREE.CylinderGeometry(0.02, 0.07, bl, 4), barkM);
      br.position.set(0, h * (0.5 + r() * 0.45), 0); br.rotation.set(0, 0, 0); br.rotateY(r() * 6.28); br.rotateZ(0.6 + r() * 0.7); br.translateY(bl / 2); t.add(br); }
    const side = r() < .5 ? -1 : 1; t.position.set(side * (5 + r() * 14), 0, -4 - r() * 44); g.add(t);
  }
  const monos = [[TEX.flowerman, -2.6, -9], [TEX.creature, 2.8, -16], [TEX.ghostline, -3, -23]];
  for (const [tx, x, z] of monos) {
    const m = new THREE.Group(); m.position.set(x, 0, z); m.rotation.y = -Math.sign(x) * 0.45;
    const st = mesh(new THREE.BoxGeometry(1.3, 2.6, 0.35), M({ map: TEX.stone, color: 0x7a7070 })); st.position.y = 1.3; m.add(st);
    const art = mesh(new THREE.PlaneGeometry(1.0, 1.0), M({ map: tx, emissive: 0x303030 })); art.position.set(0, 1.55, 0.18); m.add(art);
    const c = glow(0.6, 0xff4010, TEX.flame); c.position.set(0.45, 0.2, 0.45); m.add(c); m.userData.flame = c;
    g.add(m);
  }
  const wiz = makeWizard(); wiz.group.position.set(0, 0, -32); wiz.group.rotation.y = Math.PI; g.add(wiz.group);
  const sv = []; for (let i = 0; i < 500; i++) { const a = r() * 6.28, e = 0.15 + r() * 1.2; sv.push(Math.cos(a) * Math.cos(e) * 80, Math.sin(e) * 80, Math.sin(a) * Math.cos(e) * 80); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xd8c8d8, size: 1, sizeAttenuation: false, fog: false })); g.add(stars);
  const moon = mesh(new THREE.PlaneGeometry(9, 9), M({ map: TEX.moon, color: 0x000000, emissive: 0xffeedd, add: true, lit: 0, fog: 0 })); moon.position.set(-18, 30, -70); moon.lookAt(0, 0, 0); g.add(moon);
  const moonGlow = mesh(new THREE.PlaneGeometry(26, 26), M({ map: TEX.glow, color: 0, emissive: 0x401018, add: true, lit: 0, fog: 0 })); moonGlow.position.copy(moon.position); moonGlow.lookAt(0, 0, 0); g.add(moonGlow);
  return {
    group: g, stars, bg: 0x0c0306,
    setup() { G.uFogColor.value.set(0x1a0508); G.uFogNear.value = 4; G.uFogFar.value = 34; G.uAmbient.value.setRGB(0.24, 0.12, 0.16); G.uLightColor.value.setRGB(0.3, 0.26, 0.36); G.uOrbRange.value = 7; },
    update(lt, k, e, t) {
      const walk = ease(clamp(k / 0.86));
      camera.position.set(Math.sin(lt * 0.7) * 0.25, 1.25 + Math.abs(Math.sin(lt * 3.2)) * 0.05, lerp(7, -22.5, walk));
      camera.lookAt(Math.sin(lt * 0.5) * 0.6, 1.4 + Math.sin(lt * 0.3) * 0.15, camera.position.z - 10);
      camera.rotation.z += Math.sin(lt * 0.9) * 0.02;
      const turn = smooth(0.8, 0.9, k);
      wiz.headG.rotation.y = Math.PI * turn * 0.98 + (turn > 0 && turn < 1 ? Math.sin(lt * 60) * 0.05 : 0);   // owl turn
      setEyes(wiz, turn * (0.7 + e * 0.6));
      setOrb(wiz, 0.25 + e * 0.6);
      G.uOrbPos.value.copy(orbWorld(wiz));
      for (const c of g.children) if (c.userData.flame) c.userData.flame.scale.setScalar(0.8 + hash(Math.floor(t * 12) + c.position.x) * 0.5);
      return { glitch: smooth(0.82, 0.86, k) * (1 - smooth(0.86, 0.9, k)) * 0.8 };
    },
  };
})();

// 2) CIRCLE — the ritual: levitating wizard over the red mandala, relics orbit the orb
SCENES.circle = (() => {
  const r = rng(22), g = new THREE.Group();
  const fl = mesh(new THREE.PlaneGeometry(50, 50, 10, 10), M({ map: TEX.stone, color: 0x6a6268, repeat: [14, 14] })); fl.rotation.x = -Math.PI / 2; g.add(fl);
  const mand1 = mesh(new THREE.PlaneGeometry(10, 10), M({ map: TEX.mandala, color: 0, emissive: 0xff2020, add: true, lit: 0, fog: 0.5 })); mand1.rotation.x = -Math.PI / 2; mand1.position.y = 0.03; g.add(mand1);
  const mand2 = mesh(new THREE.PlaneGeometry(5.2, 5.2), M({ map: TEX.mandala, color: 0, emissive: 0xff6040, add: true, lit: 0, fog: 0.5 })); mand2.rotation.x = -Math.PI / 2; mand2.position.y = 0.05; g.add(mand2);
  const flames = [];
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2, c = new THREE.Group(); c.position.set(Math.cos(a) * 5.2, 0, Math.sin(a) * 5.2);
    const h = 0.3 + hash(i) * 0.5;
    const cd = mesh(new THREE.CylinderGeometry(0.07, 0.08, h, 6), M({ color: 0xd8d0c0 })); cd.position.y = h / 2; c.add(cd);
    const f = glow(0.55, 0xff5020, TEX.flame); f.position.y = h + 0.18; c.add(f); flames.push(f); g.add(c);
  }
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + 0.3, h = 2 + r() * 6;
    const p = mesh(new THREE.BoxGeometry(1.1, h, 1.1), M({ map: TEX.stone, color: 0x8a8088, repeat: [1, h / 2] }));
    p.position.set(Math.cos(a) * 10, h / 2, Math.sin(a) * 10); p.rotation.y = r() * 3; p.rotation.z = (r() - .5) * 0.15; g.add(p);
  }
  const wiz = makeWizard(); g.add(wiz.group);
  const relics = [TEX.sackdoll, TEX.claydoll, TEX.dollhead, TEX.creature, TEX.redF, TEX.flowerman, TEX.glitchshrine].map((tx, i) => {
    const p = mesh(new THREE.PlaneGeometry(0.95, 0.95), M({ map: tx, emissive: 0x282020, side: THREE.DoubleSide })); g.add(p); return p;
  });
  const dust = []; for (let i = 0; i < 300; i++) dust.push((r() - .5) * 16, r() * 7, (r() - .5) * 16);
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dust, 3));
  const motes = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xff3030, size: 1, sizeAttenuation: false, fog: true })); g.add(motes);
  return {
    group: g, bg: 0x050002,
    setup() { G.uFogColor.value.set(0x050002); G.uFogNear.value = 6; G.uFogFar.value = 24; G.uAmbient.value.setRGB(0.06, 0.04, 0.06); G.uLightColor.value.setRGB(0.12, 0.1, 0.16); G.uOrbRange.value = 11; },
    update(lt, k, e, t) {
      const a = lt * 0.32 + 0.6, rad = lerp(12, 5.5, ease(k)), hgt = lerp(9, 2.2, ease(k));
      camera.position.set(Math.cos(a) * rad, hgt, Math.sin(a) * rad); camera.lookAt(0, 1.9 - k * 0.3, 0);
      const lev = smooth(0, 0.35, k);
      wiz.group.position.y = lev * (1.1 + Math.sin(lt * 1.3) * 0.12);
      wiz.group.rotation.y = -a + Math.PI / 2 + Math.PI * 0;   // always face the camera
      wiz.group.lookAt(camera.position.x, wiz.group.position.y, camera.position.z);
      for (const [i, arm] of wiz.arms.entries()) arm.rotation.z = (i ? 1 : -1) * lerp(0.18, 2.5, smooth(0.1, 0.45, k));
      wiz.staff.position.set(0.9, 0.3 + Math.sin(lt) * 0.1, 0); wiz.staff.rotation.z = Math.sin(lt * 0.7) * 0.1;
      setEyes(wiz, 0.6 + e * 0.8); setOrb(wiz, 0.5 + e * 1.1);
      G.uOrbPos.value.copy(orbWorld(wiz));
      mand1.rotation.z = lt * 0.25; mand2.rotation.z = -lt * 0.6;
      mand1.material.uniforms.uOpacity.value = 0.45 + e * 0.9 + smooth(0.6, 1, k) * 0.4; mand2.material.uniforms.uOpacity.value = 0.4 + e;
      mand1.scale.setScalar(1 + e * 0.08);
      relics.forEach((p, i) => {
        const ra = lt * 0.6 + i / relics.length * Math.PI * 2, rr = 2.6 - smooth(0.7, 1, k) * 1.4;
        p.position.set(Math.cos(ra) * rr, 2.4 + wiz.group.position.y * 0.6 + Math.sin(lt * 1.7 + i) * 0.3, Math.sin(ra) * rr);
        p.rotation.set(Math.sin(lt + i) * 0.4, lt * 0.9 + i, 0);
      });
      flames.forEach((f, i) => f.scale.setScalar(0.7 + hash(Math.floor(t * 14) + i * 7) * 0.6 + e * 0.4));
      motes.rotation.y = lt * 0.1; motes.position.y = (lt * 0.2) % 1;
      return { glitch: 0 };
    },
  };
})();

// 3) TOWER — a corridor of portraits; something stands at the end
SCENES.tower = (() => {
  const g = new THREE.Group(), L = 64;
  const stoneM = M({ map: TEX.stone, color: 0xb0a0a8, repeat: [L / 2.5, 2] });
  const floor = mesh(new THREE.PlaneGeometry(4.4, L, 4, 64), M({ map: TEX.stone, color: 0x5a5058, repeat: [2, L / 2.2] })); floor.rotation.x = -Math.PI / 2; floor.position.z = -L / 2 + 4; g.add(floor);
  const ceil = mesh(new THREE.PlaneGeometry(4.4, L, 4, 64), M({ map: TEX.stone, color: 0x3a3238, repeat: [2, L / 2.2] })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 4.2, -L / 2 + 4); g.add(ceil);
  for (const s of [-1, 1]) { const w = mesh(new THREE.PlaneGeometry(L, 4.2, 64, 4), stoneM); w.rotation.y = -s * Math.PI / 2; w.position.set(s * 2.2, 2.1, -L / 2 + 4); g.add(w); }
  for (let z = 2; z > -L + 4; z -= 5) for (const s of [-1, 1]) { const p = mesh(new THREE.BoxGeometry(0.5, 4.2, 0.5), M({ map: TEX.stone, color: 0x6a6068, repeat: [1, 3] })); p.position.set(s * 2.0, 2.1, z); g.add(p); }
  const arts = [TEX.flowerman, TEX.redF, TEX.claydoll, TEX.creature, TEX.ghostline, TEX.fieldman, TEX.glitchshrine, TEX.sackdoll, TEX.dollhead];
  const frames = arts.map((tx, i) => {
    const s = i % 2 ? 1 : -1, f = framedArt(tx, tx === TEX.fieldman ? 1.6 : 1.3, tx === TEX.fieldman ? 0.8 : 1.3);
    f.position.set(s * 2.15, 2.0, -0.5 - i * 5.5); f.rotation.y = -s * Math.PI / 2; g.add(f); return f;
  });
  const flames = [];
  for (let i = 0; i < 12; i++) { const s = i % 2 ? -1 : 1; const f = glow(0.7, 0xff4418, TEX.flame); f.position.set(s * 1.85, 2.9, -2.5 - i * 5); g.add(f); flames.push(f); }
  const door = mesh(new THREE.PlaneGeometry(4.4, 4.2), M({ map: TEX.stone, color: 0x302830, repeat: [2, 2] })); door.position.set(0, 2.1, -L + 4); g.add(door);
  const sigil = mesh(new THREE.PlaneGeometry(3.4, 3.4), M({ map: TEX.mandala, color: 0, emissive: 0xff1818, add: true, lit: 0, fog: 0.25 })); sigil.position.set(0, 2.1, -L + 4.05); g.add(sigil);
  const head = mesh(new THREE.PlaneGeometry(1.1, 1.1), M({ map: TEX.dollhead, emissive: 0x606060, lit: 0.3, fog: 0.3 })); head.position.set(0, 2.1, -L + 6); g.add(head);
  const wiz = makeWizard(); wiz.group.position.set(0, 0, -36); g.add(wiz.group);
  return {
    group: g, bg: 0x000000,
    setup() { G.uFogColor.value.set(0x000000); G.uFogNear.value = 3; G.uFogFar.value = 20; G.uAmbient.value.setRGB(0.1, 0.06, 0.07); G.uLightColor.value.setRGB(0.08, 0.06, 0.08); G.uOrbRange.value = 10; G.uOrbColor.value.setRGB(1, 0.35, 0.18); },
    update(lt, k, e, t) {
      const z = lerp(3, -L + 11, ease(k));
      camera.position.set(Math.sin(lt * 1.6) * 0.12, 1.65 + Math.abs(Math.sin(lt * 3.2)) * 0.06, z);
      camera.lookAt(Math.sin(lt * 0.4) * 0.5, 1.75, z - 6);
      G.uOrbPos.value.set(camera.position.x + 0.4, 1.9, z - 1.2);   // carried lantern
      const fl = 0.85 + hash(Math.floor(t * 10)) * 0.3; G.uOrbColor.value.setRGB(1 * fl, 0.35 * fl, 0.18 * fl);
      flames.forEach((f, i) => f.scale.setScalar(0.7 + hash(Math.floor(t * 12) + i * 3) * 0.6));
      // the wizard flickers in and out of existence at the end of the hall, getting closer each time
      const on = k > 0.3 && hash(Math.floor(t * 6)) > 0.45;
      wiz.group.visible = on; wiz.group.position.z = lerp(-38, z - 5, smooth(0.3, 0.92, k)); wiz.group.visible = on && k < 0.93;
      setEyes(wiz, 1); setOrb(wiz, 0.3 + e);
      sigil.rotation.z = -lt * 0.4; sigil.material.uniforms.uOpacity.value = 0.4 + e * 1.2;
      head.position.y = 2.1 + Math.sin(lt * 2) * 0.1; head.rotation.z = Math.sin(lt * 7) * 0.04;
      return { glitch: wiz.group.visible ? 0.06 : 0 };
    },
  };
})();

// 4) HEAD — the summoning: face to face, the orb rises, relics are pulled in, the mandala opens
SCENES.head = (() => {
  const r = rng(44), g = new THREE.Group();
  const wiz = makeWizard(); g.add(wiz.group);
  const back = mesh(new THREE.PlaneGeometry(22, 22), M({ map: TEX.mandala, color: 0, emissive: 0xff1010, add: true, lit: 0, fog: 0 })); back.position.set(0, 2.4, -7); g.add(back);
  const back2 = mesh(new THREE.PlaneGeometry(12, 12), M({ map: TEX.mandala, color: 0, emissive: 0xff5030, add: true, lit: 0, fog: 0 })); back2.position.set(0, 2.4, -6.5); g.add(back2);
  const ringM = M({ color: 0xa00812, emissive: 0x400000, lit: 0.6 });
  const ringGeos = []; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; const s = new THREE.IcosahedronGeometry(0.12 + hash(i) * 0.1, 0); s.translate(Math.cos(a) * 1.9, Math.sin(a) * 1.9, 0); ringGeos.push(s); }
  const ring = mesh(mergeGeometries(ringGeos), ringM); g.add(ring);
  const relTex = [TEX.sackdoll, TEX.claydoll, TEX.dollhead, TEX.creature, TEX.redF, TEX.flowerman, TEX.glitchshrine, TEX.fieldman, TEX.ghostline];
  const relics = []; for (let i = 0; i < 18; i++) { const p = mesh(new THREE.PlaneGeometry(0.7, 0.7), M({ map: relTex[i % relTex.length], emissive: 0x303030, side: THREE.DoubleSide, lit: 0.5, fog: 0.5 })); p.userData.seed = r(); g.add(p); relics.push(p); }
  const ground = mesh(new THREE.CircleGeometry(30, 12), M({ map: TEX.ground, repeat: [10, 10], color: 0x605058 })); ground.rotation.x = -Math.PI / 2; g.add(ground);
  return {
    group: g, bg: 0x120003,
    setup() { G.uFogColor.value.set(0x160004); G.uFogNear.value = 3; G.uFogFar.value = 22; G.uAmbient.value.setRGB(0.1, 0.03, 0.05); G.uLightColor.value.setRGB(0.15, 0.08, 0.12); G.uOrbRange.value = 6; G.uOrbColor.value.setRGB(1, 0.12, 0.06); },
    update(lt, k, e, t) {
      // close on the faceless face, then pull back and up while he raises the orb
      const pull = ease(smooth(0.15, 0.85, k));
      camera.position.set(Math.sin(lt * 0.3) * lerp(0.1, 1.2, pull), lerp(2.05, 3.0, pull), lerp(0.95, 7.5, pull));
      camera.lookAt(0, lerp(2.05, 2.4, pull), 0);
      camera.rotation.z += Math.sin(lt * 0.8) * 0.03;
      const raise = smooth(0.25, 0.6, k);
      wiz.arms[1].rotation.z = lerp(0.18, 2.9, raise); wiz.arms[0].rotation.z = -lerp(0.18, 1.2, raise);
      wiz.staff.position.set(lerp(0.62, 0.42, raise), lerp(0, 1.05, raise), 0.12);
      wiz.headG.rotation.x = -raise * 0.15; wiz.headG.rotation.z = Math.sin(lt * 5) * 0.02 * (1 - raise);
      setEyes(wiz, 0.8 + e * 0.8 + smooth(0.9, 0.97, k) * 2); setOrb(wiz, 0.6 + raise * 1.2 + e * 0.9);
      const orb = orbWorld(wiz); G.uOrbPos.value.copy(orb);
      back.rotation.z = lt * 0.18; back2.rotation.z = -lt * 0.5;
      const open = smooth(0.3, 0.9, k);
      back.scale.setScalar(0.4 + open * 0.8 + e * 0.1); back.material.uniforms.uOpacity.value = open * (0.6 + e);
      back2.scale.setScalar(0.5 + open + e * 0.15); back2.material.uniforms.uOpacity.value = open * (0.4 + e);
      ring.position.copy(orb); ring.rotation.z = lt * 0.8; ring.rotation.x = Math.sin(lt * 0.5) * 0.6; ring.scale.setScalar(smooth(0.35, 0.6, k) * (1 + e * 0.2));
      relics.forEach((p, i) => {
        const s = p.userData.seed, ph = (lt * 0.08 + s) % 1, suck = smooth(0.45, 1, k);
        const rr = lerp(5 + s * 3, 0.2, Math.max(ph * suck * 1.2, suck * suck));
        const a = lt * (0.5 + s) + i;
        p.position.set(orb.x + Math.cos(a) * rr, orb.y + Math.sin(a * 0.7) * rr * 0.4, orb.z + Math.sin(a) * rr);
        p.rotation.set(lt + i, lt * 1.3 + s * 6, 0); p.scale.setScalar(clamp(rr / 2, 0.15, 1));
      });
      return { glitch: smooth(0.9, 0.95, k) * 0.9, fade: smooth(0.95, 1.0, k), white: smooth(0.9, 0.93, k) * (1 - smooth(0.93, 0.95, k)) };
    },
  };
})();

for (const s of Object.values(SCENES)) { s.group.visible = false; scene.add(s.group); }

// ---------- post (dither, 15-bit color, scanlines, glitch, subliminal flashes) ----------
const flashTex = [TEX.dollhead, TEX.creature, TEX.claydoll, TEX.ghostline];
const post = new THREE.ShaderMaterial({
  uniforms: { tScene: { value: rt.texture }, tFlash: { value: TEX.dollhead }, uRes: { value: new THREE.Vector2(W, H) },
    uTime: { value: 0 }, uGlitch: { value: 0 }, uFlash: { value: 0 }, uFade: { value: 0 }, uWhite: { value: 0 }, uPulse: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: /* glsl */`
  uniform sampler2D tScene, tFlash; uniform vec2 uRes; uniform float uTime, uGlitch, uFlash, uFade, uWhite, uPulse;
  varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float bayer(vec2 p){ int x = int(mod(p.x, 4.)), y = int(mod(p.y, 4.)); int i = x + y * 4;
    float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return m[i] / 16. - .5; }
  void main(){
    vec2 px = floor(vUv * uRes), uv = vUv;
    float fr = floor(uTime * 24.);
    float row = floor(px.y / 3.);
    float jump = step(1. - uGlitch * 0.6, h(vec2(row, fr)));
    uv.x += (h(vec2(row * 1.3, fr)) - .5) * 0.25 * jump * uGlitch;
    uv.y += (h(vec2(fr, 2.)) - .5) * 0.04 * step(0.85, uGlitch);
    float ca = (1.0 + uGlitch * 4.0 + uPulse * 2.0) / uRes.x;
    vec3 c = vec3(texture2D(tScene, uv + vec2(ca, 0)).r, texture2D(tScene, uv).g, texture2D(tScene, uv - vec2(ca, 0)).b);
    // subliminal flash image (red-tinted, threshold)
    vec3 fi = texture2D(tFlash, vec2(uv.x * 1.6 - 0.3, uv.y * 0.9 + 0.05)).rgb; float fl = dot(fi, vec3(.33));
    c = mix(c, vec3(fl * 1.4, fl * .15, fl * .2) * step(0.0, uv.x * 1.6 - 0.3) * step(uv.x * 1.6 - 0.3, 1.), uFlash);
    float n = h(px + fr * 7.1);
    c = mix(c, vec3(n), 0.035 + uGlitch * 0.45 * step(0.5, h(vec2(row, fr + 9.))));
    c += uPulse * vec3(0.08, 0.0, 0.01);
    vec2 q = vUv - .5; c *= 1. - dot(q, q) * 1.1;
    c *= 0.86 + 0.14 * mod(px.y, 2.);           // scanlines
    c = mix(c, vec3(1.), uWhite);
    c *= 1. - uFade;
    c = floor(clamp(c, 0., 1.) * 31. + bayer(px) + .5) / 31.;   // 15-bit color + ordered dither
    gl_FragColor = vec4(c, 1.);
  }`,
});
const postScene = new THREE.Scene(); postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// ---------- frame ----------
let current = null;
const _q = new THREE.Quaternion();
function renderAt(t) {
  t = clamp(t, 0, TOTAL - 1e-4);
  let acc = 0, idx = 0;
  while (idx < TL.sections.length - 1 && t >= acc + TL.sections[idx].dur) acc += TL.sections[idx++].dur;
  const sec = TL.sections[idx], lt = t - acc, k = lt / sec.dur, S = SCENES[sec.scene];
  if (current !== S) { if (current) current.group.visible = false; S.group.visible = true; S.setup(); scene.background = new THREE.Color(S.bg); current = S; }
  G.uTime.value = t;
  const e = env(t), hi = hit(t);
  const fx = S.update(lt, k, e, t) || {};
  // camera shake on hits
  camera.rotation.z += (hash(t * 91) - .5) * 0.03 * hi; camera.position.y += (hash(t * 57) - .5) * 0.05 * hi;
  camera.updateMatrixWorld();
  for (const b of billboards) { if (!b.visible) continue; b.parent.getWorldQuaternion(_q); b.quaternion.copy(_q.invert().multiply(camera.quaternion)); }
  // transitions: static burst + one or two subliminal frames around each cut
  const dEnd = sec.dur - lt, dStart = lt;
  const near = Math.min(dStart + (idx === 0 ? 99 : 0), dEnd + (idx === TL.sections.length - 1 ? 99 : 0));
  let glitch = Math.max(fx.glitch || 0, clamp(1 - near / 0.35) * 0.9, hi * 0.25);
  let flash = 0;
  if (near < 0.09 && idx > 0 && dStart < 0.09) { flash = 1; post.uniforms.tFlash.value = flashTex[idx % flashTex.length]; }
  if (TL.onsets) for (const [i, o] of TL.onsets.entries()) if (i % 9 === 4 && t - o >= 0 && t - o < 1 / 24) { flash = 0.85; post.uniforms.tFlash.value = flashTex[i % flashTex.length]; }
  const intro = idx === 0 ? 1 - smooth(0, 1.2, t) : 0;
  Object.assign(post.uniforms.uTime, { value: t });
  post.uniforms.uGlitch.value = Math.max(glitch, intro * 0.8);
  post.uniforms.uFlash.value = flash;
  post.uniforms.uFade.value = Math.max(fx.fade || 0, intro);
  post.uniforms.uWhite.value = fx.white || 0;
  post.uniforms.uPulse.value = e * 0.6 + hi;
  renderer.setRenderTarget(rt); renderer.render(scene, camera);
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
}
window.renderAt = renderAt; window.DBG = { G, SCENES, camera, scene };
window.SNIPPET = { total: TOTAL, fps: TL.fps };
window.READY = true;

if (!CAPTURE) {
  let audio = null, t0 = performance.now();
  if (TL.audio) { audio = new Audio(TL.audio); document.body.addEventListener('click', () => { audio.currentTime = 0; audio.play(); t0 = performance.now(); }); }
  const startAt = +(params.get('t') || 0);
  (function loop() { const t = audio && !audio.paused ? audio.currentTime : (startAt + (performance.now() - t0) / 1000) % TOTAL; renderAt(t); requestAnimationFrame(loop); })();
} else { renderAt(+(params.get('t') || 0)); }
