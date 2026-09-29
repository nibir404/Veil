import * as THREE from 'three';

// Deterministic RNG so the city layout is identical every run (authored feel, reproducible bugs).
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rand = mulberry32(19710326);
export const rr = (a, b) => a + rand() * (b - a);
export const ri = (a, b) => Math.floor(rr(a, b + 1));
export const pick = (arr) => arr[Math.floor(rand() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const smooth = (t) => t * t * (3 - 2 * t);
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function dampAngle(a, b, lambda, dt) {
  return a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt));
}

// Axis-aligned collider. Everything solid in the slice is one of these, which keeps
// player/AI collision, bullets, camera and line-of-sight on one fast code path.
export class Box {
  constructor(minx, miny, minz, maxx, maxy, maxz, opts = {}) {
    this.min = new THREE.Vector3(minx, miny, minz);
    this.max = new THREE.Vector3(maxx, maxy, maxz);
    this.climbable = opts.climbable !== false;
    this.tag = opts.tag || 'solid';
    this.ref = opts.ref || null;
    this.seeThrough = !!opts.seeThrough;
  }
  static fromCenter(cx, cy, cz, sx, sy, sz, opts) {
    return new Box(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2, opts);
  }
  contains(p, pad = 0) {
    return p.x > this.min.x - pad && p.x < this.max.x + pad && p.y > this.min.y - pad && p.y < this.max.y + pad && p.z > this.min.z - pad && p.z < this.max.z + pad;
  }
}

const _inv = new THREE.Vector3();
// Slab test. Returns {t, box, normal} for nearest hit within maxDist, or null.
export function rayBoxes(origin, dir, maxDist, boxes, filter) {
  let best = null;
  let bestT = maxDist;
  _inv.set(1 / dir.x, 1 / dir.y, 1 / dir.z);
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (filter && !filter(b)) continue;
    let t1 = (b.min.x - origin.x) * _inv.x, t2 = (b.max.x - origin.x) * _inv.x;
    let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2), axis = 0;
    t1 = (b.min.y - origin.y) * _inv.y; t2 = (b.max.y - origin.y) * _inv.y;
    let ty0 = Math.min(t1, t2), ty1 = Math.max(t1, t2);
    if (ty0 > tmin) { tmin = ty0; axis = 1; }
    tmax = Math.min(tmax, ty1);
    t1 = (b.min.z - origin.z) * _inv.z; t2 = (b.max.z - origin.z) * _inv.z;
    let tz0 = Math.min(t1, t2), tz1 = Math.max(t1, t2);
    if (tz0 > tmin) { tmin = tz0; axis = 2; }
    tmax = Math.min(tmax, tz1);
    if (tmax >= Math.max(tmin, 0) && tmin < bestT) {
      if (tmin < 0) continue; // origin inside box: ignore (camera / eye inside geometry)
      bestT = tmin;
      const n = new THREE.Vector3();
      if (axis === 0) n.x = dir.x > 0 ? -1 : 1;
      else if (axis === 1) n.y = dir.y > 0 ? -1 : 1;
      else n.z = dir.z > 0 ? -1 : 1;
      best = { t: tmin, box: b, normal: n };
    }
  }
  return best;
}

const _d = new THREE.Vector3();
export function segmentClear(a, b, boxes, filter) {
  _d.subVectors(b, a);
  const len = _d.length();
  if (len < 1e-4) return true;
  _d.divideScalar(len);
  return !rayBoxes(a, _d, len, boxes, filter);
}

// Ray vs sphere, used for hitting characters' head/torso volumes.
export function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const h = b * b - cc;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : -1;
}

export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (opts.nearest) { t.magFilter = THREE.NearestFilter; }
  return t;
}

// Grainy stain / grime overlay: the environmental aging that makes Dhaka concrete read as real.
export function grime(g, w, h, amount = 1, r = rand) {
  for (let i = 0; i < 60 * amount; i++) {
    const x = r() * w, y = r() * h * 0.3, len = r() * h * 0.7;
    const grd = g.createLinearGradient(x, y, x, y + len);
    grd.addColorStop(0, `rgba(20,25,20,${0.18 * r()})`);
    grd.addColorStop(1, 'rgba(20,25,20,0)');
    g.fillStyle = grd;
    g.fillRect(x, y, 2 + r() * 10, len);
  }
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 24 * amount;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

export const STATES = ['UNKNOWN', 'SUSPICION', 'INVESTIGATION', 'ALERT', 'HUNT', 'FULL COMBAT'];
export const S = { UNKNOWN: 0, SUSPICION: 1, INVESTIGATION: 2, ALERT: 3, HUNT: 4, COMBAT: 5 };
