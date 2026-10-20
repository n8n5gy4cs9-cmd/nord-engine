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

## Web editor
The editor also runs in a browser (`tools/build-web-editor.sh`) and on a Linux server (`nord-editor-server`); see `docs/WEB_EDITOR.md` and manual chapter 27. The desktop app is unchanged.
