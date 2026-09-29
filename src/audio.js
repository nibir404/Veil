// Fully procedural soundscape (no audio files). In the UE5 build this maps to MetaSounds +
// Quartz; the bus layout (world / music / ui / heart) and the Veil State ducking are identical.

const SCALE = [146.83, 155.56, 174.61, 196.0, 220.0, 233.08, 261.63, 293.66, 311.13, 349.23]; // D phrygian-ish, folk colour

export class Audio {
  constructor() {
    this.ready = false;
    this.veil = 0;
    this.tension = 0;
    this.combat = 0;
    this.rain = 1;
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
  }

  init() {
    if (this.ready) return;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    this.worldFilter = ctx.createBiquadFilter(); this.worldFilter.type = 'lowpass'; this.worldFilter.frequency.value = 20000;
    this.worldGain = ctx.createGain();
    this.worldFilter.connect(this.worldGain).connect(this.master);
    this.world = this.worldFilter;

    this.music = ctx.createGain(); this.music.gain.value = 0.5; this.music.connect(this.master);
    this.ui = ctx.createGain(); this.ui.gain.value = 0.8; this.ui.connect(this.master);
    this.heartBus = ctx.createGain(); this.heartBus.gain.value = 0.0; this.heartBus.connect(this.master);

    // Urban reverb: generated impulse, wet send from world bus.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.6, 2.4);
    this.revSend = ctx.createGain(); this.revSend.gain.value = 0.35;
    this.revSend.connect(this.reverb).connect(this.worldFilter);

    this.noise = this.makeNoise(3);
    this.brown = this.makeBrown(4);

    // rain bed (2 layers) + city rumble
    this.rainA = this.loop(this.noise, { type: 'highpass', f: 900 }, 0.0, this.world);
    this.rainB = this.loop(this.brown, { type: 'lowpass', f: 420 }, 0.0, this.world);
    this.city = this.loop(this.brown, { type: 'lowpass', f: 180 }, 0.22, this.world);
    // positional generator hum
    this.gen = this.hum([50, 100, 150], 0.0);
    this.drone = this.makeDrone();
    this.nextPluck = 4; this.nextFlute = 12; this.nextHonk = 1; this.nextBell = 3; this.nextBeat = 0; this.beatStep = 0;
    this.nextHeart = 0;
    this.ready = true;
  }

  makeNoise(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  makeBrown(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    return b;
  }
  impulse(sec, decay) {
    const len = this.ctx.sampleRate * sec;
    const b = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 400 ? i / 400 : 1); }
    return b;
  }
  loop(buf, filt, gain, dest) {
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = filt.type; f.frequency.value = filt.f;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(dest); src.start();
    return { src, f, g };
  }
  hum(freqs, gain) {
    const g = this.ctx.createGain(); g.gain.value = gain;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    for (const fr of freqs) { const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; const og = this.ctx.createGain(); og.gain.value = 0.3 / freqs.length; o.connect(og).connect(f); o.start(); }
    const pan = this.ctx.createStereoPanner();
    f.connect(g).connect(pan).connect(this.world);
    return { g, pan };
  }
  makeDrone() {
    const ctx = this.ctx;
    const out = ctx.createGain(); out.gain.value = 0;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 3;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 220; lfo.connect(lg).connect(f.frequency); lfo.start();
    for (const [fr, det] of [[73.42, -6], [73.42, 7], [110, 3], [36.7, 0]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det;
      const g = ctx.createGain(); g.gain.value = 0.12; o.connect(g).connect(f); o.start();
    }
    f.connect(out).connect(this.music);
    return out;
  }

  // Positional helper: returns a node chain start routed through gain+pan (+distance lowpass).
  spatial(pos, vol = 1, maxDist = 80) {
    const L = this.listener;
    const dx = pos.x - L.x, dz = pos.z - L.z, dy = (pos.y || 0) - L.y;
    const d = Math.hypot(dx, dy, dz);
    const att = Math.max(0, 1 - d / maxDist) ** 2 * vol;
    const ang = Math.atan2(dx, dz) - L.yaw;
    const pan = this.ctx.createStereoPanner(); pan.pan.value = Math.max(-1, Math.min(1, -Math.sin(ang) * 0.9));
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000 - Math.min(d / maxDist, 1) * 16000;
    const g = this.ctx.createGain(); g.gain.value = att;
    lp.connect(g).connect(pan).connect(this.world);
    const send = this.ctx.createGain(); send.gain.value = Math.min(1, d / 30) * 0.9 + 0.1; g.connect(send).connect(this.revSend);
    return { input: lp, att, d };
  }

  burst(dest, { dur = 0.1, f = 1000, q = 1, type = 'bandpass', gain = 1, attack = 0.002, buf, rate = 1 }) {
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = buf || this.noise; s.playbackRate.value = rate;
    const fl = this.ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(fl).connect(g).connect(dest); s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
    return fl;
  }
  tone(dest, { f = 440, f2, dur = 0.2, type = 'sine', gain = 0.5, attack = 0.004, when = 0 }) {
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------------ events
  shot(kind, pos, isPlayer) {
    if (!this.ready) return;
    const sp = isPlayer ? { input: this.world, att: 1, d: 0 } : this.spatial(pos, 1, kind === 'rifle' ? 220 : 50);
    const v = this.veil;
    if (kind === 'pistol') {
      this.burst(sp.input, { dur: 0.09, f: 1100, q: 0.8, gain: 0.7 });
      this.tone(sp.input, { f: 180, f2: 60, dur: 0.08, gain: 0.5 });
      this.burst(sp.input, { dur: 0.03, f: 4000, q: 2, gain: 0.25 }); // slide
    } else {
      this.burst(sp.input, { dur: 0.35 + v * 0.8, f: 1800, type: 'lowpass', gain: 1.4 });
      this.tone(sp.input, { f: 120, f2: 38, dur: 0.3 + v * 0.6, gain: 1.1 });
      this.burst(sp.input, { dur: 0.9, f: 500, type: 'lowpass', gain: 0.35, attack: 0.02 }); // slap-back tail
    }
    if (isPlayer && v > 0.5) this.tone(this.ui, { f: 90, f2: 40, dur: 0.5, gain: 0.5 }); // veil: the shot is felt, not heard
  }
  casing(pos) {
    if (!this.ready) return;
    const sp = this.spatial(pos, 0.5, 25);
    const base = 3800 + Math.random() * 1500;
    for (let i = 0; i < 3; i++) this.tone(sp.input, { f: base * (1 - i * 0.05), dur: 0.05, gain: 0.25 / (i + 1), when: i * (0.09 - i * 0.02) });
  }
  impact(pos, soft) {
    if (!this.ready) return;
    const sp = this.spatial(pos, 0.7, 40);
    this.burst(sp.input, { dur: soft ? 0.08 : 0.05, f: soft ? 400 : 2500, q: 1.5, gain: 0.6 });
  }
  glass(pos) {
    if (!this.ready) return;
    const sp = this.spatial(pos, 0.9, 50);
    this.burst(sp.input, { dur: 0.35, f: 5000, q: 0.7, type: 'highpass', gain: 0.6 });
    for (let i = 0; i < 6; i++) this.tone(sp.input, { f: 3000 + Math.random() * 4000, dur: 0.12, gain: 0.08, when: Math.random() * 0.3 });
  }
  explosion(pos) {
    if (!this.ready) return;
    const sp = this.spatial(pos, 1.6, 300);
    this.burst(sp.input, { dur: 2.4, f: 700, type: 'lowpass', gain: 1.6, attack: 0.005, buf: this.brown, rate: 0.6 });
    this.tone(sp.input, { f: 70, f2: 22, dur: 1.6, gain: 1.4 });
    this.burst(sp.input, { dur: 0.4, f: 3000, type: 'lowpass', gain: 1.2 });
  }
  step(pos, { wet, run, crouch, roof }) {
    if (!this.ready) return;
    const g = (run ? 0.5 : crouch ? 0.12 : 0.25) * (roof ? 0.9 : 1);
    this.burst(this.world, { dur: 0.06, f: roof ? 900 : 700, q: 1.2, gain: g });
    if (wet) this.burst(this.world, { dur: 0.09, f: 2600, q: 0.8, gain: g * 0.8, type: 'bandpass' });
  }
  enemyStep(pos) {
    if (!this.ready) return;
    const sp = this.spatial(pos, 0.35, 18);
    this.burst(sp.input, { dur: 0.07, f: 800, gain: 0.5 });
  }
  thud(pos, g = 0.6) {
    if (!this.ready) return;
    const sp = this.spatial(pos, g, 30);
    this.tone(sp.input, { f: 110, f2: 45, dur: 0.25, gain: 0.8 });
    this.burst(sp.input, { dur: 0.15, f: 500, type: 'lowpass', gain: 0.6 });
  }
  takedown() {
    if (!this.ready) return;
    this.burst(this.world, { dur: 0.12, f: 300, type: 'lowpass', gain: 0.8 });
    this.tone(this.world, { f: 90, f2: 50, dur: 0.2, gain: 0.5, when: 0.05 });
  }
  honk(pos) {
    if (!this.ready) return;
    const sp = this.spatial(pos, 0.45, 90);
    const f = 380 + Math.random() * 200;
    const n = Math.random() < 0.5 ? 1 : 2;
    for (let i = 0; i < n; i++) { this.tone(sp.input, { f, dur: 0.28, type: 'square', gain: 0.16, when: i * 0.35 }); this.tone(sp.input, { f: f * 1.26, dur: 0.28, type: 'square', gain: 0.1, when: i * 0.35 }); }
  }
  bell(pos) {
    if (!this.ready) return;
    const sp = this.spatial(pos, 0.5, 45);
    const reps = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < reps; i++) for (const [m, g] of [[1, 0.2], [2.76, 0.08], [5.4, 0.04]]) this.tone(sp.input, { f: 2300 * m, dur: 0.18, gain: g, when: i * 0.055 });
  }
  thunder() {
    if (!this.ready) return;
    const delay = 0.4 + Math.random() * 2;
    setTimeout(() => this.burst(this.world, { dur: 4.5, f: 260, type: 'lowpass', gain: 1.4, attack: 0.25, buf: this.brown, rate: 0.5 }), delay * 1000);
  }
  radio() {
    if (!this.ready) return;
    this.tone(this.ui, { f: 1850, dur: 0.05, type: 'square', gain: 0.06 });
    this.burst(this.ui, { dur: 0.18, f: 2500, q: 0.5, gain: 0.12 });
  }
  uiTick(f = 1200) { if (this.ready) this.tone(this.ui, { f, dur: 0.05, gain: 0.08 }); }
  pickup() {
    if (!this.ready) return;
    this.tone(this.ui, { f: 660, dur: 0.12, gain: 0.08 }); this.tone(this.ui, { f: 990, dur: 0.2, gain: 0.06, when: 0.08 });
  }
  veilEnter() {
    if (!this.ready) return;
    this.tone(this.ui, { f: 160, f2: 30, dur: 1.4, gain: 0.9 });
    this.burst(this.ui, { dur: 1.2, f: 200, type: 'lowpass', gain: 0.6, attack: 0.01, buf: this.brown, rate: 0.4 });
  }
  veilExit() {
    if (!this.ready) return;
    this.burst(this.world, { dur: 0.8, f: 3000, type: 'highpass', gain: 0.35, attack: 0.3 });
  }
  hurt() {
    if (!this.ready) return;
    this.tone(this.ui, { f: 220, f2: 120, dur: 0.15, type: 'triangle', gain: 0.3 });
  }
  whizz(pos) {
    if (!this.ready) return;
    const sp = this.spatial(pos, 0.7, 12);
    this.burst(sp.input, { dur: 0.12 + this.veil * 0.6, f: 3500, q: 3, gain: 0.5 });
  }

  // Dotara-like pluck: Karplus–Strong string through a feedback delay.
  pluck(freq, gain = 0.25, dest = this.music) {
    const ctx = this.ctx, t = ctx.currentTime;
    const d = ctx.createDelay(); d.delayTime.value = 1 / freq;
    const fb = ctx.createGain(); fb.gain.value = 0.985;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    const out = ctx.createGain(); out.gain.setValueAtTime(gain, t); out.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const eg = ctx.createGain(); eg.gain.setValueAtTime(1, t); eg.gain.exponentialRampToValueAtTime(0.001, t + 1 / freq * 3);
    src.connect(eg).connect(d); d.connect(lp).connect(fb).connect(d); lp.connect(out).connect(dest);
    src.start(t, Math.random()); src.stop(t + 0.05);
    setTimeout(() => { try { fb.disconnect(); } catch (e) { /* already gone */ } }, 3200);
  }
  flute(freq, dur = 3) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2; const vg = ctx.createGain(); vg.gain.value = freq * 0.012; vib.connect(vg).connect(o.frequency); vib.start(t);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.6); g.gain.setValueAtTime(0.07, t + dur - 0.8); g.gain.linearRampToValueAtTime(0, t + dur);
    o.frequency.setValueAtTime(freq * 0.97, t); o.frequency.linearRampToValueAtTime(freq, t + 0.25);
    o.connect(g).connect(this.music);
    const breath = this.burst(this.music, { dur, f: freq * 2, q: 8, gain: 0.02, attack: 0.5 });
    const send = ctx.createGain(); send.gain.value = 0.6; g.connect(send).connect(this.revSend);
    o.start(t); o.stop(t + dur + 0.1); vib.stop(t + dur + 0.1);
  }
  tabla(kind, when = 0) {
    if (kind === 'na') { this.tone(this.music, { f: 520, dur: 0.18, gain: 0.22, when }); this.burst(this.music, { dur: 0.03, f: 3000, gain: 0.1 }); }
    else if (kind === 'ge') { this.tone(this.music, { f: 85, f2: 120, dur: 0.45, gain: 0.45, when }); }
    else if (kind === 'ti') { this.tone(this.music, { f: 780, dur: 0.07, gain: 0.12, when }); }
    else if (kind === 'hit') { this.burst(this.music, { dur: 0.25, f: 180, type: 'lowpass', gain: 0.7 }); this.tone(this.music, { f: 55, f2: 35, dur: 0.3, gain: 0.5, when }); }
  }
  heartbeat(strength) {
    this.tone(this.heartBus, { f: 58, f2: 40, dur: 0.16, gain: 0.9 * strength });
    this.tone(this.heartBus, { f: 52, f2: 36, dur: 0.2, gain: 0.7 * strength, when: 0.19 });
  }

  // ------------------------------------------------------------------ frame
  update(dt, st) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const v = this.veil;
    // Veil State mix: world collapses to a muffled 350 Hz; heart and breath come forward.
    this.worldFilter.frequency.setTargetAtTime(20000 * Math.pow(1 - v, 3) + 350, t, 0.06);
    this.worldGain.gain.setTargetAtTime(1 - v * 0.55, t, 0.08);
    this.heartBus.gain.setTargetAtTime(Math.max(v, this.tension * 0.35, st.lowHealth ? 0.6 : 0), t, 0.2);
    this.music.gain.setTargetAtTime((0.5 - v * 0.5) * (st.musicMute ? 0 : 1), t, 0.3);

    const rain = this.rain;
    this.rainA.g.gain.setTargetAtTime(0.13 * rain, t, 0.5);
    this.rainB.g.gain.setTargetAtTime(0.35 * rain, t, 0.5);
    this.rainA.f.frequency.setTargetAtTime(st.indoor ? 400 : 900, t, 0.3);
    this.city.g.gain.setTargetAtTime(st.silence ? 0.0 : 0.22, t, 0.4);

    if (st.genPos) {
      const L = this.listener; const d = Math.hypot(st.genPos.x - L.x, st.genPos.y - L.y, st.genPos.z - L.z);
      this.gen.g.gain.setTargetAtTime(st.genOn ? Math.max(0, 1 - d / 28) ** 2 * 0.5 : 0, t, 0.2);
    }
    this.drone.gain.setTargetAtTime(0.08 + this.tension * 0.25 + this.combat * 0.1, t, 1.5);

    // heartbeat: rate rises with stress; scheduled on real time
    this.nextHeart -= dt;
    const bpm = 64 + this.tension * 40 + v * 10 + (st.lowHealth ? 30 : 0);
    if (this.nextHeart <= 0) { this.heartbeat(0.6 + v * 0.6); this.nextHeart = 60 / (bpm * (1 - v * 0.45)); }

    if (st.silence) return;
    // sparse folk-texture music in exploration
    this.nextPluck -= dt;
    if (this.nextPluck <= 0 && this.combat < 0.5 && v < 0.2) {
      const base = Math.floor(Math.random() * 5);
      const phrase = [0, 2, 1, 3, 2, 0].slice(0, 3 + Math.floor(Math.random() * 3));
      phrase.forEach((k, i) => setTimeout(() => this.pluck(SCALE[(base + k) % SCALE.length], 0.18), i * (260 + Math.random() * 120)));
      this.nextPluck = 9 + Math.random() * 10;
    }
    this.nextFlute -= dt;
    if (this.nextFlute <= 0 && this.combat < 0.3 && v < 0.2) { this.flute(SCALE[Math.floor(Math.random() * 4) + 5] * 2, 3 + Math.random() * 2); this.nextFlute = 25 + Math.random() * 20; }
    // combat percussion (tabla + industrial) at ~104 bpm
    if (this.combat > 0.3 && v < 0.3) {
      this.nextBeat -= dt;
      if (this.nextBeat <= 0) {
        const pat = ['ge', 'ti', 'na', 'ti', 'ge', 'ge', 'na', 'hit'];
        const k = pat[this.beatStep % pat.length];
        if (k !== 'hit' || this.combat > 0.7) this.tabla(k);
        this.beatStep++;
        this.nextBeat = 60 / 104 / 2;
      }
    }
    this.nextHonk -= dt;
    if (this.nextHonk <= 0 && st.honkPos) { this.honk(st.honkPos); this.nextHonk = 1.5 + Math.random() * 5; }
    this.nextBell -= dt;
    if (this.nextBell <= 0 && st.bellPos) { this.bell(st.bellPos); this.nextBell = 3 + Math.random() * 7; }
  }
}
