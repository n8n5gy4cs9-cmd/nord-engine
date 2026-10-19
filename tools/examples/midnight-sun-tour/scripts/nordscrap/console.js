// Adapted from this repository's xk/devconsole.js. Local whitelist only; never eval user text.
// Starts empty; command discovery belongs exclusively to the shipped text file.
export class TourConsole {
  constructor(host) {
    this.host=host;this.open=false;this.history=[];this.cursor=0;
    this.el=document.createElement('section');this.el.dataset.tourConsole='';
    this.el.style.cssText='position:fixed;inset:auto 0 0;height:40%;z-index:10000;background:#100b1bf5;color:#efcdab;border-top:2px solid #ac6e7f;padding:12px;box-sizing:border-box;font:15px/1.5 monospace;display:none';
    this.log=document.createElement('pre');this.log.style.cssText='margin:0;height:calc(100% - 38px);overflow:auto;white-space:pre-wrap';
    this.input=document.createElement('input');this.input.setAttribute('aria-label','Command');this.input.autocomplete='off';this.input.spellcheck=false;
    this.input.style.cssText='width:100%;box-sizing:border-box;background:#21142c;color:#ffdfb3;border:1px solid #ac6e7f;font:inherit;padding:5px';
    this.el.append(this.log,this.input);document.body.append(this.el);
    this.key=e=>{
      if(e.code==='Backquote'||e.code==='F2'){
        e.preventDefault();e.stopImmediatePropagation();if(e.type==='keydown'&&!e.repeat)this.toggle();return;
      }
      if(!this.open)return;e.stopImmediatePropagation();
      if(e.type==='keyup')return;
      if(e.key==='Escape'){e.preventDefault();this.toggle();}
      else if(e.key==='Enter'){
        e.preventDefault();const command=this.input.value.trim();this.input.value='';
        if(command){this.history.push(command);this.cursor=this.history.length;
          if(command.toLowerCase()==='clear'){this.log.textContent='';return;}
          this.write('> '+command);try{this.write(this.host.game_.command(command));}catch(err){this.write(err.message);}
        }
      }else if(e.key==='ArrowUp'||e.key==='ArrowDown'){
        e.preventDefault();this.cursor=Math.max(0,Math.min(this.history.length,this.cursor+(e.key==='ArrowUp'?-1:1)));this.input.value=this.history[this.cursor]??'';
      }
    };
    window.addEventListener('keydown',this.key,true);window.addEventListener('keyup',this.key,true);
  }
  toggle(){this.open=!this.open;this.host.compat.resetInput();this.el.style.display=this.open?'block':'none';if(this.open)this.input.focus();else{this.input.blur();this.host.compat.canvas.focus();}}
  write(text){this.log.textContent=(this.log.textContent+text+'\n').slice(-16000);this.log.scrollTop=this.log.scrollHeight;}
  destroy(){window.removeEventListener('keydown',this.key,true);window.removeEventListener('keyup',this.key,true);this.el.remove();}
}
