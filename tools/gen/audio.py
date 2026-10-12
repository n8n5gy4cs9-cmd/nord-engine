"""Synthesised placeholder SFX (wav) + music loops (mp3 via ffmpeg). Deterministic."""
import wave, subprocess, os
from common import *

SR = 44100
rng = np.random.default_rng(1)

def t_(d): return np.arange(int(SR * d)) / SR
def env(n, a=.005, d=.0, s=1.0, r=.05):
    e = np.ones(n); na, nr = int(SR * a), int(SR * r)
    if na: e[:na] = np.linspace(0, 1, na)
    if nr and nr < n: e[-nr:] *= np.linspace(1, 0, nr)
    return e
def osc(f, d, wave="sq", duty=.5):
    t = t_(d); f = f if np.ndim(f) else np.full_like(t, f); ph = np.cumsum(f) / SR
    if wave == "sq": return np.where((ph % 1) < duty, 1., -1.) * .6
    if wave == "tri": return (2 * np.abs(2 * (ph % 1) - 1) - 1) * .9
    if wave == "saw": return (2 * (ph % 1) - 1) * .6
    return np.sin(2 * np.pi * ph)
def sweep(f0, f1, d, wave="sq", curve=1.0):
    t = t_(d) / d; return osc(f0 + (f1 - f0) * t ** curve, d, wave)
def noise(d, lp=1.0):
    x = rng.uniform(-1, 1, int(SR * d))
    if lp < 1:
        a = lp; y = np.zeros_like(x); 
        for i in range(1, len(x)): y[i] = y[i - 1] + a * (x[i] - y[i - 1])
        return y * 2
    return x
def tone(f, d, wave="sq", vol=.5, a=.005, r=.05, **k): s = osc(f, d, wave, **k); return s * env(len(s), a, r=r) * vol
def cat(*xs): return np.concatenate(xs)
def mix(*xs):
    n = max(len(x) for x in xs); o = np.zeros(n)
    for x in xs: o[:len(x)] += x
    return o
def note(n): return 440 * 2 ** ((n - 69) / 12)

def wav(name, x, folder="sfx", vol=.9):
    x = x / max(np.abs(x).max(), 1e-6) * vol
    p = out("audio", folder, f"{name}.wav")
    with wave.open(p, "wb") as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype("<i2").tobytes())
    return p

def sfx():
    S = {}
    S["jump"] = sweep(260, 620, .18, "sq", .6) * env(int(SR * .18), r=.08)
    S["double_jump"] = cat(sweep(320, 700, .1), sweep(500, 900, .12)) * .8
    S["land"] = noise(.1, .08) * env(int(SR * .1), r=.09) + tone(90, .1, "sin", .6)
    S["coin"] = cat(tone(note(83), .06, "sq", .5), tone(note(88), .22, "sq", .5, r=.15))
    S["pickup"] = cat(tone(note(76), .05), tone(note(81), .05), tone(note(84), .12, r=.08))
    S["powerup"] = cat(*[tone(note(n), .07, "sq", .5) for n in (72, 76, 79, 84, 88)], tone(note(91), .25, "sq", .5, r=.2))
    S["hit"] = noise(.12, .5) * env(int(SR * .12), r=.1) * .8 + sweep(300, 80, .12, "sq")
    S["hurt"] = sweep(500, 120, .28, "saw") * env(int(SR * .28), r=.1)
    S["death"] = cat(sweep(600, 80, .6, "sq", .7)) * env(int(SR * .6), r=.3)
    S["explosion"] = noise(.9, .08) * env(int(SR * .9), a=.002, r=.85) * 1.2 + sweep(120, 30, .9, "sin") * .9
    S["explosion_small"] = noise(.35, .2) * env(int(SR * .35), r=.3) + sweep(140, 40, .35, "sin")
    S["shoot"] = sweep(900, 150, .14, "sq", .5) * env(int(SR * .14), r=.08)
    S["laser"] = sweep(1800, 300, .22, "saw", .4) * env(int(SR * .22), r=.1)
    S["laser2"] = mix(sweep(1200, 200, .3, "sq"), sweep(1210, 205, .3, "sq")) * env(int(SR * .3), r=.15)
    S["missile"] = noise(.6, .12) * env(int(SR * .6), a=.1, r=.3) * .7 + sweep(200, 500, .6, "saw") * .3
    S["reload"] = cat(tone(220, .04, "sq"), np.zeros(int(SR * .08)), tone(330, .06, "sq"))
    S["empty"] = tone(150, .06, "sq", .5)
    S["click"] = tone(1200, .03, "sq", .5, r=.025)
    S["hover"] = tone(800, .03, "tri", .4, r=.025)
    S["back"] = cat(tone(500, .05), tone(350, .08, r=.06))
    S["confirm"] = cat(tone(note(72), .06), tone(note(79), .12, r=.1))
    S["error"] = cat(tone(180, .1, "sq"), np.zeros(int(SR * .03)), tone(150, .16, "sq", r=.1))
    S["toggle"] = cat(tone(600, .04), tone(900, .05))
    S["open"] = sweep(300, 700, .2, "tri") * env(int(SR * .2), r=.1)
    S["close"] = sweep(700, 300, .2, "tri") * env(int(SR * .2), r=.1)
    S["win"] = cat(*[tone(note(n), d, "sq", .5) for n, d in ((72, .12), (76, .12), (79, .12), (84, .4))])
    S["lose"] = cat(*[tone(note(n), d, "tri", .6) for n, d in ((67, .2), (64, .2), (60, .2), (55, .5))])
    S["level_up"] = cat(*[tone(note(n), .08, "sq", .5) for n in (60, 64, 67, 72, 76, 79, 84)], tone(note(88), .3, "sq", .5, r=.25))
    S["step_grass"] = noise(.08, .25) * env(int(SR * .08), r=.07) * .6
    S["step_stone"] = mix(noise(.06, .6) * env(int(SR * .06), r=.05) * .7, tone(180, .05, "sin", .4))
    S["whoosh"] = noise(.35, .15) * env(int(SR * .35), a=.12, r=.2)
    S["swing"] = noise(.2, .35) * env(int(SR * .2), a=.06, r=.12)
    S["bounce"] = sweep(200, 700, .25, "sin", .4) * env(int(SR * .25), r=.15)
    S["splash"] = noise(.4, .3) * env(int(SR * .4), a=.02, r=.3) * .8
    S["bell"] = mix(tone(880, .8, "sin", .5, r=.7), tone(1760, .6, "sin", .25, r=.5), tone(2640, .4, "sin", .12, r=.35))
    S["notification"] = cat(tone(note(84), .08, "sin", .5), tone(note(91), .2, "sin", .5, r=.15))
    S["tick"] = tone(1000, .02, "sq", .4, r=.015)
    S["checkpoint"] = cat(tone(note(79), .1, "tri", .6), tone(note(84), .1, "tri", .6), tone(note(91), .25, "tri", .6, r=.2))
    S["door"] = noise(.3, .05) * env(int(SR * .3), a=.05, r=.2) * .6 + sweep(110, 70, .3, "sin")
    S["chest"] = cat(noise(.1, .1) * env(int(SR * .1)) * .5, sweep(300, 900, .3, "tri") * env(int(SR * .3), r=.2))
    S["magic"] = mix(sweep(500, 1800, .5, "sin"), sweep(520, 1850, .5, "tri") * .5) * env(int(SR * .5), a=.05, r=.3)
    S["heal"] = cat(*[tone(note(n), .08, "sin", .5) for n in (72, 76, 79, 84)]) * 1.0
    S["shield"] = sweep(300, 600, .35, "saw") * .5 * env(int(SR * .35), a=.05, r=.2)
    S["spawn"] = sweep(150, 900, .3, "sq", 2) * env(int(SR * .3), r=.1)
    S["teleport"] = sweep(1500, 200, .4, "sin") * env(int(SR * .4), r=.2) + sweep(200, 1500, .4, "tri") * .3
    S["alarm"] = cat(*[tone(f, .18, "sq", .5) for f in (880, 660, 880, 660)])
    S["jetpack"] = noise(.5, .2) * env(int(SR * .5), a=.05, r=.2) * .5 + sweep(80, 120, .5, "saw") * .3
    for k, v in S.items(): wav(k, v)
    print(len(S), "sfx")

# ---------- music ----------
def drum(kind, n=.12):
    if kind == "k": return sweep(150, 40, .15, "sin") * env(int(SR * .15), r=.12)
    if kind == "s": return noise(.12, .5) * env(int(SR * .12), r=.1) * .6
    return noise(.04, .9) * env(int(SR * .04), r=.035) * .3

def render(bpm, bars, tracks, steps=16):
    """tracks: list of fn(step_i, step_dur)->samples|None. Returns mono loop."""
    sd = 60 / bpm / 4; total = int(SR * sd * steps * bars); buf = np.zeros(total + SR)
    for bar in range(bars):
        for s in range(steps):
            i = bar * steps + s; pos = int(SR * sd * i)
            for tr in tracks:
                x = tr(i, sd)
                if x is not None: buf[pos:pos + len(x)] += x[:len(buf) - pos]
    loop = buf[:total].copy(); tail = buf[total:total + SR // 2]; loop[:len(tail)] += tail  # wrap tail for seamless loop
    return loop

def music():
    # 1) menu chill: Am F C G pads + arp
    ch = [(57, 60, 64), (53, 57, 60), (48, 52, 55), (55, 59, 62)]
    def pad(i, sd): c = ch[(i // 16) % 4]; return mix(*[tone(note(n + 12), sd * 16, "tri", .12, a=.3, r=.4) for n in c]) if i % 16 == 0 else None
    def arp(i, sd): c = ch[(i // 16) % 4]; n = c[(i % 4) % 3] + 24; return tone(note(n), sd * 1.8, "sin", .3, a=.01, r=.1) if i % 2 == 0 else None
    def bass(i, sd): c = ch[(i // 16) % 4]; return tone(note(c[0] - 12), sd * 7, "sin", .4, r=.2) if i % 8 == 0 else None
    wavm("music_menu_chill", render(80, 8, [pad, arp, bass]))
    # 2) action chiptune: Em C D B
    roots = [40, 36, 38, 35]
    def lead(i, sd):
        r = roots[(i // 16) % 4] + 24; pat = [0, 7, 12, 7, 0, 7, 15, 12, 0, 7, 12, 14, 12, 7, 5, 7]; return tone(note(r + pat[i % 16]), sd * .9, "sq", .22, duty=.25, r=.03)
    def bs(i, sd): r = roots[(i // 16) % 4]; return tone(note(r + (12 if i % 4 == 2 else 0)), sd * .9, "tri", .5, r=.03)
    def dr(i, sd): s = i % 16; return drum("k") if s in (0, 6, 8, 14) else drum("s") if s in (4, 12) else drum("h") if s % 2 == 0 else None
    wavm("music_action", render(150, 8, [lead, bs, dr]))
    # 3) adventure: C G Am F bouncy
    r3 = [48, 43, 45, 41]
    def mel(i, sd):
        r = r3[(i // 16) % 4] + 24; pat = [0, None, 4, None, 7, None, 4, None, 12, None, 7, None, 4, None, 2, None]; p = pat[i % 16]; return None if p is None else tone(note(r + p), sd * 1.6, "sq", .2, duty=.5, r=.1)
    def bs3(i, sd): r = r3[(i // 16) % 4]; return tone(note(r + (7 if i % 8 == 4 else 0)), sd * 1.8, "tri", .5, r=.08) if i % 4 == 0 else None
    def dr3(i, sd): s = i % 8; return drum("k") if s == 0 else drum("s") if s == 4 else drum("h") if s % 2 == 0 else None
    wavm("music_adventure", render(120, 8, [mel, bs3, dr3]))
    # 4) ambient space: drones
    def drone(i, sd): return mix(tone(note(36), sd * 32, "sin", .25, a=1.5, r=1.5), tone(note(43), sd * 32, "sin", .2, a=2, r=1.5), tone(note(52 + (i // 32) % 2 * 3), sd * 32, "tri", .1, a=2, r=1.5)) if i % 32 == 0 else None
    def twinkle(i, sd): return tone(note(84 + int(rng.integers(0, 12))), sd * 4, "sin", .08, a=.02, r=.3) if rng.random() < .15 else None
    wavm("music_ambient_space", render(60, 8, [drone, twinkle]))
    # 5) boss: Dm driving
    r5 = [38, 38, 34, 36]
    def rf(i, sd): r = r5[(i // 16) % 4]; return tone(note(r + 12 + (0 if i % 8 < 6 else 1)), sd * .9, "saw", .2, r=.03) if i % 2 == 0 else None
    def dr5(i, sd): s = i % 16; return drum("k") if s % 4 == 0 else drum("s") if s in (4, 12) else drum("h")
    def ld5(i, sd): r = r5[(i // 16) % 4] + 36; pat = [0, 3, 7, 3, 12, 10, 7, 3]; return tone(note(r + pat[(i // 2) % 8]), sd * 1.8, "sq", .14, duty=.125, r=.05) if i % 2 == 0 else None
    wavm("music_boss", render(140, 8, [rf, dr5, ld5]))
    # jingles
    jingle("jingle_victory", [(72, .12), (76, .12), (79, .12), (84, .12), (79, .1), (84, .5)])
    jingle("jingle_game_over", [(64, .25), (62, .25), (60, .25), (55, .7)], "tri")

def jingle(name, notes, w="sq"): wavm(name, cat(*[tone(note(n), d, w, .5, r=.06) for n, d in notes]) , loop=False)

def wavm(name, x, loop=True):
    x = x / max(np.abs(x).max(), 1e-6) * .85
    tmp = out("audio", "music", f"{name}.wav")
    with wave.open(tmp, "wb") as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype("<i2").tobytes())
    mp3 = tmp[:-4] + ".mp3"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-codec:a", "libmp3lame", "-b:a", "96k", "-ac", "1", mp3], check=True)
    os.remove(tmp)

def run():
    sfx(); music(); print("audio ok")
