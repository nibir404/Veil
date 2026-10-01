import * as THREE from 'three';
import { missionNavigation, groundRoute } from './navigation.js';
import { DHAKA_SECTORS } from './dhaka.js';
import { S, STATES, clamp } from './util.js';
import { Minimap } from './minimap.js';

const STATE_COL = ['rgba(200,210,220,0.0)', 'rgba(230,230,220,0.9)', 'rgba(240,180,60,0.95)', 'rgba(255,120,40,1)', 'rgba(255,110,40,1)', 'rgba(235,40,40,1)'];
const $ = (id) => document.getElementById(id);

export class UI {
  constructor(game) {
    this.g = game;
    this.canvas = $('overlay');
    this.ctx = this.canvas.getContext('2d');
    this.subs = $('subs');
    this.minimap = new Minimap(game);
    this.resize();
    this.hurtA = 0; this.hurtDir = null; this.hitT = 0;
    this.stateShown = -1; this.navTimer = 0;
  }
  resize() {
    this.canvas.width = innerWidth * devicePixelRatio;
    this.canvas.height = innerHeight * devicePixelRatio;
    if (this.minimap) this.minimap.resize();
  }

  show(id, on = true) { $(id).classList.toggle('on', on); }
  objective(text, sub = '') { $('obj').innerHTML = text ? `<span class="k">OBJECTIVE</span>${text}${sub ? `<em>${sub}</em>` : ''}` : ''; $('obj').classList.remove('flash'); void $('obj').offsetWidth; $('obj').classList.add('flash'); }

  speech(name, bn, en, kind = 'voice') {
    const el = document.createElement('div');
    el.className = `sub ${kind}`;
    el.innerHTML = `<b>${name}</b>${bn ? `<span class="bn">“${bn}”</span>` : ''}<span class="en">${en}</span>`;
    this.subs.appendChild(el);
    while (this.subs.children.length > 4) this.subs.firstChild.remove();
    const life = 2500 + en.length * 55;
    setTimeout(() => el.classList.add('out'), life);
    setTimeout(() => el.remove(), life + 700);
  }
  handler(text) { this.g.audio.radio(); this.speech('HANDLER · ZAHIR', '', text, 'handler'); }
  raven(text) { this.speech('RAVEN', '', text, 'raven'); }
  fragment(text) {
    const el = $('fragment'); el.textContent = text; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  }
  toast(text, bad) {
    const el = $('toast'); el.textContent = text; el.className = bad ? 'bad' : ''; void el.offsetWidth; el.classList.add('on');
    clearTimeout(this._tt); this._tt = setTimeout(() => el.classList.remove('on'), 1800);
  }
  prompt(text) { const el = $('prompt'); if (el._t !== text) { el.innerHTML = text || ''; el._t = text; } el.classList.toggle('on', !!text); }
  hurt(amount, relAngle) { this.hurtA = Math.min(1, this.hurtA + amount / 40); this.hurtDir = relAngle; this.hurtDirA = 1; }
  hitmarker(kill) { this.hitT = 0.18; this.hitKill = kill; }
  letterbox(on) { document.body.classList.toggle('cine', on); }

  // ---------------------------------------------------------------- frame HUD
  update(dt) {
    const g = this.g, P = g.player, ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, dpr = devicePixelRatio;
    ctx.clearRect(0, 0, W, H);
    this.hurtA = Math.max(0, this.hurtA - dt * 0.8);
    this.hitT -= dt;
    g.post.u.hurt.value = this.hurtA;

    this.navTimer -= dt;
    if (this.navTimer <= 0) {
      this.navTimer = 0.3;
      this.navigation = missionNavigation(g);
      const n = this.navigation;
      $('navTitle').textContent = n ? n.title : '';
      $('navHint').textContent = n ? n.instruction : '';
    }
    if (this.navigation) {
      const to = this.navigation.pos.clone().sub(P.pos);
      $('navDistance').textContent = `${Math.round(to.length())} m`;
      const desiredYaw = Math.atan2(-to.x, -to.z);
      $('navArrow').style.transform = `rotate(${P.yaw-desiredYaw}rad)`;
    }

    // vitals
    $('hp').style.width = `${P.health}%`;
    $('hp').parentElement.classList.toggle('low', P.health < 35);
    $('vc').style.width = `${P.veilCharge}%`;
    $('vc').parentElement.classList.toggle('ready', P.veilCharge >= 50);
    const w = P.weapon;
    $('wpn').innerHTML = `<span>${w.name}</span><b>${String(w.ammo).padStart(2, '0')}</b><i>/ ${w.res}</i>${P.reloading > 0 ? '<em>RELOADING</em>' : ''}`;
    $('wpn').classList.toggle('dim', !P.aiming && P.fireCd < -2);
    $('stance').textContent = [P.disguised ? 'DISGUISED' : '', P.crouch ? 'LOW' : '', P.dragging ? 'CARRYING' : '', P.slide ? 'SLIDING' : '', g.world.isRestricted(P.pos) ? 'RESTRICTED' : ''].filter(Boolean).join(' · ');

    // awareness readout: only when someone is paying attention
    const st = g.ai.squadState;
    const aw = g.ai.maxAw;
    const label = st >= S.SUSPICION ? STATES[st] : aw > 8 ? 'OBSERVED' : '';
    const el = $('aware');
    if (el._l !== label) { el.textContent = label; el._l = label; el.style.color = STATE_COL[Math.max(1, st)]; }
    el.classList.toggle('on', !!label);

    // edge arcs for every guard that has noticed something
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.3;
    for (const t of g.ai.threats()) {
      const rel = Math.atan2(t.pos.x - P.pos.x, t.pos.z - P.pos.z);
      const a = -(rel - (P.yaw + Math.PI)) - Math.PI / 2;
      const col = STATE_COL[Math.max(1, t.state)];
      const frac = clamp(t.aw / 100, 0.15, 1);
      ctx.strokeStyle = col; ctx.globalAlpha = 0.35 + frac * 0.65; ctx.lineWidth = (2 + frac * 3) * dpr;
      ctx.beginPath(); ctx.arc(cx, cy, R, a - 0.12 - frac * 0.1, a + 0.12 + frac * 0.1); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // hurt direction
    if (this.hurtDir !== null && this.hurtDirA > 0) {
      this.hurtDirA -= dt;
      const a = -this.hurtDir - Math.PI / 2 - Math.PI;
      ctx.strokeStyle = `rgba(220,30,30,${this.hurtDirA})`; ctx.lineWidth = 6 * dpr;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.8, a - 0.25, a + 0.25); ctx.stroke();
    }
    // tagged guards + observe-mode intel
    const cam = g.camera;
    const v = new THREE.Vector3();
    const proj = (p) => { v.copy(p).project(cam); return v.z < 1 ? [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H] : null; };
    for (const gd of g.ai.guards) {
      if (!gd.alive || !gd.tagged) continue;
      const s = proj(gd.pos.clone().setY(gd.pos.y + 2.1)); if (!s) continue;
      const col = STATE_COL[Math.max(1, gd.state)];
      ctx.save(); ctx.translate(s[0], s[1]); ctx.rotate(Math.PI / 4);
      const sz = 6 * dpr; ctx.strokeStyle = col; ctx.lineWidth = 1.5 * dpr; ctx.strokeRect(-sz / 2, -sz / 2, sz, sz);
      ctx.fillStyle = col; const f = clamp(gd.aw / 100, 0, 1); ctx.fillRect(-sz / 2, sz / 2 - sz * f, sz, sz * f);
      ctx.restore();
    }
    if (g.observe > 0.05) {
      ctx.font = `${10 * dpr}px "JetBrains Mono", monospace`; ctx.textAlign = 'center';
      const items = g.mission.observables();
      for (const it of items) {
        const s = proj(it.pos); if (!s) continue;
        const d = it.pos.distanceTo(P.pos); if (d > it.range) continue;
        ctx.globalAlpha = g.observe * clamp(1 - d / it.range + 0.3, 0, 1);
        ctx.fillStyle = it.col || '#cfe8ff'; ctx.strokeStyle = it.col || '#cfe8ff';
        ctx.beginPath(); ctx.arc(s[0], s[1], 3 * dpr, 0, 7); ctx.stroke();
        ctx.fillText(it.label, s[0], s[1] - 8 * dpr);
        ctx.globalAlpha = 1;
      }
    }
    // GTA Vice City circular radar mini-map
    if (g.input.pressed('KeyZ')) this.minimap.toggleZoom();
    this.minimap.update(dt, this.navigation);

    // crosshair
    const xh = $('xh');
    xh.classList.toggle('on', P.aiming);
    xh.classList.toggle('hit', this.hitT > 0);
    xh.classList.toggle('kill', this.hitT > 0 && this.hitKill);
    $('scope').classList.toggle('on', P.aiming && P.current === 'rifle');
  }

  map() {
    this.show('map');
    const c = $('mapCanvas'), ctx = c.getContext('2d'), W = this.g.world, P = this.g.player;
    const sx = x => (x + 90) / 180 * c.width, sz = z => (62-z)/112*c.height;
    ctx.fillStyle = '#101b20'; ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle = '#243d43'; ctx.fillRect(0,sz(-43),c.width,c.height);
    for (const b of W.buildings.filter(b=>b.q)) {
      ctx.fillStyle = '#4a5453';ctx.fillRect(sx(b.x0),sz(b.z1),sx(b.x1)-sx(b.x0),sz(b.z0)-sz(b.z1));
      ctx.strokeStyle = '#68726c';ctx.strokeRect(sx(b.x0),sz(b.z1),sx(b.x1)-sx(b.x0),sz(b.z0)-sz(b.z1));
    }
    const nav = missionNavigation(this.g);
    const route = groundRoute(W,P.pos,nav);
    ctx.strokeStyle='#a9d8cd';ctx.lineWidth=3;ctx.setLineDash([8,6]);
    if(route.length){ctx.beginPath();ctx.moveTo(sx(P.pos.x),sz(P.pos.z));for(const p of route)ctx.lineTo(sx(p.x),sz(p.z));ctx.stroke();}
    else if(nav){ctx.beginPath();ctx.moveTo(sx(P.pos.x),sz(P.pos.z));ctx.lineTo(sx(nav.pos.x),sz(nav.pos.z));ctx.stroke();}
    ctx.setLineDash([]);
    ctx.textAlign='center';ctx.font='12px monospace';ctx.fillStyle='#d4c9a5';
    for(const sector of DHAKA_SECTORS)ctx.fillText(sector.name,sx(sector.x),sz(sector.z)-5);
    const marker = (p,color,label) => {ctx.fillStyle=color;ctx.beginPath();ctx.arc(sx(p.x),sz(p.z),5,0,Math.PI*2);ctx.fill();ctx.fillText(label,sx(p.x),sz(p.z)-12);};
    marker(P.pos,'#b5e1e0','YOU / RAVEN');
    if(nav)marker(nav.pos,'#f5d69b',nav.kind==='entry'?'ENTER HERE · CLIMB 18 m':nav.title);
    const spawn = {x:-74,z:5.8};marker(spawn,'#92a293','INSERTION');
    $('mapObjective').textContent = nav ? nav.title : 'OPERATION COMPLETE';
    $('mapInstruction').textContent = nav ? nav.instruction : 'Return to the operations archive.';
    $('mapRouteNote').textContent = P.pos.y > 2 ? 'Dashed line: bearing only on rooftops. Check gaps and ledges before moving.' : 'Dashed line: suggested ground route. Gold marker: your next action.';
    if(this.g.mission.targetKnown && this.g.ai.target.alive)marker(W.designed.meeting,'#d8947b','LAST KNOWN MEETING');
    if(this.g.mission.phase==='exfil')marker(W.designed.extraction,'#9ac99e','EXTRACTION');
    $('mapClose').onclick=()=>this.g.closeModal();
  }

  // ---------------------------------------------------------------- overlays
  doc(title, html, stamp) {
    $('docT').textContent = title; $('docB').innerHTML = html; $('docS').textContent = stamp || '';
    this.show('doc'); this.g.modal = 'doc';
  }
  cctv(canvas, stampText) {
    const c = $('cctvC'); const g2 = c.getContext('2d');
    g2.drawImage(canvas, 0, 0, c.width, c.height);
    const img = g2.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) { const l = img.data[i] * 0.3 + img.data[i + 1] * 0.59 + img.data[i + 2] * 0.11; const n = (Math.random() - 0.5) * 40; img.data[i] = l * 0.8 + n; img.data[i + 1] = l * 1.05 + n; img.data[i + 2] = l * 0.9 + n; }
    g2.putImageData(img, 0, 0);
    for (let y = 0; y < c.height; y += 3) { g2.fillStyle = 'rgba(0,0,0,0.25)'; g2.fillRect(0, y, c.width, 1); }
    g2.fillStyle = '#e8ffe8'; g2.font = '14px "JetBrains Mono", monospace';
    g2.fillText('CAM 03 · BACK LANE · REC ●', 12, 22); g2.fillText(stampText, 12, c.height - 14);
    this.show('cctv'); this.g.modal = 'cctv';
  }
  board(entries, integrity) {
    const b = $('boardCards');
    b.innerHTML = entries.map((e, i) => `<div class="card ${e.kind || ''} ${e.corrupt ? 'corrupt' : ''}" style="--r:${(i % 2 ? 1 : -1) * (1 + (i * 7) % 3)}deg">
      ${e.img ? `<img src="${e.img}">` : ''}<h4>${e.title}</h4><p>${e.body}</p><small>${e.src || ''}</small></div>`).join('') || '<p class="empty">No intelligence recovered. Observe. Listen. Search.</p>';
    $('integrity').textContent = `BOARD INTEGRITY ${integrity}%`;
    $('integrity').classList.toggle('warn', integrity < 100);
  }
}
