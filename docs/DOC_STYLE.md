# How to write Nord docs (for people and for AI)

Nord's pages are written like the Unity manual: **clear, exact, in the order you do things, with an editor path for every step and a check at the end.** These rules are not suggestions. Follow them for every tutorial, example page and manual chapter. `node tools/lint-docs-style.mjs` checks the mechanical ones; CI and reviewers check the rest.

## The always-rules

1. **Every code block says which file it belongs to.** On the line directly above each fence write the file in bold with its path, and what to do with it:
   * `**File: `scripts/hero.js`** (new file, the whole file)`
   * `**File: `scripts/level.js`** (add this method inside `class Level`, **after** `Start()` and **before** `OnDestroy()`)`
   * `**File: `nord.project.json`** (replace the `display` block)`
   * `**Terminal** (in the project folder):` for shell commands, and `**Console output:**` for what you should see.
   A reader must never have to guess where a snippet goes. If a snippet is not a file (a one-line example of an API call), say so: `**Example** (not a file, just the call):`.
2. **Say what is already there and what comes next.** For code that grows over several steps, write where the new part goes relative to existing code ("after the `Update()` method", "replace the line `speed = 5`", "above the `import` lines"). Prefer showing the **complete file once at the end of the section** so the reader can compare. For a change inside an existing file, show the changed lines with 2 to 3 lines of unchanged context and mark the added lines with a comment `// new`.
3. **Editor first, then the file.** Anything the editor can do is explained **as editor steps first** (exact panel, menu or field names, written with the `@ui[Name]` macro, for example `@ui[Hierarchy ▸ Create ▸ Sprite]`, `@ui[Inspector ▸ + Add script]`), **then** the same result is shown as JSON or code under the heading or label **In the file** (`**In the file** `nord.project.json``) so the reader can check it or edit it as text. Never show only JSON for something the editor does. Never show only editor clicks for something the reader must also type.
4. **One step, one result.** After each step say what the reader sees now ("The Game view shows a blue square"). The last section of a page is **Check yourself**: a short list of things to look at, and what to check when it does not work.
5. **Tables for options.** Every Inspector field, function parameter or setting: name, type, default, effect.
6. **Runnable examples.** Every code block must run as written when pasted into the file named above. Run it (tests, example projects) before documenting it. Screenshots come from real runs (`docs/screenshots/<page>-*.png`, and the manual build copies only names with an allowed prefix: see `tools/build-manual.mjs`).
7. **Do not invent names.** Menu paths, panel names, field labels and API names must exist. Look them up in the editor source (`crates/nord-editor`), `runtime/` and the manuals. When unsure, say "the field called X" only after checking.
8. **Traps get a callout.** Anything that cost you time (an API that returns a Promise, a name that is reserved, y pointing down) goes into a `> **Trap:** …` block next to the code that triggers it.
9. **Link, do not repeat.** Link the page that explains a concept; keep each page about one thing. End with `Next:` and `Back to:` links.
10. **Unity-style pages use Unity names.** Show the Unity C# for orientation only where it helps (`Goal / Unity (C#) / Nord`), and keep the Nord code in the Unity style (`MonoBehaviour`, `Update`, `Input.GetAxis`, `Instantiate`, …). Native `NordScript` code belongs on pages that say so.

## Page shape (Unity manual style)

1. **Title** and a one-sentence summary in the front matter.
2. **What you will do / learn**, and what the result looks like (screenshot or description).
3. **Before you start** (project to open, download, prerequisites).
4. **Steps**, each: editor action, result, file label + code, expected result.
5. **How it works**: only what the reader needs to modify the result.
6. **Reference** tables if the page documents settings.
7. **Check yourself** and **Next**.

## Writing a code step (template)

```
### 3 Make the hero move

1. In the **Hierarchy**, select `Hero`.
2. In the **Inspector**, press **+ Add script**, choose **New script**, name it `hero`.
   The file `scripts/hero.js` is created and attached.
3. Double-click the script to open it and replace everything with:

**File: `scripts/hero.js`** (the whole file)
​```js
…
​```

Press **Play**. The square now moves with WASD.

**In the file** `scenes/main.scene.json`, the `Hero` entity now contains:
​```json
"scripts": [ { "path": "scripts/hero.js", "attributes": { "speed": 160 } } ]
​```
```

## Before you finish a page

* Every code fence has its **File:** / **Terminal** / **Example** label.
* Every setting has editor steps with `@ui[…]` names, then the JSON/file view.
* Every step ends with what you see.
* Code ran. Screenshots exist and are copied by the manual build.
* Links resolve: `node tools/build-manual.mjs --check`.
* `node tools/lint-docs-style.mjs` has no new warnings for the page.
