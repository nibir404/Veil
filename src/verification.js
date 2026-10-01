// Development-only checks and repeatable screenshot viewpoints. Not loaded in release builds.
import * as THREE from 'three';
import { Box } from './util.js';
import { missionNavigation, groundRoute } from './navigation.js';
import { attachWeapon } from './characters.js';

export function mountVerification(g) {
  const panel=document.createElement('aside');panel.id='verification';
  panel.style.cssText='position:fixed;bottom:8px;left:8px;z-index:90;background:#101a20ed;color:#e1d7c0;padding:12px;font:11px monospace;max-width:600px;max-height:42vh;overflow:auto;border:1px solid #65786d';
  const buttons=document.createElement('div'), out=document.createElement('pre'), metrics=document.createElement('div');panel.append(buttons,metrics,out);document.body.append(panel);
  const button=(name,fn)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='padding:6px;margin:3px;font:11px monospace;letter-spacing:0';b.onclick=fn;buttons.append(b);};
  const inspect=(pos,at)=>{
    g.state='inspection';g.modal=null;document.exitPointerLock?.();
    document.querySelectorAll('.screen,.modal').forEach(e=>e.classList.remove('on'));document.body.classList.remove('playing','cine');
    g.camera.position.set(...pos);g.camera.lookAt(...at);g.camera.fov=58;g.camera.updateProjectionMatrix();
    g.post.u.veil.value=0;g.post.u.hurt.value=0;out.textContent='';
  };
  button('Riverfront',()=>inspect([8,7,-30],[-15,1,-69]));
  button('City overview',()=>inspect([-57,27,-33],[18,9,19]));
  button('Street',()=>inspect([-42,2.2,4.6],[20,2.3,6]));
  button('Raven',()=>{g.player.pos.set(-12,.18,5.8);g.player.bodyYaw=-.55;g.player.crouch=false;g.player.animate(0);inspect([-14,1.9,3.0],[-12,1.1,5.8]);});
  button('Mission map',()=>{g.mission.active=true;g.ui.map();g.modal='map';});
  button('Run gameplay checks',()=>{
    g.state='paused';let passed=0,failed=0;out.textContent='';
    const check=(name,fn)=>{try{if(fn()===false)throw Error('assertion failed');passed++;out.textContent+=`PASS ${name}\n`;}catch(e){failed++;out.textContent+=`FAIL ${name}: ${e.message}\n`;}};
    const P=g.player, savedPos=P.pos.clone(),savedYaw=P.yaw;
    const input=(keys=[],pressed=[],mouse=[false,false,false])=>({down:k=>keys.includes(k),pressed:k=>pressed.includes(k),mouse,mousePressed:()=>false,mdx:0,mdy:0});
    check('First lead route reaches the tea stall',()=>{g.mission.targetKnown=false;g.mission.phase='infiltrate';const n=missionNavigation(g);return n.kind==='intel' && groundRoute(g.world,new THREE.Vector3(-74,.18,5.8),n).length>1;});
    check('Known target routes to ground entrance',()=>{g.mission.targetKnown=true;P.pos.set(-74,.18,5.8);const n=missionNavigation(g);return n.kind==='entry' && groundRoute(g.world,P.pos,n).length>1;});
    check('Roof guidance changes to the target',()=>{P.pos.set(33,18,26);return missionNavigation(g).kind==='target';});
    check('Extraction guidance returns west',()=>{g.mission.phase='exfil';return missionNavigation(g).kind==='exit';});
    const start=g.world.buildings.find(b=>b.q&&b.q[0]===-1&&b.q[1]===1&&b.q[2]===0);
    check('Facade climb and mantle',()=>{
      P.pos.set((start.x0+start.x1)/2,0,6.5);P.vel.set(0,0,0);P.onGround=true;P.yaw=Math.PI;
      P.update(1/60,input(['KeyW'],['Space']));
      if(!P.climbing)return false;
      for(let i=0;i<600&&P.climbing;i++)P.update(1/60,input(['KeyW']));
      return !P.climbing&&Math.abs(P.pos.y-start.h)<.1&&P.pos.z>start.z0;
    });
    const boxes=g.world.colliders;
    check('Sprint-slide enters and exits cleanly',()=>{
      g.world.colliders=[];P.pos.set(0,0,0);P.vel.set(0,0,-6);P.onGround=true;P.yaw=0;P.slideCooldown=0;
      P.update(1/60,input(['KeyW','ShiftLeft'],['ControlLeft']));const active=P.slide>0&&P.crouch;
      for(let i=0;i<60;i++)P.update(1/60,input());return active&&P.slide===0;
    });
    g.world.colliders=boxes;
    check('Weapon can be re-equipped after holstering',()=>{attachWeapon(P.rig,'pistol');attachWeapon(P.rig,null);P.aiming=true;P.weaponUpdate(1/60,input([],[],[false,false,true]),null,new THREE.Vector3(1,0,0));return !!P.rig.weapon;});
    check('Reload transfers ammunition without creating rounds',()=>{
      const w=P.weapon,ammo=w.ammo,res=w.res;w.ammo=2;w.res=8;P.weaponUpdate(.016,input([],['KeyR']),null,new THREE.Vector3(1,0,0));
      for(let i=0;i<100;i++)P.weaponUpdate(.02,input(),null,new THREE.Vector3(1,0,0));
      const ok=w.ammo===10&&w.res===0;w.ammo=ammo;w.res=res;return ok;
    });
    check('Nearby cover blocks barrel fire',()=>{
      P.pos.set(0,0,0);P.yaw=0;P.bodyYaw=0;P.pitch=0;P.crouch=false;P.aiming=true;P.animate(0);P.rig.root.updateMatrixWorld(true);
      g.camera.position.set(.5,1.62,1.55);g.camera.lookAt(.5,1.62,-100);
      const originalHit=g.combat.applyHit,originalNoise=g.ai.noise;let hit;
      g.combat.applyHit=h=>hit=h;g.ai.noise=()=>{};
      g.world.colliders=[new Box(-2,0,-.4,2,3,-.35)];
      try {P.fire(P.weapon,new THREE.Vector3(1,0,0));return hit?.type==='world'&&hit.point.z>-.41;}
      finally {g.combat.applyHit=originalHit;g.ai.noise=originalNoise;g.world.colliders=boxes;}
    });
    check('Veil preserves separate player/world rates',()=>{const a=g.veil.amount;g.veil.amount=1;const ok=Math.abs(g.veil.worldScale-.16)<1e-8&&Math.abs(g.veil.playerScale-.55)<1e-8;g.veil.amount=a;return ok;});
    check('Quality resolution reaches postprocessing',()=>g.renderer.getPixelRatio()===g.post.composer._pixelRatio);
    check('River is excluded from civilian navigation',()=>!g.world.navWalkable(...g.world.navCell(0,-50)));
    check('Raven joint transforms remain finite',()=>{P.rig.root.updateMatrixWorld(true);let ok=true;P.rig.root.traverse(o=>{ok&&=o.matrixWorld.elements.every(Number.isFinite);});return ok;});
    P.pos.copy(savedPos);P.yaw=savedYaw;P.vel.set(0,0,0);P.crouch=false;P.aiming=false;P.reloading=0;P.animate(0);g.mission.phase='infiltrate';g.mission.targetKnown=false;
    out.textContent+=`\n${passed} passed / ${failed} failed. Reload before playing.`;
  });
  let count=0,start=performance.now();
  const frame=()=>{count++;const elapsed=performance.now()-start;if(elapsed>2000){metrics.textContent=`${Math.round(count*1000/elapsed)} FPS · ${g.quality} · ${g.renderer.getPixelRatio().toFixed(2)} render scale`;count=0;start=performance.now();}requestAnimationFrame(frame);};requestAnimationFrame(frame);
}
