import * as THREE from 'three';
import { Box, canvasTex, mulberry32 } from './util.js';

// A deliberately compressed, fictional mission district, informed by Old Dhaka's
// heritage shopfronts, commercial lanes and Buriganga launch terminals. Not survey data.
export const DHAKA_SECTORS = [
  { name: 'NORTH SERVICE LANES', bn: 'উত্তর গলি', x: 0, z: 39 },
  { name: 'TELECOM QUARTER', bn: 'টেলিকম পাড়া', x: 39, z: 22 },
  { name: 'CRAFT BAZAAR', bn: 'কারুশিল্প বাজার', x: -30, z: -22 },
  { name: 'RIVER ROAD', bn: 'নদীর রাস্তা', x: 0, z: 0 },
  { name: 'BURIGANGA GHAT', bn: 'বুড়িগঙ্গা ঘাট', x: 0, z: -40 },
];
const v = (x,y,z) => new THREE.Vector3(x,y,z);
const font = '"Hind Siliguri","Kohinoor Bangla",sans-serif';

export function buildDhaka(W) {
  const rng = mulberry32(19721216);
  const stone = new THREE.MeshStandardMaterial({color:'#807867', roughness:0.88});
  const brick = new THREE.MeshStandardMaterial({color:'#784836', roughness:0.96});
  const trim = new THREE.MeshStandardMaterial({color:'#c3b59b', roughness:0.81});
  const iron = new THREE.MeshStandardMaterial({color:'#3c4846', metalness:0.55, roughness:0.57});
  const timber = new THREE.MeshStandardMaterial({color:'#514432', roughness:0.92});
  const box = (parent, x,y,z, sx,sy,sz, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz), mat); m.position.set(x,y,z);
    m.castShadow = sy > 0.5; m.receiveShadow = true; parent.add(m); return m;
  };
  const sign = (text, english, x,y,z, width=3.2, facing=0) => {
    const tex = canvasTex(768,192,(g,w,h)=>{
      g.fillStyle='#193d39';g.fillRect(0,0,w,h);g.strokeStyle='#b5a885';g.lineWidth=6;g.strokeRect(8,8,w-16,h-16);
      g.textAlign='center';g.fillStyle='#e9ddbd';g.font=`64px ${font}`;g.fillText(text,w/2,87);
      g.font='26px Arial';g.fillText(english,w/2,147);
    },{clamp:true});
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshStandardMaterial({map:tex,roughness:0.75,emissiveMap:tex,emissive:'#ffffff',emissiveIntensity:0.12}));
    m.position.set(x,y,z);m.rotation.y=facing;W.group.add(m);return m;
  };

  // Riverfront quay: solid retaining wall and a continuous, physically blocking rail.
  box(W.group,0,-0.7,-43,170,1.4,1.2,stone);
  W.addCollider(new Box(-85,-2,-44,85,1.1,-42.8,{climbable:false,tag:'quay'}));
  for(let x=-83;x<85;x+=3.5) {
    box(W.group,x,0.5,-43,0.085,1.05,0.085,iron);
    box(W.group,x+1.7,1.0,-43,3.5,0.06,0.06,iron);
    box(W.group,x+1.7,0.40,-43,3.5,0.04,0.04,iron);
  }
  // Navigation excludes the river; water is a visual boundary, not walkable pavement.
  W.addCollider(new Box(-115,-3,-170,115,0.1,-44,{climbable:false,tag:'river'}));

  const waterGeo = new THREE.PlaneGeometry(430,210,100,55).rotateX(-Math.PI/2);
  const waterMat = new THREE.MeshStandardMaterial({color:'#233d3b',roughness:0.24,metalness:0.48,transparent:true,opacity:0.96});
  waterMat.onBeforeCompile = shader => {
    shader.uniforms.riverTime = {value:0}; W.riverShader = shader;
    shader.vertexShader = 'uniform float riverTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
      vec3 objectNormal = vec3(-0.08*cos(position.x*0.48+riverTime*0.8),1.0,-0.06*cos(position.z*0.7-riverTime*0.6));
    `).replace('#include <begin_vertex>', `
      vec3 transformed = position;
      transformed.y += sin(position.x*0.48+riverTime*0.8)*0.12 + sin(position.z*0.7-riverTime*0.6)*0.06;
    `);
  };
  const water = new THREE.Mesh(waterGeo,waterMat);water.position.set(0,-0.85,-148);W.group.add(water);
  W.riverBoats=[];

  function boat(x,z,size,launch=false) {
    const g = new THREE.Group(); g.position.set(x,-0.67,z); W.group.add(g);
    const outline = new THREE.Shape(); outline.moveTo(-size/2,0); outline.quadraticCurveTo(-size*.42,-size*.19,0,-size*.18);outline.quadraticCurveTo(size*.42,-size*.19,size/2,0);outline.quadraticCurveTo(size*.42,size*.19,0,size*.18);outline.quadraticCurveTo(-size*.42,size*.19,-size/2,0);
    const geo = new THREE.ExtrudeGeometry(outline,{depth:launch?0.8:0.38,bevelEnabled:true,bevelSize:0.12,bevelThickness:0.12,bevelSegments:2,steps:1});geo.rotateX(Math.PI/2);
    const hull = new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:launch?'#203845':'#443b28',roughness:0.72}));g.add(hull);
    if(launch) {
      for(let deck=0;deck<3;deck++) {
        box(g,0,0.65+deck*1.5,0,size*.72,0.2,size*.30,trim);
        box(g,0,1.20+deck*1.5,0,size*.62,1.0,size*.25,new THREE.MeshStandardMaterial({color:'#d6d0b7',roughness:0.65}));
        for(let side of [-1,1]) for(let xx=-size*.26;xx<size*.3;xx+=0.85) {
          box(g,xx,1.22+deck*1.5,side*size*.126,0.55,0.56,0.025,new THREE.MeshStandardMaterial({color:'#252f33',emissive:'#f4c879',emissiveIntensity:0.6,roughness:0.2}));
        }
      }
      box(g,0,4.75,0,size*.7,0.14,size*.29,iron);
      const mast = box(g,0,5.4,0,0.07,1.4,0.07,iron);
      W.lamp(v(x,3,z),'#ffd6a0',16,1.5);
    } else {
      for(let xx=-size*.3;xx<size*.35;xx+=0.6)box(g,xx,0.10,0,0.24,0.10,size*.26,timber);
      const hood = new THREE.Mesh(new THREE.CylinderGeometry(size*.15,size*.15,size*.40,12,1,true,0,Math.PI),new THREE.MeshStandardMaterial({color:'#876d4e',roughness:0.93,side:THREE.DoubleSide}));
      hood.rotation.z=Math.PI/2;hood.position.y=.3;g.add(hood);
    }
    W.riverBoats.push({mesh:g,baseX:x,baseZ:z,phase:rng()*6,launch});
  }
  boat(-31,-60,19,true);boat(37,-73,23,true);
  for(let i=0;i<9;i++)boat(-73+i*17,-48-rng()*22,3.7+rng()*1.8);

  // Terminal gate and roof: landmarks visible from the whole southern approach.
  for (const x of [-12,12]) {
    box(W.group,x,2.1,-39.5,0.65,4.2,0.65,stone);
    W.addCollider(Box.fromCenter(x,2.1,-39.5,0.65,4.2,0.65,{climbable:false,tag:'pillar'}));
  }
  box(W.group,0,4.4,-39.5,25,0.35,3.7,iron);
  W.addCollider(Box.fromCenter(0,4.4,-39.5,25,.35,3.7,{tag:'canopy'}));
  sign('বুড়িগঙ্গা নৌঘাট','BURIGANGA · LAUNCH TERMINAL',0,3.8,-37.62,9);
  W.lamp(v(0,3.9,-37),'#ffce8a',18,1.8);

  // Heritage frontage: recessed arched shutters, cornices and timber pilasters.
  const heritage = W.buildings.filter(b=>b.q && b.q[1]===-1 && b.q[2]===1);
  for(const b of heritage) {
    const front = b.z1+.035, width=b.x1-b.x0;
    for(const yy of [3.1,6.2,Math.min(b.h-.2,9.2)]) box(W.group,(b.x0+b.x1)/2,yy,front,width,.15,.18,trim);
    for(let x=b.x0+1.1;x<b.x1-.8;x+=2.4) {
      box(W.group,x-0.8,2.8,front+.08,.14,5.4,.18,trim);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(.65,.065,6,16,Math.PI),trim);arch.position.set(x,4.65,front+.11);W.group.add(arch);
      box(W.group,x,4.10,front+.08,1.23,1.1,.065,iron);
      for(let k=-2;k<=2;k++)box(W.group,x+k*.2,4.16,front+.125,.028,1.1,.018,timber);
      box(W.group,x,3.57,front+.17,1.45,.12,.30,trim);
    }
  }
  sign('কারুশিল্প ও শঙ্খের দোকান','CRAFTS · FAMILY WORKSHOP',-30,2.75,-23.82,5.8);
  sign('পুরান ঢাকা','OLD DHAKA · RIVER ROAD',-67,3.0,6.7,4.5,Math.PI);

  // Drain grates, curbstones, painted road edges, torn posters and utility pipes.
  const poster = canvasTex(256,512,(g,w,h)=>{
    g.fillStyle='#d4c9a5';g.fillRect(0,0,w,h);g.fillStyle='#383930';g.textAlign='center';
    g.font=`bold 38px ${font}`;g.fillText('বাসা ভাড়া',w/2,70);g.font=`25px ${font}`;g.fillText('যোগাযোগ করুন',w/2,123);
    g.fillStyle='#772b25';g.fillRect(20,165,w-40,7);g.font='24px monospace';g.fillText('01700–000000',w/2,213);
    for(let i=0;i<90;i++){g.fillStyle=`rgba(55,45,30,${rng()*.20})`;g.fillRect(rng()*w,rng()*h,2+rng()*40,1+rng()*4);}
  },{clamp:true});
  const posterMat=new THREE.MeshStandardMaterial({map:poster,roughness:1,polygonOffset:true,polygonOffsetFactor:-1});
  const M=new THREE.Matrix4(),Q=new THREE.Quaternion();
  for(const b of W.buildings.filter(b=>b.q)) {
    const front=b.q[1]>0?b.z0-.035:b.z1+.035, ry=b.q[1]>0?Math.PI:0;
    if(rng()<.65){const p=new THREE.Mesh(new THREE.PlaneGeometry(.42,.85),posterMat);p.position.set(b.x0+.6,1.5,front);p.rotation.y=ry;W.group.add(p);}
    const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,b.h,6),iron);pipe.position.set(b.x1-.25,b.h/2,front);W.group.add(pipe);
    // Background shadow detail is instanced, with no gameplay collision changes.
    for(let y=.5;y<b.h;y+=2) {
      M.compose(v(b.x1-.25,y,front),Q,new THREE.Vector3(.12,.05,.12));W.instance('pipe-bracket',new THREE.BoxGeometry(1,1,1),iron,M);
    }
  }
  for(let x=-75;x<76;x+=8) for(const side of [-1,1]) {
    box(W.group,x,.012,side*4.7,0.7,.025,.28,iron);
    for(let k=-3;k<=3;k++)box(W.group,x+k*.085,.028,side*4.7,.026,.018,.27,stone);
  }
  // Distant opposite bank keeps the river open and legible, rather than a wall of towers.
  for(let x=-170;x<180;x+=12) {
    const h=3+rng()*7;box(W.group,x,h/2,-180-rng()*12,10,h,9,rng()>.5?brick:stone);
  }
}

export function updateDhaka(W,t) {
  if(W.riverShader) W.riverShader.uniforms.riverTime.value=t;
  for(const b of W.riverBoats || []) {
    b.mesh.position.y=-.67+Math.sin(t*.7+b.phase)*.045;
    b.mesh.rotation.z=Math.sin(t*.55+b.phase)*.013;
  }
}
