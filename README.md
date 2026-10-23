# Nord Engine

Personal Rust-based game & app engine + editor. Builds **static HTML web games** (drop on any server) and a native
**macOS (Apple Silicon)** app. Windows/Linux later. Everything vendored — fully offline.

*Crowelian 2026 + Sonnet.*

- Plan & status: [`task.md`](task.md) · [`PRD.json`](PRD.json) · [`docs/PRD.md`](docs/PRD.md)
- Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · decisions: [`docs/DECISIONS.md`](docs/DECISIONS.md)
- Assets (all replaceable placeholders): [`ASSETS.md`](ASSETS.md)
- **AI handoff (start here): [`HANDOFF.md`](HANDOFF.md)** · [`AGENTS.md`](AGENTS.md)

## Try it (Mac)
```
./run.sh                          # editor (project hub); needs Rust (rustup.rs), Node optional
./run.sh examples/conformance-2d  # open a project directly
./build.sh                        # -> dist/Nord Engine.app (ad-hoc signed; --dmg, --universal)
```
Verification notes for the embedded webview: `docs/KNOWN_ISSUES.md` (RISK-001a).

Status: **M0–M2 done, M3 (editor) implemented** — see task.md. Next: M4 export.

Windows portable release: run `./build-win.sh` (cross-build from Mac/Linux or native MSVC on Windows). Includes examples and the offline guide as a ZIP. See [Windows build guide](docs/BUILD_WINDOWS.md).

## Unity-style editor
Scene / Game / Hierarchy / Inspector / Assets with Unity shortcuts (all rebindable), multi-object gizmos with Pivot/Center, prefabs with variants and per-field overrides, material assets with lit previews, import settings, a UI Designer with a canvas scaler and prefabs, node graphs with subgraphs, and event sheets with a live highlight. Tutorial **T48 Neon Harbor** builds a combined 2D + 3D showcase using all of it. See manual chapter *Unity-style workflow*.

## Model, animate, profile, ship, play together
**3D Modeler** (mesh editor + texture painter + UV editor, `models/`), **Animator** (Unity-style state machine for sprites and glTF models, `anim/`), a deeper **Profiler** (phases, scripts, components, spikes, recorder, saved profiles), **hosting presets** (`nord build --host itch|github-pages|netlify|vercel|docker`) and **multiplayer tools** (RPC, replicated spawner, `netSync`, ping/traffic stats, network simulator, *Play multiplayer* from the editor). Tutorials T49–T53.

## FPS Creator (level editor addon)
Build first-person levels on a grid — walls, doors, windows, stairs, lights, ready-made enemies, pickups, scripts and no-code rules — in the **FPS Level** tab, press **F5** to play. Start from the *FPS Creator* template or add it to any 3D project (`nord fpsc init`). See [docs/FPS_CREATOR.md](docs/FPS_CREATOR.md).

## Web editor
The editor also runs in a browser (`tools/build-web-editor.sh`) and on a Linux server (`nord-editor-server`); see `docs/WEB_EDITOR.md` and manual chapter 27. The desktop app is unchanged.
