import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { Box, rand, rr, ri, pick, canvasTex, grime, segmentClear, clamp, mulberry32 } from './util.js';
import { makeHumanoid, animate } from './characters.js';

// ---------------------------------------------------------------------------
// MAP: an Old Dhaka block, ~170m x 116m.
//   Main road (with MRT viaduct overhead) runs along X at z=0.
//   A pedestrian bazaar lane runs along Z at x=0.
//   Rows of 3–7 storey buildings with 4m alleys between rows.
//   Side roads at |x| 77..85. Tall backdrop towers beyond the edges.
// ---------------------------------------------------------------------------
export const MAP = { minX: -85, maxX: 85, minZ: -58, maxZ: 58 };
const ROWS = [[7, 20], [24, 37], [41, 54]];

const PALETTE = ['#cfc6ae', '#a9bfa9', '#c99a82', '#9fb4c2', '#8e8e88', '#d6d6cf', '#8a4a36'];
const SIGNS = [
  ['মায়ের দোয়া হোটেল', 'Mayer Doa Hotel & Restaurant'],
  ['ভাই ভাই ইলেকট্রনিক্স', 'Bhai Bhai Electronics'],
  ['সততা ফার্মেসী', 'Sotota Pharmacy'],
  ['নিউ মডার্ন টেইলার্স', 'New Modern Tailors'],
  ['ঢাকা মোবাইল সার্ভিসিং', 'Mobile Servicing Center'],
  ['রাজধানী মিষ্টান্ন ভাণ্ডার', 'Rajdhani Sweets'],
  ['সোনালী ভ্যারাইটিজ স্টোর', 'Sonali Varieties'],
  ['চা ও নাস্তা', 'Tea & Snacks'],
  ['ফ্লেক্সিলোড এখানে', 'Flexiload Here'],
  ['পুরান ঢাকা কাচ্চি ঘর', 'Puran Dhaka Kacchi Ghor'],
  ['মা ট্রেডার্স', 'Maa Traders'],
  ['স্বপ্ন কুরিয়ার সার্ভিস', 'Shopno Courier Service'],
  ['বাবা জুয়েলার্স', 'Baba Jewellers'],
  ['নিউ স্টার প্রিন্টিং প্রেস', 'New Star Printing Press'],
];
const SIGN_BG = ['#b3141d', '#0f5c3a', '#1a3f8f', '#e0b31a', '#f2efe6', '#6a1b6f', '#0d0d0d'];
const BN_FONT = '"Kohinoor Bangla","Bangla Sangam MN","Noto Sans Bengali","Hind Siliguri",sans-serif';

function facadeTextures(base, seed) {
  const r = mulberry32(seed);
  const litW = [];
  const W = 512;
  const color = canvasTex(W, W, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, W, W);
    const brick = base === '#8a4a36';
    if (brick) {
      for (let y = 0; y < W; y += 8) for (let x = (y / 8) % 2 ? 0 : 10; x < W; x += 20) {
        g.fillStyle = `rgba(${90 + r() * 60},${40 + r() * 25},${30 + r() * 15},1)`; g.fillRect(x, y, 18, 6);
      }
    }
    for (let f = 0; f < 4; f++) {
      const fy = f * 128;
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, fy + 122, W, 6); // floor slab
      for (let b = 0; b < 4; b++) {
        const bx = b * 128;
        if (r() < 0.12) continue; // blank wall bay
        const wx = bx + 30, wy = fy + 30, ww = 68, wh = 70;
        const lit = r() < 0.38;
        const lc = lit ? pick(['#ffcf8a', '#ffd9a8', '#e9f4ff', '#dff0ff', '#9ab8ff', '#ffe0b0']) : null;
        // chhajja (concrete sunshade) + its shadow
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(wx - 8, wy - 6, ww + 16, 10);
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(wx - 8, wy - 10, ww + 16, 4);
        g.fillStyle = lit ? lc : `rgb(${14 + r() * 12},${16 + r() * 12},${20 + r() * 12})`;
        g.fillRect(wx, wy, ww, wh);
        if (lit && r() < 0.6) { g.fillStyle = pick(['#a02a2a', '#2a5a8a', '#c08a2a', '#4a7a4a', '#8a3a8a']); g.globalAlpha = 0.75; g.fillRect(wx + (r() < 0.5 ? 0 : ww * 0.5), wy, ww * 0.5, wh); g.globalAlpha = 1; }
        // grill
        g.strokeStyle = 'rgba(25,25,25,0.9)'; g.lineWidth = 2;
        for (let gx = wx; gx <= wx + ww; gx += 9) { g.beginPath(); g.moveTo(gx, wy); g.lineTo(gx, wy + wh); g.stroke(); }
        g.beginPath(); g.moveTo(wx, wy + wh / 2); g.lineTo(wx + ww, wy + wh / 2); g.stroke();
        if (r() < 0.5) { g.beginPath(); g.arc(wx + ww / 2, wy + wh / 2, 14, 0, Math.PI * 2); g.stroke(); }
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.strokeRect(wx, wy, ww, wh);
        if (lit) litW.push([wx, wy, ww, wh, lc]);
        // AC drip stain
        if (r() < 0.2) { g.fillStyle = 'rgba(30,40,30,0.3)'; g.fillRect(wx + ww - 10, wy + wh, 6, 60); }
      }
    }
    grime(g, W, W, 1.3, r);
  });
  const emissive = canvasTex(W, W, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, W);
    for (const [x, y, w, h, c] of litW) {
      g.fillStyle = c; g.globalAlpha = 0.55 + r() * 0.35; g.fillRect(x, y, w, h);
      g.globalAlpha = 1; g.fillStyle = '#000';
      for (let gx = x; gx <= x + w; gx += 9) g.fillRect(gx - 1, y, 2, h);
    }
  });
  return { color, emissive };
}

const signCache = new Map();
function signTexture(bn, en, bg) {
  const key = bn + bg;
  if (!signCache.has(key)) signCache.set(key, makeSign(bn, en, bg));
  return signCache.get(key);
}
function makeSign(bn, en, bg) {
  const light = bg === '#f2efe6' || bg === '#e0b31a';
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = light ? '#b3141d' : '#fff6d8';
    g.font = `bold 58px ${BN_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(bn, w / 2, 52);
    g.font = '600 20px Rajdhani, Arial'; g.fillStyle = light ? '#222' : '#ffe9a0';
    g.fillText(en.toUpperCase(), w / 2, 106);
    grime(g, w, h, 0.6);
  });
}

// Ground: planar reflection + analytic lamp pools. Wetness and puddles are driven by
// the weather system, so the "dry street" surreal beat is literally the same street with
// wetness pulled to zero.
const GroundShader = {
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    tMask: { value: null }, tDetail: { value: null }, tPuddle: { value: null },
    time: { value: 0 }, wetness: { value: 1 }, rain: { value: 1 },
    fogColor: { value: new THREE.Color() }, fogDensity: { value: 0.02 },
    ambient: { value: new THREE.Color(0.05, 0.055, 0.07) },
    lampPos: { value: [] }, lampCol: { value: [] }, lampCount: { value: 0 },
    mapMin: { value: new THREE.Vector2(MAP.minX, MAP.minZ) }, mapSize: { value: new THREE.Vector2(MAP.maxX - MAP.minX, MAP.maxZ - MAP.minZ) },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv; varying vec3 vWorld; varying float vFogDepth;
    void main(){
      vUv = textureMatrix * vec4(position,1.0);
      vec4 wp = modelMatrix * vec4(position,1.0); vWorld = wp.xyz;
      vec4 mv = viewMatrix * wp; vFogDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    #define MAXL 64
    uniform sampler2D tDiffuse, tMask, tDetail, tPuddle;
    uniform float time, wetness, rain, fogDensity; uniform vec3 fogColor, ambient;
    uniform vec4 lampPos[MAXL]; uniform vec3 lampCol[MAXL]; uniform int lampCount;
    uniform vec2 mapMin, mapSize;
    varying vec4 vUv; varying vec3 vWorld; varying float vFogDepth;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    vec2 ripple(vec2 p, float t){
      vec2 acc = vec2(0.0);
      for(int k=0;k<2;k++){
        vec2 q = p*(k==0?1.7:2.9) + float(k)*13.1;
        vec2 cell = floor(q); vec2 f = fract(q)-0.5;
        float h = hash(cell); float ph = fract(t*(0.9+h*0.6)+h);
        float d = length(f - (vec2(hash(cell+3.1),hash(cell+7.7))-0.5)*0.5);
        float ring = sin((d - ph*0.5)*60.0) * smoothstep(0.5,0.0,d) * (1.0-ph);
        acc += normalize(f+1e-4) * ring;
      }
      return acc;
    }
    void main(){
      vec2 muv = (vWorld.xz - mapMin)/mapSize;
      vec3 albedo = texture2D(tMask, muv).rgb;
      float det = texture2D(tDetail, vWorld.xz/3.0).r;
      albedo *= 0.65 + det*0.7;
      float puddle = smoothstep(0.45,0.75, texture2D(tPuddle, vWorld.xz/22.0).r + (det-0.5)*0.15);
      float wet = wetness;
      albedo *= mix(1.0, 0.55, wet*(0.5+puddle*0.5));
      vec3 light = ambient;
      for(int i=0;i<MAXL;i++){
        if(i>=lampCount) break;
        vec3 d = lampPos[i].xyz - vWorld; float dist2 = dot(d,d);
        float r = lampPos[i].w;
        float att = max(0.0, 1.0 - dist2/(r*r)); att *= att;
        light += lampCol[i] * att * (d.y/sqrt(dist2)+0.2);
      }
      vec3 col = albedo * light;
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = 0.04 + 0.96*pow(1.0 - max(V.y,0.0), 5.0);
      vec2 rp = ripple(vWorld.xz, time) * rain * wet;
      vec4 ruv = vUv; ruv.xy += (rp*0.012 + (det-0.5)*0.01*(1.0-puddle)) * ruv.w;
      vec3 refl = texture2DProj(tDiffuse, ruv).rgb;
      float k = wet * mix(0.22, 0.95, puddle) * max(fres, 0.35 + puddle*0.4);
      col = mix(col, refl, k) + refl*0.04*wet;
      float fog = 1.0 - exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
      gl_FragColor = vec4(mix(col, fogColor, fog), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

export class World {
  constructor(scene, renderer, quality = 1) {
    this.scene = scene;
    this.renderer = renderer;
    this.colliders = [];
    this.lamps = [];
    this.buildings = [];
    this.restricted = [];
    this.vehicles = [];
    this.animated = [];
    this.inst = {};
    this.cables = [];
    this.designed = {};
    this.shootables = []; // {pos, radius, onHit}
    this.cameras = [];
    this.wetness = 1;
    this.rain = 1;
    this.lightning = 0;
    this.quality = quality;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.initMaterials();
    this.buildSky();
    this.buildGround();
    this.buildBlocks();
    this.buildBoundary();
    this.buildStreets();
    this.buildMetro();
    this.buildTraffic();
    this.flushInstances();
    this.buildCableMesh();
    this.buildLightPool();
    this.buildNav();
  }

  // ---------------------------------------------------------------- materials
  initMaterials() {
    this.facades = PALETTE.map((c, i) => {
      const t = facadeTextures(c, 100 + i);
      return new THREE.MeshStandardMaterial({ map: t.color, emissiveMap: t.emissive, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.88 });
    });
    const roofTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#6d6a64'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${40 + rand() * 30},${45 + rand() * 30},${40 + rand() * 20},${rand() * 0.3})`; g.beginPath(); g.arc(rand() * w, rand() * h, 5 + rand() * 40, 0, 7); g.fill(); }
      grime(g, w, h, 1);
    });
    this.roofMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.55, metalness: 0.05 });
    this.darkMat = new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.9 });
    const walkTex = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#6a6660'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
      for (let i = 0; i <= w; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
      grime(g, w, h, 1);
    });
    walkTex.repeat.set(1, 1);
    this.walkMat = new THREE.MeshStandardMaterial({ map: walkTex, roughness: 0.28, metalness: 0.0 });
    this.concreteMat = new THREE.MeshStandardMaterial({ color: '#7d7a74', roughness: 0.8 });
    this.metalMat = new THREE.MeshStandardMaterial({ color: '#3a3d40', roughness: 0.45, metalness: 0.7 });
    this.tankMat = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.45 });
    this.woodMat = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.85 });
    const shutter = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#6a6e70'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 6) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, y, w, 2); }
      grime(g, w, h, 1.2);
    });
    this.shutterMat = new THREE.MeshStandardMaterial({ map: shutter, roughness: 0.4, metalness: 0.6 });
    this.shopLitMat = new THREE.MeshStandardMaterial({ color: '#2a2016', emissive: '#ffb86a', emissiveIntensity: 0.9, roughness: 0.9 });
    this.tubeMat = new THREE.MeshBasicMaterial({ color: '#f0fbff' });
    this.sodiumMat = new THREE.MeshBasicMaterial({ color: '#ffb35a' });
  }

  // ---------------------------------------------------------------- helpers
  addCollider(box) { this.colliders.push(box); return box; }
  instance(key, geo, mat, matrix) {
    if (!this.inst[key]) this.inst[key] = { geo, mat, list: [] };
    this.inst[key].list.push(matrix.clone());
  }
  flushInstances() {
    for (const k in this.inst) {
      const { geo, mat, list } = this.inst[k];
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false;
      this.group.add(im);
    }
  }
  lamp(pos, color, radius = 14, intensity = 1.6, opts = {}) {
    const l = { pos: pos.clone(), color: new THREE.Color(color), radius, intensity, broken: false, mesh: null, ...opts };
    this.lamps.push(l);
    return l;
  }
  groundAt(x, z, yRef, step = 0.55, pad = 0) {
    let g = 0;
    for (const b of this.colliders) {
      if (x < b.min.x - pad || x > b.max.x + pad || z < b.min.z - pad || z > b.max.z + pad) continue;
      if (b.max.y <= yRef + step && b.max.y > g) g = b.max.y;
    }
    return g;
  }
  isRestricted(p) { return this.restricted.some((b) => b.contains(p)); }
  lightAt(p) {
    let l = 0.12 + this.lightning;
    for (const lp of this.lamps) {
      if (lp.broken) continue;
      const d2 = lp.pos.distanceToSquared(p);
      const r = lp.radius * 0.8;
      if (d2 < r * r) l += (1 - d2 / (r * r)) * 0.9 * Math.min(lp.intensity, 1.5);
    }
    return clamp(l, 0, 1.2);
  }

  // ---------------------------------------------------------------- sky
  buildSky() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { time: { value: 0 }, flash: { value: 0 }, tint: { value: new THREE.Color('#ff9a52') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
      fragmentShader: `varying vec3 vP; uniform float time, flash; uniform vec3 tint;
        float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
        float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.0),f.x),f.y);}
        float fbm(vec2 p){float a=0.5,s=0.0;for(int i=0;i<5;i++){s+=a*n(p);p*=2.03;a*=0.5;}return s;}
        void main(){ vec3 d=normalize(vP); float y=max(d.y,0.0);
          vec3 top=vec3(0.035,0.045,0.06); vec3 hor=vec3(0.23,0.17,0.14);
          vec3 c=mix(hor, top, pow(y,0.45));
          float cl=fbm(d.xz/(d.y+0.15)*1.6+vec2(time*0.01,0.0));
          c += tint*0.06*cl*(1.0-y) + vec3(0.05,0.05,0.06)*cl*y;
          c += vec3(0.6,0.65,0.8)*flash*(0.3+cl);
          gl_FragColor=vec4(c,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
    this.scene.add(this.sky);

    // Environment map for wet-surface reflections: dark sky + neon/sodium blobs.
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 16, 8), new THREE.MeshBasicMaterial({ color: '#1a1a22', side: THREE.BackSide })));
    const cols = ['#ff9a40', '#ffb060', '#40ffd0', '#ff3050', '#e0f0ff', '#ffcc80'];
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(rr(2, 8), rr(1, 4)), new THREE.MeshBasicMaterial({ color: pick(cols), side: THREE.DoubleSide }));
      const a = rand() * Math.PI * 2; m.position.set(Math.cos(a) * 40, rr(-4, 14), Math.sin(a) * 40); m.lookAt(0, 0, 0);
      envScene.add(m);
    }
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(envScene, 0.04).texture;
    this.scene.environmentIntensity = 0.55;
  }

  // ---------------------------------------------------------------- ground
  buildGround() {
    const W = 1024, H = Math.round(1024 * (MAP.maxZ - MAP.minZ) / (MAP.maxX - MAP.minX));
    const sx = W / (MAP.maxX - MAP.minX), sz = H / (MAP.maxZ - MAP.minZ);
    const px = (x) => (x - MAP.minX) * sx, pz = (z) => (z - MAP.minZ) * sz;
    this.groundMask = canvasTex(W, H, (g) => {
      g.fillStyle = '#5c5953'; g.fillRect(0, 0, W, H);
      // mud and broken concrete
      for (let i = 0; i < 400; i++) { g.fillStyle = pick(['rgba(70,55,40,0.35)', 'rgba(40,40,38,0.3)', 'rgba(90,85,78,0.3)']); g.beginPath(); g.ellipse(rand() * W, rand() * H, rr(4, 30), rr(3, 20), rand() * 3, 0, 7); g.fill(); }
      // bazaar lane: old brick paving
      g.fillStyle = '#6a4d3e'; g.fillRect(px(-5), 0, px(5) - px(-5), H);
      // asphalt roads
      g.fillStyle = '#2b2c2e'; g.fillRect(0, pz(-4.8), W, pz(4.8) - pz(-4.8));
      g.fillRect(px(77), 0, px(85) - px(77), H); g.fillRect(px(-85), 0, px(-77) - px(-85), H);
      for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${10 + rand() * 30},${10 + rand() * 30},${12 + rand() * 30},0.5)`; g.beginPath(); g.ellipse(rand() * W, pz(rr(-4.5, 4.5)), rr(3, 18), rr(2, 6), 0, 0, 7); g.fill(); }
      // faded lane markings + zebra
      g.fillStyle = 'rgba(210,205,190,0.45)';
      for (let x = MAP.minX; x < MAP.maxX; x += 6) { if (rand() < 0.8) { g.fillRect(px(x), pz(-1.6), 3 * sx, 0.15 * sz); g.fillRect(px(x), pz(1.6), 3 * sx, 0.15 * sz); } }
      g.fillStyle = 'rgba(230,225,210,0.5)';
      for (let z = -4.2; z < 4.2; z += 0.9) g.fillRect(px(-4.5), pz(z), 9 * sx, 0.45 * sz);
      // drains
      g.fillStyle = 'rgba(15,15,14,0.8)';
      g.fillRect(0, pz(4.8), W, 0.35 * sz); g.fillRect(0, pz(-5.1), W, 0.35 * sz);
    });
    this.groundMask.wrapS = this.groundMask.wrapT = THREE.ClampToEdgeWrapping;
    const detail = canvasTex(256, 256, (g, w, h) => {
      const img = g.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) { const v = 110 + (rand() - 0.5) * 120; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      g.putImageData(img, 0, 0);
      g.filter = 'blur(1px)'; g.drawImage(g.canvas, 0, 0);
      for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.beginPath(); let x = rand() * w, y = rand() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += rr(-20, 20); y += rr(-20, 20); g.lineTo(x, y); } g.stroke(); }
    }, { linear: true });
    const puddle = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      g.filter = 'blur(10px)';
      for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(255,255,255,${rr(0.5, 1)})`; g.beginPath(); g.ellipse(rand() * w, rand() * h, rr(10, 42), rr(8, 26), rand() * 3, 0, 7); g.fill(); }
    }, { linear: true });

    const geo = new THREE.PlaneGeometry(MAP.maxX - MAP.minX + 40, MAP.maxZ - MAP.minZ + 40);
    const scale = 0.42 * this.quality;
    this.ground = new Reflector(geo, {
      textureWidth: Math.floor(innerWidth * devicePixelRatio * scale), textureHeight: Math.floor(innerHeight * devicePixelRatio * scale),
      clipBias: 0.003, shader: GroundShader,
    });
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = 0.0;
    const u = this.ground.material.uniforms;
    u.tMask.value = this.groundMask; u.tDetail.value = detail; u.tPuddle.value = puddle;
    this.group.add(this.ground);
  }

  // ---------------------------------------------------------------- buildings
  addBuilding(x0, x1, z0, z1, h, opts = {}) {
    const w = x1 - x0, d = z1 - z0;
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv;
    const ou = Math.floor(rand() * 4) * 0.25;
    for (let f = 0; f < 6; f++) {
      let su, sv;
      if (f < 2) { su = d / 12; sv = h / 12; } else if (f < 4) { su = w / 8; sv = d / 8; } else { su = w / 12; sv = h / 12; }
      for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        uv.setXY(i, uv.getX(i) * su + (f >= 2 && f < 4 ? 0 : ou), uv.getY(i) * sv);
      }
    }
    const style = opts.style ?? ri(0, PALETTE.length - 1);
    const fm = this.facades[style];
    const mesh = new THREE.Mesh(geo, [fm, fm, this.roofMat, this.darkMat, fm, fm]);
    mesh.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
    this.group.add(mesh);
    const box = this.addCollider(new Box(x0, 0, z0, x1, h, z1, { tag: 'building', climbable: opts.climbable !== false }));
    const b = { x0, x1, z0, z1, h, box, mesh, roof: [] };
    this.buildings.push(b);
    if (opts.noRoof) return b;
    this.decorateRoof(b, opts);
    return b;
  }

  decorateRoof(b, opts) {
    const { x0, x1, z0, z1, h } = b;
    const M = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const V = new THREE.Vector3();
    // parapet (low: steppable, so rooftop running stays fluid)
    const ph = 0.5, pt = 0.18;
    for (const [cx, cz, sx, sz] of [[(x0 + x1) / 2, z0 + pt / 2, x1 - x0, pt], [(x0 + x1) / 2, z1 - pt / 2, x1 - x0, pt], [x0 + pt / 2, (z0 + z1) / 2, pt, z1 - z0], [x1 - pt / 2, (z0 + z1) / 2, pt, z1 - z0]]) {
      M.compose(V.set(cx, h + ph / 2, cz), Q.identity(), new THREE.Vector3(sx, ph, sz));
      this.instance('parapet', new THREE.BoxGeometry(1, 1, 1), this.concreteMat, M);
      this.addCollider(Box.fromCenter(cx, h + ph / 2, cz, sx, ph, sz, { tag: 'parapet' }));
    }
    // stair head (chilekotha)
    const corner = opts.stair || [rand() < 0.5 ? x0 + 1.8 : x1 - 1.8, rand() < 0.5 ? z0 + 1.8 : z1 - 1.8];
    const sh = new THREE.Mesh(new THREE.BoxGeometry(3, 2.6, 3), this.concreteMat);
    sh.position.set(corner[0], h + 1.3, corner[1]);
    this.group.add(sh);
    this.addCollider(Box.fromCenter(corner[0], h + 1.3, corner[1], 3, 2.6, 3, { tag: 'stair' }));
    b.stair = new THREE.Vector3(corner[0], h, corner[1]);
    // door on stair head (dark rectangle), and a bare bulb
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2), this.darkMat);
    const dz = corner[1] < (z0 + z1) / 2 ? 1.51 : -1.51;
    door.position.set(corner[0], h + 1.0, corner[1] + dz); door.rotation.y = dz > 0 ? 0 : Math.PI;
    this.group.add(door);
    if (rand() < 0.5) this.lamp(new THREE.Vector3(corner[0], h + 2.4, corner[1] + dz * 1.1), '#ffd0a0', 7, 1.0, { bulb: true });

    // water tanks: the black polymer tanks on every Dhaka roof
    const nt = ri(1, 3);
    for (let i = 0; i < nt; i++) {
      const tx = rr(x0 + 1.2, x1 - 1.2), tz = rr(z0 + 1.2, z1 - 1.2);
      if (Math.abs(tx - corner[0]) < 2.6 && Math.abs(tz - corner[1]) < 2.6) continue;
      M.compose(V.set(tx, h + 0.4 + 0.75, tz), Q.identity(), new THREE.Vector3(1, 1, 1));
      this.instance('tank', new THREE.CylinderGeometry(0.7, 0.72, 1.5, 14), this.tankMat, M);
      M.compose(V.set(tx, h + 0.2, tz), Q.identity(), new THREE.Vector3(1.5, 0.4, 1.5));
      this.instance('tankstand', new THREE.BoxGeometry(1, 1, 1), this.metalMat, M);
      this.addCollider(Box.fromCenter(tx, h + 0.95, tz, 1.45, 1.9, 1.45, { tag: 'tank' }));
    }
    // unfinished next floor: column stubs with rebar
    if (!opts.clean && rand() < 0.4) {
      for (const [cx, cz] of [[x0 + 0.4, z0 + 0.4], [x1 - 0.4, z0 + 0.4], [x0 + 0.4, z1 - 0.4], [x1 - 0.4, z1 - 0.4]]) {
        M.compose(V.set(cx, h + 0.6, cz), Q.identity(), new THREE.Vector3(0.35, 1.2, 0.35));
        this.instance('stub', new THREE.BoxGeometry(1, 1, 1), this.concreteMat, M);
        for (let k = 0; k < 4; k++) this.cables.push([new THREE.Vector3(cx + rr(-0.12, 0.12), h + 1.2, cz + rr(-0.12, 0.12)), new THREE.Vector3(cx + rr(-0.3, 0.3), h + rr(1.8, 2.6), cz + rr(-0.3, 0.3)), 'rebar']);
      }
    }
    // clothesline with drying clothes / sarees
    if (rand() < 0.5 || opts.clothes) {
      const y = h + 1.8;
      const a = new THREE.Vector3(x0 + 0.6, y, rr(z0 + 1, z1 - 1)), c = new THREE.Vector3(x1 - 0.6, y, a.z + rr(-1, 1));
      this.cables.push([a, c, 'line']);
      const n = ri(3, 7);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const p = a.clone().lerp(c, t);
        const long = rand() < 0.35;
        const cloth = new THREE.Mesh(new THREE.PlaneGeometry(rr(0.5, 0.9), long ? 1.5 : 0.6), new THREE.MeshStandardMaterial({ color: pick(['#b01c3a', '#e0a020', '#2060b0', '#20a070', '#f0f0e8', '#8a2a8a', '#e05a20']), roughness: 0.8, side: THREE.DoubleSide }));
        cloth.geometry.translate(0, -(long ? 0.75 : 0.3), 0);
        cloth.position.copy(p); cloth.rotation.y = Math.atan2(c.x - a.x, c.z - a.z) + Math.PI / 2;
        this.group.add(cloth);
        this.animated.push({ type: 'cloth', mesh: cloth, ph: rand() * 6 });
      }
    }
    if (rand() < 0.3) {
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 6, 0, Math.PI * 2, 0, 0.9), this.metalMat);
      dish.position.set(rr(x0 + 1, x1 - 1), h + 1.2, rr(z0 + 1, z1 - 1)); dish.rotation.x = -0.8; this.group.add(dish);
    }
    if (rand() < 0.35) {
      for (let i = 0; i < ri(3, 8); i++) {
        M.compose(V.set(rr(x0 + 0.6, x1 - 0.6), h + 0.25, z1 - 0.5), Q.identity(), new THREE.Vector3(0.4, 0.5, 0.4));
        this.instance('pot', new THREE.CylinderGeometry(0.5, 0.35, 1, 8), new THREE.MeshStandardMaterial({ color: '#8a4a2a', roughness: 0.9 }), M);
        M.compose(V.set(0, 0.45, 0).add(new THREE.Vector3().setFromMatrixPosition(M)), Q.identity(), new THREE.Vector3(0.45, 0.45, 0.45));
        this.instance('plant', new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#2d5a22', roughness: 0.8 }), M);
      }
    }
  }

  addFrontage(b, face) {
    // Ground-floor shops on the street-facing side: shutters, lit interiors, Bangla signboards, awnings, balconies above.
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3();
    const along = face === 'z0' || face === 'z1';
    const a0 = along ? b.x0 : b.z0, a1 = along ? b.x1 : b.z1;
    const off = face === 'z0' ? b.z0 - 0.02 : face === 'z1' ? b.z1 + 0.02 : face === 'x0' ? b.x0 - 0.02 : b.x1 + 0.02;
    const nrm = face === 'z0' ? new THREE.Vector3(0, 0, -1) : face === 'z1' ? new THREE.Vector3(0, 0, 1) : face === 'x0' ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(1, 0, 0);
    const rotY = Math.atan2(nrm.x, nrm.z);
    const pos = (s, y, o = 0) => along ? new THREE.Vector3(s, y, off + nrm.z * o) : new THREE.Vector3(off + nrm.x * o, y, s);
    const shops = Math.max(1, Math.floor((a1 - a0) / 3.6));
    const sw = (a1 - a0) / shops;
    for (let i = 0; i < shops; i++) {
      const s = a0 + sw * (i + 0.5);
      const open = rand() < 0.6;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(sw - 0.4, 2.4), open ? this.shopLitMat : this.shutterMat);
      p.position.copy(pos(s, 1.25, 0.01)); p.rotation.y = rotY; this.group.add(p);
      if (open) {
        const tube = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.04), this.tubeMat);
        tube.position.copy(pos(s, 2.35, 0.1)); tube.rotation.y = rotY; this.group.add(tube);
        if (rand() < 0.35) this.lamp(pos(s, 2.3, 1.2), '#ffd8a8', 6, 0.8, { shop: true });
      }
      if (rand() < 0.75) {
        const [bn, en] = pick(SIGNS);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw - 0.3, (sw - 0.3) / 4), new THREE.MeshStandardMaterial({ map: signTexture(bn, en, pick(SIGN_BG)), emissive: '#ffffff', emissiveIntensity: rand() < 0.5 ? 0.35 : 0.08, roughness: 0.6 }));
        sign.material.emissiveMap = sign.material.map;
        sign.position.copy(pos(s, 2.95, 0.06)); sign.rotation.y = rotY; this.group.add(sign);
      }
      // tin / tarp awning
      if (rand() < 0.5) {
        const aw = new THREE.Mesh(new THREE.PlaneGeometry(sw - 0.2, 1.3), new THREE.MeshStandardMaterial({ color: pick(['#2a5ab0', '#d06a20', '#6a6e70', '#2a8a4a']), roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }));
        aw.position.copy(pos(s, 2.55, 0.6)); aw.rotation.set(0, rotY, 0); aw.rotateX(-Math.PI / 2 + 0.35); this.group.add(aw);
      }
    }
    // balconies with grills on upper floors
    const floors = Math.floor(b.h / 3);
    for (let f = 1; f < floors; f++) {
      for (let s = a0 + 2.2; s < a1 - 1.5; s += rr(3.2, 5)) {
        if (rand() < 0.45) continue;
        const bw = rr(1.8, 2.8);
        const c = pos(s, f * 3 + 0.05, 0.55);
        M.compose(c, Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(bw, 0.12, 1.1));
        this.instance('balc', new THREE.BoxGeometry(1, 1, 1), this.concreteMat, M);
        const g = pos(s, f * 3 + 0.6, 1.08);
        M.compose(g, Q, new THREE.Vector3(bw, 1.0, 1));
        this.instance('grill', new THREE.PlaneGeometry(1, 1), GRILL_MAT, M);
        if (rand() < 0.3) {
          // AC unit
          M.compose(pos(s + bw / 2 + 0.6, f * 3 + 1.4, 0.3), Q, new THREE.Vector3(0.8, 0.55, 0.55));
          this.instance('ac', new THREE.BoxGeometry(1, 1, 1), AC_MAT, M);
        }
      }
    }
  }

  buildBlocks() {
    const designedRow = { sx: 1, sz: 1, row: 1 };
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
      ROWS.forEach(([r0, r1], row) => {
        const isDesigned = sx === designedRow.sx && sz === designedRow.sz && row === designedRow.row;
        let lots = [];
        if (isDesigned) {
          lots = [[6.5, 16.5, 12], [18.3, 29.3, 15], [31, 43, 18], [44.8, 54.8, 15], [56.8, 65.8, 12], [67.8, 75.8, 12]];
        } else {
          let x = 6.5;
          while (x < 72) {
            const w = Math.min(rr(8, 12.5), 76 - x);
            if (w < 5) break;
            lots.push([x, x + w, ri(3, 7) * 3]);
            x += w + (rand() < 0.35 ? rr(1.1, 2.4) : rr(0.2, 0.6));
          }
        }
        lots.forEach(([a, c, h], idx) => {
          const setback = isDesigned ? 0 : rr(0, 1.4);
          const X0 = sx > 0 ? a : -c, X1 = sx > 0 ? c : -a;
          const nearZ = r0, farZ = r1 - setback;
          const Z0 = sz > 0 ? nearZ : -farZ, Z1 = sz > 0 ? farZ : -nearZ;
          const opts = {};
          if (isDesigned && idx === 2) { opts.stair = [33, 34.5]; opts.clean = true; opts.style = 4; }
          if (isDesigned && idx === 5) { opts.stair = [73.5, 26.5]; opts.clean = true; }
          if (isDesigned && idx === 1) { opts.clothes = true; }
          const b = this.addBuilding(X0, X1, Z0, Z1, h, opts);
          b.q = [sx, sz, row, idx];
          this.addFrontage(b, sz > 0 ? 'z0' : 'z1');
          if (row > 0 || rand() < 0.3) this.addFrontage(b, sz > 0 ? 'z1' : 'z0');
          if (idx === 0) this.addFrontage(b, sx > 0 ? 'x0' : 'x1');
          if (isDesigned) (this.designed.chain ||= [])[idx] = b;
        });
      });
    }
    const chain = this.designed.chain;
    const T = chain[2];
    this.designed.target = T;
    this.designed.meeting = new THREE.Vector3(38, T.h, 30.5);
    this.designed.generator = new THREE.Vector3(41.5, T.h, 26.2);
    this.designed.carPos = new THREE.Vector3(81, 0, 22);
    this.designed.boothPos = new THREE.Vector3(49, 0, 39);
    this.designed.exitDoor = new THREE.Vector3(71.8, 0, 23.4);
    this.designed.extraction = new THREE.Vector3(-80, 0, -8);

    // Restricted: the Cartographer's roof, his neighbours' roofs, and the guarded back lane.
    this.restricted.push(new Box(18.3, T.h - 4.5, 24, 55, 40, 37));
    this.restricted.push(new Box(28, -1, 37, 47, 4, 41));

    // Rahman Telecom sign — hero neon on the target building facing the alley.
    const signTex = canvasTex(1024, 256, (g, w, h) => {
      g.fillStyle = '#07120e'; g.fillRect(0, 0, w, h);
      g.shadowColor = '#40ffc0'; g.shadowBlur = 30; g.fillStyle = '#b8ffe8';
      g.font = `bold 118px ${BN_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('রহমান টেলিকম', w / 2, 105);
      g.shadowColor = '#ff3050'; g.fillStyle = '#ffd0d8'; g.font = '600 44px Rajdhani, Arial';
      g.fillText('RAHMAN TELECOM · SINCE 1998', w / 2, 212);
    });
    const hero = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false }));
    hero.material.color.setScalar(1.6);
    hero.position.set(37, 13.5, 23.9); hero.rotation.y = Math.PI;
    this.group.add(hero);
    this.designed.heroSign = hero;
    this.lamp(new THREE.Vector3(37, 12, 22), '#40ffc0', 12, 1.4, { neon: true });

    // Generator + floodlight on the meeting roof (environmental assassination opportunity).
    const gen = new THREE.Group();
    const gbody = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.1), new THREE.MeshStandardMaterial({ color: '#5a6a3a', roughness: 0.6, metalness: 0.4 }));
    gbody.position.y = 0.6;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10), new THREE.MeshStandardMaterial({ color: '#8a2a1a', roughness: 0.5, metalness: 0.4 }));
    drum.position.set(1.2, 0.45, 0.2);
    gen.add(gbody, drum);
    gen.position.copy(this.designed.generator);
    this.group.add(gen);
    this.designed.genMesh = gen;
    this.addCollider(Box.fromCenter(gen.position.x, T.h + 0.6, gen.position.z, 1.8, 1.2, 1.1, { tag: 'generator' }));
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2), this.metalMat);
    pole.position.set(35, T.h + 1.6, 27); this.group.add(pole);
    const flood = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.2), new THREE.MeshBasicMaterial({ color: '#f4f8ff' }));
    flood.position.set(35, T.h + 3.2, 27); this.group.add(flood);
    this.designed.flood = this.lamp(new THREE.Vector3(35, T.h + 3.1, 27.5), '#e8f0ff', 16, 2.2, { mesh: flood, generator: true });
    this.cables.push([new THREE.Vector3(35, T.h + 3.1, 27), this.designed.generator.clone().add(new THREE.Vector3(0, 1.1, 0)), 'cable']);
    // plastic chairs for the meeting
    for (const [cx, cz] of [[37.2, 30.2], [38.8, 30.8]]) {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), new THREE.MeshStandardMaterial({ color: '#b02020', roughness: 0.4 }));
      ch.position.set(cx, T.h + 0.22, cz); this.group.add(ch);
    }

    // Security booth with the CCTV terminal in the back lane.
    const bp = this.designed.boothPos;
    const booth = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.5, 2), new THREE.MeshStandardMaterial({ color: '#c8c0a0', roughness: 0.7 }));
    booth.position.set(bp.x, 1.25, bp.z); this.group.add(booth);
    this.addCollider(Box.fromCenter(bp.x, 1.25, bp.z, 2.2, 2.5, 2, { tag: 'booth' }));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), new THREE.MeshBasicMaterial({ color: '#6ad0ff', toneMapped: false }));
    screen.position.set(bp.x - 1.12, 1.4, bp.z); screen.rotation.y = -Math.PI / 2; this.group.add(screen);
    this.lamp(new THREE.Vector3(bp.x - 1.6, 2.2, bp.z), '#9ad8ff', 6, 0.8);

    // CCTV cameras on the target building.
    for (const c of [{ p: new THREE.Vector3(31.4, 4.2, 23.6), yaw: Math.PI * 0.85, sweep: 0.7 }, { p: new THREE.Vector3(42.6, 4.2, 37.4), yaw: 0.2, sweep: 0.9 }]) {
      const m = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.34), new THREE.MeshStandardMaterial({ color: '#dcdcd8', roughness: 0.4 }));
      body.position.z = 0.15;
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.02), new THREE.MeshBasicMaterial({ color: '#ff2020' }));
      led.position.set(0, 0.05, 0.33);
      m.add(body, led); m.position.copy(c.p); this.group.add(m);
      this.cameras.push({ ...c, mesh: m, led, base: c.yaw, t: rand() * 6, alive: true, awareness: 0 });
    }
  }

  buildBoundary() {
    // Outer towers: skyline and hard play-space boundary (not climbable).
    const ring = [];
    for (let x = MAP.minX - 20; x < MAP.maxX + 20; x += rr(10, 16)) { ring.push([x, MAP.maxZ + 0.5, 'n']); ring.push([x, MAP.minZ - 0.5, 's']); }
    for (let z = MAP.minZ; z < MAP.maxZ; z += rr(10, 16)) { ring.push([MAP.maxX + 0.5, z, 'e']); ring.push([MAP.minX - 0.5, z, 'w']); }
    for (const [x, z, s] of ring) {
      const w = rr(10, 16), d = rr(10, 18), h = ri(6, 16) * 3;
      let x0, x1, z0, z1;
      if (s === 'n') { x0 = x; x1 = x + w; z0 = z; z1 = z + d; }
      else if (s === 's') { x0 = x; x1 = x + w; z0 = z - d; z1 = z; }
      else if (s === 'e') { x0 = x; x1 = x + d; z0 = z; z1 = z + w; }
      else { x0 = x - d; x1 = x; z0 = z; z1 = z + w; }
      this.addBuilding(x0, x1, z0, z1, h, { climbable: false, noRoof: true });
    }
    // invisible hard walls
    const H = 80;
    this.addCollider(new Box(MAP.minX - 30, -5, MAP.maxZ, MAP.maxX + 30, H, MAP.maxZ + 30, { climbable: false, tag: 'bound' }));
    this.addCollider(new Box(MAP.minX - 30, -5, MAP.minZ - 30, MAP.maxX + 30, H, MAP.minZ, { climbable: false, tag: 'bound' }));
    this.addCollider(new Box(MAP.maxX, -5, MAP.minZ - 30, MAP.maxX + 30, H, MAP.maxZ + 30, { climbable: false, tag: 'bound' }));
    this.addCollider(new Box(MAP.minX - 30, -5, MAP.minZ - 30, MAP.minX, H, MAP.maxZ + 30, { climbable: false, tag: 'bound' }));

    // Distant mosque silhouette with green minaret lights, over the south skyline.
    const mg = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(9, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b8b8b0', roughness: 0.6 }));
    dome.position.y = 42;
    const baseM = new THREE.Mesh(new THREE.BoxGeometry(22, 42, 22), new THREE.MeshStandardMaterial({ color: '#a8a49a', roughness: 0.8 }));
    baseM.position.y = 21;
    mg.add(dome, baseM);
    for (const s of [-1, 1]) {
      const mn = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.3, 66, 10), baseM.material);
      mn.position.set(s * 14, 33, 0);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 6, 16), new THREE.MeshBasicMaterial({ color: '#30ff70' }));
      ring.rotation.x = Math.PI / 2; ring.position.set(s * 14, 60, 0);
      mg.add(mn, ring);
    }
    mg.position.set(-40, 0, -120); this.group.add(mg);
  }

  // ---------------------------------------------------------------- streets
  buildStreets() {
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3();
    // raised sidewalks along the main road
    for (const s of [-1, 1]) {
      for (const [a, b] of [[MAP.minX, -5], [5, MAP.maxX]]) {
        const geo = new THREE.BoxGeometry(b - a, 0.18, 2.1);
        worldUV(geo, b - a, 0.18, 2.1, 2);
        const sw = new THREE.Mesh(geo, this.walkMat);
        sw.position.set((a + b) / 2, 0.09, s * 5.8); this.group.add(sw);
        this.addCollider(Box.fromCenter((a + b) / 2, 0.09, s * 5.8, b - a, 0.18, 2.1, { tag: 'curb' }));
      }
    }
    // MRT pillars on the median + electric poles + tangled cables
    const poleGeo = new THREE.CylinderGeometry(0.11, 0.14, 9, 8);
    const polesN = [], polesS = [];
    for (let x = MAP.minX + 4; x < MAP.maxX; x += rr(11, 14)) {
      for (const s of [-1, 1]) {
        const p = new THREE.Vector3(x + rr(-0.5, 0.5), 0, s * 6.6);
        M.compose(V.set(p.x, 4.5, p.z), Q.identity(), new THREE.Vector3(1, 1, 1));
        this.instance('pole', poleGeo, this.concreteMat, M);
        this.addCollider(Box.fromCenter(p.x, 4.5, p.z, 0.28, 9, 0.28, { tag: 'pole' }));
        (s > 0 ? polesN : polesS).push(p);
        if (rand() < 0.25) {
          // pole-top transformer
          M.compose(V.set(p.x, 6.8, p.z + s * 0.3), Q.identity(), new THREE.Vector3(0.7, 0.9, 0.55));
          this.instance('transformer', new THREE.BoxGeometry(1, 1, 1), this.metalMat, M);
        }
        if (Math.abs(x) % 16 < 8) {
          // sodium streetlamp arm
          const arm = new THREE.Vector3(p.x, 7.6, p.z - s * 1.8);
          this.cables.push([new THREE.Vector3(p.x, 7.4, p.z), arm, 'arm']);
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), this.sodiumMat);
          bulb.position.copy(arm).add(new THREE.Vector3(0, -0.15, 0)); this.group.add(bulb);
          const lp = this.lamp(arm.clone().add(new THREE.Vector3(0, -0.3, 0)), '#ffab4a', 17, 1.9, { mesh: bulb, street: true });
          this.shootables.push({ pos: bulb.position, radius: 0.35, kind: 'lamp', lamp: lp });
        }
      }
    }
    for (const poles of [polesN, polesS]) {
      for (let i = 0; i < poles.length - 1; i++) {
        const a = poles[i], b = poles[i + 1];
        for (let k = 0; k < ri(6, 14); k++) {
          const ya = rr(5.4, 8.6), yb = rr(5.4, 8.6);
          this.cables.push([a.clone().setY(ya).add(new THREE.Vector3(0, 0, rr(-0.2, 0.2))), b.clone().setY(yb).add(new THREE.Vector3(0, 0, rr(-0.2, 0.2))), 'cable', rr(0.3, 1.6)]);
        }
        // service drops into buildings
        if (rand() < 0.7) {
          const s = Math.sign(a.z);
          for (let k = 0; k < ri(2, 5); k++) this.cables.push([a.clone().setY(rr(6, 8)), new THREE.Vector3(a.x + rr(-4, 4), rr(4, 10), s * 7.05), 'cable', rr(0.1, 0.5)]);
        }
      }
    }
    // cross-alley cables at the alleys, and across the bazaar lane
    for (const zc of [22, 39, -22, -39]) for (let x = MAP.minX + 8; x < MAP.maxX - 8; x += rr(3, 7)) {
      this.cables.push([new THREE.Vector3(x, rr(4, 9), zc - 2), new THREE.Vector3(x + rr(-3, 3), rr(4, 9), zc + 2), 'cable', rr(0.1, 0.6)]);
    }
    for (let z = MAP.minZ + 7; z < MAP.maxZ - 5; z += rr(2, 5)) {
      if (Math.abs(z) < 7) continue;
      this.cables.push([new THREE.Vector3(-6.5, rr(4, 10), z), new THREE.Vector3(6.5, rr(4, 10), z + rr(-2, 2)), 'cable', rr(0.2, 0.9)]);
    }

    // alley lamps: bare bulbs on brackets
    for (const zc of [22, 39, -22, -39, 56, -56]) for (let x = MAP.minX + 10; x < MAP.maxX - 6; x += rr(14, 22)) {
      const zz = zc + (rand() < 0.5 ? -1.8 : 1.8);
      if (Math.abs(zz) > 57) continue;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshBasicMaterial({ color: pick(['#fff2d8', '#e0f4ff']) }));
      bulb.position.set(x, 3.4, zz); this.group.add(bulb);
      const lp = this.lamp(bulb.position.clone(), bulb.material.color.getHexString() === 'fff2d8' ? '#ffcf90' : '#cfe8ff', 9, 1.1, { mesh: bulb, bulb: true });
      this.shootables.push({ pos: bulb.position, radius: 0.25, kind: 'lamp', lamp: lp });
    }

    // Bazaar: colourful tarps overhead, stalls, crates and produce.
    const tarpCols = ['#1f5fbf', '#e0701a', '#2a8a4a', '#c0203a', '#d0b020'];
    for (let z = 8; z < 54; z += rr(3, 5)) for (const sz of [-1, 1]) {
      if (rand() < 0.2) continue;
      const tarp = new THREE.Mesh(new THREE.PlaneGeometry(rr(4, 6.5), rr(2.5, 4)), new THREE.MeshStandardMaterial({ color: pick(tarpCols), roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
      tarp.position.set(rr(-1.5, 1.5), rr(3.4, 4.2), sz * z); tarp.rotation.x = -Math.PI / 2 + rr(-0.15, 0.15); tarp.rotation.z = rr(-0.2, 0.2);
      this.group.add(tarp);
      this.animated.push({ type: 'tarp', mesh: tarp, ph: rand() * 6, base: tarp.rotation.x });
    }
    for (let z = 9; z < 53; z += rr(4, 7)) for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
      if (rand() < 0.3) continue;
      this.addStall(sx * 3.6, sz * z, sx);
    }
    // tea stall with benches at the main-road corner (intel #1 lives here)
    this.teaStall = this.addTeaStall(new THREE.Vector3(-9, 0, 8.2));
    // parked rickshaws and motorbikes on the curbs
    for (let i = 0; i < 16; i++) {
      const s = rand() < 0.5 ? -1 : 1;
      const x = rr(MAP.minX + 8, MAP.maxX - 8);
      if (Math.abs(x) < 7) continue;
      const r = makeRickshaw();
      r.position.set(x, 0, s * 4.1); r.rotation.y = rr(-0.3, 0.3) + (s > 0 ? Math.PI / 2 : -Math.PI / 2);
      this.group.add(r);
      this.addCollider(Box.fromCenter(x, 0.7, s * 4.1, 1.2, 1.4, 1.2, { tag: 'prop' }));
    }
    // garbage, crates, sacks in alleys: cover + clutter
    for (let i = 0; i < 60; i++) {
      const zc = pick([22, 39, -22, -39]);
      const x = rr(MAP.minX + 8, MAP.maxX - 8), z = zc + rr(-1.7, 1.7);
      if (Math.abs(x) < 6) continue;
      const s = rr(0.6, 1.2);
      const t = pick(['crate', 'sack', 'drum']);
      const mat = t === 'crate' ? this.woodMat : t === 'sack' ? SACK_MAT : DRUM_MAT;
      const geo = t === 'drum' ? new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10) : new THREE.BoxGeometry(s, s * 0.8, s);
      const m = new THREE.Mesh(geo, mat); const hh = t === 'drum' ? 0.9 : s * 0.8;
      m.position.set(x, hh / 2, z); m.rotation.y = rand() * 3; this.group.add(m);
      this.addCollider(Box.fromCenter(x, hh / 2, z, t === 'drum' ? 0.6 : s * 0.9, hh, t === 'drum' ? 0.6 : s * 0.9, { tag: 'cover' }));
    }
    // Janus mark: stencilled half-faces, a recurring motif the player will start to notice.
    const janus = canvasTex(128, 128, (g) => {
      g.clearRect(0, 0, 128, 128); g.strokeStyle = 'rgba(220,220,210,0.7)'; g.lineWidth = 5;
      g.beginPath(); g.arc(64, 64, 44, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(64, 20); g.lineTo(64, 108); g.stroke();
      g.fillStyle = 'rgba(220,220,210,0.7)'; g.beginPath(); g.arc(46, 56, 5, 0, 7); g.fill(); g.beginPath(); g.arc(82, 56, 5, 0, 7); g.fill();
      g.beginPath(); g.arc(46, 80, 12, 0, Math.PI); g.stroke(); g.beginPath(); g.arc(82, 86, 12, Math.PI, 0); g.stroke();
    }, { clamp: true });
    for (const [x, y, z, ry] of [[20, 1.8, 23.95, Math.PI], [-30, 2.0, 7.02, Math.PI], [60, 1.6, 36.97, 0], [-12, 1.9, 40.9, Math.PI]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshStandardMaterial({ map: janus, transparent: true, roughness: 0.9 }));
      m.position.set(x, y, z); m.rotation.y = ry; this.group.add(m);
    }
    // Bangladesh flag on a roof
    const flagTex = canvasTex(160, 96, (g) => { g.fillStyle = '#006a4e'; g.fillRect(0, 0, 160, 96); g.fillStyle = '#f42a41'; g.beginPath(); g.arc(72, 48, 29, 0, 7); g.fill(); });
    const fb = this.buildings.find((b) => b.q && b.q[0] === -1 && b.q[1] === 1 && b.q[2] === 0);
    if (fb) {
      const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4), this.metalMat);
      fp.position.set((fb.x0 + fb.x1) / 2, fb.h + 2, fb.z0 + 1); this.group.add(fp);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.96, 10, 1), new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 }));
      flag.geometry.translate(0.8, 0, 0);
      flag.position.set(fp.position.x, fb.h + 3.5, fp.position.z); this.group.add(flag);
      this.animated.push({ type: 'flag', mesh: flag, ph: 0, base: flag.geometry.attributes.position.array.slice() });
    }
  }

  addStall(x, z, side) {
    const g = new THREE.Group();
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 1.1), this.woodMat); table.position.y = 0.4; g.add(table);
    const prodCols = ['#d02a1a', '#e8a020', '#3a8a2a', '#8a4a1a', '#e8e0c0', '#6a2a6a'];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(rr(0.07, 0.14), 6, 5), new THREE.MeshStandardMaterial({ color: pick(prodCols), roughness: 0.5 }));
      m.position.set(rr(-0.8, 0.8), 0.85, rr(-0.45, 0.45)); g.add(m);
    }
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06), new THREE.MeshBasicMaterial({ color: '#fff0d0' }));
    bulb.position.set(0, 2.1, 0); g.add(bulb);
    g.position.set(x, 0, z); g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    this.group.add(g);
    this.addCollider(Box.fromCenter(x, 0.4, z, 1.2, 0.8, 1.9, { tag: 'cover' }));
    if (rand() < 0.35) this.lamp(new THREE.Vector3(x, 2.1, z), '#ffd8a0', 6, 0.9, { bulb: true });
  }

  addTeaStall(p) {
    const g = new THREE.Group();
    const hut = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 1.6), this.woodMat); hut.position.y = 1.1; g.add(hut);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.06, 2.4), this.metalMat); roof.position.set(0, 2.3, -0.3); roof.rotation.x = 0.12; g.add(roof);
    const kettle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.25, 10), this.metalMat); kettle.position.set(0.5, 1.1 + 1.12, 0.1); g.add(kettle);
    for (let i = 0; i < 6; i++) { const j = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 8), new THREE.MeshStandardMaterial({ color: '#d8e8f0', roughness: 0.1, transparent: true, opacity: 0.6 })); j.position.set(-0.8 + i * 0.28, 2.33 - 0.2, -0.75); g.add(j); }
    const bananas = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshStandardMaterial({ color: '#d8c030' })); bananas.scale.set(1, 1.4, 1); bananas.position.set(-0.9, 1.9, -0.9); g.add(bananas);
    for (const bz of [-1.3, 1.3]) { const bench = new THREE.Mesh(new THREE.BoxGeometry(2, 0.45, 0.35), this.woodMat); bench.position.set(bz > 0 ? 1.8 : -1.8, 0.22, -1.4); bench.rotation.y = Math.PI / 2; g.add(bench); }
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.1), new THREE.MeshStandardMaterial({ color: '#3a2a1a' })); radio.position.set(-0.4, 2.25, 0.3); g.add(radio);
    g.position.copy(p); g.rotation.y = Math.PI; this.group.add(g);
    this.addCollider(Box.fromCenter(p.x, 1.1, p.z, 2.2, 2.2, 1.6, { tag: 'stall' }));
    const lp = this.lamp(new THREE.Vector3(p.x, 2.2, p.z - 1.2), '#ffcf8a', 7, 1.2, { bulb: true });
    return { group: g, pos: p.clone(), radioPos: new THREE.Vector3(p.x + 0.4, 2.25, p.z - 0.3), phonePos: new THREE.Vector3(p.x - 1.8, 0.5, p.z - 1.4), lamp: lp };
  }

  // ---------------------------------------------------------------- metro
  buildMetro() {
    const deckY = 11.5;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(MAP.maxX - MAP.minX + 40, 1.3, 8.4), this.concreteMat);
    deck.position.set(0, deckY, 0); this.group.add(deck);
    this.addCollider(new Box(MAP.minX - 20, deckY - 0.65, -4.2, MAP.maxX + 20, deckY + 0.65, 4.2, { tag: 'deck' }));
    // side barriers (visual) + pillars
    for (const s of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(MAP.maxX - MAP.minX + 40, 1.1, 0.2), this.concreteMat);
      bar.position.set(0, deckY + 1.2, s * 4.1); this.group.add(bar);
    }
    for (let x = MAP.minX + 8; x < MAP.maxX; x += 24) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, deckY - 0.6, 1.8), this.concreteMat);
      p.position.set(x, (deckY - 0.6) / 2, 0); this.group.add(p);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 7), this.concreteMat); cap.position.set(x, deckY - 1.1, 0); this.group.add(cap);
      this.addCollider(Box.fromCenter(x, (deckY - 0.6) / 2, 0, 1.6, deckY - 0.6, 1.8, { tag: 'pillar' }));
    }
    // train
    const train = new THREE.Group();
    const winTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#d8dcd8'; g.fillRect(0, 0, w, h); g.fillStyle = '#b01c2a'; g.fillRect(0, 44, w, 6); for (let x = 10; x < w; x += 40) { g.fillStyle = '#fff4d8'; g.fillRect(x, 12, 28, 24); } }, {});
    for (let i = 0; i < 6; i++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(19.5, 3.2, 3), new THREE.MeshStandardMaterial({ map: winTex, emissiveMap: winTex, emissive: '#ffffff', emissiveIntensity: 0.25, roughness: 0.4, metalness: 0.4 }));
      car.position.set(i * 20, 0, 0); train.add(car);
    }
    train.position.set(-400, deckY + 2.3, 1.8);
    this.group.add(train);
    this.metro = { mesh: train, x: -400, speed: 22, wait: 20 };
  }

  // ---------------------------------------------------------------- traffic
  buildTraffic() {
    const lanes = [{ z: -3.4, dir: 1 }, { z: -1.3, dir: 1 }, { z: 1.3, dir: -1 }, { z: 3.4, dir: -1 }]; // left-hand traffic
    const spawn = (type, lane, x) => {
      const mesh = type === 'rickshaw' ? makeRickshaw(true) : type === 'cng' ? makeCNG() : type === 'bus' ? makeBus() : makeCar('#d8d8d4');
      mesh.position.set(x, 0, lane.z); mesh.rotation.y = lane.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      this.group.add(mesh);
      const dims = { rickshaw: [2.2, 1.9, 1.1], cng: [2.6, 1.8, 1.4], bus: [10, 3.2, 2.5], car: [4.3, 1.5, 1.8] }[type];
      const box = this.addCollider(Box.fromCenter(x, dims[1] / 2, lane.z, dims[0], dims[1], dims[2], { tag: 'vehicle', climbable: type === 'bus' }));
      const base = { rickshaw: 3.2, cng: 7, bus: 6, car: 8 }[type] * rr(0.8, 1.15);
      const v = { mesh, box, lane, type, dims, x, speed: base, base, honkT: rr(2, 10) };
      if (type === 'rickshaw') { v.rider = makeHumanoid('civilian'); v.rider.root.scale.setScalar(0.95); v.rider.root.position.set(0, 0.35, -0.65); v.rider.root.rotation.y = Math.PI; mesh.add(v.rider.root); }
      this.vehicles.push(v);
    };
    lanes.forEach((lane, li) => {
      let x = MAP.minX - 10 + rr(0, 10);
      while (x < MAP.maxX + 10) {
        const type = li === 0 || li === 3 ? (rand() < 0.75 ? 'rickshaw' : 'cng') : pick(['cng', 'cng', 'car', 'bus', 'rickshaw']);
        spawn(type, lane, x);
        x += rr(14, 30);
      }
    });
    // the Cartographer's escape car
    const car = makeCar('#1a1c20');
    car.position.copy(this.designed.carPos); car.rotation.y = 0;
    this.group.add(car);
    this.designed.car = car;
    this.designed.carBox = this.addCollider(Box.fromCenter(car.position.x, 0.75, car.position.z, 1.8, 1.5, 4.3, { tag: 'vehicle' }));
  }

  // ---------------------------------------------------------------- cables
  buildCableMesh() {
    const pts = [];
    for (const [a, b, kind, sagIn] of this.cables) {
      const straight = kind === 'rebar' || kind === 'arm';
      const sag = straight ? 0 : (sagIn ?? 0.25);
      const n = straight ? 1 : 10;
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        const p0 = a.clone().lerp(b, t0); p0.y -= Math.sin(Math.PI * t0) * sag;
        const p1 = a.clone().lerp(b, t1); p1.y -= Math.sin(Math.PI * t1) * sag;
        pts.push(p0, p1);
      }
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    this.cableMesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#050506', transparent: true, opacity: 0.85 }));
    this.group.add(this.cableMesh);
  }

  // ---------------------------------------------------------------- lights
  buildLightPool() {
    this.hemi = new THREE.HemisphereLight('#5a6a8a', '#1a1612', 0.55);
    this.scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight('#8aa0c8', 0.35);
    this.moon.position.set(-30, 60, 20);
    this.scene.add(this.moon);
    this.pool = [];
    for (let i = 0; i < 12; i++) {
      const l = new THREE.PointLight('#ffffff', 0, 10, 2);
      this.scene.add(l); this.pool.push(l);
    }
    this.poolT = 0;
    const u = this.ground.material.uniforms;
    u.lampPos.value = Array.from({ length: 64 }, () => new THREE.Vector4());
    u.lampCol.value = Array.from({ length: 64 }, () => new THREE.Color());
  }

  breakLamp(lp) {
    if (lp.broken) return;
    lp.broken = true;
    if (lp.mesh) lp.mesh.material = new THREE.MeshBasicMaterial({ color: '#222' });
    lp.brokenAt = performance.now();
  }

  updateLights(camPos, dt) {
    this.poolT -= dt;
    if (this.poolT <= 0) {
      this.poolT = 0.25;
      const live = this.lamps.filter((l) => !l.broken);
      live.sort((a, b) => a.pos.distanceToSquared(camPos) - b.pos.distanceToSquared(camPos));
      this.pool.forEach((pl, i) => {
        const l = live[i];
        if (!l) { pl.intensity = 0; return; }
        pl.position.copy(l.pos); pl.color.copy(l.color); pl.distance = l.radius * 1.3;
        pl.intensity = l.intensity * 14;
      });
      // ground shader: nearest 64
      const u = this.ground.material.uniforms;
      const n = Math.min(64, live.length);
      for (let i = 0; i < n; i++) {
        u.lampPos.value[i].set(live[i].pos.x, live[i].pos.y, live[i].pos.z, live[i].radius);
        u.lampCol.value[i].copy(live[i].color).multiplyScalar(live[i].intensity * 0.9);
      }
      u.lampCount.value = n;
    }
  }

  // ---------------------------------------------------------------- nav grid
  buildNav() {
    const cell = 2;
    const nx = Math.floor((MAP.maxX - MAP.minX) / cell), nz = Math.floor((MAP.maxZ - MAP.minZ) / cell);
    const walk = new Uint8Array(nx * nz);
    const obstacles = this.colliders.filter((b) => b.min.y < 1.0 && b.max.y > 0.3 && b.tag !== 'vehicle' && b.tag !== 'curb');
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = MAP.minX + (i + 0.5) * cell, z = MAP.minZ + (j + 0.5) * cell;
      let ok = true;
      for (const b of obstacles) if (x > b.min.x - 0.5 && x < b.max.x + 0.5 && z > b.min.z - 0.5 && z < b.max.z + 0.5) { ok = false; break; }
      walk[j * nx + i] = ok ? 1 : 0;
    }
    this.nav = { cell, nx, nz, walk, obstacles };
  }
  navCell(x, z) {
    const { cell, nx, nz } = this.nav;
    return [clamp(Math.floor((x - MAP.minX) / cell), 0, nx - 1), clamp(Math.floor((z - MAP.minZ) / cell), 0, nz - 1)];
  }
  navWalkable(i, j) { const { nx, nz, walk } = this.nav; return i >= 0 && j >= 0 && i < nx && j < nz && walk[j * nx + i] === 1; }
  nearestWalkable(i, j) {
    if (this.navWalkable(i, j)) return [i, j];
    for (let r = 1; r < 6; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (this.navWalkable(i + di, j + dj)) return [i + di, j + dj];
    return null;
  }
  findPath(from, to) {
    const { cell, nx } = this.nav;
    const s = this.nearestWalkable(...this.navCell(from.x, from.z));
    const e = this.nearestWalkable(...this.navCell(to.x, to.z));
    if (!s || !e) return null;
    const key = (i, j) => j * nx + i;
    const open = new Map(), g = new Map(), came = new Map();
    const h = (i, j) => Math.hypot(i - e[0], j - e[1]);
    open.set(key(...s), h(...s)); g.set(key(...s), 0);
    let iter = 0;
    while (open.size && iter++ < 4000) {
      let bk = -1, bf = Infinity;
      for (const [k, f] of open) if (f < bf) { bf = f; bk = k; }
      open.delete(bk);
      const ci = bk % nx, cj = Math.floor(bk / nx);
      if (ci === e[0] && cj === e[1]) {
        const path = [];
        let k = bk;
        while (k !== undefined) { const i = k % nx, j = Math.floor(k / nx); path.unshift(new THREE.Vector3(MAP.minX + (i + 0.5) * cell, 0, MAP.minZ + (j + 0.5) * cell)); k = came.get(k); }
        path[path.length - 1] = to.clone().setY(0);
        return this.smoothPath(path);
      }
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (!this.navWalkable(ni, nj)) continue;
        if (di && dj && (!this.navWalkable(ci + di, cj) || !this.navWalkable(ci, cj + dj))) continue;
        const nk = key(ni, nj), ng = g.get(bk) + (di && dj ? 1.414 : 1);
        if (ng < (g.get(nk) ?? Infinity)) { g.set(nk, ng); came.set(nk, bk); open.set(nk, ng + h(ni, nj)); }
      }
    }
    return null;
  }
  smoothPath(path) {
    if (path.length < 3) return path;
    const out = [path[0]];
    let i = 0;
    const A = new THREE.Vector3(), B = new THREE.Vector3();
    while (i < path.length - 1) {
      let j = path.length - 1;
      for (; j > i + 1; j--) {
        A.copy(path[i]).setY(0.6); B.copy(path[j]).setY(0.6);
        if (segmentClear(A, B, this.nav.obstacles)) break;
      }
      out.push(path[j]); i = j;
    }
    return out;
  }
  randomPublicPoint(nearZ) {
    for (let k = 0; k < 40; k++) {
      const x = rr(MAP.minX + 4, MAP.maxX - 4);
      const z = nearZ !== undefined ? nearZ + rr(-2, 2) : pick([rr(-6.5, -4.8), rr(4.8, 6.5), rr(-54, 54)]);
      const p = new THREE.Vector3(Math.abs(z) > 6.6 && Math.abs(z) < 54 && rand() < 0.7 ? rr(-3.5, 3.5) : x, 0, z);
      const [i, j] = this.navCell(p.x, p.z);
      if (this.navWalkable(i, j) && !this.isRestricted(p)) return p;
    }
    return new THREE.Vector3(0, 0, 10);
  }

  // ---------------------------------------------------------------- update
  update(dt, t, camPos, player) {
    const u = this.ground.material.uniforms;
    u.time.value = t; u.wetness.value = this.wetness; u.rain.value = this.rain;
    u.fogColor.value.copy(this.scene.fog.color); u.fogDensity.value = this.scene.fog.density;
    u.ambient.value.setRGB(0.05 + this.lightning * 0.5, 0.055 + this.lightning * 0.5, 0.07 + this.lightning * 0.6);
    this.sky.material.uniforms.time.value = t;
    this.sky.material.uniforms.flash.value = this.lightning;
    this.hemi.intensity = 0.55 + this.lightning * 3;
    this.updateLights(camPos, dt);

    for (const a of this.animated) {
      if (a.type === 'cloth') a.mesh.rotation.x = Math.sin(t * 2.2 + a.ph) * 0.18 * this.rain + 0.05;
      else if (a.type === 'tarp') a.mesh.rotation.x = a.base + Math.sin(t * 1.3 + a.ph) * 0.03;
      else if (a.type === 'flag') {
        const pos = a.mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) { const x = a.base[i * 3]; pos.setZ(i, Math.sin(x * 3 - t * 5) * 0.12 * (x / 1.6)); }
        pos.needsUpdate = true;
      }
    }
    // traffic: keep lanes flowing, stop and honk for the player / queued vehicles
    for (const v of this.vehicles) {
      const dir = v.lane.dir;
      let want = v.base;
      const ahead = v.x + dir * (v.dims[0] / 2 + 3.5);
      if (player && Math.abs(player.pos.z - v.lane.z) < 1.6 && player.pos.y < 1.5 && (player.pos.x - v.x) * dir > 0 && Math.abs(player.pos.x - ahead) < 3.5) { want = 0; v.honk = true; }
      for (const o of this.vehicles) {
        if (o === v || o.lane !== v.lane) continue;
        const gap = (o.x - v.x) * dir - (o.dims[0] + v.dims[0]) / 2;
        if (gap > 0 && gap < 3) want = 0; else if (gap > 0 && gap < 8) want = Math.min(want, o.speed);
      }
      v.speed += (want - v.speed) * Math.min(1, dt * 2);
      v.x += dir * v.speed * dt;
      if (v.x > MAP.maxX + 15) v.x = MAP.minX - 15; if (v.x < MAP.minX - 15) v.x = MAP.maxX + 15;
      v.mesh.position.x = v.x;
      v.mesh.position.y = v.type === 'cng' || v.type === 'rickshaw' ? Math.abs(Math.sin(t * 9 + v.x)) * 0.02 : 0;
      v.box.min.x = v.x - v.dims[0] / 2; v.box.max.x = v.x + v.dims[0] / 2;
      if (v.rider) animate(v.rider, { speed: v.speed * 0.8, crouch: 0.5 }, dt);
      v.honkT -= dt;
    }
    // metro
    const m = this.metro;
    if (m.wait > 0) { m.wait -= dt; } else {
      m.x += m.speed * dt; m.mesh.position.x = m.x;
      if (m.x > 300) { m.x = -400; m.wait = rr(40, 70); m.mesh.position.x = m.x; }
    }
    // cameras sweep
    for (const c of this.cameras) {
      if (!c.alive) continue;
      c.t += dt;
      c.yaw = c.base + Math.sin(c.t * 0.45) * c.sweep;
      c.mesh.rotation.y = c.yaw;
      c.led.visible = Math.sin(t * 6) > 0;
    }
  }
}

// Scale BoxGeometry UVs to world metres so tiling textures keep their real-world size.
function worldUV(geo, w, h, d, tile) {
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
  }
}

const GRILL_MAT = new THREE.MeshStandardMaterial({
  map: canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = '#1a1a1a'; g.lineWidth = 4;
    g.strokeRect(2, 2, w - 4, h - 4);
    for (let x = 0; x < w; x += 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.lineWidth = 3; for (let x = 16; x < w; x += 32) { g.beginPath(); g.arc(x, h / 2, 10, 0, 7); g.stroke(); }
  }, { clamp: true }), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6,
});
const AC_MAT = new THREE.MeshStandardMaterial({ color: '#d8d8d0', roughness: 0.5 });
const SACK_MAT = new THREE.MeshStandardMaterial({ color: '#b8a07a', roughness: 1 });
const DRUM_MAT = new THREE.MeshStandardMaterial({ color: '#2a4a8a', roughness: 0.5, metalness: 0.5 });

// ---------------------------------------------------------------- vehicles
const RICKSHAW_ART = [];
function rickshawArt() {
  if (RICKSHAW_ART.length < 6) {
    RICKSHAW_ART.push(canvasTex(128, 96, (g, w, h) => {
      g.fillStyle = pick(['#d01830', '#1a4ab0', '#e8b020', '#10805a']); g.fillRect(0, 0, w, h);
      for (let i = 0; i < 14; i++) {
        g.fillStyle = pick(['#fff', '#ffea00', '#ff2a8a', '#2affd0', '#ff7a00']);
        g.beginPath(); const x = rand() * w, y = rand() * h; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.ellipse(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 5, 3, a, 0, 7); } g.fill();
      }
      g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8);
    }));
  }
  return pick(RICKSHAW_ART);
}
function wheel(r) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 6, 18), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.6 }));
  return m;
}
export function makeRickshaw() {
  const g = new THREE.Group();
  const art = rickshawArt();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.6), new THREE.MeshStandardMaterial({ map: art, roughness: 0.6 }));
  seat.position.set(0, 0.85, 0.3); g.add(seat);
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.05, 12, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: pick(['#d01830', '#1a2a6a', '#0a0a0a', '#e0a020']), roughness: 0.7, side: THREE.DoubleSide }));
  hood.rotation.z = Math.PI / 2; hood.rotation.y = Math.PI / 2; hood.position.set(0, 1.25, 0.45); g.add(hood);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshStandardMaterial({ map: art, roughness: 0.6, side: THREE.DoubleSide }));
  back.position.set(0, 0.8, 0.62); g.add(back);
  for (const s of [-1, 1]) { const w = wheel(0.34); w.rotation.y = Math.PI / 2; w.position.set(s * 0.5, 0.34, 0.35); g.add(w); }
  const fw = wheel(0.32); fw.rotation.y = Math.PI / 2; fw.position.set(0, 0.32, -0.95); g.add(fw);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.3), new THREE.MeshStandardMaterial({ color: '#2a2a2a', metalness: 0.5 })); frame.position.set(0, 0.6, -0.35); g.add(frame);
  return g;
}
function makeCNG() {
  const g = new THREE.Group();
  const green = new THREE.MeshStandardMaterial({ color: '#1f7a3a', roughness: 0.35, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 2.4), green); body.position.y = 0.75; g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 2.2), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.5 })); top.position.y = 1.72; g.add(top);
  for (const [x, z] of [[-0.6, -0.8], [0.6, -0.8], [-0.6, 0.8], [0.6, 0.8]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 0.05), green); p.position.set(x, 1.3, z); g.add(p); }
  const cage = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.75), GRILL_MAT); cage.rotation.y = Math.PI / 2; cage.position.set(0.66, 1.3, 0.1); g.add(cage);
  const cage2 = cage.clone(); cage2.position.x = -0.66; g.add(cage2);
  for (const [x, z] of [[-0.55, 0.8], [0.55, 0.8], [0, -1.05]]) { const w = wheel(0.25); w.rotation.y = Math.PI / 2; w.position.set(x, 0.25, z); g.add(w); }
  const hl = new THREE.Mesh(new THREE.CircleGeometry(0.1), new THREE.MeshBasicMaterial({ color: '#fff6d0' })); hl.position.set(0, 0.9, -1.21); hl.rotation.y = Math.PI; g.add(hl);
  return g;
}
function makeBus() {
  const g = new THREE.Group();
  const tex = canvasTex(512, 128, (gg, w, h) => {
    gg.fillStyle = pick(['#c8202a', '#1a5ab0', '#e0e0d0', '#2a8a4a']); gg.fillRect(0, 0, w, h);
    gg.fillStyle = '#e8c020'; gg.fillRect(0, 88, w, 10);
    for (let x = 14; x < w - 20; x += 44) { gg.fillStyle = rand() < 0.6 ? '#ffe4b0' : '#1a1a1a'; gg.fillRect(x, 16, 34, 40); }
    gg.fillStyle = '#fff'; gg.font = `bold 22px ${BN_FONT}`; gg.fillText('গুলিস্তান - মিরপুর', 150, 80);
    grime(gg, w, h, 1.5);
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.9, 10), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#553311', emissiveIntensity: 0.6, roughness: 0.6 }));
  body.position.y = 1.75; g.add(body);
  for (const z of [-3.5, 3.5]) for (const x of [-1.2, 1.2]) { const w = wheel(0.5); w.rotation.y = Math.PI / 2; w.position.set(x, 0.5, z); g.add(w); }
  return g;
}
export function makeCar(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.7, 4.3), paint); body.position.y = 0.6; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.2), new THREE.MeshStandardMaterial({ color: '#0a0c10', roughness: 0.05, metalness: 0.9 })); cab.position.set(0, 1.2, 0.2); g.add(cab);
  for (const z of [-1.4, 1.4]) for (const x of [-0.85, 0.85]) { const w = wheel(0.32); w.rotation.y = Math.PI / 2; w.position.set(x, 0.32, z); g.add(w); }
  for (const x of [-0.6, 0.6]) { const hl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.12), new THREE.MeshBasicMaterial({ color: '#ff2a2a' })); hl.position.set(x, 0.75, 2.16); g.add(hl); }
  return g;
}
