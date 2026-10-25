---
title: Export & hosting
section: Manual
group: Test and publish
order: 14
summary: Static web builds, single-file, Mac app, hosting recipes, offline guarantee.
---

Export creates a copy for players. A web build contains HTML, runtime code and assets; a desktop bundle adds the application shell.

::: dummies
Share the whole output folder, not just index.html. Keep your editable project separately. Most web builds need a local or hosted web server; use the special single-file mode when you need its supported behavior.
:::

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

## Hosting presets {#presets}
`nord build my-game --host itch|github-pages|netlify|vercel|docker` (editor: **Export ▸ Hosting preset**) adds the deploy files for that place next to the build: `ITCH.md` + the zip, `.nojekyll` + `404.html` + a Pages workflow, `netlify.toml` + `_headers`, `vercel.json`, or a `Dockerfile` + `nginx.conf`. They only add files; the game itself is unchanged. Guided: [T51](tut-t51-hosting-presets.html).

## Android and iOS {#mobile}
**File ▸ Build Settings… ▸ Android / iOS ▸ Mobile project** exports the game as a Capacitor project in `dist/mobile`: the web build in `www/`, `capacitor.config.json` (app id `com.nord.<name>`, or `export.mobile.appId` in `nord.project.json`), `package.json` and a `README-MOBILE.md`. In that folder run `npm install`, then `npx cap add android` or `npx cap add ios`, then `npm run android` / `npm run ios`. Android Studio (and Xcode for iOS) are not part of Nord Engine, so the app itself is built on your machine.

## Mac app
```
nord bundle-mac my-game --name "My Game" --icon icon.png --dmg
```
Wraps the web build in `NordPlayer` (a wry+tao window shell) and generates the icon set; ad-hoc code signing happens on macOS. Window size, fullscreen and persistent storage follow the project settings.
`export.mac.bundleId` and `export.mac.icon` live in `nord.project.json`.

## Desktop apps {#desktop}
1. Open **Project ▸ Export templates…** and install the template for each OS you want (@ui[Install from file…] with a `.nordtemplates` file, or @ui[Download]). Your own OS needs none.
2. Open @ui[File ▸ Export…], expand **Desktop app**, choose the platform, tick **Make .dmg / .zip / .tar.gz** if you want an archive, and press @ui[Export desktop app].
3. The Console says where the app is; @ui[Open folder] shows it. Check yourself: a Mac gives `<Name>.app`, Windows `<Name>/<Name>.exe` (+ zip), Linux `<name>/<name>` (+ tar.gz).

Apps are not signed for stores. A Mac app made on Windows or Linux is unsigned: right-click ▸ Open the first time. More in `docs/PACKAGING.md`.

## The offline guarantee
Every build is scanned for external `http(s)://` references and **fails** if your own files contain one (`nord check-offline <dir>`). Allow a host on purpose with a `.offline-allow` file.

::: warn
**Limits today:** texture-atlas packing and lossy PNG quantisation are not implemented, so large textures stay large (see [Performance](performance.html)). The macOS app shell is built and tested on macOS CI; Windows and Linux bundles are produced by CI with less real-world testing. Details: [Known issues](known-issues.html).
:::


## Check yourself

- Save the project, then repeat the action from the section you used. Confirm the stated result before moving on.
- If Play fails, check the Console for the first error and compare file paths and capitalisation with the example.
- For platform or feature limits, check [Known issues](known-issues.html).

Next: [Choose a worked example](examples.html). Back to: [Manual reading paths](manual-paths.html).
