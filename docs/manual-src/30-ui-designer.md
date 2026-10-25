---
title: UI Designer
section: Manual
group: Gameplay, sound and interfaces
order: 30
summary: Build menus, HUDs and dialogs visually. Layout, text, images and 9-slice, skins, input fields, and how a button reaches your code.
---

The **UI Designer** is where you build every screen the player clicks: main menu, HUD, pause screen, settings, dialogs. You draw a tree of **nodes**, see the result live, and save it as a `ui/<name>.ui.json` file. Your game loads that file with one line of code. This chapter is the full reference; for a short guided build, follow [T44](tut-t44-ui-designer.html) and [T45](tut-t45-ui-skins-9slice.html).

<figure class="shot"><img src="assets/screenshots/ui-designer-overview.png" alt="UI Designer: node palette and tree on the left, live preview in the middle, Properties on the right" loading="lazy"><figcaption>The UI Designer: <b>Add node</b> palette and <b>Tree</b> (left), the live <b>Preview</b> (middle) and <b>Properties</b> (right). The preview is the real game UI, not a mock-up.</figcaption></figure>

::: dummies
@ui[Change the font:] select a label (or button, input) in the tree, open @ui[Properties] and pick **Font** from the drop-down. Pixel fonts come first: Pixelify Sans, VT323, Press Start 2P, Silkscreen, Jersey 10, Tiny5; then Orbitron, Bebas Neue, Oswald, Rajdhani, Exo 2, Bungee, Cinzel and the UI fonts (Inter, Roboto, Open Sans…). In the JSON it is `"font": "Press Start 2P"`. The fonts are bundled and work offline in exports. Empty = the theme's font.

A UI file is a family tree of boxes. A **vbox** stacks its children top to bottom, an **hbox** left to right. A **label** shows text, a **button** can be pressed. You give a button an **Action** name such as `play`; your code says "when `play` happens, do this".
:::

## Open the Designer
* **Window ▸ UI Designer**, or the command palette (**Cmd/Ctrl+K**, type "UI Designer").
* In the **Assets** panel, double-click any `*.ui.json` file. Right-click a folder ▸ **New UI scene** creates a blank one.
* Layout presets: **Window ▸ Layout ▸ Visual scripting + UI** gives the Designer, Graph and Scene tabs room to breathe.

## The window
| Area | What it does |
|---|---|
| **Toolbar** | File name box, **Open script**, **New**, **Open**, **Save** (Ctrl/Cmd+S), **Undo/Redo**, preview **size**, colour **Theme**, **Skin**. |
| **Add node** | Click a type to add it inside the selected container (or beside the selected node). |
| **Tree** | The structure. Click to select, **drag a row onto another** to move it into a container or reorder. |
| **Preview** | Click an element to select it. **Drag** anchored elements to move them. Elements that start hidden in the game are shown ghosted (dashed outline) so you can still edit them. |
| **Properties** | Every setting of the selected node. Changes appear instantly. **Duplicate / Up / Down / Delete** are at the bottom. |
| **JSON** | The raw file. Edit and **Apply JSON** for bulk changes. |
| **Styles** | The shared skin (see [Styles](#skins)). |
| **Actions** | Every action in the file and the code that handles it (see [Connecting buttons to code](#actions)). |

## Node types
<figure class="shot"><img src="assets/screenshots/ui-node-gallery.png" alt="Every node type rendered with the pixel skin" loading="lazy"><figcaption>All node types, rendered with the sample pixel skin.</figcaption></figure>

| Type | Use it for | Notable settings |
|---|---|---|
| `panel` | A framed container (window, card). | `layout` vbox/hbox, `gap`, `padding` |
| `vbox` `hbox` | Stack children vertically / horizontally. | `gap`, `align`, `justify`, `grow` on children |
| `grid` | Rows and columns. | `cols`, `gap` |
| `center` `scroll` | Centre one child; a scrolling area. | `h` for scroll |
| `box` | Plain unstyled element with an HTML `tag` (`main`, `nav`, `h1`…). Page-style UIs. | `tag` |
| `label` | Text. | `text`, `size`, `color`, `font`, `bold`, `italic`, `align`, rich text |
| `button` | Something to press. | `text`, **`on.pressed` (Action)**, `toggle`, `image` |
| `image` | A picture. | `src`, `mode` (fit, cover, stretch, tile, slice), `slice`, `scale` |
| `bar` | Progress/health bar. | `value` 0–1, `color`, `bind.value` |
| `slider` | Draggable value. | `min`, `max`, `step`, `value`, **`on.changed`** |
| `input` | A text field (also number, colour, file, password, multi-line). | `inputType`, `placeholder`, `value`, **`on.changed`** |
| `checkbox` `select` | Tick box; drop-down list. | `checked`; `options`; **`on.toggled`/`on.changed`** |
| `canvas` | A drawing surface for your own game code. | `w`, `h` |
| `spacer` `html` | Flexible gap; raw HTML snippet. | `grow`; `html` |
| `instance` | Another UI file placed inside this one. | `ref` |

Every node also has **Name** (how code finds it), **Visible**, **Disabled**, **Tooltip**, **CSS class** (for skins) and **Bind text var** (live data, see below).

## Layout: anchors and containers
<figure class="shot"><img src="assets/screenshots/ui-anchors.png" alt="Nine labels pinned to the nine anchor points of a panel" loading="lazy"><figcaption>The nine <b>anchors</b>: tl, t, tr, l, c, r, bl, b, br. An anchored node is pinned to that point of its parent; X/Y then offset it.</figcaption></figure>

* **Anchor** pins a node to a point of its parent (`tl` top-left … `br` bottom-right, `c` centre, `fill` stretches over the whole parent). **X / Y** move it from that point. Leave Anchor empty for a node that simply flows inside a vbox/hbox/grid.
* **Width / Height** accept numbers (pixels) or CSS sizes such as `70%`. **Grow** makes a child take the remaining space in a vbox/hbox.
* **Margin** and **Padding**: one number, or four (`top right bottom left`). **Gap** is the space between children. **Align items / Justify** place children inside a container.
* Test other screens with the **Preview** size box (960×540, 1280×720, phone 390×844, 1920×1080).

## Text
* `{score}` in a label's text is replaced by a value you set from code: `menu.set('score', 12)`. Only changed values touch the page.
* `@menu.play` looks the string up in your language tables (Localisation).
* Rich text: `[b]bold[/b]`, `[i]`, `[u]`, `[color=#f7d89b]gold[/color]`, `[size=28]big[/size]`, `[br]` (new line). It is parsed into safe elements, never raw HTML.

## Inserting images {#images}
<figure class="shot"><img src="assets/screenshots/ui-designer-image-picker.png" alt="The image picker listing the project's images" loading="lazy"><figcaption><b>Browse project images…</b> lists every image in your project with a thumbnail.</figcaption></figure>

Any node can show an image. The setting is called **Image** in Properties (on an `image` node it is **Image** plus Mode). Four ways to choose a file:

1. **Browse project images…** opens the picker. Click a thumbnail.
2. **Add from computer…** (in the picker) copies a PNG, JPG, WebP or GIF into your project as `assets/ui/<name>` and selects it.
3. **Drag a file** from Finder/Explorer onto the Image field: same copy, same result.
4. **Type the path**, relative to the project root: `assets/ui/panel.png`.

Below the field Nord tells you the result immediately: **✓ found · 24×24px** with a small preview, or **✗ not found: <path>**. Fix the path until you see the tick. The **Actions** tab also lists every missing image in the file (*Checks*).

Which images work where? **Every node.** A button, panel, label, bar, canvas, even `input`, `select` and `checkbox` can carry an image; it becomes the node's background. An `image` node shows a picture on its own.

### Image modes
| Mode | Result |
|---|---|
| `stretch` | Fill the node exactly (distorts). |
| `fit` | Keep the aspect ratio inside the node. |
| `cover` | Fill the node, crop the overflow. |
| `tile` | Repeat; **Slice scale** sets the tile size. |
| `center` | Natural size, centred. |
| `slice` | **9-slice**, below. |

### 9-slice (stretch without distorting the corners)
<figure class="shot"><img src="assets/screenshots/ui-nine-slice-compare.png" alt="The same panel image stretched (top) and 9-sliced (bottom) at three sizes" loading="lazy"><figcaption>The same 24×24 image at three sizes. Top: <code>stretch</code> smears the border. Bottom: <code>slice</code> keeps the corners and edges crisp.</figcaption></figure>

A 9-slice image is cut into a 3×3 grid: the **four corners** keep their size, the **four edges** stretch along one direction, the **middle** fills. One small picture therefore becomes any window or button size.

1. Select the node, choose the image, set **Image mode** to `slice`.
2. Type **9-slice L T R B**: the border widths in *source pixels*, left, top, right, bottom (`8 8 8 8`; one number applies to all sides).
3. Or drag the guides: the **9-slice editor** below the fields shows the picture with four pink lines. Drag each to the inner edge of the decoration; the numbers and the preview update live.
4. **Slice scale** enlarges the borders on screen (2 = double-size pixel art). Tick **Pixelated** for crisp pixel art.

### Tint a white sprite to any colour
Like Unity's `Image.color`: the **Tint (multiplies sprite)** field multiplies every pixel of the picture by a colour and keeps its transparency, so one white button/panel image can be red, blue or gold. Type a colour (`#ff5050`) or use the picker beside it. It works on *image* nodes (`"tint"`) and on any node's background image (`"image": { "src": "…", "tint": "#ff5050" }`), also with 9-slice. White stays the pure colour, black stays black, a coloured sprite is darkened/shifted (multiply, as in Unity). The tinted copy is made once in the browser and cached. Tints inside shared **skins/styles** are not applied yet; set it on the node.

<figure class="shot"><img src="assets/screenshots/ui-designer-slice-editor.png" alt="9-slice editor with four draggable guides over panel.png" loading="lazy"><figcaption>The 9-slice editor: drag the guides, watch the preview.</figcaption></figure>

### Images on input fields
<figure class="shot"><img src="assets/screenshots/ui-input-image.png" alt="A text input drawn with a sliced field image next to a plain input" loading="lazy"><figcaption>Top: an <code>input</code> whose skin rule uses <code>field.png</code> as a 9-slice. Below: the same node with a plain border.</figcaption></figure>

Text fields, drop-downs and checkboxes accept images exactly like buttons do. Because you usually want *every* field to look the same, put the image in a **skin rule** instead of on each node:

**In the editor:** @ui[UI Designer] tab ▸ select the text field ▸ **Image**, pick the picture and set the slice (or edit the skin rule as described above).

**In the file** the skin's `input` style block:
```json
"input":  { "image": { "src": "assets/ui/skin/field.png", "slice": [4,4,4,4], "scale": 3, "pixelated": true },
            "color": "$fg", "background": "none", "padding": "2px 6px",
            "focus": { "image": { "src": "assets/ui/skin/button-hover.png", "slice": [5,5,5,5], "scale": 3 } } },
"select": { "extends": "input" }
```
The text starts inside the sliced border automatically. The `focus` state swaps the image while the field is being typed in. Typing, the cursor, selection and `on.changed` all keep working because the node is still a real input.

## Skins: one style for many nodes {#skins}
<figure class="shot"><img src="assets/screenshots/ui-designer-styles.png" alt="The Styles tab showing the skin JSON" loading="lazy"><figcaption>The <b>Styles</b> tab edits the skin file (here <code>pixel.skin.json</code>).</figcaption></figure>

A **skin** is one JSON file of rules that style *all* nodes. A rule named `button` styles every button; `.danger` is a variant you attach by typing `danger` into a node's **CSS class**. Rules can `extends` other rules, define `hover`, `pressed`, `disabled` and `focus` states, use `$tokens`, and set images (including 9-slice) per state. Choose the skin in the toolbar **Skin** box (it is saved as `"skin"` in the file), or apply it in code once: `ui.useSkin('ui/skin.json')`. The complete skin format is in [UI scenes](ui-scenes.html#styles) and the walkthrough in [T45](tut-t45-ui-skins-9slice.html).

## Connecting buttons to code {#actions}
A button does nothing by itself. It announces an **Action** name, and your code listens:

**File: your script, for example `scripts/Menu.js`** (inside `start()` of a scene script)
```js
const menu = await createUI(root).load('ui/menu.ui.json');   // in a scene script: this.ui.load(...)
menu.on('play', () => startGame());                            // runs when a node's Action is "play"
```

1. Select the button, type a name into **Action** (`play`).
2. Right below the field the Designer searches your project and shows **where that action is handled**: `app.js:94 — menu.on('play', …)` with an **Open** button that jumps to that line in the code editor.
3. If nothing handles it you see **⚠ No code listens to "play" yet** and a **Copy code snippet** button. Paste the snippet into the script that loads this UI file.
4. The **Actions** tab lists *every* action in the file: where it is handled, **Open** the code, **Select node**, or copy a snippet for the missing ones. It also lists problems (images not found, buttons without an action).
5. **Open script** (toolbar) opens the script that loads this UI file, so you can add handlers there.

<figure class="shot"><img src="assets/screenshots/ui-designer-actions.png" alt="The Actions tab: restart is handled in graphs/game.graph.json, with an Open button" loading="lazy"><figcaption>The <b>Actions</b> tab. Here <code>restart</code> is handled by a node graph; <b>Open</b> jumps to it.</figcaption></figure>
<figure class="shot"><img src="assets/screenshots/ui-designer-action-missing.png" alt="A new button with Action 'two' and the warning that no code listens to it" loading="lazy"><figcaption>A new button with the action <code>two</code>: Nord warns that nothing listens yet and offers a snippet.</figcaption></figure>

Actions are also emitted as the game event `ui:<action>`, so **event sheets** (*On game event → ui:play*) and **graphs** (*On UI Action*) can react without any JavaScript. The search finds handlers in scripts, event sheets, graphs and scenes. (It needs the Nord editor; in a plain browser tab you will see the snippet instead.)

Other ways to get data in and out:
* `node.on('pressed', fn)` / `'changed'` / `'input'` / `'toggled'` on a single node.
* `menu.$('score').text = 'Score 12'`, `.value`, `.visible`, `.disabled`, `.color`, `.index`.
* **Bind text var**: put `{hp}` in a label and call `menu.set('hp', 50)`; or **Bind** a bar's `value` to a variable.

## Saving and loading
* **Save** writes `ui/<name>.ui.json`; the file box accepts any name (`menu` → `ui/menu.ui.json`).
* Load it from a script with `await this.ui.load('ui/menu.ui.json')`, from an HTML project with `createUI(root).load(...)`, or from a graph with the **Load UI Screen** node.
* Several screens can be open at once: `ui.only('pause')` shows one and hides the others.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Image shows **✗ not found** | Path is relative to the project root; use **Browse** to pick a real file. |
| Image appears but the corners are blurry/distorted | Set **Image mode** to `slice`, fill **9-slice L T R B**, tick **Pixelated** for pixel art. |
| Button does nothing in the game | Give it an **Action** and add `menu.on('<action>', …)`; check the **Actions** tab. |
| "No code listens" although my code exists | The name must appear as a quoted string, e.g. `menu.on('play'`. Computed names are not found by the search. |
| Text field loses focus when I press keys in the game | Use `if (menu.typing) return;` at the top of your key handler. |
| Style from my skin does not apply | The node's own **style** wins over skin rules; remove it, or check the rule name (`button`, `.danger`). |
| Hidden panel invisible in the Designer | Not any more: hidden nodes are shown ghosted. They are hidden only in the running game. |

## Scaler, handles, sprite states, tint and prefabs
* **Canvas scaler:** select the root node and pick a mode under *Canvas scaler*: *Constant factor*, *Scale with screen* (reference resolution plus a width/height balance, like Unity's Canvas Scaler) or *Fit (letterbox)*. Positions, sizes and fonts then work in the reference resolution on every screen size.
* **Resize handles:** the selected node shows eight handles in the preview; drag one to change **Width** / **Height**. The opposite edge stays where it is, whatever the anchor. Hold Ctrl/Cmd to resize without rounding.
* **Sprite states:** buttons have *Sprite: normal / hover / pressed / disabled* fields (plus a shared 9-slice, scale and tint): one picture per state.
* **Skin tint:** a skin rule can carry `image.tint`; the picture is multiplied by that colour when the skin loads.
* **UI prefabs:** *Make UI prefab* saves the selected node as its own `ui/<name>.ui.json` and replaces it with an `instance` node. Edit the prefab once and every screen using it changes. *Open prefab* edits it, *Unpack* puts the nodes back inline.
Details are in the [UI scenes reference](ui-scenes.html).

## See also
[UI scenes reference](ui-scenes.html) · [T44 Menus and HUDs](tut-t44-ui-designer.html) · [T45 Skins and 9-slice](tut-t45-ui-skins-9slice.html) · [Node graphs](graph.html) · [UI & HUD basics](ui.html)


## Check yourself

- Save the project, then repeat the action from the section you used. Confirm the stated result before moving on.
- If Play fails, check the Console for the first error and compare file paths and capitalisation with the example.
- For platform or feature limits, check [Known issues](known-issues.html).

Next: [Choose a worked example](examples.html). Back to: [Manual reading paths](manual-paths.html).
