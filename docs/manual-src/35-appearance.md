---
title: Editor appearance
section: Manual
group: Getting oriented
order: 35
summary: Themes, font pairs, interface/text/button size with reset, and the built-in theme editor for your own themes. Everything is saved when you close the app.
---

::: dummies
This is a reference chapter: you do not have to complete every section. Choose one task, make that change in the editor, and press Play to check the result. An **entity** is an object in your scene; a **component** adds a capability; a **script** adds your own rules.
:::

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


## Documentation reader appearance
The documentation HTML has its own appearance controls. In the documentation header, choose **Theme**: Graphite, Paper, Nord, Sepia, Forest, High contrast, Slate, Deep ocean, Ember, Plum, or Arcade night. The page changes immediately and remembers the selection on the next page. This changes the manual reader; use the editor Settings described above to change editor appearance.

The five added palettes stay dark: **Slate** uses muted blue-gray, **Deep ocean** uses teal, **Ember** uses warm charcoal, and **Plum** uses soft purple. **Arcade night** adds cyan/purple accents and a subtle background glow. It keeps the same readable code blocks and controls; there are no flashing decorations.

Sidebar categories use compact tinted headers derived from the current theme's accent, purple, green, amber and rose colors. The **Old** category uses a quieter neutral header. Its pages keep earlier workflows and explain the current replacement; an Old label does not mean a supported native API has stopped working.

The **For dummies** button shows or hides beginner explanations across the manual. **Menu** opens section navigation on a narrow screen. Expand a sidebar category to see its pages, or collapse it to make the list shorter.

![Manual reading paths with grouped navigation in the Nord documentation theme](assets/screenshots/manual-redesign-desktop.png)

![Collapsible Examples categories on a narrow screen](assets/screenshots/manual-redesign-mobile.png)

![Manual topics in the dark Arcade night documentation theme](assets/screenshots/manual-redesign-arcade.png)

Check: select a different theme, open another chapter, and confirm the theme remains selected.


## Check yourself

- Save the project, then repeat the action from the section you used. Confirm the stated result before moving on.
- If Play fails, check the Console for the first error and compare file paths and capitalisation with the example.
- For platform or feature limits, check [Known issues](known-issues.html).

Next: [Choose a worked example](examples.html). Back to: [Manual reading paths](manual-paths.html).