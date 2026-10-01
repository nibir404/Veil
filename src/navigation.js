import { Vector3 } from 'three';

// Mission guidance is explicit about ground entrances and vertical traversal.
// It never asks the ground pathfinder to route through a building to a rooftop.
export function missionNavigation(game) {
  const {mission:m,player:p,world:w,ai}=game;
  const entry = new Vector3(30.25,0,27.7);
  if (m.phase === 'done') return null;
  if (m.phase === 'exfil') return { pos:w.designed.extraction.clone(), title:'EXTRACTION', instruction:'Follow River Road west. Meet the waiting rickshaw.', kind:'exit' };
  if (!m.targetKnown && m.phase !== 'confirm') {
    return {pos:w.teaStall.phonePos.clone(),title:'TEA STALL · FIRST LEAD',instruction:'Enter the tea-stall corner from River Road. Read the phone on the bench [E].',kind:'intel'};
  }
  const target = ai.target;
  if (target.pos.y < 3 && (m.phase === 'chase' || m.phase === 'confirm')) {
    return {pos:target.pos.clone(), title:m.phase==='confirm'?'CONFIRM THE KILL':'EAST ROAD · TARGET ESCAPE',instruction:m.phase==='confirm'?'Approach the body and search it [E].':'Reach the east road before the target escapes.',kind:'target'};
  }
  if (p.pos.y < w.designed.target.h - 0.5) {
    return {pos:entry,title:'RAHMAN TELECOM · WEST ENTRANCE',instruction:'Use the narrow west alley. Face the east wall, press SPACE, then hold W to climb to the roof.',kind:'entry',roof:new Vector3(31.8,w.designed.target.h,27.7)};
  }
  return {pos:target.pos.clone(), title:m.phase==='confirm'?'SEARCH THE BODY':'ROOFTOP · THE CARTOGRAPHER',instruction:m.phase==='confirm'?'Search the body [E] to confirm the photograph.':'Cross the rooftop carefully. Observe patrols [X]; choose your approach.',kind:'target'};
}

export function groundRoute(world, player, navigation) {
  if (!navigation || player.y > 2 || navigation.pos.y > 3) return [];
  return world.findPath(player,navigation.pos) || [];
}
