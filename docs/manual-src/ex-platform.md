---
title: 45 · Which platform? Editor, Mac, Windows, web, phone
section: Examples
order: 45
summary: Application.platform, isEditor, os and Cursor: do different things in the editor, on the web, in the desktop app or on a phone.
---

**Goal:** one script that behaves differently depending on where the game runs: Unity's `Application.platform`, `Application.isEditor` and `#if UNITY_EDITOR`.

## Unity (C#)
```cs
#if UNITY_EDITOR
  Debug.Log("editor only");
#endif
if (Application.platform == RuntimePlatform.WebGLPlayer) quitButton.SetActive(false);
if (Application.isMobilePlatform) ShowTouchControls();
```

## Nord

**File: `scripts/Platform.js`** (new file, the whole file)
```js
import { MonoBehaviour, Application, RuntimePlatform, Debug } from 'nord';

export default class PlatformSetup extends MonoBehaviour {
  Start() {
    if (Application.isEditor) Debug.Log('testing inside the Nord editor');   // cheats, debug overlays
    if (Application.isWebPlayer) this.Find('QuitButton')?.SetActive?.(false); // no Quit in a browser tab
    if (Application.isMobilePlatform) Debug.Log('show touch controls');
    const label = Application.os === 'mac' ? 'Cmd' : 'Ctrl';                // key names in the UI
    Debug.Log(`Press ${label}+S to save`);
  }
}
```

## What each value means
| Value | When |
|---|---|
| `Application.platform` | `OSXEditor` / `WindowsEditor` / `LinuxEditor` in the editor's Game view; `OSXPlayer` / `WindowsPlayer` / `LinuxPlayer` in the exported desktop app; `WebGLPlayer` in a browser or exported web game; `IPhonePlayer` / `Android` in a phone browser |
| `Application.isEditor` | playing inside the Nord editor |
| `Application.isDesktopApp` | the exported Mac / Windows / Linux app |
| `Application.isWebPlayer` | any web page (including the editor's Game view) |
| `Application.isMobilePlatform` | phone or tablet |
| `Application.os` | the machine, whatever the shell: `'mac'`, `'win'`, `'linux'`, `'ios'`, `'android'` |

`switch (Application.platform) { case RuntimePlatform.OSXPlayer: … }` works like in C#.

## Mouse lock (FPS look)

**File: `scripts/MouseLook.js`** (new file, the whole file)
```js
import { MonoBehaviour, Cursor, CursorLockMode, UnityInput as Input, KeyCode } from 'nord';
export default class LookLock extends MonoBehaviour {
  Update() {
    if (Input.GetMouseButtonDown(0)) { Cursor.lockState = CursorLockMode.Locked; Cursor.visible = false; }
  }
}
```
In the **editor**, Esc in the Game view releases the mouse even if your code does not (Settings ▸ Game view mouse; the exported game does not add this, so give players your own unlock key or a pause menu).

## The editor and the keyboard
While the Game view has focus, Q/W/E/R/F and the other plain keys belong to your game, not to the editor tools. Click another panel and the editor shortcuts are back. Details in [Input](input.html#keyboard-focus-in-the-editor-like-unity).

Next: [the Input Manager](ex-input-editor.html). Back to [Examples](examples.html).
