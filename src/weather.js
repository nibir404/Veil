import * as THREE from 'three';
import { clamp, lerp, damp } from './util.js';

// Monsoon system. Rain is gameplay, not a filter: intensity feeds enemy view range,
// footstep masking, ground wetness/reflections, fog density and audio.
export class Weather {
  constructor(scene, world, audio) {
    this.scene = scene; this.world = world; this.audio = audio;
    this.intensity = 0.85;      // 0..1 current
    this.target = 0.85;
    this.wind = new THREE.Vector2(1.2, 0.4);
    this.dryOverride = 0;      // surreal "dry street" beat
    this.flash = 0;
    this.nextLightning = 18;
    this.schedule = [];        // [{at, to}] authored weather changes during the mission
    this.clock = 0;

    const N = 9000;
    this.N = N;
    this.drops = new Float32Array(N * 3);
    this.speeds = new Float32Array(N);
    for (let i = 0; i < N; i++) { this.drops[i * 3] = (Math.random() - 0.5) * 60; this.drops[i * 3 + 1] = Math.random() * 30; this.drops[i * 3 + 2] = (Math.random() - 0.5) * 60; this.speeds[i] = 16 + Math.random() * 8; }
    this.pos = new Float32Array(N * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    const alpha = new Float32Array(N * 2); for (let i = 0; i < N; i++) { alpha[i * 2] = 0.0; alpha[i * 2 + 1] = 0.55; }
    geo.setAttribute('a', new THREE.BufferAttribute(alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { opacity: { value: 1 }, tint: { value: new THREE.Color('#a8b8cc') } },
      vertexShader: 'attribute float a; varying float vA; void main(){ vA=a; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
      fragmentShader: 'uniform float opacity; uniform vec3 tint; varying float vA; void main(){ gl_FragColor = vec4(tint, vA*opacity*0.5); }',
    });
    this.lines = new THREE.LineSegments(geo, this.mat);
    this.lines.frustumCulled = false;
    scene.add(this.lines);

    // splashes: ring sprites on the ground around the player
    const M = 220;
    this.splashes = [];
    const ringTex = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.strokeStyle = 'rgba(210,225,240,0.9)'; g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.stroke(); return c; })());
    const smat = new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, opacity: 0.5, blending: THREE.AdditiveBlending });
    this.splashMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), smat, M);
    this.splashMesh.frustumCulled = false;
    for (let i = 0; i < M; i++) this.splashes.push({ p: new THREE.Vector3(), t: Math.random(), life: 0.35 + Math.random() * 0.2 });
    scene.add(this.splashMesh);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3();
  }

  get effective() { return this.intensity * (1 - this.dryOverride); }

  update(worldDt, realDt, camPos, veil) {
    this.clock += worldDt;
    for (const s of this.schedule) if (!s.done && this.clock >= s.at) { this.target = s.to; s.done = true; }
    this.intensity = damp(this.intensity, this.target, 0.15, worldDt);
    const I = this.effective;

    // lightning
    this.nextLightning -= worldDt;
    if (this.nextLightning <= 0 && I > 0.5) {
      this.flash = 1; this.audio.thunder();
      this.nextLightning = 14 + Math.random() * 30;
    }
    this.flash = Math.max(0, this.flash - worldDt * (this.flash > 0.5 ? 6 : 2.5));
    const flick = this.flash > 0 ? this.flash * (0.6 + 0.4 * Math.sin(this.clock * 70)) : 0;
    this.world.lightning = flick * 0.6;

    // fog and wetness follow rain
    const fog = this.scene.fog;
    fog.density = lerp(0.012, 0.026, I) + veil * 0.004;
    this.world.rain = I;
    this.world.wetness = damp(this.world.wetness, lerp(0.35, 1, this.intensity) * (1 - this.dryOverride), this.dryOverride > 0.5 ? 20 : 0.5, realDt);
    this.audio.rain = I;

    // rain drops: advected in world time, so in Veil State they hang in the air.
    const N = this.N, d = this.drops, P = this.pos;
    const active = Math.floor(N * clamp(I, 0, 1));
    const wx = this.wind.x, wz = this.wind.y;
    const streak = lerp(0.045, 0.012, veil); // shorter streaks when slowed: drops read as beads
    for (let i = 0; i < N; i++) {
      const k = i * 3;
      if (i >= active) { P[i * 6 + 1] = -100; P[i * 6 + 4] = -100; continue; }
      const sp = this.speeds[i];
      d[k] += wx * worldDt; d[k + 1] -= sp * worldDt; d[k + 2] += wz * worldDt;
      let x = d[k], y = d[k + 1], z = d[k + 2];
      if (y < camPos.y - 12) { y = d[k + 1] = camPos.y + 18 + Math.random() * 4; }
      // wrap around camera
      const rx = ((x - camPos.x + 30) % 60 + 60) % 60 - 30, rz = ((z - camPos.z + 30) % 60 + 60) % 60 - 30;
      x = camPos.x + rx; z = camPos.z + rz;
      const o = i * 6;
      P[o] = x; P[o + 1] = y; P[o + 2] = z;
      P[o + 3] = x - wx * streak; P[o + 4] = y + sp * streak; P[o + 5] = z - wz * streak;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.mat.uniforms.opacity.value = 0.8 + flick;

    // splashes
    const sm = this.splashMesh;
    const count = Math.floor(this.splashes.length * I);
    for (let i = 0; i < this.splashes.length; i++) {
      const s = this.splashes[i];
      if (i >= count) { this._s.set(0, 0, 0); this._m.compose(s.p, this._q, this._s); sm.setMatrixAt(i, this._m); continue; }
      s.t += worldDt / s.life;
      if (s.t >= 1) {
        s.t = 0;
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 16;
        const x = camPos.x + Math.cos(a) * r, z = camPos.z + Math.sin(a) * r;
        s.p.set(x, this.world.groundAt(x, z, camPos.y + 1, 0.2) + 0.03, z);
      }
      const sc = 0.05 + s.t * 0.3;
      this._s.set(sc, 1, sc);
      this._m.compose(s.p, this._q, this._s);
      sm.setMatrixAt(i, this._m);
    }
    sm.instanceMatrix.needsUpdate = true;
    sm.material.opacity = 0.4 * I;
  }
}
