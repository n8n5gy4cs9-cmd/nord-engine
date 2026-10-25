---
title: Addons, data objects and languages
section: Manual
group: Gameplay, sound and interfaces
order: 25
summary: Extend event sheets with your own plugins, keep data in Array/Dictionary/JSON objects, and translate your game.
---

## Use this page

This chapter explains **addons, data objects and languages**. Open a saved project before following editor steps. Use the topic links below for a specific task; follow [Tutorials](tutorials.html) when you want a complete project to build in order.

| Find the instructions for | Go to |
|---|---|
| Data objects | [Read this section](#data-objects) |
| Addons | [Read this section](#addons) |
| Languages | [Read this section](#languages) |

These tools extend what event sheets can do: keep data, add new kinds of actions, and translate your game.

::: dummies
**Data objects** are named containers for numbers and text (a list, a table). An **addon** is a plug-in you install. **Localisation** means showing the game in the player's language.
:::

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


## Check yourself

- Save the project, then repeat the action from the section you used. Confirm the stated result before moving on.
- If Play fails, check the Console for the first error and compare file paths and capitalisation with the example.
- For platform or feature limits, check [Known issues](known-issues.html).

Next: [Choose a worked example](examples.html). Back to: [Manual reading paths](manual-paths.html).
