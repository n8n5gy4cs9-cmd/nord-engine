# Localisation and accessibility (M10-30)
Runtime: `runtime/core/i18n.js` (`game.i18n`, `game.a11y`). Tests: `core.test.mjs`.

## String tables
`nord.project.json`: `"strings": { "en": { "play": "Play", "hello": "Hi {name}" }, "fi": { "play": "Pelaa" } }` or `"strings": "strings.json"` (a file with the same shape), `"defaultLanguage": "en"`, optional `"language"`.
- Start language: saved choice → `project.language` → browser language (if a table exists) → default language.
- `game.i18n.t(key, {name})` — missing key falls back to the default language, then to the key itself. `setLanguage('fi')` saves the choice and emits `language`.
- Any component with `"textKey": "play"` (text, uiLabel, uiButton…) gets its `text` from the table and updates live when the language changes.
- Event sheets: `Localisation → Set language`, condition `Language is`, expressions `Localisation.Text("hello", "Ada")` (`{0}`, `{1}` placeholders) and `Localisation.Language`.

## Accessibility
- `game.a11y.setColorBlind('protanopia'|'deuteranopia'|'tritanopia'|'achromatopsia'|'none')` — preview filter (SVG colour matrix on the stage; for testing your palette, not a player setting by itself). Event sheet: `Accessibility → Set colour-blind mode`.
- `game.a11y.setUiScale(1.5)` — CSS variable `--nord-ui-scale` + `game.ui.setScale` if the UI supports it. Event sheet: `Set UI scale`.
- Touch controls: `virtualJoystick(...)` (input.js) and the `Touch` plugin (On tap).
- Not done: right-to-left layout, font fallback per language, an editor panel for editing string tables (edit the JSON), screen-reader labels.
