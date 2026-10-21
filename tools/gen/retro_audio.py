"""Original deterministic music/SFX for the full retro coding tutorials."""
import os, wave, subprocess
import numpy as np
from common import out
from audio import SR, tone, note, sweep, noise, env, mix, cat

def save(name, signal):
    p=out('audio','retro-tutorials',name+'.wav')
    x=signal/max(float(np.abs(signal).max()),1e-6)*.75
    with wave.open(p,'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes((x*32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',p,'-codec:a','libmp3lame','-b:a','128k',p[:-4]+'.mp3'],check=True)

def music(name,roots,tempo,bright):
    beat=60/tempo;step=beat/2;length=step*64
    result=np.zeros(int(length*SR))
    for i in range(64):
        root=roots[(i//16)%len(roots)]
        bass=tone(note(root),step*.9,'tri',.35)
        melody=tone(note(root+12+[0,7,12,7,3,7,10,7][i%8]),step*.7,'sq' if bright else 'tri',.12)
        kick=sweep(110,35,.12,'sin')*env(int(SR*.12),r=.1) if i%4==0 else np.zeros(1)
        hat=noise(.045,.8)*env(int(SR*.045),r=.04)*.035
        chunk=mix(bass,melody,kick*.4,hat)
        at=int(i*step*SR);end=min(len(result),at+len(chunk));result[at:end]+=chunk[:end-at]
    save(name,result)

def run():
    music('coast-drive',[45,41,48,43],128,True)
    music('coast-night',[48,43,45,41],118,False)
    music('vector-flight',[40,43,38,45],132,False)
    music('vector-boss',[36,39,38,35],148,True)
    effects={
      'engine':mix(tone(65,1,'saw',.4,r=.01),tone(130,1,'tri',.2,r=.01)),
      'skid':noise(.35,.3)*env(int(SR*.35),r=.3),
      'crash':mix(noise(.45,.12)*env(int(SR*.45),r=.4),sweep(150,35,.45,'sin')),
      'checkpoint':cat(*[tone(note(n),.09,'sq',.3) for n in [72,76,79,84]]),
      'laser':sweep(1500,220,.14,'sq')*env(int(SR*.14),r=.12),
      'explosion':mix(noise(.6,.1)*env(int(SR*.6),r=.55),sweep(120,25,.6,'sin')),
      'shield':cat(tone(330,.12,'tri'),tone(660,.18,'tri')),
      'win':cat(*[tone(note(n),.16,'tri',.35) for n in [60,64,67,72,76,79]]),
    }
    for name,signal in effects.items(): save(name,signal)
    print('retro tutorials: 4 original music tracks + 8 MP3/WAV sound effects')
