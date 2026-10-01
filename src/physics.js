import * as THREE from 'three';
import { clamp } from './util.js';

export function overlapsBody(p, radius, height, box, step = 0) {
  if (box.max.y <= p.y + step + 0.001 || box.min.y >= p.y + height - 0.001) return false;
  const dx = p.x - clamp(p.x, box.min.x, box.max.x), dz = p.z - clamp(p.z, box.min.z, box.max.z);
  return dx * dx + dz * dz < radius * radius;
}

export function resolveBody(p, radius, height, boxes, step = 0) {
  const normals = [];
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const b of boxes) {
      if (!overlapsBody(p, radius, height, b, step)) continue;
      let dx = p.x - clamp(p.x, b.min.x, b.max.x), dz = p.z - clamp(p.z, b.min.z, b.max.z);
      const d = Math.hypot(dx, dz);
      if (d < 1e-7) {
        const faces = [[p.x - b.min.x, -1, 0], [b.max.x - p.x, 1, 0], [p.z - b.min.z, 0, -1], [b.max.z - p.z, 0, 1]].sort((a,b)=>a[0]-b[0]);
        const [depth, x, z] = faces[0]; dx = x; dz = z;
        p.x += x * (depth + radius + 0.001); p.z += z * (depth + radius + 0.001);
      } else {
        dx /= d; dz /= d; p.x += dx * (radius - d + 0.001); p.z += dz * (radius - d + 0.001);
      }
      normals.push(new THREE.Vector3(dx, 0, dz)); moved = true;
    }
    if (!moved) break;
  }
  return normals;
}

// Small integration steps prevent tunnelling at ledges, low frame rates and during falls.
export function moveBody(body, dt, boxes, height) {
  const steps = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / steps;
  let landing = null;
  for (let i = 0; i < steps; i++) {
    const previousY = body.pos.y;
    body.vel.y -= 20 * h;
    body.pos.x += body.vel.x * h; body.pos.z += body.vel.z * h;
    const maxStep = body.onGround && body.vel.y <= 0 ? 0.32 : 0;
    for (const n of resolveBody(body.pos, body.radius, height, boxes, maxStep)) {
      const into = body.vel.dot(n); if (into < 0) body.vel.addScaledVector(n, -into);
    }
    const nextY = previousY + body.vel.y * h;
    let floor = 0;
    for (const b of boxes) {
      const horizontal = body.pos.x > b.min.x && body.pos.x < b.max.x && body.pos.z > b.min.z && body.pos.z < b.max.z;
      if (!horizontal) continue;
      if (b.max.y <= previousY + maxStep + 0.002) floor = Math.max(floor, b.max.y);
      if (body.vel.y > 0 && previousY + height <= b.min.y + 0.001 && nextY + height >= b.min.y) {
        body.vel.y = 0; body.pos.y = b.min.y - height - 0.002;
      }
    }
    if (body.vel.y <= 0 && nextY <= floor && previousY >= floor - maxStep - 0.002) {
      if (!body.onGround) landing = Math.max(0, (body.fallStartY || previousY) - floor);
      body.pos.y = floor; body.vel.y = 0; body.onGround = true;
    } else {
      if (body.pos.y === previousY) body.pos.y = nextY;
      if (body.onGround) body.fallStartY = previousY;
      body.onGround = false;
      body.fallStartY = Math.max(body.fallStartY || body.pos.y, body.pos.y);
    }
  }
  return landing;
}

// Gameplay timers advance only when simulation advances (including Veil slow motion).
export class SimulationTimers {
  constructor() { this.pending = []; }
  after(seconds, fn) { const event = { remaining: seconds, fn }; this.pending.push(event); return event; }
  update(dt) {
    const due = [];
    this.pending = this.pending.filter(event => { event.remaining -= dt; if (event.remaining <= 0) { due.push(event); return false; } return true; });
    for (const event of due) event.fn();
  }
}
