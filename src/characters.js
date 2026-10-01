import * as THREE from 'three';
import { detailRaven } from './raven-detail.js';
import { rand, pick, lerp, damp, canvasTex } from './util.js';

// Procedural humanoid rig. Stand-in for MetaHuman + motion matching in the UE5 build:
// the pose inputs here (speed, crouch, aim, climb, dead) map 1:1 onto the animation
// graph parameters described in docs/SYSTEMS.md.

const SKIN = ['#8a5a3c', '#7a4e33', '#9b6a48', '#6b432b', '#a87552', '#83563a'];
const matCache = new Map();
function mat(color, rough = 0.8, extra = {}) {
  const key = color + rough + JSON.stringify(extra);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra }));
  return matCache.get(key);
}

let lungiTexCache = [];
function lungiTex() {
  if (lungiTexCache.length < 5) {
    const base = pick(['#2b4a7a', '#6b2030', '#1f5a3a', '#4a3a6a', '#7a5a1a']);
    const line = pick(['#d8d0b0', '#101010', '#c04040', '#e0c060']);
    const t = canvasTex(64, 64, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      g.fillStyle = line; g.globalAlpha = 0.7;
      for (let i = 0; i < w; i += 16) { g.fillRect(i, 0, 3, h); g.fillRect(0, i, w, 3); }
    });
    t.repeat.set(3, 2);
    lungiTexCache.push(t);
  }
  return pick(lungiTexCache);
}

function limb(len, rTop, rBot, material) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(rBot, rTop, len, 8);
  geo.translate(0, -len / 2, 0);
  const m = new THREE.Mesh(geo, material);
  g.add(m);
  g.userData.mesh = m;
  return g;
}

export function makeWeaponMesh(type) {
  const g = new THREE.Group();
  const metal = mat('#1a1c1f', 0.35, { metalness: 0.7 });
  const poly = mat('#23262a', 0.6);
  if (type === 'pistol') {
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.19), metal);
    slide.position.set(0, 0.03, 0.07);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.11, 0.045), poly);
    grip.rotation.x = 0.25; grip.position.set(0, -0.03, -0.0);
    const sup = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.16, 10), metal);
    sup.rotation.x = Math.PI / 2; sup.position.set(0, 0.03, 0.24);
    g.add(slide, grip, sup);
    g.userData.muzzle = new THREE.Vector3(0, 0.03, 0.33);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.42), poly);
    body.position.z = 0.1;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8), metal);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.015, 0.46);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.06), metal);
    mag.position.set(0, -0.09, 0.14); mag.rotation.x = 0.2;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.2), poly);
    stock.position.set(0, -0.01, -0.2);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 10), metal);
    scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.07, 0.1);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.04), poly);
    grip.position.set(0, -0.07, 0.0); grip.rotation.x = 0.3;
    g.add(body, barrel, mag, stock, scope, grip);
    g.userData.muzzle = new THREE.Vector3(0, 0.015, 0.63);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

/**
 * kind: 'raven' | 'guard' | 'civilian' | 'target' | 'white'
 */
export function makeHumanoid(kind = 'civilian', opts = {}) {
  const root = new THREE.Group();
  const skin = mat(opts.skin || pick(SKIN), 0.62);
  let shirt, pants, lungi = false, cap = false, beard = rand() < 0.35, umbrella = false, saree = false;
  let hairColor = '#0c0b0a';
  let vest = null;

  switch (kind) {
    case 'raven':
      shirt = mat('#1d2226', 0.85); pants = mat('#15171a', 0.9); beard = true;
      vest = mat('#2a2f2a', 0.8);
      break;
    case 'guard':
      shirt = mat('#3a4452', 0.85); pants = mat('#2a313b', 0.9); cap = true;
      vest = mat('#1b1f24', 0.7);
      break;
    case 'target':
      shirt = mat('#c9c2b0', 0.7); pants = mat('#2a2622', 0.8); beard = false; hairColor = '#3a3a38';
      break;
    case 'white':
      shirt = mat('#ecebe6', 0.6); pants = mat('#e6e4de', 0.6); beard = true;
      break;
    default: {
      const female = rand() < 0.35;
      if (female) {
        saree = true; beard = false;
        shirt = mat(pick(['#b0243a', '#1f6a5a', '#d08a1a', '#6a2a7a', '#2a5ab0', '#c04a7a']), 0.7);
        pants = shirt;
      } else {
        shirt = mat(pick(['#d8d4c8', '#6a8aa8', '#a86a4a', '#3a5a3a', '#c8b890', '#5a5a6a', '#8a2a2a', '#e0e0d8']), 0.8);
        lungi = rand() < 0.45;
        pants = lungi ? new THREE.MeshStandardMaterial({ map: lungiTex(), roughness: 0.85 }) : mat(pick(['#2a2a30', '#4a4038', '#3a3a3a', '#5a5040']), 0.9);
        cap = rand() < 0.2;
      }
      umbrella = rand() < 0.45;
    }
  }

  // hips
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.2), pants);
  hips.add(pelvis);

  const spine = new THREE.Group(); spine.position.y = 0.06; hips.add(spine);
  const torsoGeo = new THREE.CylinderGeometry(0.2, 0.16, 0.55, 10); torsoGeo.translate(0, 0.28, 0); torsoGeo.scale(1, 1, 0.62);
  const torso = new THREE.Mesh(torsoGeo, shirt); spine.add(torso);
  if (vest) {
    const vg = new THREE.BoxGeometry(0.4, 0.34, 0.27); vg.translate(0, 0.33, 0);
    spine.add(new THREE.Mesh(vg, vest));
  }
  const neck = new THREE.Group(); neck.position.y = 0.58; spine.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), skin);
  head.scale.set(0.9, 1.08, 1); head.position.y = 0.14; neck.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(hairColor, 0.9));
  hair.position.y = 0.16; hair.scale.set(0.92, 1, 1.02); neck.add(hair);
  const noseM = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.04, 0.03), skin); noseM.position.set(0, 0.13, 0.105); neck.add(noseM);
  const eyeM = mat('#0a0908', 0.3);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), eyeM); e.position.set(0.038 * s, 0.165, 0.095); neck.add(e);
  }
  if (beard) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), mat(hairColor, 0.95));
    b.position.y = 0.14; b.scale.set(0.92, 1.05, 1.02); neck.add(b);
  }
  if (cap) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.07, 12), kind === 'guard' ? mat('#20262e') : mat('#e8e6dc'));
    c.position.y = 0.24; neck.add(c);
    if (kind === 'guard') { const bill = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.015, 0.1), mat('#20262e')); bill.position.set(0, 0.215, 0.12); neck.add(bill); }
  }
  if (kind === 'raven') {
    // hood down, bunched at the neck
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 6, 12), shirt);
    hood.rotation.x = Math.PI / 2; hood.position.set(0, 0.02, -0.03); neck.add(hood);
  }

  const arms = {};
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(0.23 * s, 0.52, 0); spine.add(sh);
    const upper = limb(0.3, 0.055, 0.045, shirt); sh.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.3; upper.add(elbow);
    const fore = limb(0.27, 0.045, 0.035, kind === 'civilian' && rand() < 0.5 ? skin : shirt); elbow.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), skin); hand.position.y = -0.29; fore.add(hand);
    const handAnchor = new THREE.Group(); handAnchor.position.y = -0.3; fore.add(handAnchor);
    arms[s < 0 ? 'L' : 'R'] = { sh, upper, elbow, fore, hand: handAnchor };
  }

  const legs = {};
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0.1 * s, -0.04, 0); hips.add(hip);
    const thigh = limb(0.44, 0.075, 0.06, pants); hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.44; thigh.add(knee);
    const shin = limb(0.44, 0.06, 0.045, lungi || saree ? skin : pants); knee.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.24), mat(kind === 'civilian' ? '#2a2018' : '#101010', 0.7));
    foot.position.set(0, -0.46, 0.05); shin.add(foot);
    legs[s < 0 ? 'L' : 'R'] = { hip, thigh, knee, shin };
  }

  if (lungi || saree) {
    // Drape: lungi / saree skirt is a cone, not legs — silhouette matters at distance.
    const geo = new THREE.CylinderGeometry(0.19, saree ? 0.3 : 0.24, 0.82, 12, 1, true);
    geo.translate(0, -0.45, 0);
    const skirt = new THREE.Mesh(geo, lungi ? pants : shirt);
    skirt.material.side = THREE.DoubleSide;
    hips.add(skirt);
    if (saree) {
      const pallu = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.3), shirt);
      pallu.position.set(-0.1, 0.33, 0); pallu.rotation.z = 0.5; spine.add(pallu);
    }
  }

  let umbrellaMesh = null;
  if (umbrella) {
    umbrellaMesh = new THREE.Group();
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.25, 10, 1, true), mat(rand() < 0.8 ? '#0d0d0f' : pick(['#6a1a2a', '#1a3a6a']), 0.5, { side: THREE.DoubleSide }));
    canopy.position.y = 0.72;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.8), mat('#333'));
    stick.position.y = 0.35;
    umbrellaMesh.add(canopy, stick);
    arms.R.hand.add(umbrellaMesh);
    umbrellaMesh.rotation.x = -0.2;
  }

  // Contact shadow: grounds characters on wet streets in lieu of real-time GI shadows.
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), BLOB);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; shadow.renderOrder = 1;
  root.add(shadow);

  const rig = { root, hips, spine, neck, head, arms, legs, umbrella: umbrellaMesh, shadow, kind, phase: rand() * 10, weapon: null, deadT: 0, lean: 0,
    p: { crouch: 0, aim: 0, climb: 0, dead: 0, speed: 0 } };
  if (kind === 'raven') detailRaven(rig);
  root.traverse(o => { if (o.isMesh && o !== shadow) { o.castShadow = kind === 'raven' || kind === 'guard' || kind === 'target'; o.receiveShadow = true; } });
  return rig;
}

const BLOB = new THREE.MeshBasicMaterial({
  map: canvasTex(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  }, { clamp: true }),
  transparent: true, depthWrite: false,
});

export function attachWeapon(rig, type) {
  if (rig.weapon) rig.arms.R.hand.remove(rig.weapon);
  if (!type) { rig.weapon = null; rig.weaponType = null; return; }
  const w = makeWeaponMesh(type);
  w.rotation.x = -Math.PI / 2;
  rig.arms.R.hand.add(w);
  rig.weapon = w; rig.weaponType = type;
}

/**
 * Drive the rig. s = { speed (m/s), crouch 0..1, aim 0..1, climb bool, dead bool, carry bool, surprised bool }
 */
export function animate(rig, s, dt) {
  const p = rig.p;
  p.crouch = damp(p.crouch, s.crouch ? 1 : 0, 10, dt);
  p.aim = damp(p.aim, s.aim ? 1 : 0, 14, dt);
  p.climb = damp(p.climb, s.climb ? 1 : 0, 10, dt);
  p.dead = damp(p.dead, s.dead ? 1 : 0, s.dead ? 5 : 20, dt);
  p.speed = damp(p.speed, s.speed || 0, 8, dt);
  const sp = p.speed;
  const run = Math.min(sp / 5.5, 1);
  rig.phase += dt * (sp > 0.05 ? 2.2 + sp * 1.25 : 0) + (p.climb > 0.5 && s.climbMove ? dt * 7 : 0);
  const ph = rig.phase;
  const walkAmp = Math.min(sp / 2, 1) * (0.5 + run * 0.35) * (1 - p.climb);
  const sw = Math.sin(ph);
  const { arms, legs, hips, spine, neck } = rig;

  hips.position.y = 0.95 - p.crouch * 0.36 + Math.abs(Math.cos(ph)) * 0.04 * walkAmp;
  spine.rotation.x = p.crouch * 0.35 + run * 0.18 - p.aim * 0.05 - p.climb * 0.1;
  spine.rotation.y = rig.lean * 0.4;
  spine.rotation.z = -rig.lean * 0.25;
  neck.rotation.x = -p.crouch * 0.2 - run * 0.1 + (s.lookPitch || 0) * 0.6;

  for (const side of ['L', 'R']) {
    const k = side === 'L' ? 1 : -1;
    const L = legs[side];
    const legSwing = sw * k * 0.75 * walkAmp;
    L.thigh.rotation.x = -legSwing - p.crouch * 1.05 + (p.climb * Math.sin(ph * 1.0 + (k > 0 ? 0 : Math.PI)) * 0.6 - p.climb * 0.5);
    L.knee.rotation.x = Math.max(0, Math.sin(ph + (k > 0 ? 0 : Math.PI) - 0.8)) * 1.1 * walkAmp + p.crouch * 1.7 + p.climb * 0.8;

    const A = arms[side];
    let ax = sw * -k * 0.6 * walkAmp - run * 0.2;
    let az = 0.08 * (side === 'L' ? 1 : -1);
    let ex = -0.25 - run * 0.9 * walkAmp;
    if (p.climb > 0.01) {
      const reach = Math.sin(ph + (k > 0 ? Math.PI : 0));
      ax = lerp(ax, -2.6 - reach * 0.4, p.climb);
      ex = lerp(ex, -0.3 - Math.max(0, reach) * 0.6, p.climb);
    }
    if (rig.umbrella && side === 'R') { ax = -0.9; ex = -1.2; az = -0.1; }
    if (s.carry) { ax = -0.8; ex = -0.4; }
    if (p.aim > 0.01) {
      // Two-handed weapon aim, following look pitch.
      const pitch = s.lookPitch || 0;
      if (side === 'R') { ax = lerp(ax, -Math.PI / 2 - pitch, p.aim); az = lerp(az, 0.0, p.aim); ex = lerp(ex, -0.05, p.aim); }
      else { ax = lerp(ax, -Math.PI / 2 - pitch + 0.1, p.aim); az = lerp(az, -0.55, p.aim); ex = lerp(ex, -0.55, p.aim); }
    } else if (rig.weapon && !rig.umbrella && side === 'R') {
      ax = lerp(ax, -0.5, 0.6); ex = -0.7; // weapon low-ready
    }
    if (s.surprised) { ax = -2.2; ex = -1.4; }
    A.upper.rotation.set(ax, 0, az);
    A.elbow.rotation.x = ex;
  }

  if (s.reload > 0) {
    const reach = Math.sin(Math.PI * s.reload);
    arms.R.upper.rotation.x = -1.0; arms.R.elbow.rotation.x = -0.8;
    arms.L.upper.rotation.x = -0.6 - reach * 0.9;
    arms.L.upper.rotation.z = -0.5; arms.L.elbow.rotation.x = -1.3;
  }
  if (s.recoil > 0 && s.aim) { arms.R.upper.rotation.x -= s.recoil * 0.13; spine.rotation.x -= s.recoil * 0.025; }
  if (s.airborne) { legs.L.thigh.rotation.x = -0.5; legs.R.knee.rotation.x = 0.8; }
  if (s.slide) {
    hips.position.y = 0.48; spine.rotation.x = -0.32;
    legs.L.thigh.rotation.x = -1.3; legs.R.thigh.rotation.x = -0.8;
    legs.L.knee.rotation.x = 0.15; legs.R.knee.rotation.x = 1.6;
  }
  // Death: fold to ground. Root yaw is preserved so the body keeps its facing.
  if (p.dead > 0.001) {
    hips.rotation.x = -p.dead * Math.PI / 2 * 0.98;
    hips.position.y = lerp(hips.position.y, 0.14, p.dead);
    for (const side of ['L', 'R']) { arms[side].upper.rotation.z += (side === 'L' ? 1 : -1) * 0.9 * p.dead; }
  } else hips.rotation.x = 0;
  rig.shadow.scale.setScalar(1 + p.dead * 0.8);
}
