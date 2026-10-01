import * as THREE from 'three';
import { makeHumanoid, animate, attachWeapon } from './characters.js';
import { S, STATES, clamp, damp, dampAngle, angleDiff, segmentClear, rand, rr, pick, lerp } from './util.js';

// ---------------------------------------------------------------------------
// Awareness model
//   UNKNOWN → SUSPICION → INVESTIGATION → ALERT → HUNT → FULL COMBAT
// Detection rate is driven by *behaviour* not proximity: walking the public street is
// invisible; trespassing, a drawn weapon, climbing, dragging a body, sprinting past a
// guard, being lit, being seen in a lightning flash — those are what get noticed.
// ---------------------------------------------------------------------------

const NAMES = ['Karim', 'Jamal', 'Sohel', 'Rubel', 'Mamun', 'Faruk', 'Shakil', 'Babul', 'Tanvir', 'Rasel', 'Nayeem', 'Liton', 'Arif', 'Monir', 'Shipon'];

// Bangla lines (transliterated) + English subtitle.
const LINES = {
  suspicion: [['Ke oikhane?', 'Who\'s there?'], ['Kichu ekta dekhlam...', 'I saw something...'], ['Ei! Dara!', 'Hey! Stop!']],
  investigate: [['Dekhchi ami.', 'I\'ll check it.'], ['Shobdo ta kothay theke elo?', 'Where did that sound come from?'], ['Dara, dekhe ashi.', 'Wait, let me look.']],
  calm: [['Mone hoy kichu na.', 'Probably nothing.'], ['Biral hobe.', 'Must be a cat.'], ['Brishti\'r shobdo.', 'Just the rain.']],
  alert: [['Oi je! Dhor oke!', 'There! Get him!'], ['Contact! Chhade!', 'Contact! On the roof!'], ['Ekjon ache! Gun!', 'Someone\'s here! Armed!']],
  body: [['Laash! Ekhane ekta laash!', 'A body! There\'s a body here!'], ['Ya Allah... ke korlo eta?', 'God... who did this?']],
  hunt: [['Chhade dekho! Rooftop gulo check koro!', 'Check the rooftops!'], ['Gali gulo bondho koro!', 'Seal off the alleys!'], ['Beshi dur jayni. Khojo!', 'He can\'t have gone far. Search!']],
  lost: [['Harai fellam!', 'Lost him!'], ['Kothay gelo?', 'Where did he go?']],
  casing: [['Gulir khosha... keu ekhane chhilo.', 'A shell casing... someone was here.']],
  blood: [['Rokto? Eta taza rokto.', 'Blood? This is fresh.']],
  light: [['Batti ta nibhe gelo keno?', 'Why did the light go out?']],
  camera: [['Camera offline. Keu dekhe asho.', 'Camera\'s offline. Someone check it.']],
  missing: [['{n}, shunte parcho? {n}?', '{n}, do you copy? {n}?']],
  noanswer: [['{n} uttor dicche na. Dekhte jachhi.', '{n} isn\'t answering. Going to look.']],
  backup: [['Backup pathao, ekhuni!', 'Send backup, now!']],
  flee: [['Sir ke niye jao! Gari ready koro!', 'Get Sir out! Ready the car!']],
  return: [['Shobai position e fire jao. Chokh khola rakho.', 'Everyone back to positions. Eyes open.']],
  hit: [['Ahh! Gayé lagse!', 'Argh! I\'m hit!']],
  reload: [['Reload!', 'Reloading!']],
  flank: [['Ami baam dik theke ghurchi.', 'I\'m flanking left.']],
  disguise: [['Tumi kon unit? Chehara to chini na.', 'Which unit are you? I don\'t know your face.']],
  civ_flee: [['Palao! Guli!', 'Run! Gunfire!'], ['Bachao!', 'Help!']],
  civ_report: [['Oi lok ta\'r hate bonduk!', 'That man has a gun!']],
};
function line(key, name) {
  const [bn, en] = pick(LINES[key]);
  return { bn: bn.replaceAll('{n}', name || ''), en: en.replaceAll('{n}', name || '') };
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3();

function pushOut(p, r, y0, h, colliders) {
  for (const b of colliders) {
    if (b.max.y <= y0 + 0.5 || b.min.y >= y0 + h) continue;
    const cx = clamp(p.x, b.min.x, b.max.x), cz = clamp(p.z, b.min.z, b.max.z);
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 1e-8) { const d = Math.sqrt(d2); p.x += dx / d * (r - d); p.z += dz / d * (r - d); }
  }
}

class Guard {
  constructor(ai, cfg) {
    this.ai = ai; this.g = ai.g;
    this.name = cfg.name;
    this.rig = makeHumanoid('guard');
    attachWeapon(this.rig, 'rifle');
    this.g.scene.add(this.rig.root);
    this.pos = cfg.pos.clone();
    this.home = cfg.pos.clone();
    this.yaw = cfg.yaw ?? 0; this.homeYaw = this.yaw;
    this.route = cfg.route || null; this.wp = 0; this.wait = rr(0, 3);
    this.roof = cfg.roof || null; // {x0,x1,z0,z1,h}
    this.state = S.UNKNOWN; this.stateT = 0;
    this.aw = 0; this.bias = 0;
    this.health = 100; this.alive = true;
    this.path = null; this.goal = null;
    this.lookAt = null;
    this.lastKnown = null; this.seenT = -99; this.visible = false;
    this.aimT = 0; this.burst = 0; this.fireCd = rr(0.5, 1.2); this.ammo = 30;
    this.speed = 0; this.crouch = false;
    this.say_cd = 0;
    this.buddy = null; this.posted = cfg.post;
    this.tagged = false;
    this.seen = new Set();
    this.scanT = rand() * 0.3;
    this.stepT = 0;
    this.sentry = !!cfg.sentry;
    this.reportedMissing = false;
    this.disguiseQ = 0;
    this.strafe = rand() < 0.5 ? 1 : -1; this.strafeT = 0;
    this.flanker = false;
  }
  get eye() { return _a.set(this.pos.x, this.pos.y + (this.crouch ? 1.1 : 1.6), this.pos.z); }
  get fwd() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  hitVolumes() {
    const y = this.pos.y, c = this.crouch ? 0.45 : 0;
    return [{ c: new THREE.Vector3(this.pos.x, y + 1.64 - c, this.pos.z), r: 0.14, part: 'head' }, { c: new THREE.Vector3(this.pos.x, y + 1.2 - c, this.pos.z), r: 0.3, part: 'body' }, { c: new THREE.Vector3(this.pos.x, y + 0.55, this.pos.z), r: 0.26, part: 'legs' }];
  }
  say(key, force) {
    if (!this.alive || (this.say_cd > 0 && !force)) return;
    this.say_cd = 3.5;
    this.ai.say(this, line(key, key === 'missing' || key === 'noanswer' ? this.missingName : null));
  }
  setState(s, why) {
    if (s === this.state) return;
    const prev = this.state;
    this.state = s; this.stateT = 0; this.path = null;
    if (s === S.SUSPICION) this.say('suspicion');
    else if (s === S.INVESTIGATION) { if (why !== 'silent') this.say(why === 'casing' ? 'casing' : why === 'blood' ? 'blood' : why === 'light' ? 'light' : 'investigate', true); }
    else if (s === S.ALERT) { this.say(why === 'body' ? 'body' : 'alert', true); this.ai.alarm(this, why); this.g.stats.detections++; }
    else if (s === S.HUNT && prev === S.COMBAT) this.say('lost', true);
    else if (s === S.UNKNOWN && prev >= S.SUSPICION) this.say(prev >= S.HUNT ? 'return' : 'calm');
  }
  investigate(p, why, level = S.INVESTIGATION) {
    if (!this.alive) return;
    if (this.state >= S.ALERT && level < S.ALERT) { if (this.state === S.HUNT) this.goal = p.clone(); return; }
    this.goal = p.clone(); this.path = null;
    if (level > this.state || level === S.INVESTIGATION) this.setState(level, why);
    this.aw = Math.max(this.aw, level >= S.INVESTIGATION ? 55 : 30);
  }

  damage(amount, dir, from, part) {
    if (!this.alive) return;
    this.health -= amount;
    this.g.fx.impact(this.hitVolumes()[part === 'head' ? 0 : 1].c, dir.clone().negate(), true);
    if (this.health <= 0) { this.kill(part === 'head' ? 'headshot' : 'shot'); return; }
    this.say('hit', true);
    if (from === 'player') { this.lastKnown = this.g.player.pos.clone(); this.seenT = this.g.time; }
    this.aw = 100;
    this.setState(S.ALERT, 'shot');
  }
  kill(how) {
    if (!this.alive) return;
    this.alive = false;
    this.state = S.UNKNOWN;
    this.ai.onKilled(this, how);
    this.body = { pos: this.pos, rig: this.rig, owner: this, discovered: false, dragged: false, hasRifle: true, blood: null };
    this.body.blood = this.g.fx.bloodPool(this.pos.clone());
    this.ai.bodies.push(this.body);
    this.g.audio.thud(this.pos, 0.5);
    this.ai.noise(this.pos.clone(), 3.5, 'bodyfall');
  }

  // ---------------------------------------------------------------- perception
  perceive(dt) {
    const g = this.g, P = g.player, W = g.world;
    this.visible = false;
    if (P.health <= 0) return;
    const eye = this.eye.clone();
    const target = P.chest;
    const to = target.clone().sub(eye);
    const dist = to.length();
    const rain = g.weather.effective;
    let range = (this.state >= S.ALERT ? 62 : 38) * (1 - 0.38 * rain) * (1 + W.lightning * 1.2);
    if (dist > range) return;
    const flat = new THREE.Vector2(to.x, to.z).normalize();
    const f = this.fwd;
    const cos = flat.x * f.x + flat.y * f.z;
    const core = cos > Math.cos(THREE.MathUtils.degToRad(34));
    const periph = cos > Math.cos(THREE.MathUtils.degToRad(this.state >= S.INVESTIGATION ? 75 : 58));
    if (!periph && dist > 2.2) return;
    const vfilter = (b) => b.tag !== 'parapet' || b.max.y > eye.y - 0.3;
    if (!segmentClear(eye, target, W.colliders, vfilter) && !segmentClear(eye, P.headPos, W.colliders, vfilter)) return;
    this.visible = true;

    // behaviour score
    const restricted = W.isRestricted(P.pos);
    let sus = 0;
    const knownHostile = this.ai.squadState >= S.ALERT;
    if (knownHostile) sus = 2.5;
    if (restricted) sus += P.disguised ? (dist < 4 ? 0.9 : 0.12) : 1.2;
    if (P.aiming || (P.rig.weapon && P.fireCd > -1.2)) sus += 1.6;
    if (P.climbing) sus += 0.8;
    if (P.dragging) sus += 2.5;
    if (P.sprint && dist < 16) sus += 0.35;
    if (P.crouch && dist < 10 && !restricted) sus += 0.3;
    if (!restricted && P.pos.y > 3 && !knownHostile) sus += 0.35; // on a roof at night
    if (P.disguised && (P.aiming || P.sprint || P.climbing)) sus += 0.8;
    if (sus <= 0) return;

    const light = W.lightAt(target);
    const lightF = lerp(0.3, 1.15, clamp(light, 0, 1));
    const distF = Math.pow(clamp(1 - dist / range, 0, 1), 1.1) + (dist < 3 ? 1.5 : 0);
    const stanceF = P.crouch ? 0.55 : 1;
    const periphF = core ? 1 : 0.4;
    let crowdF = 1;
    if (!restricted && !P.sprint) { const n = this.ai.civiliansNear(P.pos, 3); if (n >= 2) crowdF = 0.3; }
    const rate = 70 * sus * distF * lightF * stanceF * periphF * crowdF * (1 + this.bias * 0.4);
    this.aw = Math.min(100, this.aw + rate * dt);
    if (this.aw > 25) { this.lastKnown = P.pos.clone(); this.lookAt = P.pos.clone(); }
    if (knownHostile && this.aw > 60) { this.lastKnown = P.pos.clone(); this.seenT = g.time; }
    if (P.disguised && restricted && dist < 4 && this.disguiseQ <= 0 && this.state < S.ALERT) { this.say('disguise', true); this.disguiseQ = 15; }
  }

  scanEvidence() {
    const g = this.g, W = g.world, ai = this.ai;
    const eye = this.eye.clone();
    const f = this.fwd;
    const inView = (p, maxD) => {
      const d = p.distanceTo(eye); if (d > maxD) return false;
      const to = p.clone().sub(eye); const c = (to.x * f.x + to.z * f.z) / Math.hypot(to.x, to.z);
      if (c < 0.3 && d > 2) return false;
      return segmentClear(eye, _b.copy(p).setY(p.y + 0.25), W.colliders);
    };
    for (const b of ai.bodies) {
      if (b.discovered || b.owner === this) continue;
      const lit = W.lightAt(b.pos);
      const maxD = lit < 0.3 ? 6 : 20 * (1 - 0.3 * g.weather.effective);
      if (inView(b.pos, maxD)) {
        b.discovered = true;
        this.lastKnown = b.pos.clone();
        this.aw = 100;
        this.setState(S.ALERT, 'body');
        g.stats.bodiesFound++;
        return;
      }
    }
    if (this.state >= S.ALERT) return;
    for (const c of g.fx.casings) {
      if (!c.resting || c.seenBy.has(this) || ai.casingNoticed.has(c)) continue;
      if (W.lightAt(c.pos) > 0.35 && inView(c.pos, 5.5)) { c.seenBy.add(this); ai.casingNoticed.add(c); this.investigate(c.pos, 'casing'); return; }
    }
    for (const bl of g.fx.blood) {
      if (bl.seenBy.has(this)) continue;
      if (inView(bl.pos, 8)) { bl.seenBy.add(this); if (!bl.noticed) { bl.noticed = true; this.investigate(bl.pos, 'blood'); return; } }
    }
    for (const lp of W.lamps) {
      if (!lp.broken || lp.noticed || this.seen.has(lp)) continue;
      if (lp.pos.distanceTo(this.pos) < 20 && performance.now() - lp.brokenAt > 1500) { this.seen.add(lp); lp.noticed = true; this.investigate(lp.pos.clone().setY(this.pos.y), 'light'); return; }
    }
  }

  // ---------------------------------------------------------------- think
  update(dt) {
    if (!this.alive) {
      if (this.body && !this.body.dragged) { this.rig.root.position.copy(this.pos); }
      else if (this.body) this.rig.root.position.copy(this.body.pos);
      animate(this.rig, { dead: true }, dt);
      return;
    }
    const g = this.g, P = g.player;
    this.stateT += dt; this.say_cd -= dt; this.disguiseQ -= dt;
    this.perceive(dt);
    this.scanT -= dt;
    if (this.scanT <= 0) { this.scanT = 0.35; this.scanEvidence(); }

    // awareness decay & threshold transitions
    if (!this.visible) {
      const decay = this.state >= S.HUNT ? 1.5 : this.state === S.INVESTIGATION ? 4 : 9;
      this.aw = Math.max(this.bias * 12, this.aw - decay * dt);
    }
    if (this.state < S.ALERT) {
      if (this.aw >= 100) this.setState(S.ALERT, 'seen');
      else if (this.aw >= 55 && this.state < S.INVESTIGATION) { this.goal = this.lastKnown?.clone() || this.pos.clone(); this.setState(S.INVESTIGATION); }
      else if (this.aw >= 25 && this.state < S.SUSPICION) this.setState(S.SUSPICION);
    }

    let moveTo = null, speed = 0, faceTo = null;
    switch (this.state) {
      case S.UNKNOWN: {
        this.crouch = false;
        if (this.route) {
          const wp = this.route[this.wp];
          if (this.wait > 0) { this.wait -= dt; faceTo = this.lookAround(undefined, dt); }
          else if (this.flatDist(wp) < 0.4) { this.wp = (this.wp + 1) % this.route.length; this.wait = rr(2, 5); }
          else { moveTo = wp; speed = 1.4; }
        } else {
          if (this.flatDist(this.home) > 0.6) { moveTo = this.home; speed = 1.5; }
          else faceTo = this.lookAround(this.homeYaw, dt);
        }
        break;
      }
      case S.SUSPICION: {
        faceTo = this.lookAt;
        if (this.aw < 15) this.setState(S.UNKNOWN);
        break;
      }
      case S.INVESTIGATION: {
        const goal = this.goal || this.lastKnown;
        if (goal && this.flatDist(goal) > 1.3 && this.stateT < 25) { moveTo = goal; speed = 2.0; }
        else { faceTo = this.lookAround(undefined, dt); if (!this.searchT) this.searchT = 4.5; this.searchT -= dt; if (this.searchT <= 0) { this.searchT = 0; this.aw = Math.min(this.aw, 20); this.bias = Math.min(3, this.bias + 0.3); this.setState(S.UNKNOWN); } }
        if (this.visible && this.aw > 25) faceTo = this.lastKnown;
        break;
      }
      case S.ALERT: {
        faceTo = this.lastKnown;
        this.crouch = false;
        if (this.stateT > 0.7) this.setState(this.visible ? S.COMBAT : S.HUNT);
        break;
      }
      case S.COMBAT: {
        const lk = this.lastKnown || P.pos;
        faceTo = lk;
        if (this.visible) {
          this.trackT = (this.trackT || 0) + dt;
          this.seenT = g.time;
          this.lastKnown = P.pos.clone();
          const d = this.flatDist(P.pos);
          this.strafeT -= dt;
          if (this.strafeT <= 0) { this.strafeT = rr(1.2, 2.5); this.strafe *= -1; this.crouch = rand() < 0.35; }
          if (!this.roof) {
            if (d < 6) { moveTo = this.pos.clone().addScaledVector(this.fwd, -3); speed = 2.2; }
            else if (d > 24) { moveTo = P.pos; speed = 3.6; }
            else { const side = new THREE.Vector3(this.fwd.z, 0, -this.fwd.x).multiplyScalar(this.strafe * 2); moveTo = this.pos.clone().add(side); speed = this.crouch ? 1 : 1.6; }
          }
          this.combatShoot(dt);
        } else {
          this.aimT = 0; this.trackT = Math.max(0, (this.trackT || 0) - dt * 2);
          if (g.time - this.seenT > 3) this.setState(S.HUNT);
          else if (!this.roof) { moveTo = lk; speed = 3.2; }
        }
        break;
      }
      case S.HUNT: {
        this.crouch = false;
        if (this.visible && this.aw > 40) { this.setState(S.COMBAT); break; }
        if (!this.goal) this.goal = (this.lastKnown || this.pos).clone();
        if (this.flatDist(this.goal) > 1.2) { moveTo = this.goal; speed = this.stateT < 12 ? 3.4 : 2.1; }
        else {
          faceTo = this.lookAround(undefined, dt);
          this.searchT = (this.searchT || 3) - dt;
          if (this.searchT <= 0) {
            this.searchT = 3;
            const c = this.lastKnown || this.pos;
            this.goal = this.roof ? this.clampRoof(c.clone().add(new THREE.Vector3(rr(-6, 6), 0, rr(-6, 6)))) : c.clone().add(new THREE.Vector3(rr(-12, 12), 0, rr(-12, 12)));
            this.path = null;
          }
        }
        if (this.stateT > 40) { this.aw = 30; this.bias = Math.min(3, this.bias + 1); this.goal = null; this.setState(S.UNKNOWN); }
        break;
      }
    }

    // locomotion
    if (moveTo) this.moveToward(moveTo, speed, dt);
    else this.speed = damp(this.speed, 0, 8, dt);
    if (faceTo) this.faceYaw(Math.atan2(-(faceTo.x - this.pos.x), -(faceTo.z - this.pos.z)), 6, dt);

    // enemy footsteps (positional): the player can hear patrols approaching
    if (this.speed > 0.5) { this.stepT -= dt * this.speed * 0.7; if (this.stepT <= 0) { this.stepT = 1; if (this.pos.distanceTo(P.pos) < 18) g.audio.enemyStep(this.pos); } }

    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw + Math.PI;
    const aim = this.state >= S.INVESTIGATION || this.aimT > 0;
    const pitch = this.lastKnown && this.state === S.COMBAT ? Math.atan2(this.lastKnown.y - this.pos.y, this.flatDist(this.lastKnown) + 0.01) : 0;
    animate(this.rig, { speed: this.speed, crouch: this.crouch, aim, lookPitch: pitch }, dt);
  }

  combatShoot(dt) {
    const g = this.g, P = g.player;
    this.fireCd -= dt;
    if (this.fireCd > 0) return;
    // aim telegraph: the window the Veil State lives in
    if (this.aimT === 0) { this.aimT = 0.0001; g.veil.onThreat(this); }
    this.aimT += dt;
    const need = this.burst > 0 ? 0 : rr(0.55, 0.85);
    if (this.aimT < need) return;
    if (this.ammo <= 0) { this.say('reload'); this.ammo = 30; this.fireCd = 2.4; this.aimT = 0; this.crouch = true; return; }
    this.ammo--;
    this.ai.fireBullet(this);
    this.burst = (this.burst || rr(3, 6) | 0) - 1;
    if (this.burst <= 0) { this.burst = 0; this.fireCd = rr(0.9, 1.8); this.aimT = 0; }
    else this.fireCd = 0.11;
  }

  lookAround(base, dt) {
    const b = base ?? this.yaw;
    if (!this._lookT || this._lookT < 0) { this._lookT = rr(1.5, 3); this._lookYaw = (base ?? this.homeYaw ?? this.yaw) + rr(-1.2, 1.2); }
    this._lookT -= dt;
    return this.pos.clone().add(new THREE.Vector3(-Math.sin(this._lookYaw), 0, -Math.cos(this._lookYaw)));
  }
  faceYaw(y, k, dt) { this.yaw = dampAngle(this.yaw, y, k, dt); }
  flatDist(p) { return Math.hypot(p.x - this.pos.x, p.z - this.pos.z); }
  clampRoof(p) { const r = this.roof; p.x = clamp(p.x, r.x0 + 0.7, r.x1 - 0.7); p.z = clamp(p.z, r.z0 + 0.7, r.z1 - 0.7); p.y = r.h; return p; }

  moveToward(target, speed, dt) {
    const W = this.g.world;
    let next = target;
    if (this.roof) next = this.clampRoof(target.clone());
    else {
      // ground: A* over nav grid, repath when the goal moves
      if (!this.path || !this.pathGoal || this.pathGoal.distanceTo(target) > 2.5 || this.pathIdx >= this.path.length) {
        const direct = segmentClear(_a.set(this.pos.x, 0.8, this.pos.z), _b.set(target.x, 0.8, target.z), W.nav.obstacles);
        this.path = direct ? [target.clone().setY(0)] : W.findPath(this.pos, target) || [target.clone()];
        this.pathGoal = target.clone(); this.pathIdx = 0;
      }
      next = this.path[this.pathIdx];
      if (this.flatDist(next) < 0.6 && this.pathIdx < this.path.length - 1) { this.pathIdx++; next = this.path[this.pathIdx]; }
    }
    const dx = next.x - this.pos.x, dz = next.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { this.speed = damp(this.speed, 0, 8, dt); return; }
    this.speed = damp(this.speed, speed, 6, dt);
    const step = Math.min(d, this.speed * dt);
    this.pos.x += dx / d * step; this.pos.z += dz / d * step;
    if (this.state !== S.COMBAT || !this.visible) this.faceYaw(Math.atan2(-dx, -dz), 7, dt);
    if (this.roof) { this.pos.y = this.roof.h; pushOut(this.pos, 0.35, this.pos.y, 1.7, W.colliders); this.clampRoof(this.pos); }
    else { pushOut(this.pos, 0.35, 0, 1.7, W.nav.obstacles); this.pos.y = W.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.3, 0.4); }
  }
}

// ---------------------------------------------------------------------------
class Civilian {
  constructor(ai, pos) {
    this.ai = ai; this.g = ai.g;
    this.rig = makeHumanoid('civilian');
    this.g.scene.add(this.rig.root);
    this.pos = pos.clone(); this.yaw = rand() * 6;
    this.goal = null; this.path = null; this.pi = 0;
    this.idle = rr(0, 6);
    this.panic = 0; this.alive = true; this.speed = 0; this.base = rr(1.0, 1.5);
    this.reported = false;
  }
  hitVolumes() { return [{ c: new THREE.Vector3(this.pos.x, this.pos.y + 1.6, this.pos.z), r: 0.14, part: 'head' }, { c: new THREE.Vector3(this.pos.x, this.pos.y + 1.15, this.pos.z), r: 0.3, part: 'body' }]; }
  damage() {
    if (!this.alive) return;
    this.alive = false; this.g.stats.civilians++;
    this.g.fx.bloodPool(this.pos.clone());
    this.ai.noise(this.pos.clone(), 12, 'scream');
    this.g.ui.toast('CIVILIAN CASUALTY', true);
  }
  scare(from) {
    if (!this.alive) return;
    if (this.panic <= 0 && rand() < 0.3) this.ai.say(this, line('civ_flee'), true);
    this.panic = rr(10, 18);
    const away = this.pos.clone().sub(from).setY(0).normalize().multiplyScalar(30).add(this.pos);
    this.goal = away; this.path = null;
  }
  update(dt) {
    if (!this.alive) { animate(this.rig, { dead: true }, dt); return; }
    const g = this.g, W = g.world, P = g.player;
    // Suspicious civilians: a man with a drawn gun is reported.
    if (!this.reported && P.health > 0 && (P.aiming || P.dragging) && this.pos.distanceTo(P.pos) < 9) {
      const to = P.pos.clone().sub(this.pos);
      if (segmentClear(_a.set(this.pos.x, 1.6, this.pos.z), _b.set(P.pos.x, P.pos.y + 1.2, P.pos.z), W.colliders)) {
        this.reported = true; this.ai.say(this, line('civ_report'), true);
        this.ai.noise(this.pos.clone(), 22, 'scream'); this.scare(P.pos);
      }
    }
    let speed = this.base;
    if (this.panic > 0) { this.panic -= dt; speed = 4.8; }
    if (!this.goal) {
      this.idle -= dt;
      if (this.idle <= 0) { this.goal = W.randomPublicPoint(); this.path = null; }
    }
    if (this.goal) {
      if (!this.path) { this.path = W.findPath(this.pos, this.goal) || [this.goal]; this.pi = 0; }
      const n = this.path[this.pi];
      const dx = n.x - this.pos.x, dz = n.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.5) { this.pi++; if (this.pi >= this.path.length) { this.goal = null; this.path = null; this.idle = this.panic > 0 ? 0.5 : rr(3, 12); } }
      else {
        this.speed = damp(this.speed, speed, 5, dt);
        this.pos.x += dx / d * this.speed * dt; this.pos.z += dz / d * this.speed * dt;
        this.yaw = dampAngle(this.yaw, Math.atan2(-dx, -dz), 6, dt);
      }
    } else this.speed = damp(this.speed, 0, 6, dt);
    this.pos.y = W.groundAt(this.pos.x, this.pos.z, 0.3, 0.3);
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw + Math.PI;
    animate(this.rig, { speed: this.speed, surprised: this.panic > 0 && this.speed < 1 }, dt);
  }
}

// ---------------------------------------------------------------------------
// The Cartographer: scripted target with a rooftop escape route.
class Target {
  constructor(ai) {
    this.ai = ai; this.g = ai.g;
    const W = this.g.world;
    this.rig = makeHumanoid('target');
    this.g.scene.add(this.rig.root);
    this.pos = W.designed.meeting.clone();
    this.yaw = Math.PI * 0.5;
    this.alive = true; this.state = 'meeting'; this.health = 100;
    this.name = 'The Cartographer';
    const c = W.designed.chain;
    this.route = [
      [38, c[2].h, 30.5], [42.4, c[2].h, 31], { jump: [46.2, c[3].h, 31] }, [54, c[3].h, 31], { jump: [57.8, c[4].h, 31] }, [65, c[4].h, 31],
      { jump: [69, c[5].h, 30] }, [73.5, c[5].h, 28.4], { vanish: true },
    ].map((w) => (Array.isArray(w) ? new THREE.Vector3(...w) : w.jump ? { jump: new THREE.Vector3(...w.jump) } : w));
    this.ri = 0; this.jumpT = -1; this.speed = 0; this.gazeT = 6;
  }
  hitVolumes() { return this.alive && this.state !== 'hidden' && this.state !== 'car' ? [{ c: new THREE.Vector3(this.pos.x, this.pos.y + 1.62, this.pos.z), r: 0.14, part: 'head' }, { c: new THREE.Vector3(this.pos.x, this.pos.y + 1.15, this.pos.z), r: 0.3, part: 'body' }] : []; }
  damage(amount, dir, from, part) {
    if (!this.alive) return;
    this.health -= amount;
    this.g.fx.impact(this.hitVolumes()[part === 'head' ? 0 : 1]?.c || this.pos, dir.clone().negate(), true);
    if (this.health <= 0) this.kill(part === 'head' ? 'headshot' : 'shot');
    else this.flee();
  }
  kill(how) {
    if (!this.alive) return;
    this.alive = false; this.state = 'dead'; this.how = how;
    this.g.stats.kills++; if (how === 'headshot') this.g.stats.headshots++; if (how === 'takedown') this.g.stats.takedowns++;
    this.body = { pos: this.pos, rig: this.rig, owner: this, discovered: false, dragged: false, isTarget: true };
    this.ai.bodies.push(this.body);
    this.g.fx.bloodPool(this.pos.clone());
    this.g.mission.onTargetKilled(how);
  }
  flee() {
    if (this.state !== 'meeting') return;
    this.state = 'flee';
    const talker = this.ai.guards.find((g) => g.alive && g.roof === this.ai.targetRoof);
    if (talker) talker.say('flee', true);
    this.g.mission.onTargetFlee();
  }
  update(dt) {
    const g = this.g, P = g.player;
    if (!this.alive) {
      if (this.body.dragged) this.rig.root.position.copy(this.body.pos); else this.rig.root.position.copy(this.pos);
      animate(this.rig, { dead: true }, dt); return;
    }
    if (this.state === 'meeting') {
      // He knows. Every few seconds he turns and looks straight at wherever Raven is — through walls.
      this.gazeT -= dt;
      if (this.gazeT < 0) { this.gazeYaw = Math.atan2(-(P.pos.x - this.pos.x), -(P.pos.z - this.pos.z)); if (this.gazeT < -3) { this.gazeT = rr(6, 10); g.mission.onTargetGaze(); } }
      const yaw = this.gazeT < 0 ? this.gazeYaw : Math.PI * 0.5 + Math.sin(g.time * 0.3) * 0.6;
      this.yaw = dampAngle(this.yaw, yaw, 3, dt);
      const d = P.pos.distanceTo(this.pos);
      if (this.ai.squadState >= S.ALERT || (d < 8 && !P.disguised) || (d < 3)) this.flee();
    } else if (this.state === 'flee') {
      const w = this.route[this.ri];
      if (!w) return;
      if (w.vanish) { this.state = 'hidden'; this.hideT = 6; this.rig.root.visible = false; return; }
      if (w.jump) {
        if (this.jumpT < 0) { this.jumpT = 0; this.j0 = this.pos.clone(); }
        this.jumpT += dt / 0.6;
        const t = Math.min(1, this.jumpT);
        this.pos.lerpVectors(this.j0, w.jump, t); this.pos.y = lerp(this.j0.y, w.jump.y, t) + Math.sin(Math.PI * t) * 1.2;
        this.yaw = Math.atan2(-(w.jump.x - this.j0.x), -(w.jump.z - this.j0.z));
        if (t >= 1) { this.jumpT = -1; this.ri++; g.audio.thud(this.pos, 0.5); }
        this.speed = 5;
      } else {
        const dx = w.x - this.pos.x, dz = w.z - this.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.3) this.ri++;
        else { this.speed = damp(this.speed, 5.0, 4, dt); this.pos.x += dx / d * this.speed * dt; this.pos.z += dz / d * this.speed * dt; this.pos.y = w.y; this.yaw = dampAngle(this.yaw, Math.atan2(-dx, -dz), 10, dt); }
      }
    } else if (this.state === 'hidden') {
      this.hideT -= dt;
      if (this.hideT <= 0) { this.state = 'street'; this.pos.copy(g.world.designed.exitDoor); this.rig.root.visible = true; }
    } else if (this.state === 'street') {
      const car = g.world.designed.carPos.clone().add(new THREE.Vector3(-1.2, 0, 0));
      const dx = car.x - this.pos.x, dz = car.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.4) { this.state = 'car'; this.rig.root.visible = false; this.carT = 0; g.mission.onTargetInCar(); }
      else { this.speed = 5; this.pos.x += dx / d * 5 * dt; this.pos.z += dz / d * 5 * dt; this.pos.y = g.world.groundAt(this.pos.x, this.pos.z, 0.5); this.yaw = dampAngle(this.yaw, Math.atan2(-dx, -dz), 10, dt); }
    } else if (this.state === 'car') {
      this.carT += dt;
      const car = g.world.designed.car;
      if (this.carT > 1.5) {
        const v = Math.min(14, (this.carT - 1.5) * 6);
        car.position.z -= v * dt;
        const cb = g.world.designed.carBox; cb.min.z = car.position.z - 2.15; cb.max.z = car.position.z + 2.15;
        if (car.position.z < -55) { this.state = 'escaped'; g.mission.onTargetEscaped(); }
      }
    }
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw + Math.PI;
    animate(this.rig, { speed: this.state === 'meeting' ? 0 : this.speed, surprised: false }, dt);
  }
}

// ---------------------------------------------------------------------------
export class AI {
  constructor(game) {
    this.g = game;
    this.guards = []; this.civilians = []; this.bodies = []; this.bullets = [];
    this.squadState = S.UNKNOWN;
    this.casingNoticed = new Set();
    this.radioT = 40; this.pendingMissing = []; this.reinforced = false; this.combatT = 0;
    this.radioTapped = false;
    const W = game.world;
    const T = W.designed.target; const chain = W.designed.chain;
    const roofOf = (b) => ({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, h: b.h });
    this.targetRoof = roofOf(T);
    const tr = this.targetRoof;
    const names = [...NAMES];
    const G = (cfg) => { const gd = new Guard(this, { name: names.shift(), ...cfg }); this.guards.push(gd); return gd; };
    const v = (x, y, z) => new THREE.Vector3(x, y, z);

    // Target roof
    const r1 = G({ pos: v(37, tr.h, 29.3), yaw: Math.PI, roof: tr });
    const r2 = G({ pos: v(32.5, tr.h, 25.5), roof: tr, route: [v(32.5, tr.h, 25.5), v(39, tr.h, 25.2), v(42.2, tr.h, 28.5), v(42.2, tr.h, 35.8), v(36, tr.h, 36)] });
    const r3 = G({ pos: v(33, tr.h, 32.2), yaw: 0, roof: tr });
    // Neighbouring roof sentries
    const b2 = roofOf(chain[1]);
    const s1 = G({ pos: v(20, b2.h, 25.5), roof: b2, sentry: true, route: [v(20, b2.h, 25.5), v(28, b2.h, 25.5), v(28, b2.h, 35.5)] });
    const opp = W.buildings.find((b) => b.q && b.q[0] === 1 && b.q[1] === 1 && b.q[2] === 0 && b.x0 < 38 && b.x1 > 36) || W.buildings.find((b) => b.q && b.q[0] === 1 && b.q[1] === 1 && b.q[2] === 0);
    if (opp) { const o = roofOf(opp); G({ pos: v((o.x0 + o.x1) / 2, o.h, o.z1 - 0.9), roof: o, sentry: true, route: [v(o.x0 + 1, o.h, o.z1 - 0.9), v(o.x1 - 1, o.h, o.z1 - 0.9)] }); }
    // Back lane
    const a1 = G({ pos: v(29.5, 0, 39), route: [v(29.5, 0, 38.6), v(45.5, 0, 38.6)] });
    const a2 = G({ pos: v(45, 0, 39.6), route: [v(45, 0, 39.6), v(30, 0, 39.6)] });
    const door = G({ pos: v(37, 0, 22.6), yaw: 0 });
    const booth = G({ pos: v(46.6, 0, 39.9), yaw: -Math.PI / 2 });
    // Street patrols (public space: only behaviour gets you noticed)
    const p1 = G({ pos: v(12, 0.18, 5.9), route: [v(12, 0.18, 5.9), v(62, 0.18, 5.9)] });
    const p2 = G({ pos: v(60, 0.18, -5.9), route: [v(60, 0.18, -5.9), v(14, 0.18, -5.9)] });
    const car = G({ pos: v(79.4, 0, 20.4), yaw: Math.PI / 2 });
    // buddy pairs for radio check-ins
    const pair = (a, b) => { a.buddy = b; b.buddy = a; };
    pair(r1, r3); pair(r2, s1); pair(a1, a2); pair(door, booth); pair(p1, p2); car.buddy = door;
    this.boothGuard = booth;

    for (let i = 0; i < 38; i++) this.civilians.push(new Civilian(this, W.randomPublicPoint()));
    this.target = new Target(this);
  }

  civiliansNear(p, r) { let n = 0; for (const c of this.civilians) if (c.alive && c.pos.distanceToSquared(p) < r * r) n++; return n; }

  say(who, l, force) {
    const P = this.g.player;
    const d = who.pos.distanceTo(P.pos);
    const radio = who instanceof Guard && this.radioTapped;
    if (d > 28 && !radio && !force) return;
    if (d > 45 && !radio) return;
    this.g.ui.speech(who.name || (who instanceof Civilian ? 'Civilian' : ''), l.bn, l.en, d > 28 && radio ? 'radio' : 'voice');
    if (radio && d > 28) this.g.audio.radio();
  }

  // Global stimulus bus.
  noise(pos, radius, type) {
    for (const gd of this.guards) {
      if (!gd.alive) continue;
      const d = gd.pos.distanceTo(pos);
      if (d > radius) continue;
      if (type === 'gunshot' || type === 'explosion') { gd.lastKnown = pos.clone(); gd.aw = 100; if (gd.state < S.ALERT) gd.setState(S.ALERT, type); else if (gd.state === S.HUNT) gd.goal = pos.clone(); }
      else if (type === 'footsteps') { gd.aw = Math.min(100, gd.aw + 18); gd.lastKnown = pos.clone(); gd.lookAt = pos.clone(); if (gd.state === S.UNKNOWN && gd.aw >= 25) gd.setState(S.SUSPICION); }
      else gd.investigate(pos, type);
    }
    if (type === 'gunshot' || type === 'explosion' || type === 'scream' || (type === 'suppressed' && radius > 3)) {
      for (const c of this.civilians) if (c.pos.distanceTo(pos) < (type === 'suppressed' ? 6 : type === 'scream' ? 10 : 45)) c.scare(pos);
    }
  }

  alarm(src, why) {
    // Radio: everyone converges / hunts at the reported location.
    const at = (src.lastKnown || src.pos).clone();
    for (const gd of this.guards) {
      if (!gd.alive || gd === src) continue;
      if (gd.state < S.ALERT) { gd.lastKnown = at.clone(); gd.goal = at.clone(); gd.aw = Math.max(gd.aw, 70); gd.state = S.HUNT; gd.stateT = 0; gd.path = null; }
    }
    // secure the exit: the car guard holds, one guard flanks
    const flank = this.guards.find((g) => g.alive && !g.roof && g !== src && g.state === S.HUNT);
    if (flank && !flank.flanker) { flank.flanker = true; this.g.after(1.5, () => flank.say('flank', true)); }
    this.g.after(2.5, () => { const h = this.guards.find((g) => g.alive && g.state === S.HUNT); if (h) h.say('hunt', true); });
  }

  onKilled(gd, how) {
    const st = this.g.stats;
    st.kills++;
    if (how === 'headshot') st.headshots++;
    if (how === 'takedown') st.takedowns++;
    gd.missingSince = this.g.time;
  }

  fireBullet(gd) {
    const g = this.g, P = g.player;
    const muzzle = new THREE.Vector3();
    if (gd.rig.weapon) gd.rig.weapon.localToWorld(muzzle.copy(gd.rig.weapon.userData.muzzle)); else muzzle.copy(gd.eye);
    const aimAt = P.chest.clone();
    const d = muzzle.distanceTo(aimAt);
    // Accuracy builds with continuous sight: the first burst is suppressive, not lethal.
    gd.trackT = (gd.trackT || 0);
    const settle = 1 + 2.4 * Math.exp(-gd.trackT / 2.5);
    const spread = (0.045 + d * 0.003 + P.speed * 0.02 + (P.crouch ? 0.015 : 0) + g.weather.effective * 0.015) * settle;
    aimAt.add(new THREE.Vector3((rand() - 0.5), (rand() - 0.5) * 0.7, (rand() - 0.5)).multiplyScalar(spread * d));
    const dir = aimAt.sub(muzzle).normalize();
    this.bullets.push({ p: muzzle.clone(), v: dir.clone().multiplyScalar(85), life: 2.5, whizzed: false });
    g.fx.muzzle(muzzle, dir, true, g.veil.amount);
    g.audio.shot('rifle', muzzle, false);
    this.noise(gd.pos.clone(), 40, 'gunshot');
  }

  updateBullets(dt) {
    if (dt <= 0) return;
    const g = this.g, P = g.player, W = g.world;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const step = b.v.clone().multiplyScalar(dt);
      const len = step.length();
      const dir = step.clone().divideScalar(len);
      const wh = W.colliders.length ? g.combat.worldRay(b.p, dir, len) : null;
      // player capsule approx: two spheres
      let hitP = false;
      for (const [c, r] of [[P.chest, 0.32], [P.headPos, 0.16]]) {
        const oc = b.p.clone().sub(c);
        const bb = oc.dot(dir), cc = oc.lengthSq() - r * r, h = bb * bb - cc;
        if (h >= 0) { const t = -bb - Math.sqrt(h); if (t >= 0 && t <= len && (!wh || t < wh.t)) { hitP = true; break; } }
        // near miss
        const closest = Math.sqrt(Math.max(0, oc.lengthSq() - bb * bb));
        if (!b.whizzed && closest < 1.2 && -bb > 0 && -bb < len) { b.whizzed = true; g.audio.whizz(b.p); P.veilCharge = Math.min(100, P.veilCharge + 3); }
      }
      if (g.veil.active) g.fx.tracer(b.p, b.p.clone().add(step.clone().multiplyScalar(-6)), '#ffd8a0', 0.03);
      if (hitP && P.health > 0) { P.hurt(g.veil.active ? 5 : 8, b.p); this.bullets.splice(i, 1); continue; }
      // One projectile can hit only one civilian; compare against the nearest world surface.
      let civilianHit = null, civilianT = wh ? wh.t : len;
      for (const c of this.civilians) if (c.alive) for (const hv of c.hitVolumes()) {
        const oc = b.p.clone().sub(hv.c), bb = oc.dot(dir), disc = bb*bb - (oc.lengthSq()-hv.r*hv.r);
        if (disc >= 0) { const t = -bb-Math.sqrt(disc); if (t>=0 && t<civilianT) { civilianHit=c; civilianT=t; } }
      }
      if (civilianHit) { civilianHit.damage(); g.stats.civByEnemy++; this.bullets.splice(i,1); continue; }
      if (wh) { g.fx.impact(b.p.clone().addScaledVector(dir, wh.t), wh.normal, false); this.bullets.splice(i, 1); continue; }
      b.p.add(step); b.life -= dt;
      if (b.life <= 0) this.bullets.splice(i, 1);
    }
  }

  radioCheck(dt) {
    // Missing patrol members: periodic check-ins over radio.
    this.radioT -= dt;
    if (this.radioT <= 0) {
      this.radioT = 35;
      for (const gd of this.guards) {
        if (!gd.alive || !gd.buddy || gd.buddy.alive || gd.buddy.reportedMissing || gd.state >= S.ALERT) continue;
        if (this.g.time - gd.buddy.missingSince < 15) continue;
        gd.buddy.reportedMissing = true;
        gd.missingName = gd.buddy.name;
        gd.say('missing', true);
        const buddy = gd.buddy;
        this.g.after(6, () => {
          if (!gd.alive) return;
          gd.missingName = buddy.name; gd.say('noanswer', true);
          gd.investigate(buddy.pos.clone(), 'silent');
          for (const o of this.guards) if (o.alive) o.bias = Math.min(3, o.bias + 0.8);
        });
        break;
      }
    }
    // disabled cameras get noticed by the booth guard
    for (const c of this.g.world.cameras) {
      if (!c.alive && !c.noticed && this.g.time - c.deadAt > 15 && this.boothGuard.alive) {
        c.noticed = true; this.boothGuard.say('camera', true);
        const n = this.guards.find((g) => g.alive && !g.roof && g !== this.boothGuard && g.state < S.ALERT);
        if (n) n.investigate(c.p.clone().setY(0), 'silent');
      }
    }
  }

  cameraPerceive(dt) {
    const g = this.g, P = g.player, W = g.world;
    for (const c of W.cameras) {
      if (!c.alive) continue;
      const to = P.chest.clone().sub(c.p); const d = to.length();
      const f = new THREE.Vector3(Math.sin(c.yaw), -0.35, Math.cos(c.yaw)).normalize();
      const seen = d < 18 && to.normalize().dot(f) > Math.cos(0.45) && segmentClear(c.p, P.chest, W.colliders) && !P.disguised;
      c.awareness = seen ? Math.min(100, c.awareness + 90 * dt * (W.isRestricted(P.pos) || P.aiming ? 1 : 0.15)) : Math.max(0, c.awareness - 20 * dt);
      c.led.material.color.set(c.awareness > 30 ? '#ffd020' : '#ff2020');
      if (c.awareness >= 100 && this.squadState < S.ALERT) {
        c.awareness = 0;
        const bg = this.boothGuard.alive ? this.boothGuard : this.guards.find((x) => x.alive);
        if (bg) { bg.lastKnown = P.pos.clone(); bg.aw = 100; bg.setState(S.ALERT, 'camera'); }
      }
    }
  }

  update(dt) {
    for (const gd of this.guards) gd.update(dt);
    for (const c of this.civilians) c.update(dt);
    this.target.update(dt);
    this.updateBullets(dt);
    this.radioCheck(dt);
    this.cameraPerceive(dt);
    let s = S.UNKNOWN, maxAw = 0, loud = null;
    for (const gd of this.guards) if (gd.alive) { if (gd.state > s) s = gd.state; if (gd.aw > maxAw) { maxAw = gd.aw; loud = gd; } }
    this.squadState = s; this.maxAw = maxAw; this.loudest = loud;
    if (s >= S.ALERT) this.combatT += dt; else this.combatT = Math.max(0, this.combatT - dt);
    if (s === S.COMBAT && this.combatT > 22 && !this.reinforced) this.reinforce();
  }

  reinforce() {
    this.reinforced = true;
    const lead = this.guards.find((g) => g.alive && g.state >= S.ALERT);
    if (lead) lead.say('backup', true);
    this.g.after(9, () => {
      for (let i = 0; i < 3; i++) {
        const gd = new Guard(this, { name: `Unit-${i + 4}`, pos: new THREE.Vector3(81 + i, 0, 45 - i * 1.5) });
        gd.lastKnown = this.g.player.pos.clone(); gd.goal = gd.lastKnown.clone(); gd.aw = 80; gd.state = S.HUNT; gd.bias = 2;
        this.guards.push(gd);
      }
      this.g.ui.speech('HANDLER', '', 'Three more coming in from the east road. Move.', 'handler');
    });
  }

  // For HUD edge indicators
  threats() {
    return this.guards.filter((g) => g.alive && (g.aw > 8 || g.state >= S.SUSPICION)).map((g) => ({ pos: g.pos, aw: g.aw, state: g.state, tagged: g.tagged }));
  }
}

export { Guard, STATES };
