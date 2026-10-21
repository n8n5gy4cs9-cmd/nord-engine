// Original small arena rules. No Nintendo/Battle City code or data.
export const DIRECTIONS=[[0,-1],[1,0],[0,1],[-1,0]];
export function overlaps(a,b,pad=0){return Math.abs(a.x-b.x)<(a.w+b.w)/2+pad&&Math.abs(a.y-b.y)<(a.h+b.h)/2+pad;}
export function canMove(actor,x,y,objects,width,height){const p={...actor,x,y};return x>=actor.w/2&&y>=actor.h/2&&x<=width-actor.w/2&&y<=height-actor.h/2&&!objects.some(o=>o!==actor&&o.alive&&overlaps(p,o));}
export function shotTarget(bullet,objects){return objects.find(o=>o.alive&&o.id!==bullet.owner&&!(bullet.team==='enemy'&&o.kind==='enemy')&&overlaps(bullet,o));}
