---
title: Export & hosting
section: Manual
order: 14
summary: Static web builds, single-file, Mac app, hosting recipes, offline guarantee.
---
`nord build <project>` (alias `nord export`) writes a **static folder** — default `<project>/dist` — that needs nothing from the internet.

::: dummies
Exporting is "exhaling" your project into one plain folder of files. Any web host, USB stick or `python3 -m http.server` can serve that folder, and anyone with a browser can play it.
:::

## Targets
| Target | Output | Runtime shipped |
|---|---|---|
| `html` | folder | none (your HTML/JS) |
| `web-2d` | folder | nord.js + Phaser |
| `web-3d` | folder | nord.js + Babylon packages used + Havok wasm |
| `web-wasm-game` | folder | `game.wasm` + macroquad bundle |
| `web-wasm-app` | folder | eframe wasm + glue |
| mac app | `Name.app` (+ `.dmg`) | NordPlayer shell wrapping any of the above |
`-t auto` (default) picks from the project `type`. `nord doctor` recommends one.

## Common options
```
nord build my-game --minify              # smaller JS/JSON
nord build my-game --optimize            # lossless PNG recompress, WAV→MP3 if ffmpeg is installed
nord build my-game --zip                 # also dist.zip (itch.io style)
nord build my-game --single-file         # one index.html that opens from file://
nord build my-game -o ../site            # custom output folder
```
In the editor: **Project → Export…** shows the same options and a size report.

## Output layout
```
dist/  index.html  nord.json  scenes/ prefabs/ scripts/ assets/  runtime/  vendor/
```
`nord.json` lists every file with size and sha256. All paths are relative, so sub-folder hosting works.

## Hosting {#hosting}
| Where | How |
|---|---|
| Local | `cd dist && python3 -m http.server 8000` |
| Double-click | build with `--single-file` (folder builds need a server: browsers block modules/`fetch` on `file://`) |
| itch.io | `--zip`, upload as HTML, tick *played in the browser*, set viewport to the game size |
| GitHub Pages | commit `dist/` to `gh-pages` (or `/docs`) and enable Pages |
| nginx | `root /srv/game;` and serve `.wasm` as `application/wasm` (default mime types do) |
| Netlify / Cloudflare Pages / S3 | upload the folder |
Full notes: `docs/HOSTING.md`.

## Mac app
```
nord bundle-mac my-game --name "My Game" --icon icon.png --dmg
```
Wraps the web build in `NordPlayer` (a wry+tao window shell) and generates the icon set; ad-hoc code signing happens on macOS. Window size, fullscreen and persistent storage follow the project settings.
`export.mac.bundleId` and `export.mac.icon` live in `nord.project.json`.

## The offline guarantee
Every build is scanned for external `http(s)://` references and **fails** if your own files contain one (`nord check-offline <dir>`). Allow a host on purpose with a `.offline-allow` file.

::: warn
Not done yet: texture-atlas packing and lossy PNG quantisation (task M4-11). The macOS shell and CI bundle step are verified on macOS CI only — see `docs/KNOWN_ISSUES.md`.
:::
