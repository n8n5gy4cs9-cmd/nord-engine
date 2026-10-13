# Star-Not — reusable original assets

All paths below are relative to **examples/star-not/**. Copy the file and its sidecar/licence where applicable. Source counterparts live under **tools/examples/star-not/assets/**. Regenerating examples copies files, not artwork prompts.

| Path | Contains | How to use |
|---|---|---|
| `assets/sprites/space.png` + `.meta.json` | Ships, Sun, eight planets, satellite, asteroid, projectile, explosion | A Nord `sprite` component with `texture` + numbered `frame`. |
| `assets/ui/portraits.png` + `.meta.json` | Three portraits and thirteen UI symbols | CSS 4×4 atlas helper, or Nord sprite frames. |
| `assets/audio/music/cruise.wav` | Slow original space theme | `this.audio.music(path, {fade: .45})`. |
| `assets/audio/music/combat.wav` | Original rhythmic battle theme | Same music API, loops automatically. |
| `assets/audio/music/victory.wav` | Original victory theme | Same music API. |
| `assets/audio/sfx/laser.wav` | Pulse cannon shot | `this.audio.play(path)`. |
| `assets/audio/sfx/hit.wav` | Hull impact | One-shot. |
| `assets/audio/sfx/explosion.wav` | Ship disabled | One-shot. |
| `assets/audio/sfx/travel.wav` | Travel confirmation | One-shot. |
| `assets/audio/sfx/hail.wav` | Conversation greeting | One-shot. |
| `assets/audio/sfx/confirm.wav` | Resource/accord confirmation | One-shot. |
| `assets/audio/sfx/victory.wav` | Encounter victory | One-shot. |
| `assets/audio/sfx/defeat.wav` | Encounter defeat | One-shot. |
| `assets/fonts/inter.woff2` + `LICENSE` | Inter Regular | Keep its OFL-1.1 licence. |

## Space sheet (zero-based row order)
0 Earth explorer · 1 Mars interceptor · 2 Venutian ship · 3 derelict satellite
4 Sun · 5 Mercury · 6 Venus · 7 Earth
8 Mars · 9 Jupiter · 10 Saturn · 11 Uranus
12 Neptune · 13 asteroid · 14 pulse · 15 explosion

## UI sheet
0 Earth captain · 1 Mars commander · 2 Venutian speaker · 3 solar compass
4 fuel · 5 crew · 6 scrap · 7 accord
8 relay core · 9 ice sample · 10 shield · 11 cannon
12 play · 13 save · 14 speaker · 15 Earth port

The generated atlas dimensions are recorded by each `.meta.json`; cells use integer floor(image dimension / 4), with any remaining edge pixels unused. The PNGs preserve their alpha channels. CSS atlas helpers use percentage positioning so the full image remains the source. The UI helper has per-row vertical crop bounds for full portrait busts and smaller symbols; copy that helper for the same framing. Smaller displays scale the artwork; these are original detailed sprites, not pixel-perfect 16×16 art.

## Reuse example
```json
{"type":"sprite","texture":"assets/sprites/space.png","frame":0,"size":[64,64]}
```
Copy the PNG and `.meta.json` to that path in your own project. Add this component to an entity. The body/control code is separate: a picture alone does not make a spaceship move.

Art was generated with the built-in ImageGen tool; exact prompts in ART_DIRECTION.md. Audio is original synthesis using the existing engine WAV-writing approach; explicitly run `node tools/gen_star_not_audio.mjs` to replace the defaults, then regenerate the example. Do not run it after swapping in your own music unless you intend to replace it.

No UQM graphics, music, voices or dialogue were copied. Original Star-Not art/audio may be reused under MIT, © Crowelian 2026 + Sonnet. UQM-derived game code keeps GPL-2.0-or-later (see SOURCE.md/COPYING); fonts retain their own licence.
