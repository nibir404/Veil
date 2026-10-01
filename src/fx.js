import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { canvasTex } from './util.js';

const flareTex = canvasTex(64, 64, (g) => {
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,250,230,1)'); grd.addColorStop(0.25, 'rgba(255,190,90,0.9)'); grd.addColorStop(1, 'rgba(255,120,30,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
}, { clamp: true });
const smokeTex = canvasTex(64, 64, (g) => {
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(160,160,160,0.5)'); grd.addColorStop(1, 'rgba(160,160,160,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
}, { clamp: true });

export class Effects {
  constructor(scene, world, audio) {
    this.scene = scene; this.world = world; this.audio = audio;
    this.flashes = []; this.tracers = []; this.sparks = []; this.smokes = [];
    this.casings = [];   // persistent evidence (enemies investigate these)
    this.decals = [];
    this.blood = [];     // persistent evidence
    this.flashLight = new THREE.PointLight('#ffb060', 0, 12, 2);
    scene.add(this.flashLight);
    this.casingGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.022, 6);
    this.casingMat = new THREE.MeshStandardMaterial({ color: '#c8a040', metalness: 0.9, roughness: 0.25 });
    this.sparkMat = new THREE.MeshBasicMaterial({ color: '#ffd080' });
    this.sparkGeo = new THREE.BoxGeometry(0.02, 0.02, 0.09);
    this.decalMat = new THREE.MeshBasicMaterial({ map: canvasTex(32, 32, (g) => { g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 32, 32); const grd = g.createRadialGradient(16, 16, 0, 16, 16, 14); grd.addColorStop(0, 'rgba(10,10,10,0.95)'); grd.addColorStop(1, 'rgba(10,10,10,0)'); g.fillStyle = grd; g.fillRect(0, 0, 32, 32); }, { clamp: true }), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.bloodMat = new THREE.MeshBasicMaterial({ color: '#3a0606', transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  }

  muzzle(pos, dir, big, veil) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, blending: THREE.AdditiveBlending, depthWrite: false, color: '#ffffff' }));
    const sc = (big ? 0.7 : 0.25) * (1 + veil * 1.8);
    s.scale.setScalar(sc); s.position.copy(pos).addScaledVector(dir, 0.06);
    this.scene.add(s);
    this.flashes.push({ s, t: 0, life: 0.05 + veil * 0.08 });
    this.flashLight.position.copy(pos); this.flashLight.intensity = big ? 60 : 12;
  }
  tracer(from, to, color = '#ffcf70', life = 0.06) {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
    this.scene.add(l);
    this.tracers.push({ l, t: 0, life });
  }
  casing(pos, right) {
    const m = new THREE.Mesh(this.casingGeo, this.casingMat);
    m.position.copy(pos);
    this.scene.add(m);
    const v = right.clone().multiplyScalar(1.6 + Math.random()).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 2 + Math.random(), (Math.random() - 0.5) * 0.4));
    const c = { m, v, spin: new THREE.Vector3(Math.random() * 20, Math.random() * 20, Math.random() * 20), resting: false, bounces: 0, seenBy: new Set(), pos: m.position };
    this.casings.push(c);
    if (this.casings.length > 80) { const old = this.casings.shift(); this.scene.remove(old.m); }
  }
  impact(pos, normal, soft) {
    for (let i = 0; i < (soft ? 3 : 7); i++) {
      const m = new THREE.Mesh(this.sparkGeo, soft ? this.bloodMat : this.sparkMat);
      m.position.copy(pos);
      const v = normal.clone().multiplyScalar(2 + Math.random() * 3).add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3));
      m.lookAt(pos.clone().add(v));
      this.scene.add(m);
      this.sparks.push({ m, v, t: 0, life: 0.25 + Math.random() * 0.25 });
    }
    if (!soft) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), this.decalMat);
      d.position.copy(pos).addScaledVector(normal, 0.01);
      d.lookAt(pos.clone().add(normal));
      this.scene.add(d); this.decals.push(d);
      if (this.decals.length > 120) { const old = this.decals.shift(); this.scene.remove(old); old.geometry.dispose(); }
      this.smoke(pos, 0.3, 0.8);
    }
    this.audio.impact(pos, soft);
  }
  bloodPool(pos) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.1, 14), this.bloodMat);
    d.rotation.x = -Math.PI / 2; d.position.copy(pos); d.position.y += 0.025;
    this.scene.add(d);
    const b = { m: d, pos: d.position, grow: 0, seenBy: new Set() };
    this.blood.push(b);
    return b;
  }
  smoke(pos, size = 1, life = 2) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, depthWrite: false, transparent: true, opacity: 0.5, color: '#9a9a9a' }));
    s.position.copy(pos); s.scale.setScalar(size);
    this.scene.add(s);
    this.smokes.push({ s, t: 0, life, size, v: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.4 + Math.random() * 0.3, (Math.random() - 0.5) * 0.3) });
  }
  explosion(pos) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.copy(pos); s.scale.setScalar(6);
    this.scene.add(s); this.flashes.push({ s, t: 0, life: 0.5, grow: 10 });
    this.flashLight.position.copy(pos); this.flashLight.intensity = 800; this.flashLight.distance = 40;
    for (let i = 0; i < 40; i++) this.impact(pos.clone().add(new THREE.Vector3((Math.random() - 0.5), Math.random(), (Math.random() - 0.5))), new THREE.Vector3((Math.random() - 0.5), Math.random(), (Math.random() - 0.5)).normalize(), false);
    for (let i = 0; i < 14; i++) this.smoke(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2)), 3 + Math.random() * 3, 6 + Math.random() * 4);
    this.fire = { pos: pos.clone(), t: 0 };
    this.audio.explosion(pos);
  }

  update(dt) {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]; f.t += dt;
      if (f.grow) f.s.scale.setScalar(6 + f.t * f.grow);
      f.s.material.opacity = 1 - f.t / f.life;
      if (f.t > f.life) { this.scene.remove(f.s); f.s.material.dispose(); this.flashes.splice(i, 1); }
    }
    this.flashLight.intensity *= Math.exp(-dt * 30);
    if (this.flashLight.intensity < 0.1) this.flashLight.distance = 12;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]; t.t += dt; t.l.material.opacity = 0.9 * (1 - t.t / t.life);
      if (t.t > t.life) { this.scene.remove(t.l); t.l.geometry.dispose(); t.l.material.dispose(); this.tracers.splice(i, 1); }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]; s.t += dt; s.v.y -= 9.8 * dt; s.m.position.addScaledVector(s.v, dt);
      if (s.t > s.life) { this.scene.remove(s.m); this.sparks.splice(i, 1); }
    }
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i]; s.t += dt; s.s.position.addScaledVector(s.v, dt); s.s.scale.setScalar(s.size * (1 + s.t * 0.6));
      s.s.material.opacity = 0.45 * (1 - s.t / s.life);
      if (s.t > s.life) { this.scene.remove(s.s); s.s.material.dispose(); this.smokes.splice(i, 1); }
    }
    for (const c of this.casings) {
      if (c.resting) continue;
      c.v.y -= 9.8 * dt;
      c.m.position.addScaledVector(c.v, dt);
      c.m.rotation.x += c.spin.x * dt; c.m.rotation.y += c.spin.y * dt;
      const g = this.world.groundAt(c.m.position.x, c.m.position.z, c.m.position.y + 0.05, 0.1) + 0.006;
      if (c.m.position.y < g) {
        c.m.position.y = g;
        if (c.bounces++ < 2 && c.v.y < -1) { c.v.y *= -0.35; c.v.x *= 0.5; c.v.z *= 0.5; this.audio.casing(c.m.position); }
        else { c.resting = true; c.m.rotation.set(Math.PI / 2, Math.random() * 6, 0); }
      }
    }
    for (const b of this.blood) if (b.grow < 1) { b.grow = Math.min(1, b.grow + dt * 0.25); b.m.scale.setScalar(1 + b.grow * 6); }
    if (this.fire) {
      this.fire.t += dt;
      if (Math.random() < dt * 20) this.smoke(this.fire.pos.clone().add(new THREE.Vector3((Math.random() - 0.5), 0.5, (Math.random() - 0.5))), 1.5, 4);
      if (Math.random() < dt * 30) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, blending: THREE.AdditiveBlending, depthWrite: false }));
        s.position.copy(this.fire.pos).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, Math.random() * 1.2, (Math.random() - 0.5) * 1.2)); s.scale.setScalar(0.6 + Math.random());
        this.scene.add(s); this.flashes.push({ s, t: 0, life: 0.4 });
      }
    }
  }
}

// ------------------------------------------------------------------ post
const VeilShader = {
  uniforms: {
    tDiffuse: { value: null }, veil: { value: 0 }, time: { value: 0 }, pulse: { value: 0 },
    hurt: { value: 0 }, observe: { value: 0 }, aspect: { value: 1 }, grade: { value: 0 }, wrong: { value: 0 }, lens: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float veil, time, pulse, hurt, observe, aspect, grade, wrong, lens;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 uv = vUv; vec2 c = uv - 0.5; float r = length(c*vec2(aspect,1.0));
      // rain on the lens: sparse refracting droplets
      vec2 cell = floor(uv*vec2(aspect,1.0)*14.0); vec2 f = fract(uv*vec2(aspect,1.0)*14.0)-0.5;
      float hh = h(cell); float drop = step(0.93, hh) * smoothstep(0.22, 0.0, length(f - (vec2(h(cell+1.3),h(cell+2.7))-0.5)*0.5));
      uv += drop * f * 0.02 * lens;
      // Veil: radial time-smear and chromatic split grow toward the edges.
      float ca = (0.00015 + veil*0.004 + hurt*0.006) * r;
      vec2 dir = normalize(c + 1e-5);
      vec3 col;
      col.r = texture2D(tDiffuse, uv - dir*ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv + dir*ca).b;
      if (veil > 0.01) {
        vec3 acc = col; float wsum = 1.0;
        for (int i=1;i<7;i++){ float k = float(i)/6.0; acc += texture2D(tDiffuse, uv - c*k*0.05*veil*r).rgb * (1.0-k); wsum += 1.0-k; }
        col = mix(col, acc/wsum, veil);
      }
      float lum = dot(col, vec3(0.299,0.587,0.114));
      // Veil grade: everything drains toward a cold steel, except hot highlights (muzzle, fire) keep their colour.
      float hot = smoothstep(0.55, 1.2, max(col.r, col.g));
      vec3 cold = vec3(lum)*vec3(0.82,0.92,1.05);
      col = mix(col, mix(cold, col*1.15, hot), veil*0.85);
      // Observe (intel focus): mild desat + contrast
      col = mix(col, vec3(lum)*vec3(0.9,0.97,1.05)*1.1, observe*0.6);
      // campaign colour language (0 early natural -> 1 late surreal)
      col = mix(col, col.gbr*0.3 + col*0.7, wrong*0.25);
      col = pow(col, vec3(1.0 + grade*0.1));
      // heartbeat pulse vignette
      float vig = smoothstep(0.35, 1.05, r);
      col *= 1.0 - vig*(0.20 + veil*0.45 + pulse*veil*0.25);
      col = mix(col, vec3(0.35,0.0,0.0), hurt*vig*0.8);
      // film grain
      col += (h(uv*vec2(1920.0,1080.0) + time) - 0.5) * (0.008 + veil*0.02);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.setPixelRatio(renderer.getPixelRatio());
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.28, 0.4, 0.95);
    this.composer.addPass(this.bloom);
    this.output = new OutputPass();
    this.composer.addPass(this.output);
    // Veil pass runs after tonemapping so its grade operates on display values.
    this.veil = new ShaderPass(VeilShader);
    this.composer.addPass(this.veil);
    this.composer.addPass(new SMAAPass(innerWidth, innerHeight));
    this.u = this.veil.uniforms;
    this.resize();
  }
  resize() {
    this.composer.setSize(innerWidth, innerHeight);
    this.u.aspect.value = innerWidth / innerHeight;
  }
  render(dt) { this.u.time.value += dt; this.composer.render(dt); }
}
