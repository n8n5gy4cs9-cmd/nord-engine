# notepaint — reusable assets

| File in examples/notepaint | What it is | Reuse |
|---|---|---|
| `assets/ui/tools.png` | Original transparent 4×4 UI icon atlas, 1254×1254 | Copy into your own app; CSS uses 400% background-size and row/column percentages. |
| `assets/ui/tools.png.meta.json` | Nord spritesheet metadata (313×313 cells, last two border pixels unused) | Copy alongside the PNG if using it as Nord sprites. |
| `assets/fonts/inter.woff2` | Vendored Inter Regular | Copy with its OFL licence. |
| `assets/fonts/LICENSE` | Font licence | Keep with the font. |

Atlas indices start at zero, left to right, top to bottom:

0 New document · 1 Open · 2 Save · 3 Export
4 Pencil · 5 Brush · 6 Eraser · 7 Fill
8 Line · 9 Rectangle · 10 Ellipse · 11 Eyedropper
12 Undo · 13 Redo · 14 Trash · 15 Notepaint emblem

The app uses `src/app.js`'s `icon(index)` helper and `.np-sprite` in `style.css`. These display a selected cell without splitting the image into sixteen files. They have text/accessible labels so the icon is not the only explanation.

Source PNG: `tools/examples/notepaint/assets/ui/tools.png`. The plain PNG is authoritative. Regenerating examples copies it; it does not redraw it. Original built-in ImageGen artwork; prompt in ART_DIRECTION.md. Crowelian 2026 + Sonnet. You may reuse the original artwork under MIT; no app audio.
