// fav — paranormal / psychedelic PS1 wizard snippet (procedural, no photos).
// Every frame is a function of time t + the feedback buffer, so capture renders sequentially.
import * as THREE from 'three';
THREE.ColorManagement.enabled = false;

const params = new URLSearchParams(location.search);
const W = +(params.get('w') || 270), H = +(params.get('h') || 480);
const CAPTURE = params.has('capture');

// ---------------- timeline ----------------
let TL = { fps: 30, sections: [
  { scene: 'broadcast', dur: 15, drop: 1.75 }, { scene: 'coven', dur: 15, drop: 1.78 },
  { scene: 'forest', dur: 15, drop: 2.4 }, { scene: 'vortex', dur: 15.3, drop: 0, out: 11.8 }],
  env: null, bass: null, kicks: [], onsets: [], audio: null };
try { const r = await fetch('./timeline.json', { cache: 'no-store' }); if (r.ok) TL = { ...TL, ...(await r.json()) }; } catch (e) {}
const TOTAL = TL.sections.reduce((a, s) => a + s.dur, 0);

// ---------------- helpers ----------------
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const frameOf = (t) => Math.floor(t * TL.fps + 1e-6);
const arr = (a, t, d) => a ? (a[clamp(frameOf(t), 0, a.length - 1)] ?? 0) : d;
const envAt = (t) => arr(TL.env, t, 0.5);
const bassAt = (t) => arr(TL.bass, t, 0.5);
function decayFrom(list, t, len) { let b = 0; for (const o of list) { const d = t - o; if (d >= -1e-6 && d < len) b = Math.max(b, 1 - d / len); } return b; }
const kickAt = (t) => decayFrom(TL.kicks, t, 0.22);
function kickIndex(t) { let n = 0; for (const k of TL.kicks) if (k <= t + 1e-6) n++; return n; }
function onKickFrame(t) { return TL.kicks.some(k => t - k >= -1e-6 && t - k < 1 / TL.fps); }

// ---------------- renderer & targets ----------------
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
document.body.appendChild(renderer.domElement);
const mkRT = (filter) => new THREE.WebGLRenderTarget(W, H, { minFilter: filter, magFilter: filter, depthBuffer: true });
const rtScene = mkRT(THREE.NearestFilter);
let rtA = mkRT(THREE.LinearFilter), rtB = mkRT(THREE.LinearFilter);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(64, W / H, 0.05, 300);

// ---------------- procedural textures ----------------
function canvasTex(size, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const R0 = rng(5);
function px(g, x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
function starsAndMoons(g, s, base, ink, n) {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  for (let i = 0; i < s * s * 0.15; i++) px(g, R0() * s | 0, R0() * s | 0, `rgba(0,0,0,${R0() * 0.5})`);
  for (let i = 0; i < n; i++) {
    const x = R0() * s | 0, y = R0() * s | 0;
    if (R0() < 0.6) { px(g, x, y, ink); px(g, x + 1, y, ink); px(g, x - 1, y, ink); px(g, x, y + 1, ink); px(g, x, y - 1, ink); }
    else { g.fillStyle = ink; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); g.fillStyle = base; g.beginPath(); g.arc(x + 1.6, y - 1, 2.6, 0, 7); g.fill(); }
  }
}
const TEX = {
  robe: canvasTex(64, (g, s) => starsAndMoons(g, s, '#16090f', '#c8102a', 14)),
  hat: canvasTex(64, (g, s) => { starsAndMoons(g, s, '#0d0509', '#e02040', 10); g.fillStyle = '#5a0010'; g.fillRect(0, 54, s, 5); }),
  bark: canvasTex(64, (g, s) => { starsAndMoons(g, s, '#4a1826', '#b01830', 8); for (let y = 0; y < s; y += 4) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y, s, 1); } }),
  stone: canvasTex(64, (g, s) => { g.fillStyle = '#2a2026'; g.fillRect(0, 0, s, s); for (let i = 0; i < 1400; i++) px(g, R0() * s | 0, R0() * s | 0, `rgba(${R0() < .5 ? '0,0,0' : '120,90,100'},${R0() * .5})`); g.fillStyle = 'rgba(0,0,0,.6)'; for (let y = 0; y < s; y += 16) g.fillRect(0, y, s, 1); }),
  glow: canvasTex(32, (g, s) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, '#fff'); gr.addColorStop(.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }, false),
  flame: canvasTex(32, (g) => { const gr = g.createRadialGradient(16, 20, 0, 16, 18, 14); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(.4, 'rgba(255,60,30,.9)'); gr.addColorStop(1, 'rgba(120,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(16, 18, 8, 14, 0, 0, 7); g.fill(); }, false),
};

// ---------------- PS1 material ----------------
const G = {
  uSnap: { value: new THREE.Vector2(W / 2.4, H / 2.4) }, uTime: { value: 0 },
  uFogColor: { value: new THREE.Color(0) }, uFogNear: { value: 4 }, uFogFar: { value: 30 },
  uLightDir: { value: new THREE.Vector3(0.3, 1, 0.5).normalize() }, uLightColor: { value: new THREE.Color(0.3, 0.25, 0.3) },
  uAmbient: { value: new THREE.Color(0.15, 0.1, 0.12) },
  uOrbPos: { value: new THREE.Vector3() }, uOrbColor: { value: new THREE.Color(1, 0.1, 0.1) }, uOrbRange: { value: 8 },
  uMelt: { value: 0 },
};
const VERT = /* glsl */`
uniform vec2 uSnap; uniform float uFogNear, uFogFar, uTime, uMelt, uLit, uWobble;
uniform vec3 uLightDir, uLightColor, uAmbient, uOrbPos, uOrbColor; uniform float uOrbRange;
varying vec3 vUvw; varying vec3 vLight; varying float vFog;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float wob = uWobble + uMelt;
  wp.x += sin(uTime * 2.3 + wp.y * 1.7 + wp.z * 0.7) * wob * 0.05 * max(wp.y, 0.0);
  wp.z += cos(uTime * 1.9 + wp.y * 1.3 + wp.x * 0.5) * wob * 0.04 * max(wp.y, 0.0);
  wp.y += sin(uTime * 3.1 + wp.x * 0.9 + wp.z * 0.9) * uMelt * 0.15;
  vec4 mv = viewMatrix * wp;
  vec4 p = projectionMatrix * mv;
  p.xy = floor(p.xy / p.w * uSnap + 0.5) / uSnap * p.w;
  gl_Position = p;
  vUvw = vec3(uv * p.w, p.w);
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vec3 L = uAmbient + uLightColor * max(dot(n, uLightDir), 0.0);
  vec3 to = uOrbPos - wp.xyz; float d = length(to); float att = clamp(1.0 - d / uOrbRange, 0.0, 1.0);
  L += uOrbColor * att * att * (0.3 + 0.7 * max(dot(n, to / max(d, 1e-3)), 0.0)) * 2.4;
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
  gl_FragColor = vec4(mix(c, uFogColor, f), 1.0);
}`;
function M(o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...G, map: { value: o.map || null }, uHasMap: { value: o.map ? 1 : 0 },
      uColor: { value: new THREE.Color(o.color ?? 0xffffff) }, uEmissive: { value: new THREE.Color(o.emissive ?? 0) },
      uAlphaTest: { value: o.alphaTest ?? 0.02 }, uAdd: { value: o.add ? 1 : 0 }, uOpacity: { value: o.opacity ?? 1 },
      uFogAmt: { value: o.fog ?? 1 }, uLit: { value: o.lit ?? 1 }, uWobble: { value: o.wobble ?? 0 },
      uRepeat: { value: new THREE.Vector2(...(o.repeat || [1, 1])) }, uScroll: { value: new THREE.Vector2() } },
    vertexShader: VERT, fragmentShader: FRAG, side: o.side ?? THREE.FrontSide,
    transparent: !!o.add, depthWrite: !o.add, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending });
}
const mesh = (geo, mat) => new THREE.Mesh(geo, mat);
const billboards = [];
function glow(size, color, tex = TEX.glow, fog = 0.5) {
  const m = mesh(new THREE.PlaneGeometry(size, size), M({ map: tex, color: 0, emissive: color, add: true, lit: 0, fog }));
  m.userData.billboard = true; billboards.push(m); return m;
}

// ---------------- the wizard ----------------
function makeWizard(o = {}) {
  const tall = o.tall ?? 1, g = new THREE.Group();
  const F = o.fog ?? 1;
  const robeM = M({ map: TEX.robe, repeat: [3, 2], wobble: 0.5, fog: F });
  const robe = mesh(new THREE.CylinderGeometry(0.2, 0.75, 1.8 * tall, 7, 4), robeM); robe.position.y = 0.9 * tall; g.add(robe);
  const top = 1.8 * tall;
  const headG = new THREE.Group(); headG.position.y = top + 0.02; g.add(headG);
  const head = mesh(new THREE.IcosahedronGeometry(0.25, 1), M({ color: 0x050204, lit: 0.3, fog: F })); head.position.y = 0.14; head.scale.set(1, 1.15, 1); headG.add(head);
  const eyeCol = o.eyes ?? 0xffffff;
  const eyeM = M({ color: 0, emissive: eyeCol, lit: 0, fog: 0.2 });
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = mesh(new THREE.CircleGeometry(0.03, 5), eyeM); e.position.set(s * 0.085, 0.17, 0.245); headG.add(e);
    const eg = glow(0.22, eyeCol, TEX.glow, 0.2); eg.position.copy(e.position); eg.position.z += 0.02; headG.add(eg); eyes.push(eg);
  }
  const hatM = M({ map: TEX.hat, repeat: [2, 1], wobble: 0.3, fog: F });
  const brim = mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.04, 9), hatM); brim.position.y = 0.33; headG.add(brim);
  const hat1 = mesh(new THREE.CylinderGeometry(0.15, 0.42, 1.1, 7), hatM); hat1.position.y = 0.88; headG.add(hat1);
  const tipG = new THREE.Group(); tipG.position.y = 1.42; tipG.rotation.set(0.2, 0, -0.6); headG.add(tipG);
  const hat2 = mesh(new THREE.ConeGeometry(0.15, 1.1, 7), hatM); hat2.position.y = 0.55; tipG.add(hat2);
  const arms = [];
  const fingerM = M({ color: 0x0a0608, lit: 0.4, fog: F });
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.28, top - 0.12, 0); g.add(a);
    const len = 0.9 * tall;
    const sleeve = mesh(new THREE.CylinderGeometry(0.06, 0.16, len, 6), robeM); sleeve.position.y = -len / 2; a.add(sleeve);
    for (let f = 0; f < 4; f++) { const fg = mesh(new THREE.ConeGeometry(0.018, 0.32 * tall, 4), fingerM); fg.position.set((f - 1.5) * 0.03, -len - 0.14 * tall, 0); fg.rotation.x = Math.PI; fg.rotation.z = (f - 1.5) * 0.12; a.add(fg); }
    a.rotation.z = s * 0.15; arms.push(a);
  }
  return { group: g, headG, eyes, eyeM, arms, tall };
}
function setEyes(w, k) { for (const e of w.eyes) e.scale.setScalar(0.25 + Math.min(k, 3) * 0.8); }
function raiseArms(w, k, spread = 2.4) { w.arms.forEach((a, i) => a.rotation.z = (i ? 1 : -1) * lerp(0.15, spread, k)); }

// ---------------- raymarched / 2D background (writes depth) ----------------
const bgMat = new THREE.ShaderMaterial({
  uniforms: { uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uProjView: { value: new THREE.Matrix4() },
    uCamPos: { value: new THREE.Vector3() }, uTime: { value: 0 }, uMode: { value: 0 },
    uBass: { value: 0 }, uKick: { value: 0 }, uEnv: { value: 0 }, uTwist: { value: 0 }, uPal: { value: 0 }, uLid: { value: 0 },
    uZoom: { value: 0 }, uAspect: { value: W / H }, uGlowZ: { value: 0 }, uMoonDir: { value: new THREE.Vector3(0, 0.5, -1).normalize() } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */`
  uniform mat4 uInvProj, uCamWorld, uProjView; uniform vec3 uCamPos, uMoonDir;
  uniform float uTime, uMode, uBass, uKick, uEnv, uTwist, uPal, uLid, uZoom, uAspect, uGlowZ;
  varying vec2 vUv;
  #define PI 3.14159265
  mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
  float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float a = .5, s = 0.; for(int i=0;i<5;i++){ s += a*n2(p); p = rot(.6)*p*2.03; a *= .5; } return s; }
  vec3 pal(float t){
    vec3 a = vec3(.5,.15,.2), b = vec3(.5,.15,.25), d = vec3(0.,.15,.3);
    vec3 acid = .5 + .5*cos(6.2831*(t + vec3(0.,.33,.67)));
    return mix(a + b*cos(6.2831*(t + d)), acid, uPal);
  }
  float cellZ;
  float mapC(vec3 p){
    p.xy = rot(p.z * uTwist + uTime * .15) * p.xy;
    cellZ = floor(p.z / 3.0);
    vec3 q = p; q.z = mod(q.z, 3.0) - 1.5;
    float r = length(q.xy);
    float a = atan(q.y, q.x); float n = 6.0; a = mod(a, 2.*PI/n) - PI/n;
    vec2 c = r * vec2(cos(a), sin(a));
    float wall = 2.7 - c.x;
    float rib = length(vec2(c.x - 2.55, q.z)) - 0.22;
    float col = length(vec2(c.y, q.z)) - (0.16 + 0.05 * sin(p.z * 4. + uTime * 3.));
    col = max(col, -(c.x - 2.0));
    float d = min(wall, min(rib, col));
    d += sin(p.x*3.+uTime)*sin(p.y*3.)*sin(p.z*2.)*0.06*(1.+uBass*2.);
    return d;
  }
  vec3 nC(vec3 p){ vec2 e = vec2(.01, 0); return normalize(vec3(mapC(p+e.xyy)-mapC(p-e.xyy), mapC(p+e.yxy)-mapC(p-e.yxy), mapC(p+e.yyx)-mapC(p-e.yyx))); }
  void main(){
    vec2 ndc = vUv * 2.0 - 1.0;
    vec4 v = uInvProj * vec4(ndc, 1.0, 1.0); v /= v.w;
    vec3 rd = normalize((uCamWorld * vec4(v.xyz, 0.0)).xyz), ro = uCamPos;
    vec3 col = vec3(0.); float depth = 1.0;
    if (uMode < 0.5) { gl_FragColor = vec4(0,0,0,1); gl_FragDepth = 1.0; return; }
    if (uMode < 1.5) {                       // 1: endless arcade
      float t = 0.05; bool hit = false;
      for (int i = 0; i < 70; i++) { float d = mapC(ro + rd * t); if (d < 0.004 * t) { hit = true; break; } t += d * 0.9; if (t > 34.) break; }
      if (hit) {
        vec3 p = ro + rd * t; float cz = cellZ; vec3 n = nC(p);
        float diff = max(dot(n, -rd), 0.);
        vec3 base = pal(cz * 0.07 + uTime * 0.12 + n.y * .2) * (0.25 + 0.75 * diff);
        float band = smoothstep(.06, 0., abs(fract(p.z * .333 - uGlowZ) - .5) - .44);
        float stripes = step(.92, fract((atan(p.y,p.x)/PI*6.) + uTime*.3)) * .6;
        base += pal(cz*.13 + .5) * (band * (1.5 + uKick * 2.) + stripes * uEnv);
        col = base * exp(-t * 0.09);
        vec4 cp = uProjView * vec4(p, 1.0); depth = cp.z / cp.w * 0.5 + 0.5;
      }
    } else if (uMode < 2.5) {                // 2: void with smoke vortex
      vec2 q = vec2(atan(rd.x, rd.z), rd.y);
      float s = fbm(q * 3. + vec2(uTime * .1, -uTime * .2));
      col = vec3(.06, .0, .02) * s + pal(s + uTime*.05) * pow(s, 4.) * .35 * uEnv;
    } else if (uMode < 3.5) {                // 3: aurora sky + the moon that is an eye
      float y = rd.y;
      vec2 q = rd.xz / max(y + .25, .05);
      float w = fbm(q * .35 + vec2(uTime * .05, 0.) + fbm(q * .5 - uTime * .07) * 1.5);
      col = mix(vec3(.35,.02,.06) * (.6 + uBass * .6), vec3(.08,.0,.03), smoothstep(-.05, .45, y));
      col += pal(w + uTime * .03) * smoothstep(.45, .9, w) * smoothstep(-.05, .3, y) * (.4 + uBass * .8);
      float st = step(.997, h21(floor(rd.xy * 300.))) * smoothstep(0., .3, y); col += st * .7;
      vec3 md = normalize(uMoonDir); float ang = acos(clamp(dot(rd, md), -1., 1.));
      vec3 rgt = normalize(cross(md, vec3(0,1,0))), u2 = cross(rgt, md);
      vec2 e = vec2(dot(rd - md, rgt), dot(rd - md, u2)) / .16;
      float disk = smoothstep(1., .96, length(e));
      float almond = step(abs(e.y), (1. - e.x*e.x) * .8 * uLid);
      float ir = length(e);
      vec3 eyeC = mix(vec3(.95,.9,.85), pal(.1 + uTime * .2) * 1.3, smoothstep(.45, .4, ir));
      eyeC = mix(eyeC, vec3(0.), smoothstep(.18, .14, ir * (1. - uKick*.3)));
      col = mix(col, mix(vec3(.31,.2,.19), eyeC, almond), disk);
      col += vec3(.5,.05,.08) * exp(-ang * 9.) * .5;
    } else {                                 // 4: infinite log-polar tunnel of blinking eyes
      vec2 uv = (vUv - .5) * vec2(uAspect, 1.) * 2.;
      float r = length(uv), a = atan(uv.y, uv.x);
      float z = log(r) * 1.6 + uZoom;
      vec2 cell = vec2(a / (2.*PI) * 9. + z * .5, z);
      vec2 id = floor(cell), f = fract(cell) - .5;
      id.x = mod(id.x, 9.);
      float hid = h21(id);
      float blink = smoothstep(.0, .08, abs(fract(uTime * .35 + hid) - .5) - .02);
      float open = clamp(blink * (.55 + .45 * uEnv), 0., 1.);
      vec2 ef = f; ef.x *= .9;
      float almond = step(abs(ef.y), (0.2025 - ef.x*ef.x) * 2.2 * open);
      float ir = length(f - vec2(sin(uTime*1.3+hid*6.)*.06, 0.));
      vec3 bg = pal(id.y * .08 + uTime * .1) * (.25 + .2 * sin(id.x + id.y));
      bg *= .6 + .4 * step(.5, fract((id.x + id.y) * .5));
      vec3 eye = vec3(.92, .88, .84);
      eye = mix(eye, pal(hid + uTime * .3) * 1.4, smoothstep(.19, .16, ir));
      eye = mix(eye, vec3(0.), smoothstep(.08, .06, ir * (1. - uKick*.4)));
      col = mix(bg, eye, almond);
      col = mix(vec3(.45, .0, .06) * (1. + uKick * 1.5), col, smoothstep(.06, .4, r));
      col *= 1. + uKick * .6;
    }
    gl_FragColor = vec4(col, 1.0); gl_FragDepth = depth;
  }`,
  depthTest: false, depthWrite: true,
});
const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat); bgQuad.frustumCulled = false; bgQuad.renderOrder = -10;
scene.add(bgQuad);

// ---------------- the pit (psychedelic liquid + eye) ----------------
const pitMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uLid: { value: 0 }, uEnv: { value: 0 }, uKick: { value: 0 }, uOn: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: /* glsl */`
  uniform float uTime, uLid, uEnv, uKick, uOn; varying vec2 vUv;
  mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
  float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float a = .5, s = 0.; for(int i=0;i<5;i++){ s += a*n2(p); p = rot(.6)*p*2.03; a *= .5; } return s; }
  void main(){
    vec2 p = (vUv - .5) * 2.; float r = length(p);
    vec2 q = rot(uTime * .3 + r * 3.) * p * 3.;
    float w = fbm(q + fbm(q * 1.5 + uTime * .4) * 2.);
    float s = sin(6.2831 * (w * 1.5 + uTime * .2)) * .5 + .5;
    vec3 c = mix(vec3(0.), mix(vec3(.9,.02,.08), vec3(.8,.05,.6), s), smoothstep(.3, .55, w));
    c = mix(c, vec3(1., .88, .9), smoothstep(.62, .78, w));
    c = mix(vec3(w * .2, 0., w * .05), c * (.6 + uEnv), uOn);
    vec2 e = p / .75; float almond = step(abs(e.y), (1. - e.x * e.x) * .55 * uLid);
    float ir = length(e);
    vec3 eye = mix(vec3(.95,.9,.85), vec3(.9,.05,.1), smoothstep(.5, .45, ir));
    eye = mix(eye, vec3(0.), smoothstep(.22 + uKick * .1, .18 + uKick * .1, ir));
    c = mix(c, eye, almond);
    c *= smoothstep(1., .9, r);
    gl_FragColor = vec4(c, 1.);
  }`,
});

// ======================= SCENES =======================
// update(lt, D, sec, t, env, bass, kick) -> fx {decay, zoom, rot, warp, hue, kaleido, palMode, palMix, palShift,
//                                                glitch, neg, static, ghost, roll, override, fade, flashWhite}
const SCENES = {};

// 1) BROADCAST — dead channel, a figure in the static; then sucked into the endless arcade
SCENES.broadcast = (() => {
  const g = new THREE.Group();
  const wiz = makeWizard({ tall: 1.25, eyes: 0xffffff }); g.add(wiz.group);
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  return { group: g,
    setup() { G.uFogColor.value.set(0); G.uFogNear.value = 3; G.uFogFar.value = 22; G.uAmbient.value.setRGB(.25, .12, .18); G.uLightColor.value.setRGB(.4, .2, .3); G.uOrbRange.value = 6; G.uOrbColor.value.setRGB(1, .2, .4); },
    update(lt, D, sec, t, e, b, k) {
      const fx = {};
      if (lt < D) {
        bgMat.uniforms.uMode.value = 0;
        camera.position.set(0, 1.9, 4.2 - lt * 0.5); camera.lookAt(0, 1.9, 0);
        wiz.group.position.set(Math.sin(t * 40) * 0.03, 0, 0); wiz.group.rotation.set(0, 0, 0);
        raiseArms(wiz, 0.1); setEyes(wiz, 0);
        Object.assign(fx, { override: whiteMat, ghost: 1, static: 1, decay: 0, roll: 1 });
        return fx;
      }
      const L = lt - D, dur = sec.dur - D;
      bgMat.uniforms.uMode.value = 1;
      const zc = -(L * 7 + Math.pow(L, 1.6) * 0.6);
      camera.position.set(Math.sin(L * .7) * .3, Math.cos(L * .5) * .25, zc);
      camera.lookAt(Math.sin(L * .4) * .5, Math.cos(L * .3) * .3, zc - 5);
      camera.rotation.z += L * 0.08 + Math.sin(L * 0.6) * 0.3;
      // same distance however fast we fly — and he teleports closer every 5 kicks
      const steps = [8, 6, 4.4, 3.2, 2.2, 1.45];
      const ki = kickIndex(t) - kickIndex(sec.t0 + D - 0.05);
      const si = Math.min(steps.length - 1, Math.floor(ki / 5));
      wiz.group.position.set(0, -1.9 + Math.sin(L * 2) * 0.08, zc - steps[si]);
      wiz.group.lookAt(camera.position.x, wiz.group.position.y, camera.position.z);
      raiseArms(wiz, 0.6 + Math.sin(L * 1.3) * 0.15, 1.7);
      wiz.headG.rotation.z = Math.sin(L * 9) * 0.04 + (si >= 4 ? Math.sin(L * 37) * 0.1 : 0);
      setEyes(wiz, 0.6 + e * 0.8 + si * 0.25);
      G.uOrbPos.value.set(camera.position.x, camera.position.y, zc - 1.5);
      bgMat.uniforms.uTwist.value = 0.04 + b * 0.05 + L * 0.004;
      bgMat.uniforms.uGlowZ.value = -zc * 0.333 + L * 2.2;
      bgMat.uniforms.uPal.value = 0.03 + smooth(9, 13, L) * 0.35;
      const tele = ki % 5 === 0 && ki > 0 && onKickFrame(t);
      fx.glitch = tele ? 1 : 0; fx.neg = tele ? 1 : 0;
      Object.assign(fx, { decay: 0.7, zoom: 0.985, rot: 0.004, hue: 0.0, warp: 0.002 + b * 0.004,
        palMode: L > dur - 2.2 ? 1 : 5, palMix: 0.55 + smooth(dur - 3, dur, L) * 0.3, palShift: t * 0.15,
        kaleido: L > dur - 2.2 ? 6 : 0, flashWhite: L < 0.07 ? 1 : 0 });
      return fx;
    } };
})();

// 2) COVEN — night-vision camcorder over a ring of hooded figures; the pit opens its eye
SCENES.coven = (() => {
  const g = new THREE.Group(), r = rng(22);
  const floor = mesh(new THREE.PlaneGeometry(40, 40, 20, 20), M({ map: TEX.stone, repeat: [12, 12] })); floor.rotation.x = -Math.PI / 2; g.add(floor);
  const pit = mesh(new THREE.CircleGeometry(2.2, 24), pitMat); pit.rotation.x = -Math.PI / 2; pit.position.y = 0.02; g.add(pit);
  const rim = mesh(new THREE.TorusGeometry(2.25, 0.12, 4, 16), M({ color: 0x302028 })); rim.rotation.x = -Math.PI / 2; g.add(rim);
  const ring = new THREE.Group(); g.add(ring);
  const coven = [];
  for (let i = 0; i < 12; i++) {
    const w = makeWizard({ tall: 0.9 + r() * 0.2, eyes: 0xff2030 }); const a = i / 12 * Math.PI * 2;
    w.group.position.set(Math.cos(a) * 3.6, 0, Math.sin(a) * 3.6); w.group.lookAt(0, 0, 0); ring.add(w.group); coven.push(w);
  }
  const flames = [];
  for (let i = 0; i < 12; i++) { const a = (i + .5) / 12 * Math.PI * 2; const f = glow(0.5, 0xff5020, TEX.flame); f.position.set(Math.cos(a) * 2.8, 0.35, Math.sin(a) * 2.8); g.add(f); flames.push(f); }
  return { group: g,
    setup() { G.uFogColor.value.set(0); G.uFogNear.value = 6; G.uFogFar.value = 26; G.uAmbient.value.setRGB(.3, .2, .25); G.uLightColor.value.setRGB(.2, .15, .2); G.uOrbRange.value = 9; G.uOrbColor.value.setRGB(1, .2, .3); G.uOrbPos.value.set(0, 1, 0); },
    update(lt, D, sec, t, e, b, k) {
      const fx = {}; bgMat.uniforms.uMode.value = 2;
      pitMat.uniforms.uTime.value = t; pitMat.uniforms.uEnv.value = e; pitMat.uniforms.uKick.value = k;
      flames.forEach((f, i) => f.scale.setScalar(0.7 + hash(frameOf(t) * .5 + i * 7) * .6));
      if (lt < D) {
        camera.position.set(0.3 + Math.sin(t * 3) * 0.02, 9.5, 4.5); camera.lookAt(0, 0, 0.3); camera.rotation.z += Math.sin(t * 2) * 0.01;
        ring.rotation.y = 0;
        coven.forEach(w => { w.group.position.y = 0; w.headG.rotation.x = 0.35; setEyes(w, 0.2); raiseArms(w, 0); });
        pitMat.uniforms.uOn.value = 0; pitMat.uniforms.uLid.value = 0;
        Object.assign(fx, { palMode: 3, palMix: 1, decay: 0.3 });
        return fx;
      }
      const L = lt - D, dur = sec.dur - D;
      const dive = smooth(dur - 2.6, dur, L);
      const a = L * 0.45, rad = lerp(lerp(6.5, 5, smooth(0, dur - 3, L)), 0.01, dive), h = lerp(lerp(5.5, 3.2, smooth(0, dur - 3, L)), 0.6, dive);
      camera.position.set(Math.cos(a) * rad, h, Math.sin(a) * rad);
      camera.lookAt(0, lerp(1.2, 0, dive), 0); camera.rotation.z += L * 0.1 * dive;
      ring.rotation.y = -L * (0.6 + b * 0.3);
      coven.forEach((w, i) => {
        w.group.position.y = Math.abs(Math.sin(L * 2.2 + i * 0.5)) * 0.25 * smooth(0, 1, L);
        w.headG.rotation.x = lerp(0.35, -0.9, smooth(0.1, 0.5, L));
        setEyes(w, 0.8 + e); raiseArms(w, smooth(0.3, 1.2, L) * (0.7 + 0.3 * Math.sin(L * 4 + i)), 2.8);
      });
      pitMat.uniforms.uOn.value = smooth(0, 0.2, L); pitMat.uniforms.uLid.value = smooth(0.4, 1.6, L);
      G.uOrbColor.value.setRGB(1, .2 + .5 * e, .3 + .3 * Math.sin(t)); G.uOrbPos.value.set(0, 1.2, 0);
      const kal = false;
      Object.assign(fx, { kaleido: kal ? 4 + 2 * (Math.floor(kickIndex(t) / 16) % 2) : 0,
        decay: 0.62, zoom: 1.0, rot: 0.012 + b * 0.01, hue: 0.0, warp: 0.002,
        palMode: kal ? 1 : 5, palMix: kal ? 0.35 : 0.6, palShift: t * 0.2,
        glitch: L < 0.15 ? 1 : 0, neg: L < 0.07 ? 1 : 0, fade: smooth(dur - 0.3, dur, L) });
      return fx;
    } };
})();

// 3) FOREST — a forest of giant witch hats; on the drop every trunk opens an eye and HE rises
SCENES.forest = (() => {
  const g = new THREE.Group(), r = rng(33);
  const gr = mesh(new THREE.PlaneGeometry(120, 120, 40, 40), M({ map: TEX.stone, repeat: [30, 30], color: 0x806070 })); gr.rotation.x = -Math.PI / 2; g.add(gr);
  const trees = [];
  const treeM = M({ map: TEX.bark, repeat: [3, 4], wobble: 0.6 });
  const whiteM = M({ color: 0, emissive: 0xe8e0d8, lit: 0, fog: 0.7 }), irisM = M({ color: 0, emissive: 0xd00818, lit: 0, fog: 0.7 }), pupM = M({ color: 0, lit: 0, fog: 0 });
  for (let i = 0; i < 70; i++) {
    let x = (r() - .5) * 60, z = -r() * 70 + 6; if (Math.abs(x) < 2.2) x += Math.sign(x || 1) * 2.4;
    const hgt = 5 + r() * 9, rad = 0.6 + r() * 0.9;
    const t = new THREE.Group(); t.position.set(x, 0, z);
    const brim = mesh(new THREE.CylinderGeometry(rad * 2.3, rad * 2.3, 0.08, 8), treeM); brim.position.y = 0.3; t.add(brim);
    const c1 = mesh(new THREE.CylinderGeometry(rad * 0.45, rad, hgt * 0.6, 7), treeM); c1.position.y = hgt * 0.3; t.add(c1);
    const tip = new THREE.Group(); tip.position.y = hgt * 0.6; tip.rotation.z = (r() - .5) * 1.4; tip.rotation.x = (r() - .5) * 0.6; t.add(tip);
    const c2 = mesh(new THREE.ConeGeometry(rad * 0.45, hgt * 0.45, 7), treeM); c2.position.y = hgt * 0.22; tip.add(c2);
    const eG = new THREE.Group(); const ey = 1.4 + r() * 2; eG.position.set(0, ey, 0); t.add(eG);
    eG.rotation.y = Math.atan2(-x, 0 - z + 4);   // roughly facing the path
    const zr = rad * (1 - ey / (hgt * 0.6) * 0.55) + 0.02;
    const white = mesh(new THREE.CircleGeometry(0.34, 8), whiteM); white.position.z = zr; eG.add(white);
    const iris = mesh(new THREE.CircleGeometry(0.16, 6), irisM); iris.position.z = zr + 0.01; eG.add(iris);
    const pupil = mesh(new THREE.CircleGeometry(0.07, 5), pupM); pupil.position.z = zr + 0.02; eG.add(pupil);
    g.add(t); trees.push({ t, white, iris, pupil, seed: r() });
  }
  const giant = makeWizard({ tall: 1.3, eyes: 0xff1020, fog: 0.15 }); giant.group.scale.setScalar(11); giant.group.position.set(0, -40, -62); g.add(giant.group);
  const halo = glow(90, 0x700818, TEX.glow, 0); halo.position.set(0, 30, -80); g.add(halo);
  return { group: g,
    setup() { G.uFogColor.value.set(0x1c0208); G.uFogNear.value = 5; G.uFogFar.value = 42; G.uAmbient.value.setRGB(.38, .2, .26); G.uLightColor.value.setRGB(.5, .25, .35); G.uOrbRange.value = 9; G.uOrbColor.value.setRGB(1, .3, .2); },
    update(lt, D, sec, t, e, b, k) {
      const fx = {}; bgMat.uniforms.uMode.value = 3;
      const dur = sec.dur, z = lerp(5, -26, lt / dur);
      const up = smooth(D + 4.5, D + 8, lt) * (1 - smooth(dur - 2, dur, lt) * 0.3);
      camera.position.set(Math.sin(lt * .8) * .3, 1.6 + Math.abs(Math.sin(lt * 3.3)) * .07, z);
      camera.lookAt(Math.sin(lt * .5) * .8, lerp(1.7, 20, up), z - 10);
      camera.rotation.z += Math.sin(lt * .7) * 0.04;
      if (lt > D) { camera.fov = 64 - k * 10; camera.updateProjectionMatrix(); }
      G.uOrbPos.value.set(camera.position.x, 2, z - 2);
      const opened = smooth(D, D + 0.25, lt);
      trees.forEach(tr => {
        const o = opened * (0.15 + 0.85 * smooth(0, .06, Math.abs(((t * .4 + tr.seed) % 1) - .5) - .03));
        tr.white.scale.y = 0.04 + o; tr.iris.scale.y = 0.04 + o; tr.pupil.scale.setScalar(o * (1 + k * .8) + 0.001);
        const dx = clamp((camera.position.x - tr.t.position.x) * 0.02, -.1, .1);
        tr.iris.position.x = dx; tr.pupil.position.x = dx * 1.2;
      });
      G.uMelt.value = lt > D ? b * 0.8 + k * 0.6 : 0;
      const rise = smooth(D, D + 6, lt);
      halo.scale.setScalar(rise * (0.8 + b * 0.5));
      giant.group.position.set(0, lerp(-40, -2, rise), -62 + lt * 0.4);
      raiseArms(giant, smooth(D + 2, D + 7, lt), 2.6);
      giant.headG.rotation.x = smooth(dur - 4, dur - 1, lt) * 0.5;
      setEyes(giant, rise * (1 + e) + smooth(dur - 1.5, dur, lt) * 3);
      bgMat.uniforms.uLid.value = smooth(D, D + 0.6, lt) * (hash(Math.floor(t * 0.7)) > .85 ? 0 : 1);
      { const hp = new THREE.Vector3(); giant.headG.getWorldPosition(hp); hp.y += 7; const md = hp.sub(camera.position).normalize(); if (rise < 0.5) md.set(0.35, 0.55, -1).normalize(); bgMat.uniforms.uMoonDir.value.lerp(md, 1); }
      bgMat.uniforms.uPal.value = 0.1;
      if (lt < D) Object.assign(fx, { palMode: 4, palMix: 0.6, decay: 0.4 });
      else Object.assign(fx, { palMode: k > 0.55 ? 2 : 5, palMix: k > 0.55 ? 0.6 : 0.55 + b * 0.2, palShift: t * 0.1, decay: 0.55, zoom: 1 - k * 0.02, warp: 0.003 + b * 0.006 });
      fx.glitch = lt > D && lt < D + 0.12 ? 1 : 0; fx.neg = lt > D && lt < D + 0.07 ? 1 : 0;
      fx.flashWhite = smooth(dur - 0.5, dur - 0.05, lt);
      return fx;
    } };
})();

// 4) VORTEX — infinite tunnel of blinking eyes; then the beat dies and the static comes back for you
SCENES.vortex = (() => {
  const g = new THREE.Group();
  const wiz = makeWizard({ tall: 1.1, eyes: 0xffffff }); g.add(wiz.group);
  const ghosts = [0, 1, 2].map(() => { const w = makeWizard({ tall: 1.1, eyes: 0xff2040 }); g.add(w.group); return w; });
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  return { group: g,
    setup() { G.uFogColor.value.set(0); G.uFogNear.value = 6; G.uFogFar.value = 30; G.uAmbient.value.setRGB(.3, .15, .22); G.uLightColor.value.setRGB(.4, .2, .3); G.uOrbRange.value = 6; G.uOrbColor.value.setRGB(1, .3, .6); },
    update(lt, D, sec, t, e, b, k) {
      const fx = {}, out = sec.out ?? 11.8, dur = sec.dur;
      camera.position.set(0, 1.9, 6); camera.lookAt(0, 1.9, 0);
      if (lt < out) {
        bgMat.uniforms.uMode.value = 4;
        bgMat.uniforms.uZoom.value = -t * 1.2 - kickIndex(t) * 0.12 - k * 0.15;
        bgMat.uniforms.uPal.value = 0.05 + 0.3 * smooth(6, 11, lt);
        camera.rotation.z = lt * 0.35 + Math.sin(lt) * 0.3;
        wiz.group.position.set(0, 0.2 + Math.sin(lt * 1.5) * 0.15, lerp(-6, 1.5, smooth(0, out, lt)));
        wiz.group.rotation.y = Math.sin(lt * 0.8) * 0.6; raiseArms(wiz, 0.9 + Math.sin(lt * 3) * 0.1, 2.2);
        setEyes(wiz, 0.8 + e * 1.2);
        ghosts.forEach((w, i) => {
          w.group.visible = true;
          const a = lt * 1.2 + i * 2.094; w.group.position.set(Math.cos(a) * 2.2, 0.2 + Math.sin(a * 2) * .3, wiz.group.position.z - 1 + Math.sin(a) * 1.5);
          w.group.rotation.y = -a; raiseArms(w, 0.5, 2); setEyes(w, 1);
        });
        G.uOrbPos.value.set(0, 2.2, wiz.group.position.z + 1);
        const kal4 = (Math.floor(kickIndex(t) / 8) % 3 === 2);
        Object.assign(fx, { decay: 0.68, zoom: 0.97 - k * 0.02, rot: -0.01, hue: 0.0, warp: 0.002 + b * .005,
          palMode: kal4 ? 1 : 5, palMix: 0.5, palShift: t * 0.3,
          kaleido: (Math.floor(kickIndex(t) / 8) % 3 === 2) ? 8 : 0,
          glitch: lt > out - 0.2 ? 1 : 0, neg: onKickFrame(t) && kickIndex(t) % 4 === 0 ? 1 : 0 });
        return fx;
      }
      // the beat is gone. the static comes back, and he is right in front of you (= loops into the start)
      const L = lt - out, rem = dur - out;
      bgMat.uniforms.uMode.value = 0;
      ghosts.forEach(w => w.group.visible = false);
      camera.rotation.z = 0;
      wiz.group.position.set(Math.sin(t * 40) * 0.02, 0, lerp(-1.5, 2.6, smooth(0, rem, L)));
      wiz.group.rotation.set(0, 0, 0); raiseArms(wiz, 0.1); setEyes(wiz, 0);
      Object.assign(fx, { override: whiteMat, ghost: 1, static: lerp(0.6, 1, smooth(0, 0.8, L)), decay: 0, roll: 1 });
      return fx;
    } };
})();

for (const s of Object.values(SCENES)) { s.group.visible = false; scene.add(s.group); }

// ---------------- feedback pass ----------------
const quad = (mat) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)); return s; };
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fbMat = new THREE.ShaderMaterial({
  uniforms: { tPrev: { value: null }, tScene: { value: rtScene.texture }, uDecay: { value: 0 }, uZoom: { value: 1 }, uRot: { value: 0 },
    uWarp: { value: 0 }, uHue: { value: 0 }, uKaleido: { value: 0 }, uTime: { value: 0 }, uAspect: { value: W / H }, uMosh: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: /* glsl */`
  uniform sampler2D tPrev, tScene; uniform float uDecay, uZoom, uRot, uWarp, uHue, uKaleido, uTime, uAspect, uMosh;
  varying vec2 vUv;
  vec3 hue(vec3 c, float a){ const vec3 k = vec3(0.57735); float ca = cos(a); return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1. - ca); }
  void main(){
    vec2 c = vUv - .5; c.x *= uAspect;
    vec2 su = vUv;
    if (uKaleido > .5) {
      float r = length(c), a = atan(c.y, c.x), seg = 6.2831 / uKaleido;
      a = mod(a + uTime * .2, seg); a = abs(a - seg * .5);
      vec2 k = r * vec2(cos(a), sin(a)); k.x /= uAspect; su = k + .5;
      su = 1. - abs(1. - mod(su, 2.));
    }
    vec3 sc = texture2D(tScene, su).rgb;
    vec2 pc = c; float ca = cos(uRot), sa = sin(uRot);
    pc = mat2(ca, -sa, sa, ca) * pc * uZoom;
    pc += uWarp * vec2(sin(vUv.y * 23. + uTime * 3.), cos(vUv.x * 19. - uTime * 2.7));
    pc.x /= uAspect;
    vec3 pv = hue(texture2D(tPrev, pc + .5).rgb, uHue);
    vec2 e = vec2(1. / 270., 0.);
    float gx = dot(texture2D(tScene, su + e).rgb - texture2D(tScene, su - e).rgb, vec3(.33));
    float gy = dot(texture2D(tScene, su + e.yx * 1.8).rgb - texture2D(tScene, su - e.yx * 1.8).rgb, vec3(.33));
    vec3 mosh = texture2D(tPrev, vUv + vec2(gx, gy) * .06 + vec2(0., .004)).rgb;
    vec3 o = max(sc, pv * uDecay);
    o = mix(o, max(mosh, sc * .35), uMosh);
    gl_FragColor = vec4(o, 1.);
  }`,
});
const fbScene = quad(fbMat);

// ---------------- final post ----------------
const post = new THREE.ShaderMaterial({
  uniforms: { tFeed: { value: null }, tScene: { value: rtScene.texture }, uRes: { value: new THREE.Vector2(W, H) }, uTime: { value: 0 },
    uGlitch: { value: 0 }, uNeg: { value: 0 }, uStatic: { value: 0 }, uGhost: { value: 0 }, uRoll: { value: 0 },
    uPalMode: { value: 0 }, uPalMix: { value: 0 }, uPalShift: { value: 0 }, uFade: { value: 0 }, uWhite: { value: 0 }, uKick: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: /* glsl */`
  uniform sampler2D tFeed, tScene; uniform vec2 uRes; uniform float uTime, uGlitch, uNeg, uStatic, uGhost, uRoll, uPalMode, uPalMix, uPalShift, uFade, uWhite, uKick;
  varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float bayer(vec2 p){ int x = int(mod(p.x, 4.)), y = int(mod(p.y, 4.)); int i = x + y * 4;
    float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return m[i] / 16. - .5; }
  vec3 palette(float l, float mode){
    if (mode < 1.5) return .5 + .5 * cos(6.2831 * (l * 1.3 + uPalShift + vec3(0., .33, .67)));
    if (mode < 2.5) {
      vec3 c = mix(vec3(0.,0.,.08), vec3(.35,0.,.55), smoothstep(0., .25, l));
      c = mix(c, vec3(.9,.05,.2), smoothstep(.2, .5, l)); c = mix(c, vec3(1.,.75,.1), smoothstep(.45, .75, l));
      return mix(c, vec3(1.), smoothstep(.75, 1., l)); }
    if (mode < 3.5) return vec3(.15, 1., .35) * pow(clamp(l * 2.4, 0., 1.), .75);
    if (mode > 4.5) { // blood psychedelia: black -> red <-> magenta (cycling) -> bone white
      float s = sin(6.2831 * (l * .8 + uPalShift)) * .5 + .5;
      vec3 mid = mix(vec3(.85, .02, .08), vec3(.75, .05, .55), s);
      vec3 c = mix(vec3(0.), mid, smoothstep(.02, .45, l));
      return mix(c, vec3(1., .9, .92), smoothstep(.6, .95, l)); }
    return mix(mix(vec3(0.), vec3(.85, .03, .1), smoothstep(0., .28, l)), vec3(1., .9, .9), smoothstep(.45, .9, l));
  }
  void main(){
    vec2 px = floor(vUv * uRes), uv = vUv;
    float fr = floor(uTime * 30.);
    float row = floor(px.y / 2.);
    float jump = step(1. - uGlitch * .5, h(vec2(row, fr)));
    uv.x += (h(vec2(row * 1.7, fr)) - .5) * .3 * jump * uGlitch;
    float roll = fract(uTime * .37);
    float band = smoothstep(.06, 0., abs(vUv.y - roll)) * uRoll;
    uv.x += band * (h(vec2(row, fr + 3.)) - .5) * .08;
    float ca = (uGlitch * 5.) / uRes.x;   // chroma split only during glitch events
    vec3 c = vec3(texture2D(tFeed, uv + vec2(ca, 0.)).r, texture2D(tFeed, uv).g, texture2D(tFeed, uv - vec2(ca, 0.)).b);
    float l = dot(c, vec3(.3, .5, .2));
    c = mix(c, palette(l, uPalMode), uPalMix);
    float mask = dot(texture2D(tScene, uv).rgb, vec3(.33)) * uGhost;
    float n = h(px + fr * 7.31), n2 = h(floor(px / 2.) + fr * 3.1);
    float st = step(.56 - mask * .3, n) * (.55 + .45 * n2);
    st *= .8 + .2 * sin(px.y * .7 + uTime * 40.);
    c = mix(c, vec3(st) + band * .3, uStatic);
    c = mix(c, 1. - c, uNeg);
    c = mix(c, vec3(1.), uWhite); c *= 1. - uFade;
    c = floor(clamp(c, 0., 1.) * 31. + bayer(px) + .5) / 31.;
    gl_FragColor = vec4(c, 1.);
  }`,
});
const postScene = quad(post);

// ---------------- frame ----------------
let current = null, lastT = -1;
let acc0 = 0; for (const s of TL.sections) { s.t0 = acc0; acc0 += s.dur; }
const _q = new THREE.Quaternion();
function clearFeedback() { for (const r of [rtA, rtB]) { renderer.setRenderTarget(r); renderer.setClearColor(0, 1); renderer.clear(); } }
function renderAt(t) {
  t = clamp(t, 0, TOTAL - 1e-4);
  if (t < lastT) clearFeedback();
  lastT = t;
  let idx = 0; while (idx < TL.sections.length - 1 && t >= TL.sections[idx].t0 + TL.sections[idx].dur) idx++;
  const sec = TL.sections[idx], lt = t - sec.t0, S = SCENES[sec.scene];
  if (current !== S) { if (current) current.group.visible = false; S.group.visible = true; S.setup(); current = S; }
  G.uTime.value = t; G.uMelt.value = 0;
  const e = envAt(t), b = bassAt(t), k = kickAt(t);
  camera.fov = 64; camera.updateProjectionMatrix();
  const fx = S.update(lt, sec.drop || 0, sec, t, e, b, k) || {};
  camera.updateMatrixWorld();
  for (const bb of billboards) { if (!bb.parent) continue; bb.parent.getWorldQuaternion(_q); bb.quaternion.copy(_q.invert().multiply(camera.quaternion)); }
  const bu = bgMat.uniforms;
  bu.uInvProj.value.copy(camera.projectionMatrixInverse); bu.uCamWorld.value.copy(camera.matrixWorld);
  bu.uProjView.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  bu.uCamPos.value.copy(camera.position); bu.uTime.value = t;
  bu.uBass.value = b; bu.uKick.value = k; bu.uEnv.value = e;
  const sinceCut = idx > 0 ? lt : 99;
  const mosh = clamp(1 - sinceCut / 0.4) * 0.85;
  // 1) scene
  bgQuad.visible = !fx.override;
  scene.overrideMaterial = fx.override || null;
  renderer.setRenderTarget(rtScene); renderer.setClearColor(0, 1); renderer.clear(); renderer.render(scene, camera);
  scene.overrideMaterial = null;
  // 2) feedback
  const fu = fbMat.uniforms;
  fu.tPrev.value = rtA.texture; fu.uDecay.value = fx.decay ?? 0.6; fu.uZoom.value = fx.zoom ?? 0.99; fu.uRot.value = fx.rot ?? 0;
  fu.uWarp.value = fx.warp ?? 0.001; fu.uHue.value = fx.hue ?? 0; fu.uKaleido.value = fx.kaleido ?? 0; fu.uTime.value = t;
  fu.uMosh.value = fx.override ? 0 : mosh;
  renderer.setRenderTarget(rtB); renderer.render(fbScene, orthoCam);
  [rtA, rtB] = [rtB, rtA];
  // 3) post
  const pu = post.uniforms;
  pu.tFeed.value = rtA.texture; pu.uTime.value = t;
  pu.uGlitch.value = clamp(Math.max(fx.glitch || 0, mosh * 0.8));
  pu.uNeg.value = fx.neg || 0; pu.uStatic.value = fx.static || 0; pu.uGhost.value = fx.ghost || 0; pu.uRoll.value = fx.roll || 0;
  pu.uPalMode.value = fx.palMode ?? 0; pu.uPalMix.value = fx.palMix ?? 0; pu.uPalShift.value = fx.palShift ?? 0;
  pu.uFade.value = fx.fade || 0; pu.uWhite.value = fx.flashWhite || 0; pu.uKick.value = k;
  renderer.setRenderTarget(null); renderer.render(postScene, orthoCam);
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
