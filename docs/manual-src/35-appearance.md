---
title: Editor appearance
section: Manual
order: 35
summary: Themes, font pairs, interface/text/button size with reset, and the built-in theme editor for your own themes. Everything is saved when you close the app.
---

**Settings** (Cmd/Ctrl+,) ▸ the top of the page controls how the editor looks. Every change is applied immediately and saved to `editor.json` in Nord's config folder, so the editor looks the same the next time you start it.

## Themes and fonts
* **Theme (colors):** 55+ built-in themes. Besides the classic ones below there are *Inspired* themes with the palette feel of other tools: Unity, Unreal, Godot, Blender, Defold, Cocos Creator, GameMaker, Flax, Stride, Construct, RPG Maker, VS Code Dark+/Light+, JetBrains Darcula, IntelliJ Light, Xcode Dark, Ayu (Dark, Mirage, Light), Night Owl, Rosé Pine, Everforest, Kanagawa, Synthwave '84, Cobalt2, Atom One Light, Gruvbox Light and Poimandres (inspired by, not copies; names belong to their owners). Dark: PlayCanvas (default), Graphite, Nord, Dracula, One Dark, Monokai, Tokyo Night, Gruvbox, Solarized Dark, Catppuccin Mocha, GitHub Dark, Material Palenight and the new **Midnight, Obsidian, Carbon, Deep Ocean, Forest Night, Ember, Rose Night, Slate Gold**. Light: Nord Light, GitHub Light, Solarized Light and the new **Paper** and **Daylight**. Your own themes appear as *Name (custom)*.
* **Skin (fonts):** a UI font plus a code font. Besides the original three there are ten more pairs: Material (Roboto / Roboto Mono), Adobe Studio (Source Sans 3 / Source Code Pro), Geometric (DM Sans / DM Mono), Soft (Manrope / JetBrains Mono), Humanist (Open Sans / Source Code Pro), Classic (Roboto / Source Code Pro), Studio (Source Sans 3 / Red Hat Mono), Clean (DM Sans / Roboto Mono), Compact Dev (Open Sans / Fira Code) and Workstation (Inter / Red Hat Mono). All are open-source (OFL) fonts bundled with the app.

## Size: interface, text, buttons
Three sliders. Nothing changes while you drag them: press **Apply sizes** to use the new sizes (the editor would otherwise re-layout on every step). **Reset to 1.00** puts the sliders back to the default size; press Apply to use it:
| Slider | Changes |
|---|---|
| **Interface size** | everything: text, buttons, spacing |
| **Text size** | text only, on top of Interface size |
| **Button size** | buttons, inputs and icon buttons, on top of Interface size |

Use *Text size* alone to make code and labels bigger without making the whole editor bigger, or *Button size* to make touch-friendly buttons. **Reset all settings to defaults** also resets these.

## Theme editor (make your own theme)
Open **Settings ▸ Theme editor**.
1. Press **New theme from the current one** (start from the theme you like best).
2. Give it a **Name**, tick **Dark** or not, and click the colour boxes: Background, Panel, Raised panel, Borders, Text, Dim text, Accent, Good, Warning, Error and the code colours (keyword, string, number, comment, function, type). The whole editor updates live while you edit.
3. **Save as new theme** adds it to the Theme list as *Name (custom)* and selects it. **Cancel** goes back to the previous theme.
Built-in themes are never changed: custom themes are separate entries stored in `themes.custom.json` in the config folder (you can copy that file to another computer). Under **Theme editor** you can **Use**, **Edit** or **Delete** your custom themes later.

::: tip
Missing symbols? The editor falls back to a bundled symbol font for arrows, bullets and similar characters in every skin, and menus use real icons instead of text glyphs.
:::
