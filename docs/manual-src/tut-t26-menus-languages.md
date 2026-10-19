---
title: T26 Menus and two languages
section: Tutorials
order: 26
summary: Build a main menu, an options screen and a game scene that switch with events, then add a second language.
---
**Result:** Play / Options buttons, a language switch (English ⇄ Finnish) and a volume control.
**Start from:** *New project → Menu starter (event sheet)* (`templates/es-menu-starter`).

<figure class="shot"><img src="assets/screenshots/es-tpl-es-menu-starter-options.png" alt="The options scene in Finnish with language and volume buttons" loading="lazy"><figcaption>The options scene after pressing "Suomi" — every label changed.</figcaption></figure>

## 1. Three scenes
`menu`, `options` and `game` are three layouts. Each has its own event sheet. The start layout is the menu (Layout tab → *set as start*).

## 2. Buttons that send events
A button is a `uiButton` with an **event name** (`play`, `options`, `lang-fi`…). When pressed it sends that name on the game's event bus. In a sheet, **Events → On game event (name)** reacts. `play` runs *System → Go to layout "game"*.

## 3. Texts that translate
`nord.project.json` has `strings: { en: {…}, fi: {…} }`. Every button and label uses a **textKey** (`play`, `options`…) instead of fixed text. *Localisation → Set language "fi"* changes them all at once, and the choice is saved.

## 4. Volume
`volume` is a variable. *vol-up* sets it to `min(1, volume + 0.1)` and calls *Audio → Set volume (music)*. The label shows `round(volume * 100) & "%"`.

## Try it
- Add a German table and a third button.
- Put your own game into the `game` scene and call *Go to layout "menu"* from a pause key.
