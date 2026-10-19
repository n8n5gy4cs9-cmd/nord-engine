---
title: Addons, data objects and languages
section: Manual
order: 25
summary: Extend event sheets with your own plugins, keep data in Array/Dictionary/JSON objects, and translate your game.
---

## Data objects
Besides objects in the world, event sheets can hold **data**: an **Array** (1–3 dimensions), a **Dictionary**, a **JSON** object or **AJAX** (web requests). Add one with **+ Data object** in the Event sheets tab (give it a name and a type; *global* keeps it when the scene changes) and use it like any object: `Inventory → Push back`, `Inventory.At(2)`, `Config.Get("volume")`, `Net → Request`, trigger *On completed*. The full list of actions and expressions is in the generated *Event sheet reference*.

## Addons
An **addon** adds new conditions, actions and expressions (a *plugin*), new *behaviors*, *data objects* or *effects* written in plain JavaScript. A sample lives in `library/addons/dice`.
1. `nord addon install library/addons/dice` copies it into your project's `addons/` folder and registers it.
2. In the Event sheets tab press **Refresh addons** — its actions now appear in the picker.
3. Share yours with `nord addon pack <folder>` (a `.nordaddon` file). Only install addons you trust: they run with your game.
Details: `docs/ADDONS.md`.

## Languages
Put your texts in `nord.project.json` → `strings` (`{ "en": { "play": "Play" }, "fi": { "play": "Pelaa" } }`). Give a text or button a **`textKey`** instead of fixed text and it follows the language. *Localisation → Set language* switches it (and the choice is remembered); `Localisation.Text("hello", "Ada")` fills `{0}` placeholders. The **Menu starter** template shows a language switch end to end. Accessibility helpers: *Accessibility → Set colour-blind mode* previews your colours for protanopia/deuteranopia/tritanopia, and *Set UI scale* enlarges the interface.
