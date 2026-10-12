
## Attribute types {#attribute-types}
Used by script `static attributes` and component schemas (the inspector draws a widget for each).

| Type | JSON value | Options |
|---|---|---|
| `number` | float | `min`, `max`, `step`, `default`, `label` |
| `int` | integer | `min`, `max` |
| `bool` | true/false | |
| `string` | text | |
| `color` | `"#rrggbb"` (3–8 hex digits accepted) | |
| `vec2` / `vec3` | `[x, y]` / `[x, y, z]` | |
| `enum` | one of `options` | `options: [...]` (script attributes) |
| `entity` | entity name or id | |
| `asset` | project-relative path | `assetType`: `image` `audio` `model` `json` `prefab` |
| `curve` | list of `[t, value]` points | |
| `array` | list of values | element type |

Invalid values fall back to the default with a console warning; numbers are clamped to `min`/`max`; unknown attribute names warn.
