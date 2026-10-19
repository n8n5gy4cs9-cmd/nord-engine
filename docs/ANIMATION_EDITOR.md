# Animation editor v2 (M10-17)
Tab **Anim & Tiles** → *Animations*. Sheet metadata `<sheet>.png.meta.json` → `anims`:
```json
"anims": { "run": { "frames": [0,1,2,3], "fps": 12, "loop": true, "speed": 1, "pingPong": false,
                    "repeat": 0, "repeatTo": 2, "frameDurations": [1,1,2,1], "tags": ["move"] } }
```
- **Many named animations per sheet**, frame list (`0-3, 5` text or click frames in the sheet), **frame list with per-frame duration multipliers**, reorder/duplicate/delete.
- **Speed** multiplies fps; **ping-pong** plays forward then back; **loop** off + **repeat n** plays 1+n times; **repeat to frame #N** plays once then loops from list position N (intro + loop animations); **tags** (free text, for your own filtering/scripts).
- **Preview** with the exact timing (durations, ping-pong) and **onion skin** (previous red / next green).
- **Import GIF…**: an animated GIF becomes `assets/sprites/<name>.png` (frames in a strip) + `.meta.json` with a `default` animation whose fps and per-frame durations come from the GIF delays (GIF delays are 10 ms steps).
- Spritesheet import = slicing by *Frame* width × height (existing); the *Sprite* tab edits the pixels and stores per-frame `frameProps` (`duration` multiplier, `event`).
Runtime (`runtime/phaser/index.js`, `components.js`): speed, ping-pong (`yoyo`), repeat, per-frame durations (`frameDurations[i]` or `frameProps[frame].duration`), *repeat to* (a second looping animation chained after the first), and **per-frame events** (`frameProps[frame].event` → `entity.on(name)` + global `Events → On game event`). Test: `tools/plugin-objects-test.mjs`.
Not done: dragging frames in the list (use ▲▼), Aseprite import, onion skin in the main viewport, an animation timeline strip with thumbnails.
