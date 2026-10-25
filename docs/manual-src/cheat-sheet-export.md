---
title: Export, hosting and release cheatsheet
section: Guides
group: Test and ship
order: 31
summary: Choose web, single-file, desktop, PWA or mobile output; validate it and test what players actually receive.
---
Use this page when the saved project works and you are ready to share it. Keep the editable project; an export is a separate playable artifact.

::: dummies
A successful build means Nord produced files. A successful release means the player can load those files, control the game, hear audio after interaction, and reach the intended ending. Test the delivered version, not just the editor preview.
:::

## Export from the editor
1. Stop Play and save the scene, scripts and tool documents. Confirm the project's starting scene.
2. Open @ui[File ▸ Export…]. Choose web or desktop output, an output folder and the required options. For desktop, install the matching player template through @ui[Project ▸ Export templates…] when required.
3. Run the export and read its result in Console. Open the output folder, then test the artifact using the method appropriate to its target below.

**In the file** `nord.project.json`, the project type, start scene and export settings determine the build. A scene can reference separate levels, UI screens and controllers; save those resources too. [Project format](project-format.html) defines the fields.

## Choose the artifact

| Audience / need | Output | Test it by | Limit to remember |
|---|---|---|---|
| Browser on a static host | Normal web folder | Serving the whole output over HTTP | Keep its files and relative paths together |
| itch.io browser game | Web ZIP / itch preset | Uploading as an HTML game and testing its page | Viewport, input focus and audio need checking |
| Supported double-click workflow | Single-file export | Opening its generated HTML | Not every dynamic-resource workflow fits this mode |
| Installable web app | PWA export | HTTP/HTTPS test with its manifest and worker | Old caches can hide new files |
| Mac / Windows / Linux app | Desktop export | Running the actual target-platform bundle | Matching player, signing and platform checks apply |
| Android / iOS project | Mobile project from Build Settings | Building and running through its platform tools | Exported project is not a finished signed store submission |
| Multiplayer with a separate server | Client build plus separately deployed server | Two clients connected to that server | Static hosting does not start a Node process |

## Command lookup
Run from the project folder. If `nord` is not on PATH, use the executable path in the [CLI cheatsheet](cheat-sheet-cli.html).

| Goal | Command | Result |
|---|---|---|
| Validate source | `nord check .` | Project/scene problems reported |
| Preview with reload | `nord serve . -p 4173` | Local development server |
| Build default web target | `nord build .` | `dist/` |
| Choose output folder | `nord build . -o ../site` | Separate output folder |
| Minify and optimize | `nord build . --minify --optimize` | Processed output; compare behavior and size |
| Make ZIP too | `nord build . --zip` | Folder plus archive |
| Single HTML output | `nord build . --single-file` | Supported resources packed into HTML |
| PWA files | `nord build . --pwa` | Manifest/worker and build |
| Hosting preset | `nord build . --host github-pages` | Host-specific deploy files; also itch/netlify/vercel/docker |
| Rust game / app | `nord export . --target web-wasm-game` / `web-wasm-app` | Corresponding Rust/WASM target |
| Check output for outside URLs | `nord check-offline dist` | Offline-reference scan |
| Diagnose missing tools | `nord doctor` | Toolchain report |

For desktop CLI commands and archive options, see [CLI](cheat-sheet-cli.html#desktop-apps). For the current desktop export window and templates, see [Desktop apps](desktop-apps.html). Desktop and mobile builds still need testing on their destination platforms.

## Release checks

| Check | Pass condition |
|---|---|
| Start scene | Fresh launch reaches the intended first screen |
| Files | Images, sound, models, fonts and level data resolve with correct filename case |
| Controls | Keyboard/mouse work after focus; intended touch/gamepad controls are tested on devices |
| Audio | A user gesture enables sound, volume controls work, music does not duplicate |
| Saves | Missing data is handled; stored data survives the expected restart |
| Scene changes | No stale HUD, doubled listener or old scene object reference |
| Display | Intended viewport/aspect works; essential UI remains reachable |
| Hosting | Nested path, refresh behavior and MIME types work for this host |
| Offline promise | Scan passes and runtime behavior is checked without unintended external requests |
| Multiplayer | Required server is running separately and clients can reach it |

## Troubleshooting

| Symptom | Check |
|---|---|
| Blank folder build after double-click | Serve it over HTTP or choose a supported single-file workflow |
| Works locally, missing art online | File case, relative paths, omitted dependencies and uploaded folder structure |
| Old version remains | Host cache, browser cache and PWA service worker |
| Save appears reset on new URL | Browser origin/port/profile and project id/slot |
| Desktop template unavailable | Template version/platform and installed player templates |
| Exported multiplayer is offline | Static files cannot launch its separate server |

## Check yourself
Launch the actual deliverable from a fresh session, complete its main interaction, restart and verify persistence. State which platforms and devices still need a human pass.

Next: [Command line](cheat-sheet-cli.html). Back to: [Cheatsheets](cookbook.html).
