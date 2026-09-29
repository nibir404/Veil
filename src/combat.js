import * as THREE from 'three';
import { rayBoxes, raySphere, S } from './util.js';

export class Combat {
  constructor(game) { this.g = game; }

  worldRay(o, d, max) { return rayBoxes(o, d, max, this.g.world.colliders); }

  // Nearest of: world geometry, character hit volume, shootable prop.
  trace(origin, dir, max) {
    const g = this.g;
    let best = { t: max, type: 'none', point: origin.clone().addScaledVector(dir, max) };
    const wh = this.worldRay(origin, dir, max);
    if (wh) best = { t: wh.t, type: 'world', normal: wh.normal, box: wh.box };
    const chars = [...g.ai.guards, ...g.ai.civilians, g.ai.target];
    for (const c of chars) {
      if (!c.alive) continue;
      if (c.pos.distanceToSquared(origin) > (best.t + 2) ** 2) continue;
      for (const hv of c.hitVolumes()) {
        const t = raySphere(origin, dir, hv.c, hv.r);
        if (t >= 0 && t < best.t) best = { t, type: 'char', char: c, part: hv.part };
      }
    }
    for (const s of g.world.shootables) {
      if (s.lamp?.broken) continue;
      const t = raySphere(origin, dir, s.pos, s.radius);
      if (t >= 0 && t < best.t) best = { t, type: 'shootable', s };
    }
    for (const c of g.world.cameras) {
      if (!c.alive) continue;
      const t = raySphere(origin, dir, c.p, 0.3);
      if (t >= 0 && t < best.t) best = { t, type: 'camera', cam: c };
    }
    const gen = g.world.designed.generator;
    if (!g.world.designed.genDead) {
      const t = raySphere(origin, dir, gen.clone().add(new THREE.Vector3(0.3, 0.7, 0)), 0.95);
      if (t >= 0 && t < best.t) best = { t, type: 'generator' };
    }
    best.point = origin.clone().addScaledVector(dir, best.t);
    return best;
  }

  applyHit(hit, dir, w, from) {
    const g = this.g;
    switch (hit.type) {
      case 'char': {
        const dmg = hit.part === 'head' ? w.head : hit.part === 'legs' ? w.dmg * 0.6 : w.dmg;
        hit.char.damage(dmg, dir, from, hit.part);
        g.stats.hits++;
        if (hit.part === 'head' && !hit.char.alive) { g.player.veilCharge = Math.min(100, g.player.veilCharge + 12); g.ui.hitmarker(true); } else g.ui.hitmarker(false);
        break;
      }
      case 'world':
        g.fx.impact(hit.point, hit.normal, false);
        g.ai.noise(hit.point.clone(), 5, 'impact');
        break;
      case 'shootable':
        if (hit.s.kind === 'lamp') {
          g.world.breakLamp(hit.s.lamp);
          g.audio.glass(hit.point);
          g.fx.impact(hit.point, dir.clone().negate(), false);
          g.ai.noise(hit.point.clone(), 7, 'glass');
          g.stats.lightsOut++;
        }
        break;
      case 'camera':
        hit.cam.alive = false; hit.cam.deadAt = g.time; hit.cam.led.visible = false;
        hit.cam.mesh.rotation.x = 0.6;
        g.fx.impact(hit.point, dir.clone().negate(), false);
        g.audio.glass(hit.point);
        g.ui.toast('CAMERA DISABLED');
        break;
      case 'generator':
        this.detonateGenerator();
        break;
    }
  }

  // Environmental assassination: the diesel generator next to the meeting.
  detonateGenerator() {
    const g = this.g, W = g.world;
    if (W.designed.genDead) return;
    W.designed.genDead = true;
    const p = W.designed.generator.clone().add(new THREE.Vector3(0, 0.8, 0));
    g.fx.explosion(p);
    W.breakLamp(W.designed.flood);
    W.designed.genMesh.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ color: '#1a1814', roughness: 1 }); });
    g.cam.shake = 1;
    g.ai.noise(p, 140, 'explosion');
    for (const c of [...g.ai.guards, g.ai.target]) {
      if (!c.alive) continue;
      const d = c.pos.distanceTo(p);
      if (d < 6) { if (c === g.ai.target) c.kill('environment'); else c.kill('explosion'); }
    }
    if (g.player.pos.distanceTo(p) < 6) g.player.hurt(80, p, 'explosion');
    g.stats.environmental = true;
  }

  // Silent / contextual takedown. Works from behind, or on anyone not yet in combat.
  tryTakedown() {
    const g = this.g, P = g.player;
    const cands = [...g.ai.guards, g.ai.target].filter((c) => c.alive && c.pos.distanceTo(P.pos) < 1.7 && Math.abs(c.pos.y - P.pos.y) < 1.2);
    if (!cands.length) return false;
    cands.sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos));
    const c = cands[0];
    const behind = (() => { if (!c.fwd) return true; const to = P.pos.clone().sub(c.pos).normalize(); return to.dot(c.fwd) < 0.2; })();
    const state = c.state ?? S.UNKNOWN;
    if (typeof state === 'number' && state >= S.COMBAT && !behind && !g.veil.active) {
      // frontal struggle during combat: disarm and fire, costs health
      P.hurt(12, c.pos, 'melee');
    }
    P.bodyYaw = Math.atan2(-(c.pos.x - P.pos.x), -(c.pos.z - P.pos.z));
    g.audio.takedown();
    c.kill('takedown');
    P.veilCharge = Math.min(100, P.veilCharge + 18);
    g.cam.shake = 0.3;
    g.ui.toast(behind ? 'SILENT TAKEDOWN' : 'CLOSE-QUARTERS TAKEDOWN');
    if (!behind || state >= S.ALERT) g.ai.noise(P.pos.clone(), 6, 'struggle');
    return true;
  }
}
