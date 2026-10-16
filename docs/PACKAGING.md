# Packaging & distribution (M8-01, M9-13)

Nord does **resource swap**, not per-app compilation: a prebuilt `nord-player` (wry + tao shell, plus the `nord-desktop` backend) is copied and
your exported web build is placed next to it as `game/`. Build the player once per OS: `cargo build --release -p nord-player --features shell`
(macOS: WKWebView; Windows: WebView2 — preinstalled on Win 10/11; Linux: `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev libxdo-dev`).

| Target | Command | Output |
|---|---|---|
| macOS | `nord bundle-mac <project> [--dmg] [--icon icon.png]` | `<Name>.app` (+ `.dmg`), ad-hoc signed on a Mac |
| Windows | `nord bundle-portable <project> --os windows --player <nord-player.exe>` | `<Name>/<Name>.exe + game/ + icon.ico + register.reg`, `<Name>-windows.zip` |
| Linux | `nord bundle-portable <project> --os linux --player <nord-player>` | `<name>/<name> + game/ + <name>.desktop + <name>.png`, `<name>-linux.tar.gz` |
| Web | `nord export <project>` | static folder / zip |

`nord bundle-portable` can run on any OS (it only copies files); the *player binary* must be built for the target OS (CI does this, see
`.github/workflows/ci.yml`). Engine itself: `./build.sh` → `dist/Nord Engine.app`, `dist/windows/`, `dist/linux/`.
Windows cross-build: `./build-win.sh` (MinGW on macOS/Linux; MSVC on Windows). The portable
release includes the complete guide as `docs/manual.zip`, served directly by the Docs tab,
plus all examples, assets, templates and export/runtime sources. The complete Windows build guide is appended below (source: `docs/BUILD_WINDOWS.md`).

## Manifest fields that affect packaging (`nord.project.json` → `desktop`)
```json
"desktop": {
  "permissions": { "…": "see DESKTOP_APPS.md" },
  "singleInstance": true,
  "schemes": ["nordnotes"],
  "fileTypes": [{ "name": "Markdown", "ext": ["md", "markdown"], "mime": "text/markdown" }]
}
```
* **macOS** → `CFBundleURLTypes` / `CFBundleDocumentTypes` in Info.plist (double-click / `open -a` / `nordnotes://…` reach the app as the `open` event + `app.launch()`).
* **Linux** → `MimeType=` + `x-scheme-handler/…` in the `.desktop` file; install it to `~/.local/share/applications/` and run `update-desktop-database`.
* **Windows** → `register.reg` (HKCU). Edit the `C:\Path\To\…` install path, double-click to register file types and URL schemes. An installer should do this itself.
* Version shown in the bundle comes from `nord.json.version` (falls back to the engine version). Icon: `--icon`, else `icon.png` in the project, else the Nord logo.

## macOS: signing, notarisation, dmg
`nord bundle-mac` / `build.sh` sign **ad-hoc** (`codesign -s -`): fine on your own Mac; a downloaded copy needs right-click → Open. To distribute:
1. Join the Apple Developer Program; create a *Developer ID Application* certificate (Xcode → Settings → Accounts → Manage Certificates).
2. Sign with the hardened runtime (needed for notarisation; the player needs no special entitlements — it uses WKWebView and no JIT of its own):
   `codesign --force --deep --options runtime --timestamp --sign "Developer ID Application: NAME (TEAMID)" "App.app"`
3. Zip and notarise: `ditto -c -k --keepParent App.app App.zip`, then
   `xcrun notarytool submit App.zip --apple-id you@x.com --team-id TEAMID --password <app-specific-password> --wait`
   (store credentials once with `xcrun notarytool store-credentials`).
4. Staple: `xcrun stapler staple App.app`; check: `spctl -a -vvv -t install App.app`.
5. dmg: `hdiutil create -volname "App" -srcfolder App.app -ov -format UDZO App.dmg`, then sign + notarise + staple the dmg too
   (`codesign --sign "Developer ID…" App.dmg`; `notarytool submit App.dmg …`; `stapler staple App.dmg`).
6. Apps that read user folders (Documents, Downloads…) trigger the OS permission prompts automatically; add `NSDesktopFolderUsageDescription`-style keys
   only if you extend Info.plist yourself. Sandboxing (`com.apple.security.app-sandbox`) is optional and **not** enabled: our permission manifest is an
   application-level guard, not an OS sandbox (ADR-020).
*Not verifiable on Linux; steps follow Apple's documented flow — report problems.*

## Windows
* Portable zip works as is (WebView2 runtime ships with Windows 10/11; for older systems bundle Microsoft's evergreen bootstrapper).
* SmartScreen warns for unsigned executables. Sign with `signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /a App.exe` (a code-signing certificate is needed).
* Installer (optional, later): Inno Setup / WiX wrapping the folder; write the `register.reg` entries from there; autostart is done by the app via `app.setAutostart()` (HKCU\…\Run).

## Linux
* `tar.gz` runs anywhere with webkit2gtk-4.1 + gtk3 installed. `.desktop` + icon → `~/.local/share/applications`, `~/.local/share/icons`.
* AppImage (optional): put the folder in an AppDir (`AppRun` → the exe), add the `.desktop` and icon, run `appimagetool`; `.deb`: `dpkg-deb --build` of `/opt/<name>` + `/usr/share/applications/<name>.desktop` (depends: `libwebkit2gtk-4.1-0, libgtk-3-0, libayatana-appindicator3-1`).
* Wayland: global shortcuts and tray icons depend on the compositor; X11/XWayland always works.

## Auto-update (strategy only, opt-in)
Not built in. Recommended: the app checks a JSON file with `desktop.http.fetch` (declare the host in `permissions.net`), downloads the new bundle with the same API
into `appData`, verifies a SHA-256 from the signed manifest, then asks the user (`dialog.confirm`) and reveals/launches it (`shell.reveal`). Never self-modify a signed bundle in place.
