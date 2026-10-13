// Reusable code-drawn touch controls. Copy into any Nord 2D/3D project; map your action names.
import { virtualJoystick } from 'nord';
export function mountTouchControls(input,parent,{left='left',right='right',up='up',down='down',fire='fire',shield='jump',rightInset=24,bottomInset=24}={}) {
  const layer=document.createElement('div');layer.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:3';parent.append(layer);
  const joystick=virtualJoystick(input,layer,{left,right,up,down,size:112});joystick.el.style.pointerEvents='auto';joystick.el.style.bottom=bottomInset+'px';joystick.el.setAttribute('aria-label','Touch joystick: drag to steer');
  const held=new Set(),buttons=[];
  function add(label,action,rightOffset){
    const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-label',label);b.style.cssText=`position:absolute;right:${rightOffset}px;bottom:${bottomInset}px;width:72px;height:72px;border-radius:50%;border:2px solid #baded4;background:#234958dd;color:white;font:700 13px system-ui;pointer-events:auto;touch-action:none;user-select:none`;
    const release=()=>{held.delete(action);input.setVirtual(action,false);};
    b.onpointerdown=e=>{e.preventDefault();e.stopPropagation();b.setPointerCapture(e.pointerId);held.add(action);input.setVirtual(action,true);};
    b.onpointerup=b.onpointercancel=b.onlostpointercapture=release;
    layer.append(b);buttons.push(b);
  }
  add('FIRE',fire,rightInset);add('SHIELD',shield,rightInset+85);
  const reset=()=>{for(const action of[left,right,up,down,fire,shield])input.setVirtual(action,false);input.stick=[0,0];held.clear();};
  window.addEventListener('blur',reset);const hidden=()=>{if(document.hidden)reset();};document.addEventListener('visibilitychange',hidden);
  return{destroy(){reset();window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',hidden);joystick.destroy();layer.remove();}};
}
