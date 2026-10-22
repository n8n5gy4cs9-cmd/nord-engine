# UI scenes (`.ui.json`) and the UI Designer

Menus, HUDs and dialogs are **data**: a `ui/<name>.ui.json` file edited in the **UI Designer** tab and loaded from code. Decision: ADR-030.

* Runtime: `runtime/core/uiscene.js` (no dependencies; `game.ui.load()` or standalone `createUI(el)`).
* Designer: `editor/uidesigner/` (served at `/editor/uidesigner/index.html`, embedded as the **UI Designer** tab). It writes the JSON through the project file API (`/api/fpsc/save`, folder `ui/` only).
* Raw HTML still works (`ui.panel/label/button…`, an `html` node, or your own markup). UI scenes are the recommended path.
* DOM overlay for menus/HUDs; Babylon GUI (`game.gui.scene(def, { entity })`) only for UI that lives inside the 3D world.

## File format (version 1)
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

## Performance notes
One shadow root per screen (style isolation, shared constructable stylesheet), one delegated listener per event type, one DocumentFragment per build, text/bar/visible updates are skipped when the value did not change. Use `style`/`class` sparingly; prefer anchors and containers.

## UI Designer
Add nodes from the palette into the selected container; drag rows in the **Tree** to re-parent/reorder; click or drag nodes in the preview (anchored nodes move by editing `x/y`); edit all fields in **Properties** or raw **JSON**; Undo/Redo (Ctrl+Z / Ctrl+Shift+Z); Ctrl+S saves. The preview is the real runtime, so what you see is what the game shows. Preview sizes and four colour presets are in the toolbar.

## 3D world UI
`game.gui.scene(def, { entity, offsetY })` builds the same tree (label, button, bar, image, vbox, hbox, panel, spacer; anchors, size, colours, `on.pressed → ui:<action>`) as Babylon GUI controls, floating over `entity` when given. Rich text is stripped and layout is simpler than DOM; use DOM screens for menus and HUDs.
