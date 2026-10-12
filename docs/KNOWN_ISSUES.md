# Known issues & bug log

Format: `BUG-nnn [open|fixed] title — repro / notes`. Unverified-but-plausible risks are listed under "Unverified".

## Open
_(none yet)_

## Unverified / risks
- RISK-001 Tauri v2 window + WKWebView behaviour (splash timing, custom protocol, file dialogs) cannot be tested in the Linux sandbox; verify on macOS CI / M1 Max.
- RISK-002 Babylon Havok needs wasm served with `application/wasm`; some static hosts misconfigure → provide JS fallback (cannon-es) or inline base64 in single-file mode.
- RISK-003 `file://` loading blocks `fetch`/ES modules in browsers → single-file/file-safe export mode required (EXPORT_TARGETS).
