import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { Box, rayBoxes, raySphere } from '../src/util.js';
import { moveBody, overlapsBody, SimulationTimers } from '../src/physics.js';
const body = (x=0,y=0,z=0) => ({pos:new Vector3(x,y,z),vel:new Vector3(),radius:.34,onGround:y===0,fallStartY:y});

test('parallel ray on a slab face stays finite and detects the wall',()=>{
 const b=new Box(0,0,0,1,2,1);
 const h=rayBoxes(new Vector3(0,1,-2),new Vector3(0,0,1),10,[b]);
 assert.equal(h.t,2); assert(h.normal.z===-1);
 assert.equal(rayBoxes(new Vector3(2,1,-2),new Vector3(0,0,1),10,[b]),null);
});
test('ray beginning inside cover blocks immediately',()=>{
 assert.equal(rayBoxes(new Vector3(.5,1,.5),new Vector3(0,0,1),10,[new Box(0,0,0,1,2,1)]).t,0);
 assert.equal(raySphere(new Vector3(),new Vector3(0,0,1),new Vector3(),1),0);
});
test('high speed cannot tunnel through a thin wall',()=>{
 const b=body(-1);b.vel.x=20;
 moveBody(b,.1,[new Box(0,0,-2,.03,3,2)],1.75);
 assert(b.pos.x<=-.34);assert.equal(b.vel.x,0);
});
test('fall from height lands on the rooftop, not underneath it',()=>{
 const b=body(0,15,0);b.vel.y=-35;
 const boxes=[new Box(-5,0,-5,5,10,5)];let fall;
 for(let i=0;i<30;i++){const f=moveBody(b,.033,boxes,1.75);if(f!==null)fall=f;}
 assert.equal(b.pos.y,10);assert(b.onGround);assert.equal(fall,5);
});
test('ceiling collision stops a jump',()=>{
 const b=body();b.onGround=false;b.vel.y=6.1;
 for(let i=0;i<12;i++){moveBody(b,1/120,[new Box(-2,2,-2,2,2.2,2)],1.75);assert(b.pos.y+1.75<=2.002);}
});
test('crouched player cannot stand into a canopy',()=>{
 const b=new Box(-2,1.4,-2,2,1.6,2);
 assert(!overlapsBody(new Vector3(),.34,1.15,b));
 assert(overlapsBody(new Vector3(),.34,1.75,b));
});
test('curbs are stepped up; tall cover cannot be stepped through',()=>{
 const b=body(-1);b.vel.x=3;
 for(let i=0;i<50;i++){b.vel.x=3;moveBody(b,1/60,[new Box(0,0,-2,4,.18,2)],1.75);}
 assert.equal(b.pos.y,.18);assert(b.pos.x>0);
});
test('timers freeze with simulation and callbacks scheduled inside callbacks survive',()=>{
 const s=new SimulationTimers();let n=0;
 s.after(1,()=>{n++;s.after(.5,()=>n++);});
 s.update(0);assert.equal(n,0);s.update(.9);assert.equal(n,0);s.update(.11);assert.equal(n,1);s.update(.5);assert.equal(n,2);
});
test('movement distance is stable across 30, 60 and 144 FPS',()=>{
 const values=[30,60,144].map(fps=>{const b=body();for(let i=0;i<fps;i++){b.vel.x=6;moveBody(b,1/fps,[],1.75);}return b.pos.x;});
 for(const value of values)assert(Math.abs(value-6)<.001);
});
