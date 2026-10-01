import * as THREE from 'three';
import { qualitySettings, QUALITY } from './quality.js';
import { SimulationTimers } from './physics.js';
import { DHAKA_SECTORS } from './dhaka.js';
import { World } from './world.js';
import { Player, WEAPONS } from './player.js';
import { AI } from './ai.js';
import { Combat } from './combat.js';
import { Veil } from './veil.js';
import { Weather } from './weather.js';
import { Effects, Post } from './fx.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { Mission01 } from './mission01.js';
import { MISSIONS } from './missions.js';
import { rayBoxes, clamp, damp, lerp, S, segmentClear } from './util.js';

class Input {
  constructor() {
    this.keys = new Set(); this.pressedSet = new Set();
    this.mouse = [false, false, false]; this.mousePressedSet = new Set();
    this.mdx = 0; this.mdy = 0;
    addEventListener('keydown', (e) => {
      if (['Tab', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressedSet.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('mousedown', (e) => { this.mouse[e.button] = true; this.mousePressedSet.add(e.button); });
    addEventListener('mouseup', (e) => { this.mouse[e.button] = false; });
    addEventListener('mousemove', (e) => { if (document.pointerLockElement) { this.mdx += e.movementX; this.mdy += e.movementY; } });
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('blur', () => { this.keys.clear(); this.mouse = [false, false, false]; });
  }
  down(c) { return this.keys.has(c); }
  pressed(c) { return this.pressedSet.has(c); }
  mousePressed(b) { return this.mousePressedSet.has(b); }
  endFrame() { this.pressedSet.clear(); this.mousePressedSet.clear(); this.mdx = 0; this.mdy = 0; }
}

class Game {
  constructor() {
    const q = new URLSearchParams(location.search);
    this.quality = QUALITY[q.get('q')] ? q.get('q') : 'high';
    this.settings = qualitySettings(this.quality);
    this.timers = new SimulationTimers();
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.settings.pixelRatio));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = this.settings.shadows > 0;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2('#37444e', 0.014);
    this.scene.background = null;
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 900);
    this.WEAPONS = WEAPONS;

    this.input = new Input();
    this.audio = new Audio();
    this.world = new World(this.scene, this.renderer, this.quality);
    this.weather = new Weather(this.scene, this.world, this.audio);
    this.fx = new Effects(this.scene, this.world, this.audio);
    this.post = new Post(this.renderer, this.scene, this.camera);
    this.stats = { shots: 0, hits: 0, kills: 0, headshots: 0, takedowns: 0, detections: 0, bodiesFound: 0, damage: 0, civilians: 0, civByEnemy: 0, lightsOut: 0, veil: 0, intel: 0 };
    this.player = new Player(this);
    this.veil = new Veil(this);
    this.combat = new Combat(this);
    this.ai = new AI(this);
    this.ui = new UI(this);
    this.mission = new Mission01(this);
    this.cam = { shake: 0, fov: 62, dist: 3.3, sway: new THREE.Vector2(), pos: new THREE.Vector3(-60, 20, 30) };

    this.state = 'title';
    this.modal = null;
    this.time = 0; this.realTime = 0;
    this.observe = 0; this.observeT = 0;
    this.silence = false;
    this.clock = new THREE.Clock();
    addEventListener('resize', () => this.resize());
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.state === 'play' && !this.modal) this.pause(true);
    });
    this.renderer.domElement.addEventListener('click', () => { if (this.state === 'play' && !this.modal && !document.pointerLockElement) this.lock(); });
    this.bindMenus();
    if (import.meta.env.DEV && q.has('verify')) import('./verification.js').then(m => m.mountVerification(this));
    this.renderer.setAnimationLoop(() => this.frame());
    document.getElementById('loading').classList.add('gone');
    if (sessionStorage.getItem('veil.retry')) { sessionStorage.removeItem('veil.retry'); this.openBriefing(); }
  }

  after(seconds, fn) { return this.timers.after(seconds, fn); }
  lock() {
    try { const p = this.renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* needs a user gesture */ }
  }
  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    this.post.resize(); this.ui.resize(); this.world.resize();
  }

  // ---------------------------------------------------------------- menus
  bindMenus() {
    const $ = (id) => document.getElementById(id);
    let prog = {};
    try { prog = JSON.parse(localStorage.getItem('veil.progress') || '{}'); } catch (e) { /* ignore */ }
    this.prog = prog;
    $('titleStart').onclick = () => { this.audio.init(); this.openArchive(); };
    $('archiveBack').onclick = () => { this.ui.show('archive', false); this.ui.show('title'); };
    $('briefGo').onclick = () => this.begin();
    $('volume').value = Math.round(this.audio.volume*100); $('volumeValue').textContent = `${Math.round(this.audio.volume*100)}%`;
    $('volume').oninput = e => { this.audio.setVolume(Number(e.target.value)/100); $('volumeValue').textContent = `${e.target.value}%`; };
    $('calmAudio').checked = this.audio.calmEnabled; $('calmAudio').onchange = e => this.audio.setCalm(e.target.checked);
    $('quality').value = this.quality;
    $('quality').onchange = e => { const u = new URL(location.href); u.searchParams.set('q', e.target.value); location.href = u.href; };
    $('resume').onclick = () => this.pause(false);
    $('restart').onclick = () => { sessionStorage.setItem('veil.retry', '1'); location.reload(); };
    $('toTitle').onclick = () => location.reload();
    $('docClose').onclick = () => this.closeModal();
    $('cctvClose').onclick = () => this.closeModal();
    $('deadRetry').onclick = () => { sessionStorage.setItem('veil.retry', '1'); location.reload(); };
    $('debriefArchive').onclick = () => location.reload();
    this.ui.show('title');
    // tagline sequence
    setTimeout(() => $('title').classList.add('t1'), 600);
    setTimeout(() => $('title').classList.add('t2'), 2600);
    setTimeout(() => $('title').classList.add('t3'), 4200);
  }
  openArchive() {
    const $ = (id) => document.getElementById(id);
    this.ui.show('title', false);
    const done = !!this.prog.m01;
    const corr = { '05': 'STATUS: COMPLETED · 11.02.2026 · OPERATIVE: RAVEN', '04': 'STATUS: COMPLETED · 03.12.2025', '09': 'STATUS: OPERATIVE RAVEN — TERMINATED' };
    $('archiveList').innerHTML = MISSIONS.map((m) => {
      const status = m.playable ? (done ? 'STATUS: COMPLETED' : 'STATUS: ACTIVE') : done && corr[m.id] ? corr[m.id] : 'RECORD SEALED';
      return `<div class="rec ${m.playable ? 'playable' : ''} ${done && corr[m.id] ? 'corrupt' : ''}" data-id="${m.id}">
        <div class="num">${m.id}</div><div class="meta"><h3>${m.title}</h3><div class="loc">${m.loc} · <i>${m.theme}</i></div><p>${m.brief}</p><div class="st">${status}</div></div></div>`;
    }).join('');
    $('archiveList').querySelectorAll('.rec.playable').forEach((el) => el.onclick = () => { this.audio.uiTick(); this.openBriefing(); });
    $('archiveList').querySelectorAll('.rec:not(.playable)').forEach((el) => el.onclick = () => { this.audio.uiTick(300); el.classList.add('denied'); setTimeout(() => el.classList.remove('denied'), 600); });
    this.ui.show('archive');
  }
  openBriefing() {
    this.ui.show('title', false); this.ui.show('archive', false);
    this.ui.show('briefing');
  }
  begin() {
    this.audio.init();
    for (const id of ['title', 'archive', 'briefing']) this.ui.show(id, false);
    document.body.classList.add('playing');
    this.state = 'play';
    this.time = 0; this.weather.clock = 0;
    this.mission.start();
    this.lock();
  }
  pause(on) {
    if (this.state !== 'play' && this.state !== 'paused') return;
    this.state = on ? 'paused' : 'play';
    this.ui.show('pause', on);
    if (!on) this.lock();
    if (this.audio.ctx) on ? this.audio.ctx.suspend() : this.audio.ctx.resume();
  }
  closeModal() {
    const was = this.modal;
    this.modal = null;
    this.ui.show('doc', false); this.ui.show('cctv', false); this.ui.show('board', false); this.ui.show('map', false);
    if (was && this.state === 'play') this.lock();
  }
  onPlayerDeath() {
    this.veil.exit();
    this.ui.letterbox(true);
    setTimeout(() => { this.state = 'dead'; document.exitPointerLock?.(); this.ui.show('dead'); }, 2600);
  }
  fail(title, sub) {
    this.state = 'dead';
    document.exitPointerLock?.();
    document.getElementById('deadT').textContent = title;
    document.getElementById('deadS').textContent = sub;
    this.ui.show('dead');
  }
  debrief(data) {
    this.state = 'debrief';
    document.exitPointerLock?.();
    const $ = (id) => document.getElementById(id);
    $('debriefRows').innerHTML = data.rows.map(([k, v]) => `<div class="row"><span>${k}</span><p>${v}</p></div>`).join('');
    this.ui.show('debrief');
    setTimeout(() => $('debrief').classList.add('t1'), 3500);
    setTimeout(() => $('debrief').classList.add('t2'), 7500);
    setTimeout(() => $('debrief').classList.add('t3'), 10500);
  }

  // ---------------------------------------------------------------- camera
  updateCamera(dt) {
    const P = this.player, cam = this.camera, c = this.cam;
    const fwd = new THREE.Vector3(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch));
    const right = new THREE.Vector3(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
    const rifleScope = P.aiming && P.current === 'rifle';
    const targetDist = P.aiming ? (rifleScope ? 1.1 : 1.55) : P.sprint ? 3.9 : P.climbing ? 4.2 : 3.3;
    c.dist = damp(c.dist, targetDist, 8, dt);
    P.shoulderLerp = damp(P.shoulderLerp, P.shoulder, 10, dt);
    c.height = damp(c.height ?? 1.62, P.slide ? 0.9 : P.crouch ? 1.15 : 1.62, 14, dt);
    const pivot = P.pos.clone().add(new THREE.Vector3(0, c.height, 0));
    const side = right.clone().multiplyScalar((P.aiming ? 0.5 : 0.62) * P.shoulderLerp);
    // keep the shoulder offset out of walls
    const sideLen = side.length();
    const sh = rayBoxes(pivot, side.clone().normalize(), sideLen + 0.2, this.world.colliders);
    const shoulder = pivot.clone().addScaledVector(side, sh ? Math.max(0, (sh.t - 0.2) / sideLen) : 1);
    const want = shoulder.clone().addScaledVector(fwd, -c.dist);
    const back = fwd.clone().negate();
    const hit = rayBoxes(shoulder, back, c.dist + 0.25, this.world.colliders, (b) => b.tag !== 'vehicle' || b.max.y > 2);
    if (hit) want.copy(shoulder).addScaledVector(back, Math.max(0.3, hit.t - 0.25));
    P.camPos.copy(want);
    cam.position.copy(want);
    // handheld: subtle breathing sway, stronger in combat; shake from impacts
    const t = this.realTime;
    const combat = this.ai.squadState >= S.COMBAT ? 1 : 0;
    const swayA = (0.0015 + combat * 0.002) * (1 - this.veil.amount * 0.7) * (rifleScope ? 0.5 : 1);
    c.shake = Math.max(0, c.shake - dt * 2.2);
    const sk = c.shake * c.shake * 0.08;
    const look = want.clone().add(fwd);
    look.x += Math.sin(t * 1.3) * swayA + (Math.random() - 0.5) * sk;
    look.y += Math.sin(t * 1.9) * swayA * 0.7 + (Math.random() - 0.5) * sk;
    look.y += P.recoil * 0.013;
    cam.lookAt(look);
    const fov = (rifleScope ? 24 : P.aiming ? 50 : P.sprint ? 66 : 62) - this.veil.amount * 7;
    c.fov = damp(c.fov, fov, 10, dt);
    cam.fov = c.fov; cam.updateProjectionMatrix();
    // audio listener
    const L = this.audio.listener; L.x = cam.position.x; L.y = cam.position.y; L.z = cam.position.z; L.yaw = P.yaw + Math.PI;
    this.post.u.lens.value = this.weather.effective * 0.7 * (this.isSheltered(cam.position) ? 0 : 1);
  }
  isSheltered(p) {
    return !!rayBoxes(p, new THREE.Vector3(0, 1, 0), 30, this.world.colliders);
  }

  titleCamera(dt) {
    // Slow crane over the rooftops toward the green sign.
    const t = this.realTime * 0.04;
    const cam = this.camera;
    const p = new THREE.Vector3(-20 + Math.sin(t) * 40, 22 + Math.sin(t * 0.7) * 4, 6 + Math.cos(t) * 10);
    cam.position.lerp(p, 1 - Math.exp(-dt * 0.8));
    cam.lookAt(37, 12, 24);
    cam.fov = 50; cam.updateProjectionMatrix();
    const L = this.audio.listener; L.x = cam.position.x; L.y = cam.position.y; L.z = cam.position.z; L.yaw = 0;
  }

  // ---------------------------------------------------------------- frame
  frame() {
    const realDt = Math.min(this.clock.getDelta(), 0.1);
    this.presentationTime = (this.presentationTime || 0) + realDt;
    if (this.state !== 'paused') this.realTime += realDt;
    const inp = this.input;

    if (this.state === 'play' && !this.modal) {
      this.veil.update(realDt, inp);
      const wdt = realDt * this.veil.worldScale;
      const pdt = realDt * this.veil.playerScale;
      this.time += wdt;
      this.timers.update(wdt);
      this.player.update(pdt, inp);
      this.handleActions(inp);
      this.ai.update(wdt);
      this.world.update(wdt, this.time, this.camera.position, this.player);
      this.weather.update(wdt, realDt, this.camera.position, this.veil.amount);
      this.fx.update(wdt);
      this.mission.update(wdt, realDt);
      this.updateCamera(realDt);
      this.player.weaponUpdate(pdt, inp, null, new THREE.Vector3(Math.cos(this.player.yaw),0,-Math.sin(this.player.yaw)));
      this.updateObserve(realDt, inp);
      this.ui.update(realDt);
      if (this.player.health > 0 && this.time - this.player.lastHurt > 6) this.player.health = Math.min(100, this.player.health + realDt * 6);
      this.post.u.veil.value = this.veil.amount;
      this.post.u.observe.value = this.observe;
    } else if (this.state === 'play' && this.modal) {
      if (inp.pressed('Escape') || inp.pressed('KeyM') || inp.pressed('KeyE') || inp.pressed('Tab') || inp.pressed('Enter') || inp.pressed('Space')) {
        if (this.modal === 'reveal') this.mission.closeReveal(); else this.closeModal();
      }
      this.mission.update(0, realDt);
      this.ui.update(realDt);
    } else if (this.state === 'title') {
      this.time += realDt;
      this.ai.update(realDt);
      this.world.update(realDt, this.time, this.camera.position, null);
      this.weather.update(realDt, realDt, this.camera.position, 0);
      this.titleCamera(realDt);
    } else if (this.state === 'inspection') {
      this.time += realDt; this.world.update(realDt,this.time,this.camera.position,null);
      this.weather.update(realDt,realDt,this.camera.position,0);
    } else if (this.state === 'debrief' || this.state === 'dead') {
      this.time += realDt * 0.3;
      this.world.update(realDt * 0.3, this.time, this.camera.position, null);
      this.weather.update(realDt * 0.3, realDt, this.camera.position, 0);
    }
    this.audio.tension = damp(this.audio.tension, this.ai.squadState >= S.ALERT ? 1 : this.ai.maxAw / 120, 1.5, realDt);
    this.audio.combat = damp(this.audio.combat, this.ai.squadState >= S.COMBAT ? 1 : this.ai.squadState >= S.ALERT ? 0.5 : 0, 1, realDt);
    const honker = this.world.vehicles.find((v) => v.honk || Math.random() < 0.02);
    const bell = this.world.vehicles.find((v) => v.type === 'rickshaw' && v.mesh.position.distanceTo(this.camera.position) < 40);
    for (const v of this.world.vehicles) v.honk = false;
    if (this.state !== 'paused') this.audio.update(realDt, {
      genPos: this.world.designed.generator, genOn: !this.world.designed.genDead,
      honkPos: honker?.mesh.position, bellPos: bell?.mesh.position,
      lowHealth: this.player.health < 35 && this.state === 'play', silence: this.silence || this.state === 'title' && false,
      indoor: this.isSheltered(this.camera.position), musicMute: this.modal === 'reveal',
    });
    this.post.render(this.state === 'paused' ? 0 : realDt);
    inp.endFrame();
  }

  handleActions(inp) {
    const P = this.player;
    if (P.health <= 0) return;
    if (inp.pressed('Escape')) { this.pause(true); document.exitPointerLock?.(); return; }
    if (inp.pressed('KeyM')) { this.ui.map(); this.modal = 'map'; document.exitPointerLock?.(); return; }
    // interaction prompt priority: takedown > interact > drag
    const tdCand = [...this.ai.guards, this.ai.target].find((c) => c.alive && c.pos.distanceTo(P.pos) < 1.7 && Math.abs(c.pos.y - P.pos.y) < 1.2 && c.rig.root.visible !== false);
    const acts = this.mission.interactables();
    const body = !P.dragging && this.ai.bodies.find((b) => b.pos.distanceTo(P.pos) < 1.6);
    let prompt = '';
    if (tdCand) prompt += `<kbd>F</kbd> ${tdCand.state >= S.COMBAT ? 'Disarm & kill' : 'Takedown'}`;
    if (acts[0]) prompt += `${prompt ? '&nbsp;&nbsp;' : ''}<kbd>E</kbd> ${acts[0].text}`;
    if (body) prompt += `${prompt ? '&nbsp;&nbsp;' : ''}<kbd>G</kbd> Drag body`;
    if (P.dragging) prompt = '<kbd>G</kbd> Drop body';
    this.ui.prompt(prompt);
    if (inp.pressed('KeyF') && tdCand) this.combat.tryTakedown();
    if (inp.pressed('KeyE') && acts[0]) acts[0].fn();
    if (inp.pressed('KeyG')) {
      if (P.dragging) P.drop();
      else if (body) { P.dragging = body; body.dragged = true; P.crouch = false; }
    }
    if (inp.pressed('Tab')) { this.ui.board(this.mission.board, this.mission.integrity); this.ui.show('board'); this.modal = 'board'; document.exitPointerLock?.(); }
    if (inp.pressed('KeyH')) document.body.classList.toggle('help');
  }

  updateObserve(dt, inp) {
    const on = inp.down('KeyX');
    this.observe = damp(this.observe, on ? 1 : 0, 8, dt);
    if (!on) return;
    // Tag guards in view: marks persist (intelligence gathering, not wallhacks — needs line of sight).
    const cam = this.camera;
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    for (const gd of this.ai.guards) {
      if (!gd.alive || gd.tagged) continue;
      const to = gd.pos.clone().add(new THREE.Vector3(0, 1.4, 0)).sub(cam.position);
      const d = to.length();
      if (d > 60 || dir.angleTo(to) > 0.45) continue;
      if (segmentClear(cam.position, gd.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), this.world.colliders)) { gd.tagged = true; this.audio.uiTick(1600); }
    }
    const T = this.ai.target;
    if (T.alive && !this.mission.targetKnown) {
      const to = T.pos.clone().add(new THREE.Vector3(0, 1.4, 0)).sub(cam.position);
      if (to.length() < 90 && dir.angleTo(to) < 0.2 && segmentClear(cam.position, T.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), this.world.colliders)) this.mission.revealTarget();
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try { window.game = new Game(); }
  catch (e) { console.error(e); document.getElementById('loading').textContent = 'VEIL failed to start: ' + e.message; }
});
