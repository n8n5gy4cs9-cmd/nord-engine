// Local MP3/WAV/OGG files, decoded on first user activation. No external service.
export class RetroAudio {
  constructor(config) { this.config=config;this.cache=new Map();this.voices=new Set();this.problem='';this.muted=false; }
  async unlock() {
    this.ctx??=new AudioContext();
    if(!this.master){this.master=this.ctx.createGain();this.master.gain.value=.55;this.master.connect(this.ctx.destination);}
    await this.ctx.resume();
  }
  async load(path) {
    if(!this.cache.has(path))this.cache.set(path,(async()=>{const response=await fetch(path);if(!response.ok)throw Error(`${path}: HTTP ${response.status}`);return this.ctx.decodeAudioData(await response.arrayBuffer());})());
    return this.cache.get(path);
  }
  async voice(path,{volume=.5,loop=false,rate=1}={}) {
    if(!this.ctx)return null;
    try {
      const buffer=await this.load(path);if(this.voices.size>24&&!loop)return null;
      const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=buffer;source.loop=loop;source.playbackRate.value=rate;gain.gain.value=volume;source.connect(gain);gain.connect(this.master);
      const voice={source,gain};this.voices.add(voice);source.onended=()=>{this.voices.delete(voice);source.disconnect();gain.disconnect();};source.start();return voice;
    }catch(error){this.problem=error.message;console.warn('[retro audio]',error);return null;}
  }
  play(name,options={}) {const path=this.config.sfx[name];return path?this.voice(path,options):Promise.resolve(null);}
  async music(index=0) {
    const old=this.song,next=await this.voice(this.config.music[index%this.config.music.length],{loop:true,volume:0});
    if(!next)return;this.song=next;next.gain.gain.linearRampToValueAtTime(.4,this.ctx.currentTime+.4);
    if(old){old.gain.gain.linearRampToValueAtTime(0,this.ctx.currentTime+.4);old.source.stop(this.ctx.currentTime+.45);}
  }
  mute() {this.muted=!this.muted;if(this.master)this.master.gain.gain.value=this.muted?0:.55;return this.muted;}
  suspend() {if(this.ctx?.state==='running')return this.ctx.suspend();}
  resume() {if(this.ctx?.state==='suspended')return this.ctx.resume();}
  async dispose() {if(this.ctx)await this.ctx.close();this.voices.clear();}
}
