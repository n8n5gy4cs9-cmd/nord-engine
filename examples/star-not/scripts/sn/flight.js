// GPL-2.0-or-later. Simplified JavaScript adaptation of the normal-acceleration branch
// of inertial_thrust(), sc2/src/uqm/ship.c, 0xDEC0DE/sc2-uqm uqm-ee
// d0f959d013b52c275f27d944039073d066dc8c93; Copyright Paul Reiche, Fred Ford 1992–2002.
// Uses floating-point seconds rather than UQM fixed-point ticks. No gravity slingshot branch.
export function thrust(ship, amount, dt) {
  const dx=ship.vx+Math.sin(ship.angle)*ship.spec.thrust*amount*dt;
  const dy=ship.vy-Math.cos(ship.angle)*ship.spec.thrust*amount*dt;
  const wanted=dx*dx+dy*dy,max=ship.spec.speed*ship.spec.speed;
  if(wanted<=max){ship.vx=dx;ship.vy=dy;}
  else {const scale=ship.spec.speed/Math.sqrt(wanted);ship.vx=dx*scale;ship.vy=dy*scale;}
}
export const wrap = (n,lo,hi) => ((n-lo)%(hi-lo)+(hi-lo))%(hi-lo)+lo;
export function wrappedDelta(from,to,span) { let d=to-from;if(d>span/2)d-=span;if(d<-span/2)d+=span;return d; }
export function shortestTurn(from,to) { return Math.atan2(Math.sin(to-from),Math.cos(to-from)); }
export function moveShip(ship,controls,dt,arena) {
  ship.angle+=controls.turn*ship.spec.turn*dt;
  if(controls.thrust)thrust(ship,controls.thrust,dt);
  if(controls.brake){const drag=Math.exp(-3.5*dt);ship.vx*=drag;ship.vy*=drag;}
  ship.x=wrap(ship.x+ship.vx*dt,arena.left,arena.right);ship.y=wrap(ship.y+ship.vy*dt,arena.top,arena.bottom);
  ship.cooldown=Math.max(0,ship.cooldown-dt);ship.shield=Math.max(0,ship.shield-dt);ship.shieldWait=Math.max(0,ship.shieldWait-dt);
  if(controls.shield&&ship.shieldWait<=0){ship.shield=1.1;ship.shieldWait=5;}
}
export function gamepadControls(pad) {
  if(!pad)return {turn:0,thrust:0,fire:false,brake:false,shield:false};
  const axis=pad.axes?.[0]||0,up=-(pad.axes?.[1]||0),button=i=>!!pad.buttons?.[i]?.pressed;
  return {turn:Math.abs(axis)>.18?axis:0,thrust:button(7)?1:Math.max(0,up>.18?up:0),fire:button(0),brake:button(1),shield:button(2)};
}
