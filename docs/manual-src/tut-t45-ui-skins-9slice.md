---
title: T45 One style for every button, and 9-slice images
section: Tutorials
order: 45
summary: Restyle all buttons at once with a skin file, add variants and hover states, then use 9-slice images so panels and buttons stretch like in Unity or Godot.
---
**Result:** a menu where every button shares one pixel-art look with hover/pressed images, a red "danger" variant and a panel that stretches without distorting its corners.
**Start from:** the menu you built in [T44](tut-t44-ui-designer.html). Allow 20 minutes.

::: dummies
A **skin** is one file of rules such as "all buttons look like this". You do not paint each button. A **9-slice** image is a picture cut into 3×3 pieces: the four corners never stretch, so a small frame can become a big window and still look crisp.
:::

<figure class="shot"><img src="assets/screenshots/ui-nine-slice-compare.png" alt="The same panel stretched and 9-sliced" loading="lazy"><figcaption>The same 24×24 picture at three sizes: stretched (top) and 9-sliced (bottom).</figcaption></figure>

## 1. Why not style-1, style-2?
Numbered slots tell you nothing and break when you reorder them. Nord skins work like this instead:

* a rule named by **type** (`button`) styles *every* button automatically;
* a rule named by **meaning** (`.danger`, `.title`) is a variant you attach with `"class": "danger"`;
* a variant can **extend** another rule and change only what differs;
* **states** (`hover`, `pressed`, `disabled`) live inside the rule, so you never create "button-hover-2".

## 2. Make a skin
In the UI Designer open the **Styles** tab. Type `ui/skin.json` and paste:

```json
{
  "tokens": { "accent": "#7fb0e8", "fg": "#e8f0ff" },
  "styles": {
    "button": {
      "bg": "$accent", "fg": "#10203a", "radius": 8, "pad": "8px 18px", "fontWeight": 700,
      "hover": { "filter": "brightness(1.15)" },
      "pressed": { "transform": "translateY(1px)" },
      "disabled": { "opacity": 0.5 }
    },
    ".danger": { "extends": "button", "bg": "#bf616a" },
    ".title": { "fontSize": 44, "color": "$accent" }
  }
}
```
Press **Apply**, then **Save skin**. Choose *Project ui/skin.json* in the **Skin** box. Every button in the preview changed together. Change `"accent"` and apply again: every `$accent` updates.

Give the Quit button the class `danger` (Properties ▸ CSS class) and the title label the class `title`.

## 3. Use it in the game

**File: your script, for example `scripts/Menu.js`** (inside `start()`)
```js
const ui = createUI(root);              // or this.ui in a scene script
await ui.useSkin('ui/skin.json');       // once, for every screen
const menu = await ui.load('ui/menu.ui.json');
```
Or put `"skin": "ui/skin.json"` at the top of the `.ui.json` file. Calling `useSkin` again with another file swaps the whole look at runtime, for example a night theme.

## 4. Give buttons a picture (9-slice)
Copy the sample art from `assets/ui/skin/` (`panel.png`, `button.png`, `button-hover.png`, `button-down.png`) into your project, or start from the **Pixel (sample)** skin in the Designer's Skin box. A sliced rule looks like this:

**In the editor:** @ui[UI Designer] tab ▸ **Styles** tab ▸ select the `button` rule ▸ **Image**: pick `button.png`, drag the four slice guides to 5 pixels, set the scale to 3 and tick **pixelated**; do the same for the **hover** and **pressed** states with `button-hover.png` and `button-down.png`.

**In the file** `ui/skin.skin.json` (the Styles tab writes it; this is the `button` rule):
```json
"button": {
  "image": { "src": "assets/ui/skin/button.png", "slice": [5, 5, 5, 5], "scale": 3, "pixelated": true },
  "color": "$fg", "background": "none",
  "hover":   { "image": { "src": "assets/ui/skin/button-hover.png", "slice": [5, 5, 5, 5], "scale": 3, "pixelated": true } },
  "pressed": { "image": { "src": "assets/ui/skin/button-down.png",  "slice": [5, 5, 5, 5], "scale": 3, "pixelated": true } }
}
```
* `slice` is `[left, top, right, bottom]` in **pixels of the source picture**: the border that must never stretch.
* `scale` multiplies those borders on screen (3 turns a 16 px pixel-art button into a chunky 48 px one).
* `pixelated` keeps pixel art sharp.

<figure class="shot"><img src="assets/screenshots/ui-designer-image-picker.png" alt="Choosing an image in the Designer" loading="lazy"><figcaption><b>Browse project images…</b>, <b>Add from computer…</b>, or drag a file onto the Image field.</figcaption></figure>

### Find the slice numbers visually
Select any node that has an image in the Designer. The **9-slice editor** under Properties shows the picture with four pink guides. Drag them to the edge of the decoration; the numbers and the preview update live.

<figure class="shot"><img src="assets/screenshots/ui-designer-slice-editor.png" alt="The 9-slice editor" loading="lazy"><figcaption>Drag the four guides; the preview updates live.</figcaption></figure>

### Input fields too
A text input, drop-down or checkbox can use images exactly like a button. Put the image in the skin (rule `input`) and every field gets it, with a different image for the `focus` state.

<figure class="shot"><img src="assets/screenshots/ui-input-image.png" alt="A sliced text input" loading="lazy"><figcaption>An <code>input</code> drawn with a 9-slice image; it still types, selects and fires <code>on.changed</code>.</figcaption></figure>

## 5. Images that are not sliced
An `image` node has a `mode`:

| Mode | Use for |
|---|---|
| `fit` | logos: keep the aspect ratio inside the box |
| `cover` | backgrounds: fill the box, crop the rest |
| `stretch` | exact fill, ignoring the aspect ratio |
| `tile` | repeating patterns (`scale` changes the tile size) |
| `slice` | a 9-slice picture of any size: `{ "type": "image", "src": "…/panel.png", "mode": "slice", "slice": [8,8,8,8], "w": 320, "h": 140 }` |

Any other node (a panel, a bar, a box) takes the same options in an `image` object, for example `"image": "assets/bg.png"` for a plain stretched background.

## Checkpoint
Resize the preview to *Phone 390×844*: the panels and buttons keep sharp corners at every size. Change the skin file and every screen updates without touching one `.ui.json` file or line of code.

Reference: `docs/UI_SCENES.md` (Styles, Images and 9-slice).
