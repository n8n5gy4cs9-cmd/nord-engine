---
title: Cheat sheet — command line
section: Guides
group: Test and ship
order: 32
summary: How to start the nord command on macOS, Windows and Linux, and every command with its common options.
---

::: dummies
Choose the row that matches your current task. Names in code are case-sensitive. Follow the linked manual chapter for setup steps before using this quick reference.
:::

`nord` is Nord's optional **command-line tool**. It does the same project jobs as the editor without a window, which suits scripts, build servers and people who like terminals. You never need it to make a game. This page lists every command.

## How to run `nord`

The program is installed **next to the editor**, but it is **not on your PATH**. So typing `nord` in a new terminal says "command not found" until you either use the full path or add a shortcut.

| System | Where `nord` is | Run it |
|---|---|---|
| **macOS** | Inside the app: `Nord Engine.app/Contents/MacOS/nord` | `"/Applications/Nord Engine.app/Contents/MacOS/nord" doctor` (keep the quotes: the name has a space) |
| **Windows** | In the unzipped folder, next to `nord-editor.exe`: `NordEngine\nord.exe` | `C:\Path\To\NordEngine\nord.exe doctor` |
| **Linux** | In the extracted folder, next to `nord-editor`: `nord-engine/nord` | `./nord-engine/nord doctor` |
| **From a source checkout** | `target/release/nord` after `cargo build --release -p nord-cli` | `./target/release/nord doctor` |

### Make plain `nord` work

**macOS or Linux:** create a symbolic link once.

**Terminal** (macOS or Linux, once):
```bash
sudo ln -s "/Applications/Nord Engine.app/Contents/MacOS/nord" /usr/local/bin/nord
```

On Linux point the link at your extracted `nord-engine/nord` (for example into `~/.local/bin`, which needs no `sudo`).

**Windows:** add the `NordEngine` folder to your user **PATH** (Start menu → "Edit environment variables for your account" → *Path* → *Edit* → *New*), then open a new terminal.

Check it works:

**Terminal** (any folder):
```bash
nord --version
nord doctor
```

`nord doctor` prints whether `node`, `cargo`, the WebAssembly target and `ffmpeg` were found, where the engine files are, and which project types you can use.

::: tip
Every command also has built-in help: `nord --help` lists commands and `nord build --help` lists that command's options.
:::

## Projects

| Goal | Command |
|---|---|
| Show engine info | `nord info` |
| Check your toolchain | `nord doctor` |
| New empty web project | `nord new my-game` |
| New 2D game from a template | `nord new my-game -t 2d` |
| New project from a starter | `nord new my-game -t platformer` (any id from the hub's templates, such as `fps-arena`) |
| New Rust game or app | `nord new my-game -t wasm-game` or `-t wasm-app` |
| Validate scenes, ids and missing files | `nord check my-game` |
| Make asset thumbnails | `nord thumbs my-game` |

`-t` accepts `html`, `2d`, `3d`, `wasm-game`, `wasm-app` or a starter id. The default is `html`. The project folder defaults to `.` (the current folder) for every command below that takes one.

## Run and test

| Goal | Command |
|---|---|
| Dev server with live reload | `nord serve my-game` → open `http://localhost:4173` |
| Another port | `nord serve my-game -p 8080` |
| Test on a phone on the same Wi-Fi | `nord serve my-game --lan` (prints a link with a secret token; only the game is shared) |
| Build a Rust project for the dev server | `nord build-rust my-game` (add `--release` for an optimised build) |

## Export (web)

`nord export` is the same command as `nord build`.

| Goal | Command |
|---|---|
| Static web build into `my-game/dist` | `nord build my-game` |
| Choose the output folder | `nord build my-game -o ../site` |
| Smaller files | `nord build my-game --minify --optimize` |
| Also make a zip (itch.io style) | `nord build my-game --zip` |
| One file that opens by double-click | `nord build my-game --single-file` |
| Installable offline web app | `nord build my-game --pwa` |
| Keep event sheets as JSON | `nord build my-game --no-compile-events` |
| Pick the target yourself | `nord build my-game -t web-2d` |

Targets for `-t`: `auto` (default, from the project type), `html`, `web-2d`, `web-3d`, `web-3d-pc`, `web-wasm-game`, `web-wasm-app`. Rust targets need Rust installed: see [Rust / WASM](rust-wasm.html).

## Desktop apps

| Goal | Command |
|---|---|
| macOS app | `nord bundle-mac my-game --name "My Game" --icon icon.png` |
| macOS app plus `.dmg` | `nord bundle-mac my-game --name "My Game" --dmg` |
| Windows bundle (folder + zip) | `nord bundle-portable my-game --os windows --name "My Game"` |
| Linux bundle (folder + tar.gz) | `nord bundle-portable my-game --os linux --name "My Game"` |
| Skip the archive | add `--no-archive` |

`INPUT` can be a project folder (built first) or an existing `nord build` output folder. Use `--out` to choose where the result goes and `--player` to name a specific `nord-player` program. See [Desktop apps](desktop-apps.html).

## Addons and creator tools

| Goal | Command |
|---|---|
| Zip an addon folder | `nord addon pack library/addons/dice` |
| Install an addon into a project | `nord addon install library/addons/dice -p my-game` |
| List a project's addons | `nord addon list my-game` |
| Add the FPS Creator to a project | `nord fpsc init my-game` (add `--start` to make its scene the start scene) |

## Checks and maintenance

| Goal | Command |
|---|---|
| Fail if files mention an outside website | `nord check-offline dist` |
| Allow one host on purpose | `nord check-offline dist --allow cdn.example.com` (or a `.offline-allow` file in the folder) |
| Verify bundled libraries are unchanged | `nord vendor --verify` |

## Output options and defaults

| Option | Type | Default | Effect |
|---|---|---|---|
| build `--target` / `-t` | Target name | auto | Choose the runtime target; auto uses project type |
| build `--out` / `-o` | Folder path | project/dist | Write a separate playable output |
| build `--host` | Preset name | none | Add deploy files; does not publish them |
| build `--minify` | Flag | off | Minify supported JS/JSON output |
| build `--optimize` | Flag | off | Recompress supported assets; audio conversion needs ffmpeg |
| build `--zip` | Flag | off | Also make the output archive |
| build `--pwa` | Flag | off | Add installable web-app files |
| serve `--port` / `-p` | Integer | 4173 | Choose the local dev-server port |
| serve `--lan` | Flag | off | Share the game on the local network using the printed link |

Inspect `nord build --help` or the generated [CLI reference](cli.html) when combining options. A hosting preset prepares files; a separate host upload/deploy step still follows.

## Desktop player template packaging

`nord template-pack --platform mac-arm64 --player PATH --out OUTPUT` packs an already-built player into a `.nordtemplates` file. Platform names are `mac-arm64`, `mac-x64`, `windows-x64`, `linux-x64`, and `linux-arm64`. PATH and OUTPUT stand for your actual input binary and destination folder; this call does not compile a player.

For ordinary desktop export, use the editor's Export templates window to install the matching release template. The packaging command is for release/tooling work; it is not a prerequisite for making your first web game.

## Automation order

| Step | Command family | Expected evidence |
|---|---|---|
| 1. Diagnose tools | doctor | Required tools available for the chosen tier |
| 2. Validate source | check | No unresolved project/scene errors |
| 3. Build once | build / export | Output path and successful exit status |
| 4. Scan the result | check-offline | No unintended external-host references |
| 5. Test the result | Open through the intended server or platform shell | Actual game interaction works |

Stop a build script when a command fails. Do not upload an old dist folder just because it still exists after a failed build. See the [release checklist](cheat-sheet-export.html#release-checks) for the user-visible checks a command exit code cannot prove.

## Common problems

| What you see | Try this |
|---|---|
| `nord: command not found` | Use the full path above, or make the link or PATH entry. |
| `engine root not found` | Set the `NORD_ROOT` environment variable to the folder that holds the engine files (inside the app: `Contents/Resources`). |
| `cargo not found` or `wasm32 target is missing` | Install Rust and run `rustup target add wasm32-unknown-unknown`. |
| A blank page from a folder build | Serve it (`nord serve`, or any web server) or build with `--single-file`. |

More detail for each command is in the generated [command reference](cli.html).


## Check yourself

Run the command with --help first, then the intended project path. Confirm its exit status and actual output folder; test the result before sharing it.

Next: [Unity scripting cheatsheet](cheat-sheet-unity.html). Back to: [Cheatsheets](cookbook.html).
