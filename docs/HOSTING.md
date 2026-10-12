# Hosting a Nord web build

`nord build <project>` writes a **static folder** (default `<project>/dist`): `index.html`, `nord.json`, `scenes/ scripts/ assets/`, `runtime/`, `vendor/`.
Nothing is fetched from the internet — upload the folder anywhere that serves static files.

```
nord build my-game                       # folder build
nord build my-game --minify --optimize   # smaller (needs Node; --optimize recompresses PNGs, WAV→MP3 with ffmpeg)
nord build my-game --zip                 # also my-game/dist.zip for itch.io style uploads
nord build my-game --single-file         # one index.html (+ vendor/fonts) that also opens from file://
```

| Where | How | Tested |
|---|---|---|
| **Local, quick** | `cd dist && python3 -m http.server 8000` → http://localhost:8000 | yes (`node tools/e2e.mjs export-python-http`: 3D build incl. Havok `.wasm`) |
| **Double-click / `file://`** | build with `--single-file`; `index.html` works from the file system (ES modules and `fetch` do *not* work from `file://`, so folder builds need a server) | yes (`export-single-2d/3d`, loaded from `file://`) |
| **itch.io** | `--zip`, upload the zip as "HTML", tick *This file will be played in the browser*, set the viewport to the game's display size. Use the folder build (not single-file) | zip layout tested, upload is manual |
| **GitHub Pages** | commit `dist/` to a `gh-pages` branch (or `/docs`) and enable Pages. Paths are relative, so project sub-paths (`user.github.io/repo/`) work | relative paths verified; Pages itself untested |
| **nginx** | `root /srv/game;` — make sure `.wasm` is served as `application/wasm` (default `mime.types` has it) and `.js` as `text/javascript` | mime requirements covered by the python test |
| **Netlify / Cloudflare Pages / S3** | upload the folder; no server config needed | untested |

## Notes
- Every output is checked for external `http(s)://` references (the **offline guarantee**); the build fails if your own files contain one. Allow a host on purpose with a `.offline-allow` file in the project.
- Audio needs a user gesture in browsers; the runtime unlocks it on the first click/key.
- `nord.json` lists every file with size + sha256 (cache busting / integrity checks).
- `--single-file` inlines scripts, scenes and assets as `data:` URIs: great for small games, big for large asset sets. UI fonts stay as separate files in `vendor/fonts/`.
- macOS app: `nord bundle-mac my-game` wraps the build with the prebuilt `nord-player` (see EXPORT_TARGETS.md).
