import * as THREE from 'three';
import { makeHumanoid, animate, attachWeapon } from './characters.js';
import { clamp, damp, dampAngle, lerp, rayBoxes, raySphere, S } from './util.js';

const UP = new THREE.Vector3(0, 1, 0);

export const WEAPONS = {
  pistol: { name: 'P-9 SUPPRESSED', mag: 12, reserve: 48, rpm: 360, dmg: 55, head: 200, spread: 0.004, recoil: 0.018, noise: 7, auto: false, mesh: 'pistol', reload: 1.4 },
  rifle: { name: 'KR-7 CARBINE', mag: 30, reserve: 90, rpm: 700, dmg: 38, head: 200, spread: 0.009, recoil: 0.028, noise: 85, auto: true, mesh: 'rifle', reload: 2.2, zoom: 2.4 },
};

export class Player {
  constructor(game) {
    this.g = game;
    this.rig = makeHumanoid('raven');
    game.scene.add(this.rig.root);
    this.pos = new THREE.Vector3(-70, 0.18, -6);
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI / 2; this.pitch = -0.05; this.bodyYaw = Math.PI / 2;
    this.radius = 0.34;
    this.onGround = true;
    this.crouch = false; this.sprint = false; this.aiming = false;
    this.climbing = null;
    this.health = 100; this.lastHurt = -99;
    this.veilCharge = 60;
    this.shoulder = 1; this.shoulderLerp = 1;
    this.weapons = { pistol: { ...WEAPONS.pistol, ammo: 12, res: 48 }, rifle: null };
    this.current = 'pistol';
    this.fireCd = 0; this.reloading = 0; this.recoil = 0;
    this.disguised = false;
    this.dragging = null;
    this.stepT = 0; this.airTime = 0; this.fallStartY = 0;
    this.camPos = new THREE.Vector3();
    this.camDist = 3.4;
    this.lean = 0;
    this.noiseT = 0;
    attachWeapon(this.rig, null);
  }

  get eye() { return new THREE.Vector3(this.pos.x, this.pos.y + (this.crouch ? 1.05 : 1.6), this.pos.z); }
  get chest() { return new THREE.Vector3(this.pos.x, this.pos.y + (this.crouch ? 0.8 : 1.25), this.pos.z); }
  get headPos() { return new THREE.Vector3(this.pos.x, this.pos.y + (this.crouch ? 1.15 : 1.66), this.pos.z); }
  get weapon() { return this.weapons[this.current]; }
  get moving() { return Math.hypot(this.vel.x, this.vel.z) > 0.4; }
  get speed() { return Math.hypot(this.vel.x, this.vel.z); }

  // Collision: circle vs AABB in XZ for every box overlapping our vertical span above step height.
  collide(p, height) {
    const cs = this.g.world.colliders;
    let contact = null;
    for (const b of cs) {
      if (b.max.y <= p.y + 0.55 || b.min.y >= p.y + height) continue;
      const cx = clamp(p.x, b.min.x, b.max.x), cz = clamp(p.z, b.min.z, b.max.z);
      let dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < this.radius * this.radius) {
        if (d2 < 1e-8) {
          // centre inside box: push out along shallowest axis
          const ox = Math.min(p.x - b.min.x, b.max.x - p.x), oz = Math.min(p.z - b.min.z, b.max.z - p.z);
          if (ox < oz) { dx = p.x - b.min.x < b.max.x - p.x ? -1 : 1; dz = 0; p.x += dx * (ox + this.radius); }
          else { dz = p.z - b.min.z < b.max.z - p.z ? -1 : 1; dx = 0; p.z += dz * (oz + this.radius); }
          contact = { box: b, n: new THREE.Vector3(dx, 0, dz) };
          continue;
        }
        const d = Math.sqrt(d2);
        const push = this.radius - d;
        p.x += (dx / d) * push; p.z += (dz / d) * push;
        contact = { box: b, n: new THREE.Vector3(dx / d, 0, dz / d) };
      }
    }
    return contact;
  }

  update(dt, input) {
    const g = this.g;
    const veil = g.veil.active;
    // --- look
    const sens = 0.0022 * (this.aiming ? (this.weapon.zoom && this.current === 'rifle' ? 0.35 : 0.6) : 1);
    this.yaw -= input.mdx * sens; this.pitch = clamp(this.pitch - input.mdy * sens, -1.2, 0.95);

    if (this.health <= 0) { this.deadUpdate(dt); return; }

    // --- stance
    if (input.pressed('KeyC')) this.crouch = !this.crouch;
    if (input.pressed('KeyV')) this.shoulder *= -1;
    this.aiming = input.mouse[2] && !this.climbing && !this.dragging;
    this.sprint = input.down('ShiftLeft') && !this.aiming && !this.dragging && !this.climbing;
    if (this.sprint) this.crouch = false;
    this.lean = damp(this.lean, this.aiming && this.crouch ? 0.6 : 0, 8, dt);

    if (this.climbing) { this.climbUpdate(dt, input); this.animate(dt); return; }

    // --- move
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3();
    if (input.down('KeyW')) wish.add(fwd);
    if (input.down('KeyS')) wish.sub(fwd);
    if (input.down('KeyD')) wish.add(right);
    if (input.down('KeyA')) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize();
    let spd = this.crouch ? 1.6 : this.sprint ? 6.2 : 2.7;
    if (this.aiming) spd = Math.min(spd, this.crouch ? 1.3 : 2.0);
    if (this.dragging) spd = 1.3;
    if (g.world.wetness > 0.6 && this.sprint) spd *= 0.96; // wet slip
    const accel = this.onGround ? 14 : 2.5;
    this.vel.x = damp(this.vel.x, wish.x * spd, accel, dt);
    this.vel.z = damp(this.vel.z, wish.z * spd, accel, dt);

    // jump / vault / climb
    if (input.pressed('Space') && this.onGround && !this.dragging) {
      const wall = this.wallAhead(wish.lengthSq() ? wish : fwd);
      if (wall && wall.box.climbable && wall.top - this.pos.y > 0.6 && wall.top - this.pos.y < 1.5) {
        this.startClimb(wall, true); // vault / mantle
      } else if (wall && wall.box.climbable && wall.top - this.pos.y >= 1.5) {
        this.startClimb(wall, false);
      } else {
        this.vel.y = 6.1; this.onGround = false; this.fallStartY = this.pos.y;
        this.crouch = false;
      }
    }
    // gravity
    this.vel.y -= 20 * dt;
    const np = this.pos.clone().addScaledVector(this.vel, dt);
    const height = this.crouch ? 1.15 : 1.75;
    this.collide(np, height);
    const ground = g.world.groundAt(np.x, np.z, Math.max(this.pos.y, np.y), 0.55, 0);
    if (np.y <= ground) {
      if (!this.onGround) this.land(this.fallStartY - ground, np);
      np.y = ground; this.vel.y = 0; this.onGround = true;
    } else {
      if (this.onGround && np.y - ground > 0.6) { this.onGround = false; this.fallStartY = this.pos.y; }
      else if (this.onGround) { np.y = ground; this.vel.y = 0; }
    }
    // ceiling
    for (const b of g.world.colliders) {
      if (np.x > b.min.x && np.x < b.max.x && np.z > b.min.z && np.z < b.max.z && np.y + height > b.min.y && np.y < b.min.y && this.vel.y > 0) { np.y = b.min.y - height; this.vel.y = 0; }
    }
    this.pos.copy(np);

    // body orientation: face camera when aiming, face movement otherwise
    const moveYaw = Math.atan2(-this.vel.x, -this.vel.z);
    if (this.aiming) this.bodyYaw = dampAngle(this.bodyYaw, this.yaw, 20, dt);
    else if (this.speed > 0.3) this.bodyYaw = dampAngle(this.bodyYaw, moveYaw, 10, dt);

    // footsteps & noise
    if (this.onGround && this.speed > 0.5) {
      this.stepT -= dt * this.speed * (this.sprint ? 0.55 : 0.75);
      if (this.stepT <= 0) {
        this.stepT = 1;
        const onRoof = this.pos.y > 2;
        g.audio.step(this.pos, { wet: g.world.wetness > 0.5, run: this.sprint, crouch: this.crouch, roof: onRoof });
        // rain masks footsteps
        const r = this.sprint ? 9 * (1 - g.weather.effective * 0.45) : this.crouch ? 0 : 2.2;
        if (r > 0.5) g.ai.noise(this.pos.clone(), r, 'footsteps');
      }
    }

    // weapons
    this.weaponUpdate(dt, input, fwd, right);

    // drag body
    if (this.dragging) {
      const b = this.dragging;
      const behind = this.pos.clone().addScaledVector(new THREE.Vector3(Math.sin(this.bodyYaw), 0, Math.cos(this.bodyYaw)), 1.1);
      b.pos.x = damp(b.pos.x, behind.x, 6, dt); b.pos.z = damp(b.pos.z, behind.z, 6, dt);
      b.pos.y = g.world.groundAt(b.pos.x, b.pos.z, this.pos.y + 0.3);
      b.rig.root.rotation.y = this.bodyYaw + Math.PI;
      if (this.pos.distanceTo(b.pos) > 2.2) b.pos.lerp(behind, 0.5);
    }

    this.animate(dt);
  }

  land(fall, np) {
    const g = this.g;
    if (fall > 2) g.ai.noise(np.clone(), Math.min(14, fall * 1.6) * (1 - g.weather.effective * 0.3), 'landing');
    if (fall > 1.2) g.audio.thud(np, 0.4);
    if (fall > 7.5) this.hurt((fall - 7.5) * 18, null, 'fall');
    g.cam.shake = Math.min(1, fall * 0.06);
  }

  wallAhead(dir) {
    const o = this.pos.clone().add(new THREE.Vector3(0, 0.6, 0));
    const hit = rayBoxes(o, dir.clone().normalize(), 0.9, this.g.world.colliders, (b) => b.max.y > this.pos.y + 0.55);
    if (!hit) return null;
    return { box: hit.box, top: hit.box.max.y, n: hit.normal, dist: hit.t };
  }
  startClimb(wall, vault) {
    this.climbing = { box: wall.box, n: wall.n.clone(), top: wall.top, vault, t: 0 };
    this.vel.set(0, 0, 0);
    this.crouch = false;
    this.bodyYaw = Math.atan2(wall.n.x, wall.n.z);
    if (!vault && this.pos.y < 1) this.g.ai.noise(this.pos.clone(), 2, 'climb');
  }
  climbUpdate(dt, input) {
    const c = this.climbing;
    c.t += dt;
    // Climb via window grills, pipes and balcony edges: continuous hand-over-hand ascent.
    const up = c.vault ? 5.5 : 2.9;
    if (input.pressed('KeyC') && !c.vault) { this.climbing = null; this.onGround = false; this.fallStartY = this.pos.y; this.pos.addScaledVector(c.n, 0.2); return; }
    const going = c.vault || input.down('KeyW') || input.down('Space');
    this.climbMove = going;
    if (going) this.pos.y += up * dt;
    // side shimmy
    const side = new THREE.Vector3(-c.n.z, 0, c.n.x);
    if (input.down('KeyA')) this.pos.addScaledVector(side, 1.2 * dt);
    if (input.down('KeyD')) this.pos.addScaledVector(side, -1.2 * dt);
    this.collide(this.pos, 1.75);
    // stick to wall
    if (this.pos.y >= c.top - 0.25) {
      // mantle onto top
      this.pos.y = c.top + 0.02;
      this.pos.addScaledVector(c.n, -0.75);
      this.climbing = null; this.onGround = true; this.vel.set(0, 0, 0);
      this.g.audio.thud(this.pos, 0.15);
      return;
    }
    // lost the wall (shimmied off the side)
    const probe = this.pos.clone().addScaledVector(c.n, -0.5);
    if (probe.x < c.box.min.x - 0.1 || probe.x > c.box.max.x + 0.1 || probe.z < c.box.min.z - 0.1 || probe.z > c.box.max.z + 0.1) {
      this.climbing = null; this.onGround = false; this.fallStartY = this.pos.y;
    }
  }

  weaponUpdate(dt, input, fwd, right) {
    const g = this.g;
    this.fireCd -= dt;
    if (input.pressed('Digit1') && this.current !== 'pistol') { this.current = 'pistol'; this.reloading = 0; g.ui.toast('P-9 SUPPRESSED'); }
    if (input.pressed('Digit2') && this.weapons.rifle && this.current !== 'rifle') { this.current = 'rifle'; this.reloading = 0; g.ui.toast('KR-7 CARBINE — UNSUPPRESSED'); }
    const w = this.weapon;
    if (this.aiming && this.rig.weaponType !== w.mesh) attachWeapon(this.rig, w.mesh);
    if (!this.aiming && this.rig.weapon && this.fireCd < -1.2) attachWeapon(this.rig, null); // holster: blend in with civilians
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { const need = w.mag - w.ammo; const take = Math.min(need, w.res); w.ammo += take; w.res -= take; g.audio.uiTick(700); }
      return;
    }
    if (input.pressed('KeyR') && w.ammo < w.mag && w.res > 0) { this.reloading = w.reload; g.audio.uiTick(500); return; }
    const trigger = w.auto ? input.mouse[0] : input.mousePressed(0);
    if (this.aiming && trigger && this.fireCd <= 0) {
      if (w.ammo <= 0) { g.audio.uiTick(300); this.fireCd = 0.3; if (w.res > 0) this.reloading = w.reload; return; }
      w.ammo--;
      this.fireCd = 60 / w.rpm;
      this.fire(w, right);
    }
  }

  fire(w, right) {
    const g = this.g;
    const cam = g.camera;
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const moveSpread = this.speed * 0.006 + (this.crouch ? -0.002 : 0);
    const sp = Math.max(0.0005, w.spread + moveSpread) * (g.veil.active ? 0.3 : 1);
    dir.x += (Math.random() - 0.5) * sp * 2; dir.y += (Math.random() - 0.5) * sp * 2; dir.z += (Math.random() - 0.5) * sp * 2;
    dir.normalize();
    const origin = cam.position.clone();
    // Start the trace past the player so we never shoot our own shoulder.
    origin.addScaledVector(dir, this.camPos.distanceTo(this.eye) * 0.9);
    const hit = g.combat.trace(origin, dir, 200, { from: 'player' });
    const muzzle = new THREE.Vector3();
    if (this.rig.weapon) { this.rig.weapon.localToWorld(muzzle.copy(this.rig.weapon.userData.muzzle)); } else muzzle.copy(this.chest);
    g.fx.muzzle(muzzle, dir, w.mesh === 'rifle', g.veil.amount);
    if (g.veil.active) g.fx.tracer(muzzle, hit.point, '#ffe6b0', 0.25);
    g.fx.casing(muzzle.clone().add(new THREE.Vector3(0, 0.03, 0)), right);
    g.audio.shot(w.mesh, muzzle, true);
    g.combat.applyHit(hit, dir, w, 'player');
    g.ai.noise(this.pos.clone(), w.noise * (w.mesh === 'rifle' ? 1 : 1 - g.weather.effective * 0.3), w.mesh === 'rifle' ? 'gunshot' : 'suppressed');
    this.pitch += w.recoil * (this.crouch ? 0.6 : 1);
    this.yaw += (Math.random() - 0.5) * w.recoil * 0.6;
    g.cam.shake = Math.max(g.cam.shake, w.mesh === 'rifle' ? 0.25 : 0.08);
    g.stats.shots++;
  }

  hurt(amount, from, kind) {
    const g = this.g;
    if (this.health <= 0) return;
    this.health -= amount;
    this.lastHurt = g.time;
    g.stats.damage += amount;
    g.ui.hurt(amount, from ? Math.atan2(from.x - this.pos.x, from.z - this.pos.z) - this.yaw : null);
    g.audio.hurt();
    if (this.dragging) this.drop();
    if (this.health <= 0) { this.health = 0; g.onPlayerDeath(); }
  }

  drop() { if (this.dragging) { this.dragging.dragged = false; this.dragging = null; } }

  deadUpdate(dt) { animate(this.rig, { dead: true }, dt); }

  animate(dt) {
    const r = this.rig;
    r.root.position.copy(this.pos);
    r.root.rotation.y = this.bodyYaw + Math.PI; // rig faces +Z; our forward is -Z
    r.lean = this.lean * this.shoulder;
    animate(r, {
      speed: this.climbing ? 0 : this.speed, crouch: this.crouch, aim: this.aiming, climb: !!this.climbing, climbMove: this.climbMove,
      lookPitch: this.aiming ? this.pitch : 0, carry: !!this.dragging,
    }, dt);
    r.shadow.visible = this.onGround && !this.climbing;
  }
}
