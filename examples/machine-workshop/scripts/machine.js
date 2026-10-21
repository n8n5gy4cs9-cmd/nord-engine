import { NordScript } from 'nord';
// Original gravity puzzle; Nord's existing Matter adapter simulates all bodies.
export default class Machine extends NordScript {
  start(){
    this.started=false;this.game.paused=true;this.panel=document.createElement('div');Object.assign(this.panel.style,{position:'absolute',left:'16px',top:'16px',padding:'16px',color:'#ecf3fa',background:'#17232dee',font:'14px system-ui',border:'1px solid #65809b',borderRadius:'8px',maxWidth:'400px',zIndex:100});document.getElementById('stage').append(this.panel);
    const title=document.createElement('strong');title.textContent='MACHINE WORKSHOP';this.panel.append(title);
    const desc=document.createElement('p');desc.textContent='Guide the ball into the basket. Tune both ramps, then Release. Gravity, friction and bounce do the rest.';this.panel.append(desc);
    for(const name of ['Ramp A','Ramp B']){const label=document.createElement('label');label.textContent=name+' angle ';const input=document.createElement('input');input.type='range';input.min=-25;input.max=35;input.value=15;input.setAttribute('aria-label',name+' angle');const val=document.createElement('span');val.textContent='15°';input.oninput=()=>{if(this.started)return;const e=this.scene.find(name);e.rot=[0,0,Number(input.value)];val.textContent=input.value+'°';this.game.backend.syncTransform(e);};label.append(input,val);label.style.display='block';this.panel.append(label);}
    const button=(text,fn)=>{const b=document.createElement('button');b.textContent=text;b.onclick=fn;Object.assign(b.style,{margin:'10px 8px 0 0',padding:'8px 15px',cursor:'pointer'});this.panel.append(b);};
    button('Release',()=>{this.started=true;this.panel.querySelectorAll('input').forEach(i=>i.disabled=true);this.game.paused=false;});button('Reset',()=>this.game.restart());
    this.result=document.createElement('p');this.result.textContent='Ready — ball held until Release';this.panel.append(this.result);
    this.off=this.events.on('level-win',()=>{this.won=true;this.result.textContent='Solved! Ball in the basket. Reset to try another setup.';this.game.paused=true;});
    this.key=e=>{if(e.code==='KeyR')this.game.restart();};window.addEventListener('keydown',this.key);
  }
  update(){if(!this.started||this.won)return;const p=this.scene.find('Player');this.result.textContent=p?.pos[1]>550?'Ball lost — Reset and change the ramps.':'Running — watch the ball roll and fall.';}
  onDestroy(){this.off?.();window.removeEventListener('keydown',this.key);this.panel.remove();}
}
