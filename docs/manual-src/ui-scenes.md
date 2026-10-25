---
title: UI scenes reference
section: Guides
order: 3
summary: The .ui.json format, text, images and 9-slice, skins, and the script API.
---

Menus, HUDs and dialogs are **data**: a `ui/<name>.ui.json` file edited in the **UI Designer** tab and loaded from code. Decision: ADR-030.

* Runtime: `runtime/core/uiscene.js` (no dependencies; `game.ui.load()` or standalone `createUI(el)`).
* Designer: `editor/uidesigner/` (served at `/editor/uidesigner/index.html`, embedded as the **UI Designer** tab). It writes the JSON through the project file API (`/api/fpsc/save`, folder `ui/` only).
* Raw HTML still works (`ui.panel/label/button…`, an `html` node, or your own markup). UI scenes are the recommended path.
* DOM overlay for menus/HUDs; Babylon GUI (`game.gui.scene(def, { entity })`) only for UI that lives inside the 3D world.

> **Tint:** an image node or a node's `image` may carry `tint: '#rrggbb'`; the sprite pixels are multiplied by it (Unity `Image.color`), alpha kept. See `tintImage()` in `runtime/core/uiscene.js`.

## File format (version 1)

**In the editor:** @ui[Assets ▸ right-click `ui` ▸ New UI scene] opens the @ui[UI Designer] tab; add nodes from its palette and set their fields in its inspector. Saving writes the file below.

**In the file** `ui/menu.ui.json` (this shows the shape; the designer writes it):
```json
{ "version": 1, "name": "menu", "theme": { "accent": "#f7d89b" },
  "root": { "type": "panel", "name": "root", "anchor": "fill", "children": [ …nodes… ] } }
```
`theme` sets `--nord-*` CSS variables for this screen only (`bg panel border fg accent good font-ui`). Every node:

| Field | Meaning |
|---|---|
| `type` | `box panel vbox hbox grid center scroll label button image canvas bar slider input checkbox select spacer html instance` |
| `name` | handle name used by scripts (unique per file) |
| `anchor` | `tl t tr l c r bl b br fill`; omit = in normal flow of the parent container |
| `x y` | offset from the anchor (px) |
| `w h minW maxW` | size (number = px, string = any CSS size such as `"70%"`) |
| `grow` | flex-grow in vbox/hbox; `self` aligns a single child |
| `margin padding gap` | number or `[top,right,bottom,left]` |
| `align justify` | children alignment (`start center end stretch between around`); for labels `align` is text-align |
| `cols` | columns of a `grid` |
| `visible disabled tooltip class style` | initial state, CSS class, raw inline CSS map |
| `on` | `{ "pressed": "play" }` event → **action name** (`pressed input changed toggled`) |
| `payload` | value passed with the action |
| `bind` | `{ "value": "hp", "visible": "alive" }` property ← data variable |
| `children` | child nodes (containers only) |

**Page mode (HTML-style pages).** `"page": true` makes the screen flow in the document instead of overlaying a game; `"styles": ["style.css"]` links your own stylesheet inside the screen's shadow root; `"body": { "margin": "0", "background": "#0a1522" }` styles the real page body. Style the screen root in that CSS with `:host { … }`. Nodes get `id` = their `name`, so `#status` rules work. `box` is an unstyled element chosen with `tag` (`main nav section aside footer h1 p hr ol …`); a `label` also takes a `tag`; `attrs` sets attributes (`aria-label`, `data-*`); `canvas` nodes (`w`,`h`) hold game drawing; `input` takes `inputType` (`text number color file checkbox password`), `multiline`, `accept`, `maxlength`. The runtime's own look is applied with zero specificity, so a project stylesheet always wins. `screen.typing` is true while a text field has focus (use it to ignore game keys; `document.activeElement` only sees the shadow host).

Type specifics: **label** `text size color bold italic wrap outline font rich` · **button** `text toggle size` · **image** `src fit opacity` · **bar** `value(0..1) color` · **slider** `min max step value` · **input** `placeholder value password` · **checkbox** `text checked` · **select** `options value` · **html** `html` · **instance** `ref` (another `.ui.json`, optional `name anchor x y w h grow margin visible style` overrides).

### Text
* `{score}` placeholders in `text` are filled from `screen.set('score', 12)` — only changed values touch the page.
* `@menu.play` looks the string up in the project's i18n tables (`game.i18n`) and re-runs on `screen.retranslate()`.
* Rich text (labels): `[b] [i] [u] [color=#f7d89b] [size=28] [br]`. Parsed into spans — never `innerHTML`.

## Script API

**Example** (not a file; calls inside a script):
```js
const ui = createUI(rootElement);                  // standalone; in a game: game.ui (same methods)
const menu = await ui.load('ui/menu.ui.json');     // fetch + build + show. ui.build(obj) for sync
menu.on('play', () => start());                    // action name from node.on.pressed; '*' = all
menu.$('score').text = 'Score 12';                 // node by name; $ throws if missing, get() returns null
menu.set('hp', 0.5);                               // data binding; menu.set({ hp: .5, name: 'A' })
const n = menu.get('mute');  n.text, n.value, n.checked, n.visible, n.disabled, n.index, n.color, n.src
n.set({ text: 'Go', visible: true, style: { opacity: .5 } });  n.on('pressed', fn);  n.css({...});
const row = menu.$('list').add({ type: 'label', text: 'Row' });  menu.$('list').clear();
menu.show(); menu.hide(); menu.toggle(); menu.destroy(); ui.only('pause');  // switch screens
```
UI → code: `on.pressed` names + `menu.on(action, fn)`; every action is also emitted on `game.events` as `ui:<action>`, so event sheets and scripts can react without wiring. Code → UI: handles and `set()` above; `ui.define(name, obj)` registers a screen without a file.

## Styles (skins): one rule set for every node {#styles}
Do not copy styles node by node. A **skin** is a JSON file of shared rules, applied to every UI scene:

**In the editor:** @ui[UI Designer] tab ▸ the **Styles** tab edits the rules and saves the skin file; the **Skin** box in the toolbar picks which skin the preview uses.

**In the file** `ui/skin.skin.json` (a skin file):
```json
{ "tokens": { "accent": "#7fb0e8", "fg": "#e8f0ff" },
  "styles": {
    "button":  { "bg": "$accent", "fg": "#10203a", "radius": 6, "pad": "8px 16px",
                 "hover": { "filter": "brightness(1.15)" }, "pressed": { "transform": "translateY(1px)" }, "disabled": { "opacity": 0.5 } },
    ".danger": { "extends": "button", "bg": "#bf616a" },
    "panel label": { "color": "$fg" } } }
```
* **By type — automatic:** a rule named `button`, `panel`, `label`, `bar`… styles *every* node of that type. This is the answer to "same style on all buttons".
* **By class — variants:** give a node `"class": "danger big"`; rules `.danger`, `button.danger`, `#play` (by name) and descendant rules (`panel label`) work like CSS. No numbered style-1/style-2: name styles by meaning.
* **Inheritance:** `"extends": "button"` (or a list) copies another rule, then overrides it.
* **States:** `hover`, `pressed`, `disabled`, `focus`, `on` (toggled) nested inside a rule; each can swap colours, transform or the whole **image**.
* **Tokens:** `tokens` become `--nord-<name>` variables; use `$name` anywhere in values. Change one token to re-colour everything.
* **Shorthands:** `bg fg radius pad size shadow`; any camelCase CSS property works; numbers mean px (except `opacity`, `fontWeight`, `lineHeight`…).
* **Where it lives:** `ui/skin.json` (or any `.skin.json`). Apply once: `ui.useSkin('ui/skin.json')` (also `createUI(root, { skin: … })`), or per file with `"skin": "ui/skin.json"` at the top of a `.ui.json`. Calling `useSkin` again swaps the look live (dark/light, seasonal, per-level). A `.ui.json` may also carry its own rules as `"styles": { … }` (object) next to or instead of a skin; `"styles": [ "page.css" ]` (array) still links CSS files. Node `style` (inline) always wins over any rule; project CSS wins over the runtime defaults.
* **Designer:** the **Skin** box in the toolbar picks the skin for the preview/file, the **Styles** tab edits and saves it.

## Images and 9-slice (Unity "Sliced", Godot NinePatchRect)
Any node can have an image, either as a plain picture or sliced so it scales without distorting its corners:

**In the editor:** @ui[UI Designer] tab ▸ select the node ▸ **Image**: pick the picture, choose the mode (`fit` or `slice`) and drag the four slice guides.

**In the file** `ui/menu.ui.json` (nodes with an image):
```json
{ "type": "panel", "image": { "src": "assets/ui/skin/panel.png", "slice": [8, 8, 8, 8], "scale": 2, "pixelated": true } }
{ "type": "image", "src": "assets/sprites/logo.png", "mode": "fit", "w": 240, "h": 80 }
{ "type": "image", "src": "assets/ui/skin/panel.png", "mode": "slice", "slice": [8, 8, 8, 8], "w": 300, "h": 120 }
```
| `mode` | Result |
|---|---|
| `slice` | **9-slice** (default when `slice` is set): the four corners keep their size, the edges stretch (or tile with `"repeat": "tile"`), the centre fills. `slice` = `[left, top, right, bottom]` in **source pixels**, or one number for all sides; `scale` enlarges the borders (2 = double-size pixel art). `"fill": false` leaves the centre empty (frames). |
| `stretch` | image stretched over the whole node (non-uniform) |
| `fit` / `cover` | keep aspect ratio inside / over the node |
| `tile` | repeat (`scale` sets the tile size) |
| `center` | natural size, centred |

On `image` nodes use `src`/`mode`/`slice`/`scale`; on every other node (panel, button, box, bar, label…) use the `image` object, and put it inside a skin rule to give every button a sliced sprite, with a different image per state:
`"button": { "image": { "src": "…/button.png", "slice": [5,5,5,5], "scale": 3 }, "hover": { "image": { "src": "…/button-hover.png", … } } }`.
`pixelated` turns off smoothing for pixel art. Slicing uses the browser's native `border-image`, so it is GPU-composited and costs nothing per frame. In the Designer, selecting any node with an image shows the **9-slice editor**: drag the four pink guides over the picture. Sample skin and art: `assets/ui/skin/` (`pixel.skin.json`, regenerate with `python3 tools/gen_ui_skin.py`).

## Performance notes
One shadow root per screen (style isolation, shared constructable stylesheet), one delegated listener per event type, one DocumentFragment per build, text/bar/visible updates are skipped when the value did not change. Use `style`/`class` sparingly; prefer anchors and containers.

## UI Designer
Add nodes from the palette into the selected container; drag rows in the **Tree** to re-parent/reorder; click or drag nodes in the preview (anchored nodes move by editing `x/y`); edit all fields in **Properties** or raw **JSON**; Undo/Redo (Ctrl+Z / Ctrl+Shift+Z); Ctrl+S saves. The preview is the real runtime, so what you see is what the game shows. Preview sizes and four colour presets are in the toolbar.

## 3D world UI
`game.gui.scene(def, { entity, offsetY })` builds the same tree (label, button, bar, image, vbox, hbox, panel, spacer; anchors, size, colours, `on.pressed → ui:<action>`) as Babylon GUI controls, floating over `entity` when given. Rich text is stripped and layout is simpler than DOM; use DOM screens for menus and HUDs.

## Canvas scaler, sprite states and prefabs
* **`scaler`** (top level of the file): `{ "mode": "constant"|"scale"|"fit", "ref": [1280, 720], "match": 0.5, "factor": 1 }`. `scale` works like Unity's *Scale With Screen Size* (log blend between width and height ratio, `match` 0 = width, 1 = height); `fit` shows the whole `ref` area letterboxed; `constant` multiplies by `factor`. Anchors, sizes and fonts then work in the reference resolution. `scalerFactor(scaler, w, h)` is exported for tests.
* **`sprites`** on any node (usually a button): `{ "normal", "hover", "pressed", "disabled", "on", "focus": "<image>", "slice", "scale", "pixelated", "mode", "tint" }`: one picture per state, sharing the slice/scale/tint settings.
* **Skin tint:** a skin rule (or one of its states) may carry `image.tint: "#rrggbb"`; the sprite is multiplied by it when the skin loads (`tintSkin()`).
* **UI prefabs:** a node can be saved as its own file (Designer ▸ *Make UI prefab…*) and used through an `instance` node; *Unpack* inlines it again, *Open prefab* edits it.
