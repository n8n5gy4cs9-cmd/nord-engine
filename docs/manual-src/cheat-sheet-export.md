---
title: Cheat sheet — export
section: Guides
order: 3
summary: Build, bundle and host commands on one page.
---

::: dummies
Save the editable project first. An export is the playable result; it does not replace your source project. Run commands from the project folder, and check the built result before uploading it.
:::

## Export from the editor
Save the project, then open @ui[File ▸ Export…]. Choose the web or desktop output appropriate to your audience. The export window reports the result; open that output and confirm that the first scene appears. A desktop export needs the matching player template: see [Desktop apps](desktop-apps.html).

**In the file** `nord.project.json`, the project's type and start scene determine what gets built. Check their exact saved values with [Project format](project-format.html); keep the editable project alongside your backups.

## Command lookup
These commands are alternatives to the editor workflow. Run them from the project folder. If `nord` is not found, use the executable path in the [CLI cheatsheet](cheat-sheet-cli.html).

| Goal | Command |
|---|---|
| Check project | `nord check .` |
| Dev server (live reload) | `nord serve . -p 4173` |
| Web build | `nord build .` → `dist/` |
| Smaller | `nord build . --minify --optimize` |
| itch.io zip | `nord build . --zip` |
| Double-clickable | `nord build . --single-file` |
| Rust game / app | `nord export . --target web-wasm-game` / `web-wasm-app` |
| Dev build of Rust | `nord build-rust .` |
| Mac app | `nord bundle-mac . --name "My Game" --icon icon.png --dmg` |
| Offline scan | `nord check-offline dist` |
| Toolchain advice | `nord doctor` |
Details: [Export & hosting](export.html), [CLI](cli.html).


## Check yourself

Confirm the result in your saved project. Check Console errors and compare exact names with the linked reference if the result differs.

Next: [Unity scripting cheatsheet](cheat-sheet-unity.html). Back to: [Cheatsheets](cookbook.html).
