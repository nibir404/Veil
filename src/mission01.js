import * as THREE from 'three';
import { makeHumanoid, animate } from './characters.js';
import { S, clamp, damp } from './util.js';
import { CORRUPTIONS } from './missions.js';

// MISSION 01 — THE CITY THAT NEVER SLEEPS · Dhaka · Paranoia
// OBSERVE → INFILTRATE → MANIPULATE → ASSASSINATE → ESCALATE → SURVIVE → QUESTION REALITY

const v = (x, y, z) => new THREE.Vector3(x, y, z);

export class Mission01 {
  constructor(game) {
    this.g = game;
    const W = game.world;
    this.active = false;
    this.phase = 'infiltrate';
    this.clock = 23 * 3600 + 21 * 60; // in-world time: 23:21
    this.targetKnown = false;
    this.board = [
      { title: 'OPERATION ORDER 01', body: 'TARGET: THE CARTOGRAPHER. Intelligence broker. Sells locations — of people, safehouses, operatives.<br>AREA: Old Dhaka.<br>ROE: minimise civilian exposure.', src: 'HANDLER · ZAHIR', kind: 'order' },
      { title: 'PHOTOGRAPH', body: 'Identification photograph — <b>SEALED</b>. Open on confirmation only.', src: 'ATTACHED TO ORDER 01', kind: 'photo' },
    ];
    this.integrity = 100;
    const chain = W.designed.chain;
    const tea = W.teaStall;
    this.items = [
      { id: 'phone', label: 'INTEL · PHONE', pos: tea.phonePos.clone().setY(0.5), taken: false, prompt: 'Read the phone left on the bench' },
      { id: 'radio', label: 'INTEL · RADIO LOG', pos: v(25.5, 0.9, 21.2), taken: false, prompt: 'Read the guard\'s radio log' },
      { id: 'cctv', label: 'INTEL · CCTV', pos: W.designed.boothPos.clone().add(v(-1.3, 1.3, 0)), taken: false, prompt: 'Access the security terminal' },
      { id: 'file', label: 'INTEL · FILE', pos: v(chain[1].x0 + 1.4, chain[1].h + 0.4, chain[1].z1 - 2.5), taken: false, prompt: 'Open the envelope' },
      { id: 'uniform', label: 'NIRAPOTTA JACKET', pos: v(chain[0].x0 + 3, chain[0].h + 0.9, chain[0].z0 + 3), taken: false, prompt: 'Take the security jacket (disguise)' },
    ];
    // physical props for items
    for (const it of this.items) {
      const geo = it.id === 'uniform' ? new THREE.BoxGeometry(0.5, 0.7, 0.08) : it.id === 'cctv' ? new THREE.BoxGeometry(0.05, 0.05, 0.05) : new THREE.BoxGeometry(0.22, 0.03, 0.3);
      const col = it.id === 'uniform' ? '#3a4452' : it.id === 'phone' ? '#101418' : '#d8d0b8';
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, emissive: it.id === 'phone' ? '#4a8aff' : '#000', emissiveIntensity: 0.5 }));
      m.position.copy(it.pos); if (it.id === 'uniform') m.position.y += 0.3;
      game.scene.add(m); it.mesh = m;
    }
    // crate under the radio log
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.85, 0.9), W.woodMat); crate.position.set(25.5, 0.42, 21.2); game.scene.add(crate);

    // The man in the white panjabi.
    this.white = makeHumanoid('white');
    game.scene.add(this.white.root);
    const opp = W.buildings.find((b) => b.q && b.q[0] === 1 && b.q[1] === 1 && b.q[2] === 0 && b.x1 > 20 && b.x0 < 28);
    this.whiteSpots = [v(-44, 0.18, 6.4), v(-1.5, 0, 26), v(15, 0, 22.4), opp ? v((opp.x0 + opp.x1) / 2, opp.h, opp.z1 - 1) : v(20, 0, 20), v(-60, 0.18, -6.2)];
    this.whiteIdx = 0; this.whiteSeen = 0; this.whiteGone = false;
    this.placeWhite();

    this.dryDone = false; this.dryT = 0;
    this.gazeCount = 0;
    this.radioDone = false;
    this.lines = [];
  }

  // ---------------------------------------------------------------- flow
  start() {
    this.active = true;
    const g = this.g;
    g.player.pos.set(-74, 0.18, 5.8);
    g.player.yaw = -Math.PI / 2; g.player.bodyYaw = -Math.PI / 2;
    g.ui.objective('Find the Cartographer', 'Observe [X]. Listen. Nobody here knows your face — yet.');
    this.queue([
      [1.5, () => g.ui.handler('Raven, you\'re in. Old Dhaka, grid seven. Rain\'s going to hold all night.')],
      [6.5, () => g.ui.handler('The Cartographer is somewhere in this block. We don\'t have a building. We have a photograph — sealed. Open it when you confirm.')],
      [13, () => g.ui.handler('Walk like you belong. On the street you\'re nobody. On their roofs you\'re a target.')],
      [19, () => g.ui.raven('...Copy.')],
    ]);
    g.weather.schedule = [{ at: 150, to: 1 }, { at: 320, to: 0.55 }, { at: 460, to: 0.95 }];
  }

  queue(list) { for (const [t, fn] of list) this.lines.push({ t: this.g.realTime + t, fn }); }

  observables() {
    const W = this.g.world, P = this.g.player;
    const out = [];
    for (const it of this.items) if (!it.taken) out.push({ pos: it.pos, label: it.label, range: 40, col: '#bfe3ff' });
    if (!W.designed.genDead) out.push({ pos: W.designed.generator.clone().add(v(0, 1.2, 0)), label: 'GENERATOR · FUEL', range: 70, col: '#ffb070' });
    for (const c of W.cameras) if (c.alive) out.push({ pos: c.p, label: 'CCTV', range: 40, col: '#ff8080' });
    for (const l of W.lamps) if (!l.broken && (l.street || l.bulb) && l.pos.distanceTo(P.pos) < 22) out.push({ pos: l.pos, label: 'LIGHT', range: 22, col: '#ffe0a0' });
    const T = this.g.ai.target;
    if (this.targetKnown && T.alive && T.rig.root.visible) out.push({ pos: T.pos.clone().setY(T.pos.y + 2.2), label: 'THE CARTOGRAPHER', range: 160, col: '#ff5050' });
    if (this.phase === 'exfil') out.push({ pos: W.designed.extraction.clone().setY(1.5), label: 'EXTRACTION', range: 200, col: '#80ffb0' });
    return out;
  }

  interactables() {
    const g = this.g, P = g.player;
    const out = [];
    for (const it of this.items) if (!it.taken && it.pos.distanceTo(P.eye) < 2.2) out.push({ text: it.prompt, fn: () => this.take(it) });
    for (const b of g.ai.bodies) {
      if (b.pos.distanceTo(P.pos) > 1.8) continue;
      if (b.isTarget && !this.searched) out.push({ text: 'Search the body', fn: () => this.reveal() });
      else if (b.hasRifle && !P.weapons.rifle) out.push({ text: 'Take KR-7 carbine (unsuppressed)', fn: () => { b.hasRifle = false; P.weapons.rifle = { ...g.WEAPONS.rifle, ammo: 30, res: 60 }; g.audio.pickup(); g.ui.toast('KR-7 ACQUIRED · [2] TO EQUIP'); } });
      else if (b.hasRifle && P.weapons.rifle && P.weapons.rifle.res < 150) out.push({ text: 'Take magazines', fn: () => { b.hasRifle = false; P.weapons.rifle.res += 30; g.audio.pickup(); } });
    }
    if (this.phase === 'exfil' && P.pos.distanceTo(g.world.designed.extraction) < 5) out.push({ text: 'Extract', fn: () => this.complete() });
    return out;
  }

  take(it) {
    const g = this.g;
    it.taken = true; if (it.mesh) it.mesh.visible = false;
    g.audio.pickup();
    g.stats.intel += it.id === 'uniform' ? 0 : 1;
    if (it.id === 'phone') {
      g.ui.doc('A PHONE, LEFT ON THE BENCH', `<div class="sms"><div class="from">UNKNOWN · 22:58</div><div class="bn">মিটিং সরানো হয়েছে। রহমান টেলিকম, ছাদ। ১১:৪০। একা আসবেন।</div><div class="en">Meeting moved. Rahman Telecom, roof. 11:40. Come alone.</div></div>
        <div class="sms"><div class="from">UNKNOWN · 23:02</div><div class="bn">সে আসছে।</div><div class="en">He's coming.</div></div>`, 'The cha-wala says the owner left twenty minutes ago. He didn\'t come back for it.');
      this.board.push({ title: 'SMS · RECOVERED PHONE', body: '"Meeting moved. Rahman Telecom, roof. 11:40."<br>"He\'s coming."', src: 'TEA STALL, MAIN ROAD' });
      this.revealTarget();
      this.queue([[1, () => g.ui.handler('Rahman Telecom. East side of the block, the green sign. Good.')], [5, () => g.ui.handler('"He\'s coming." ...Someone tipped him. Stay sharp.')]]);
    } else if (it.id === 'radio') {
      g.ai.radioTapped = true;
      g.ui.doc('RADIO LOG · NIRAPOTTA SECURITY', `<pre>CH-4  ROTATION 23:00–03:00
ROOF (RT)    KARIM · JAMAL · SOHEL
ROOF (N/W)   RUBEL (DMR)
LANE (BACK)  FARUK · SHAKIL  — check-in every 35s
DOOR         BABUL       BOOTH  TANVIR
STREET       RASEL · NAYEEM
CAR          LITON  (east road, engine warm)

NOTE: CAM 03 back lane — sweep blind 40°
NOTE: generator on RT roof leaking diesel, DO NOT SMOKE</pre>`, 'You tune your earpiece to CH-4. You can hear their radio now.');
      this.board.push({ title: 'RADIO LOG', body: 'Patrol rotation, buddy check-ins every 35s. Car waiting on east road. Roof generator leaking diesel.', src: 'FRONT ALLEY' });
      this.queue([[1, () => g.ui.handler('You\'re on their channel. Nice. Leaking diesel next to his meeting... I\'m just saying.')]]);
    } else if (it.id === 'cctv') {
      this.openCCTV();
      this.board.push({ title: 'CCTV · CAM 03', body: 'Feed shows <b>you</b>, standing at this terminal.<br>Timestamp: 3 minutes <b>ahead</b> of the clock.', src: 'SECURITY BOOTH', corrupt: true });
      this.integrity -= 3;
      this.revealTarget();
    } else if (it.id === 'file') {
      g.ui.doc('ENVELOPE · INTERNAL', `<div class="file"><div class="row"><span>TARGET</span><b>RAHMAN</b></div><div class="row"><span>STATUS</span><b class="red">KILLED</b></div><div class="row"><span>OPERATIVE</span><b>RAVEN</b></div><div class="row"><span>DATE</span><b>14.08.2025</b></div><div class="row"><span>LOCATION</span><b>RAHMAN TELECOM, OLD DHAKA</b></div><p class="note">Handwritten, in the margin: “again?”</p></div>`, 'You have never heard of anyone called Rahman. You were not in Dhaka in August.');
      this.board.push({ title: 'FILE · RAHMAN', body: 'TARGET: RAHMAN<br>STATUS: <b class="red">KILLED</b><br>OPERATIVE: RAVEN · 14.08.2025', src: 'ROOFTOP, NEXT TO TARGET', corrupt: true });
      this.integrity -= 4;
      this.queue([[1.5, () => g.ui.raven('Zahir. Who was Rahman?')], [4.5, () => g.ui.handler('The shop? It\'s just a name on a sign, Raven. Focus.')]]);
    } else if (it.id === 'uniform') {
      g.player.disguised = true;
      g.player.rig.root.traverse((o) => { if (o.isMesh && o.material.color && o.material.color.getHexString() === '1d2226') o.material.color.set('#3a4452'); });
      g.ui.toast('DISGUISED · NIRAPOTTA SECURITY');
      g.ui.handler('Their jacket buys you distance, not trust. Don\'t let them get close, and don\'t run.');
    }
  }

  revealTarget() {
    if (this.targetKnown) return;
    this.targetKnown = true;
    this.g.ui.objective('Eliminate the Cartographer', 'Rahman Telecom · rooftop meeting');
  }

  openCCTV() {
    const g = this.g, P = g.player;
    const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 200);
    cam.position.set(g.world.designed.boothPos.x - 1.2, 4.1, g.world.designed.boothPos.z - 2.2);
    cam.lookAt(P.pos.x, P.pos.y + 1, P.pos.z);
    const rt = new THREE.WebGLRenderTarget(480, 270);
    const prevVeil = g.post.u.veil.value;
    g.renderer.setRenderTarget(rt); g.renderer.render(g.scene, cam); g.renderer.setRenderTarget(null);
    const px = new Uint8Array(480 * 270 * 4); g.renderer.readRenderTargetPixels(rt, 0, 0, 480, 270, px);
    const c = document.createElement('canvas'); c.width = 480; c.height = 270;
    const cx = c.getContext('2d'); const img = cx.createImageData(480, 270);
    for (let y = 0; y < 270; y++) for (let x = 0; x < 480; x++) { const s = ((269 - y) * 480 + x) * 4, d = (y * 480 + x) * 4; for (let k = 0; k < 3; k++) img.data[d + k] = Math.min(255, Math.pow(px[s + k] / 255, 1 / 2.2) * 255 * 1.6); img.data[d + 3] = 255; }
    cx.putImageData(img, 0, 0);
    rt.dispose();
    g.post.u.veil.value = prevVeil;
    const t = this.clock + 180;
    const hh = String(Math.floor(t / 3600) % 24).padStart(2, '0'), mm = String(Math.floor(t / 60) % 60).padStart(2, '0'), ss = String(Math.floor(t) % 60).padStart(2, '0');
    g.ui.cctv(c, `2026-09-29  ${hh}:${mm}:${ss}`);
    this.queue([[0.5, () => g.ui.raven('That\'s me.')], [3, () => g.ui.handler('Probably a delay on their recorder. What\'s the route on the other feeds?')], [7, () => g.ui.raven('Roof to roof, east. Down the last stairwell. His car\'s on the east road.')]]);
    this.lastCCTV = c.toDataURL();
  }

  // ---------------------------------------------------------------- target events
  onTargetGaze() {
    if (!this.active || this.gazeCount > 2) return;
    const d = this.g.player.pos.distanceTo(this.g.ai.target.pos);
    if (d > 70) return;
    this.gazeCount++;
    if (this.gazeCount === 1) this.g.ui.handler('He just turned and looked right at your position. Through the wall. That\'s... not possible.');
    if (this.gazeCount === 2) this.g.ui.raven('He keeps doing that.');
  }
  onTargetFlee() {
    if (!this.active) return;
    this.phase = 'chase';
    this.revealTarget();
    this.g.ui.objective('He\'s running — stop him before he reaches the car', 'Roof to roof, east');
    this.g.ui.handler('He\'s bolting across the roofs! Don\'t lose him!');
    this.g.stats.chase = true;
  }
  onTargetInCar() { if (this.active) this.g.ui.handler('He\'s at the car — Raven, the car!'); }
  onTargetEscaped() {
    if (!this.active) return;
    this.g.ui.handler('...He\'s gone. We lost him.');
    setTimeout(() => this.g.fail('THE CARTOGRAPHER ESCAPED', 'He knew the roofs. He knew the car. He knew you.'), 2500);
  }
  onTargetKilled(how) {
    if (!this.active) return;
    const g = this.g, P = g.player, T = g.ai.target;
    const d = P.pos.distanceTo(T.pos);
    g.stats.approach = how === 'environment' ? 'ENVIRONMENTAL' : how === 'takedown' ? (P.disguised ? 'SOCIAL · CLOSE' : 'SILENT · CLOSE') : d > 35 ? 'LONG RANGE' : g.ai.squadState >= S.COMBAT ? 'TACTICAL ASSAULT' : P.disguised ? 'SOCIAL' : 'PRECISION';
    g.stats.killDist = d;
    this.phase = 'confirm';
    g.ui.objective('Confirm the kill', 'Search the body');
    this.queue([[0.8, () => g.ui.handler(how === 'environment' ? 'That... is one way to do it. Target down. Confirm with the photograph.' : 'Target down. Confirm with the photograph. Then get out.')]]);
    if (d > 35) this.queue([[5, () => g.ui.handler('You\'ll have to get to him. I need visual confirmation.')]]);
  }

  // ---------------------------------------------------------------- the photograph
  reveal() {
    const g = this.g, P = g.player;
    this.searched = true;
    g.modal = 'reveal';
    // Photograph Raven. The "identification photo" is rendered from the live scene.
    const cam = new THREE.PerspectiveCamera(17, 0.8, 0.05, 80);
    const head = P.headPos;
    const f = new THREE.Vector3(-Math.sin(P.bodyYaw), 0, -Math.cos(P.bodyYaw));
    cam.position.copy(head).addScaledVector(f, 2.0).add(v(0, 0.12, 0));
    cam.lookAt(head.x, head.y - 0.08, head.z);
    const flash = new THREE.PointLight('#fff4e0', 3, 8); flash.position.y += 0.6; flash.position.add(cam.position); g.scene.add(flash);
    const wasAim = P.rig.weapon; if (wasAim) P.rig.weapon.visible = false;
    const W = 400, H = 500, rt = new THREE.WebGLRenderTarget(W, H);
    g.renderer.setRenderTarget(rt); g.renderer.render(g.scene, cam); g.renderer.setRenderTarget(null);
    g.scene.remove(flash); if (wasAim) P.rig.weapon.visible = true;
    const px = new Uint8Array(W * H * 4); g.renderer.readRenderTargetPixels(rt, 0, 0, W, H, px); rt.dispose();
    const c = document.createElement('canvas'); c.width = W; c.height = H + 90;
    const x = c.getContext('2d');
    x.fillStyle = '#efe9dc'; x.fillRect(0, 0, W, H + 90);
    const img = x.createImageData(W - 40, H - 40);
    for (let yy = 0; yy < H - 40; yy++) for (let xx = 0; xx < W - 40; xx++) {
      const s = ((H - 21 - yy) * W + xx + 20) * 4, d = (yy * (W - 40) + xx) * 4;
      const l = Math.pow((px[s] * 0.3 + px[s + 1] * 0.59 + px[s + 2] * 0.11) / 255, 1 / 2.2) * 255 * 1.35 + (Math.random() - 0.5) * 26;
      img.data[d] = l * 1.05 + 8; img.data[d + 1] = l * 0.95 + 4; img.data[d + 2] = l * 0.8; img.data[d + 3] = 255;
    }
    x.putImageData(img, 20, 20);
    x.fillStyle = '#ff8a2a'; x.font = 'bold 18px "JetBrains Mono", monospace'; x.fillText('12 03 2019', W - 150, H - 32);
    x.fillStyle = '#2a2a60'; x.font = '30px "Caveat", "Bradley Hand", cursive'; x.fillText('Cartographer — confirm on sight', 24, H + 44);
    this.photo = c.toDataURL('image/jpeg', 0.9);
    const el = document.getElementById('reveal');
    document.getElementById('revealImg').src = this.photo;
    el.className = 'on s1';
    g.audio.tension = 1;
    g.ui.letterbox(true);
    setTimeout(() => el.classList.add('s2'), 3200);
    setTimeout(() => el.classList.add('s3'), 7200);
    setTimeout(() => el.classList.add('s4'), 10500);
    setTimeout(() => { el.classList.add('s5'); this.revealReady = true; }, 13500);
    // the board updates
    this.board[1] = { title: 'PHOTOGRAPH', body: 'Identification photograph for THE CARTOGRAPHER.<br>Dated 12.03.2019 — two years before your recruitment.', img: this.photo, src: 'RECOVERED FROM TARGET', kind: 'photo', corrupt: true };
    this.board.push({ title: 'QUESTION', body: 'Who was hunting whom?', src: '—', kind: 'q' });
    this.integrity -= 11;
  }
  closeReveal() {
    const g = this.g;
    if (!this.revealReady) return;
    document.getElementById('reveal').className = '';
    g.modal = null; g.ui.letterbox(false);
    g.audio.tension = 0.3;
    this.phase = 'exfil';
    g.ui.objective('Get out', 'Extraction · west end of the main road');
    this.queue([[1, () => g.ui.handler('Raven? Talk to me. Is it him?')], [4.5, () => g.ui.raven('...It\'s him.')], [8, () => g.ui.handler('Good. West end. A rickshaw will be waiting.')]]);
  }

  complete() {
    const g = this.g;
    this.phase = 'done';
    g.debrief(this.debriefText());
    try {
      const prog = JSON.parse(localStorage.getItem('veil.progress') || '{}');
      prog.m01 = true; prog.photo = this.photo ? true : false;
      localStorage.setItem('veil.progress', JSON.stringify(prog));
    } catch (e) { /* storage unavailable */ }
  }

  debriefText() {
    const s = this.g.stats;
    const acc = s.shots ? Math.round((s.hits / s.shots) * 100) : null;
    const rows = [
      ['APPROACH', s.approach || 'UNKNOWN'],
      ['STEALTH', s.detections === 0 ? 'They never saw you. Some of them will still swear they did.' : `Seen ${s.detections} time${s.detections > 1 ? 's' : ''}. ${s.bodiesFound ? `${s.bodiesFound} bod${s.bodiesFound > 1 ? 'ies' : 'y'} found. ` : ''}Nirapotta will circulate your silhouette by morning.`],
      ['PRECISION', acc === null ? 'You did not fire a single round.' : `${s.shots} rounds, ${acc}% on target, ${s.headshots} headshot${s.headshots === 1 ? '' : 's'}. ${s.shots > 60 ? 'Loud. Expensive.' : s.shots < 8 ? 'Economical.' : ''}`],
      ['INTELLIGENCE', `${s.intel} of 4 records recovered. ${s.intel >= 2 ? 'At least one of them contradicts the others.' : 'You went in blind. He didn\'t.'}`],
      ['DAMAGE', s.damage < 1 ? 'Untouched.' : s.damage < 60 ? `Minor wounds. ${Math.round(s.damage)} points of blood on Old Dhaka's stones.` : `You should be dead. ${Math.round(s.damage)} damage absorbed.`],
      ['CIVILIAN IMPACT', s.civilians === 0 ? 'No civilians harmed. Old Dhaka will wake up and not know you were here.' : `${s.civilians} civilian${s.civilians > 1 ? 's' : ''} hurt${s.civByEnemy ? ` (${s.civByEnemy} by Nirapotta fire)` : ''}. Tomorrow's papers will call it a gang dispute.`],
      ['TACTICAL EFFICIENCY', `${s.kills} killed · ${s.takedowns} takedown${s.takedowns === 1 ? '' : 's'} · ${s.lightsOut} light${s.lightsOut === 1 ? '' : 's'} shot out · Veil State ×${s.veil} · ${Math.floor(this.g.time / 60)}m ${Math.floor(this.g.time % 60)}s`],
    ];
    return { rows, corruptions: CORRUPTIONS };
  }

  // ---------------------------------------------------------------- surreal systems
  placeWhite() {
    const p = this.whiteSpots[this.whiteIdx];
    if (!p) { this.white.root.visible = false; this.whiteGone = true; return; }
    this.white.root.position.copy(p); this.white.root.visible = true; this.whiteSeen = 0;
  }
  updateWhite(dt) {
    if (this.whiteGone) return;
    const g = this.g, P = g.player, root = this.white.root;
    if (this.whiteIdx === 4 && this.phase !== 'exfil') { root.visible = false; return; }
    root.visible = true;
    const to = P.pos.clone().sub(root.position);
    root.rotation.y = Math.atan2(to.x, to.z);
    animate(this.white, { speed: 0 }, dt);
    const camDir = new THREE.Vector3(); g.camera.getWorldDirection(camDir);
    const toW = root.position.clone().add(v(0, 1.5, 0)).sub(g.camera.position);
    const dist = toW.length();
    const ang = camDir.angleTo(toW.normalize());
    const onScreen = ang < 0.55;
    if (onScreen && dist < 45) this.whiteSeen += dt * (ang < 0.12 ? 1.5 : 0.5);
    if (dist < 6) this.whiteSeen = 5;
    // once noticed, he is gone the moment you look away
    if (this.whiteSeen > 1.2 && !onScreen) {
      this.whiteIdx++;
      if (this.whiteIdx === 2) this.queue([[0.5, () => g.ui.raven('Zahir. The man in white. Is he one of ours?')], [3.5, () => g.ui.handler('What man?')]]);
      this.placeWhite();
    }
  }
  updateDry(dt) {
    const g = this.g, P = g.player;
    const inZone = P.pos.x > -34 && P.pos.x < -16 && P.pos.z > 20 && P.pos.z < 24.2 && P.pos.y < 1;
    if (!this.dryDone && inZone) { this.dryDone = true; this.dryT = 7; }
    if (this.dryT > 0) {
      this.dryT -= dt;
      g.weather.dryOverride = damp(g.weather.dryOverride, this.dryT > 0.3 ? 1 : 0, 12, dt);
      g.silence = this.dryT > 0.3;
      if (this.dryT <= 0) {
        g.weather.dryOverride = 0; g.silence = false;
        this.queue([[1, () => g.ui.raven('Zahir... is it still raining where you are?')], [4, () => g.ui.handler('It\'s been raining all night, Raven. Why?')], [7, () => g.ui.raven('No reason.')]]);
      }
    }
  }
  updateRadio() {
    const g = this.g, P = g.player;
    if (this.radioDone || this.phase !== 'exfil') return;
    if (P.pos.distanceTo(g.world.teaStall.radioPos) < 9) {
      this.radioDone = true;
      g.ui.speech('RADIO', 'ঢাকায় আজ রাতে ভারী বর্ষণের সম্ভাবনা...', '...heavy rain expected over Dhaka tonight...', 'radio');
      setTimeout(() => g.ui.speech('RADIO', '', '...you already know what\'s in the photograph, Raven.', 'wrong'), 4200);
      setTimeout(() => g.ui.raven('...'), 8200);
    }
  }

  update(dt, realDt) {
    if (!this.active) return;
    this.clock += dt;
    const now = this.g.realTime;
    this.lines = this.lines.filter((l) => { if (now >= l.t) { l.fn(); return false; } return true; });
    this.updateWhite(realDt);
    this.updateDry(realDt);
    this.updateRadio();
    // discovering the target by sight
    const T = this.g.ai.target, P = this.g.player;
    if (!this.targetKnown && T.alive && P.pos.distanceTo(T.pos) < 30) this.revealTarget();
    for (const it of this.items) if (it.mesh && !it.taken) it.mesh.rotation.y += realDt * (it.id === 'uniform' ? 0 : 0.3);
  }
}
