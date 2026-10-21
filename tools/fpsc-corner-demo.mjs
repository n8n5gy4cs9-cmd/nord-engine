// Original editable example: an octagonal room and a circular room built from shared grid corners.
import { newLevel, paintRoom, setCell } from '../runtime/fpsc/level.js';
export function cornerDemo() {
  const level=newLevel({name:'Corner workshop',w:13,d:8});
  level.settings.ground='none';level.settings.ambient=0.65;level.settings.objective='Explore the octagon. The circular room is linked by a teleporter.';
  paintRoom(level,0,1,1,4,4,{floor:'wood_floor',ceiling:'ceiling_tiles',tex:'brick'});
  paintRoom(level,0,8,2,9,3,{floor:'tile_checker',ceiling:'ceiling_tiles',tex:'metal_panel'});
  for(const [x,z,corner] of [[1,1,'SW'],[4,1,'SE'],[1,4,'NW'],[4,4,'NE']]) setCell(level,0,x,z,{shape:{kind:'diagonal',corner,t:'brick'}});
  for(const [x,z,corner] of [[8,2,'SW'],[9,2,'SE'],[8,3,'NW'],[9,3,'NE']]) setCell(level,0,x,z,{shape:{kind:'round',corner,t:'metal_panel'}});
  const add=(type,x,z,props={},extra={})=>level.entities.push({id:`corner_${level.entities.length}`,type,x,z,layer:0,rot:0,props,...extra});
  add('player_start',12,12);add('level_exit',12,8);
  add('teleporter',18,12,{},{name:'to_circle',target:'circle_arrival'});
  add('spawn_point',36,12,{},{name:'circle_arrival'});
  add('teleporter',38,12,{},{name:'to_octagon',target:'octagon_arrival'});
  add('spawn_point',14,12,{},{name:'octagon_arrival'});
  add('light_point',12,12,{intensity:1,range:18}); add('light_point',36,12,{intensity:1,range:10});
  return level;
}
