import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTex, mulberry32 } from './util.js';

// Original Raven equipment. All pieces follow existing animated joints.
export function detailRaven(rig) {
  const rng = mulberry32(2041);
  const weave = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#909080'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      const n = 105 + rng() * 70;
      g.fillStyle = `rgb(${n},${n},${n})`; g.fillRect(x, y, 1, 1);
    }
    g.strokeStyle = '#b0b0a0'; g.globalAlpha = 0.25;
    for (let x = 0; x < w; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  });
  const fabric = (color) => new THREE.MeshStandardMaterial({ color, map: weave, bumpMap: weave, bumpScale: 0.0015, roughness: 0.91 });
  const olive = fabric('#69705a'), dark = fabric('#353d36'), web = fabric('#85836a'), scarf = fabric('#696a5b');
  const rubber = new THREE.MeshStandardMaterial({ color: '#202622', roughness: 0.77 });
  const metal = new THREE.MeshStandardMaterial({ color: '#777d78', roughness: 0.42, metalness: 0.75 });
  const skin = new THREE.MeshStandardMaterial({ color: '#926346', roughness: 0.7 });
  const box = (parent, size, pos, mat, radius = 0.012) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 2, radius), mat);
    mesh.position.set(...pos); parent.add(mesh); return mesh;
  };
  const ellipsoid = (parent, size, pos, mat) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), mat);
    mesh.scale.set(...size); mesh.position.set(...pos); parent.add(mesh); return mesh;
  };
  const seam = (parent, points, mat = web, radius = 0.003) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, radius, 5, false), mat);
    parent.add(mesh); return mesh;
  };

  // Replace the square placeholder vest with shaped front/back carrier plates.
  for (const mesh of [...rig.spine.children]) if (mesh.isMesh && mesh.geometry.type === 'BoxGeometry') rig.spine.remove(mesh);
  box(rig.spine, [0.365, 0.40, 0.085], [0, 0.31, 0.135], olive, 0.035);
  box(rig.spine, [0.35, 0.39, 0.085], [0, 0.32, -0.145], dark, 0.035);
  for (const side of [-1, 1]) {
    box(rig.spine, [0.065, 0.16, 0.31], [side * 0.135, 0.51, 0], web, 0.02);
    box(rig.spine, [0.075, 0.028, 0.045], [side * 0.135, 0.46, 0.185], rubber);
    box(rig.spine, [0.055, 0.17, 0.23], [side * 0.182, 0.20, 0], dark);
    // MOLLE webbing on front and rear, especially visible in third person.
    for (let row = 0; row < 4; row++) {
      box(rig.spine, [0.15, 0.018, 0.009], [side * 0.087, 0.20 + row * 0.063, 0.182], web, 0.003);
      box(rig.spine, [0.15, 0.018, 0.009], [side * 0.087, 0.20 + row * 0.063, -0.192], web, 0.003);
    }
  }
  for (const x of [-0.112, 0, 0.112]) {
    box(rig.spine, [0.095, 0.155, 0.07], [x, 0.16, 0.218], olive);
    box(rig.spine, [0.092, 0.044, 0.078], [x, 0.225, 0.223], web);
    box(rig.spine, [0.018, 0.10, 0.008], [x, 0.16, 0.258], dark, 0.003);
  }
  // Compact hydration pack, radio, antenna, cable, and Bangladesh shoulder patch.
  box(rig.spine, [0.235, 0.34, 0.105], [0, 0.30, -0.23], olive, 0.035);
  box(rig.spine, [0.18, 0.125, 0.038], [0, 0.22, -0.29], dark);
  seam(rig.spine, [[-0.1, 0.13, -0.285], [-0.105, 0.44, -0.285], [0.10, 0.44, -0.285], [0.10, 0.13, -0.285]], web, 0.002);
  box(rig.spine, [0.064, 0.14, 0.07], [-0.205, 0.31, -0.07], rubber);
  seam(rig.spine, [[-0.21, 0.37, -0.07], [-0.22, 0.62, -0.075], [-0.25, 0.78, -0.075]], rubber, 0.004);
  seam(rig.spine, [[-0.19, 0.37, -0.08], [-0.16, 0.58, -0.01], [-0.12, 0.46, 0.19]], rubber, 0.005);
  const flag = canvasTex(128, 80, g => {
    g.fillStyle = '#234c3e'; g.fillRect(0, 0, 128, 80);
    g.fillStyle = '#a8443c'; g.beginPath(); g.arc(57, 40, 23, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8e9278'; g.lineWidth = 4; g.strokeRect(3, 3, 122, 74);
  });
  box(rig.arms.L.upper, [0.009, 0.072, 0.10], [-0.060, -0.10, 0], new THREE.MeshStandardMaterial({ map: flag, roughness: 0.95 }), 0.003);

  // Woven collar with overlapping folds; face remains identifiable.
  for (let i = 0; i < 4; i++) {
    const fold = new THREE.Mesh(new THREE.TorusGeometry(0.115 + i * 0.009, 0.023, 8, 28), scarf);
    fold.rotation.set(Math.PI / 2 + i * 0.04, 0, i * 0.04); fold.scale.y = 0.85;
    fold.position.set(0, 0.012 - i * 0.017, 0); rig.neck.add(fold);
  }
  const tail = box(rig.spine, [0.095, 0.24, 0.018], [0.095, 0.40, 0.205], scarf);
  tail.rotation.z = -0.24;

  // More defined jaw, ears, brow, nose and swept close-cropped hair.
  rig.head.geometry.dispose(); rig.head.geometry = new THREE.SphereGeometry(0.112, 28, 24);
  rig.head.scale.set(0.88, 1.14, 0.93);
  ellipsoid(rig.neck, [0.078, 0.066, 0.072], [0, 0.086, 0.015], skin);
  for (const side of [-1, 1]) {
    ellipsoid(rig.neck, [0.017, 0.030, 0.017], [side * 0.10, 0.135, 0], skin);
    const brow = box(rig.neck, [0.044, 0.011, 0.016], [side * 0.038, 0.189, 0.094], rubber, 0.004);
    brow.rotation.z = side * 0.10;
  }
  ellipsoid(rig.neck, [0.018, 0.025, 0.019], [0, 0.126, 0.111], skin);
  box(rig.neck, [0.049, 0.006, 0.008], [0, 0.085, 0.093], dark, 0.002);
  // Earpiece and mic are Raven's distinctive silhouette, rather than copied headwear.
  ellipsoid(rig.neck, [0.017, 0.027, 0.021], [0.114, 0.14, 0.005], rubber);
  seam(rig.neck, [[0.12, 0.14, 0], [0.13, 0.08, 0.08], [0.052, 0.085, 0.125]], rubber, 0.003);

  box(rig.hips, [0.365, 0.065, 0.235], [0, 0, 0], dark);
  box(rig.hips, [0.065, 0.047, 0.018], [0, 0, 0.125], metal, 0.005);
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1, arm = rig.arms[side], leg = rig.legs[side];
    box(arm.fore, [0.091, 0.06, 0.091], [0, -0.24, 0], dark);
    ellipsoid(arm.fore, [0.047, 0.064, 0.042], [0, -0.295, 0], rubber);
    for (let i = 0; i < 4; i++) box(arm.fore, [0.016, 0.045, 0.022], [-0.028 + i * 0.019, -0.338, 0.008], rubber, 0.006);
    box(arm.fore, [0.065, 0.05, 0.014], [0, -0.22, -0.049], side === 'L' ? metal : dark);
    box(leg.thigh, [0.07, 0.17, 0.13], [s * 0.065, -0.18, 0], olive);
    box(leg.thigh, [0.079, 0.042, 0.14], [s * 0.066, -0.11, 0], web);
    box(leg.knee, [0.12, 0.15, 0.05], [0, -0.025, 0.064], rubber, 0.025);
    box(leg.shin, [0.105, 0.21, 0.115], [0, -0.35, 0], dark, 0.025);
    box(leg.shin, [0.114, 0.078, 0.235], [0, -0.455, 0.045], rubber, 0.024);
    box(leg.shin, [0.118, 0.027, 0.241], [0, -0.49, 0.045], dark, 0.008);
    for (let row = 0; row < 4; row++) box(leg.shin, [0.068, 0.007, 0.007], [0, -0.31 - row * 0.03, 0.06], web, 0.002);
  }
}
