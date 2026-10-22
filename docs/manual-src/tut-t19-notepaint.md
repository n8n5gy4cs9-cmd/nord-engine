---
title: T19 Build notepaint, from a blank folder
section: Tutorials
order: 19
summary: Recreate a complete notes-and-paint app, with every file, autosave, drawing tools and portable documents.
---
**Result:** a working notepad and paint app in one window. Each document keeps its words and picture together. You can create, search, rename, duplicate, delete, import and export documents. Drawing includes eight tools and undo/redo.

**Already-built example:** `examples/notepaint/`. The editable engine source is `tools/examples/notepaint/`; the example folder is generated from it. For this lesson, make your own folder so you can edit freely. You need the `nord` CLI and a current engine checkout for the reusable artwork.

::: dummies
HTML makes the page. CSS makes it look good. JavaScript handles buttons, drawing and saving. Nord's **HTML tier** serves and exports those files; this app does not need Phaser, Babylon or a game scene.
:::

## 1. Decide what a finished app means
Write a short plan before coding:

> A document has a title, plain text and one picture. The app must keep them together, save locally, and let the user take a portable copy away. A person should be able to understand the screen without reading source code.

That gives you three small pieces: storage, drawing and the interface. Keep them separate because they change for different reasons. Do not add accounts, networking, rich text or layers to this first version.

## 2. Make the project folder
Create a folder called `my-notepaint`. Inside it make this structure:

```text
my-notepaint/
  nord.project.json
  index.html
  app.js
  store.js
  drawing.js
  style.css
  _kit.js
  assets/
    ui/tools.png
    ui/tools.png.meta.json
    fonts/inter.woff2
    fonts/LICENSE
```

The four JavaScript files are code. The CSS file is appearance. The assets folder holds files that can be reused or replaced. Keep filenames and capitals exactly the same as the imports below.

For a larger app, see [Plan a larger Nord project](tut-t21-project-design.html). This small app deliberately keeps its files close together.

## 3. Add the Nord project settings
Create `nord.project.json`. Copy this complete file. `type: "html"` selects plain HTML; the empty startScene is intentional because the app has no game scene.

::: example-code examples/notepaint/nord.project.json json

## 4. Add the page that starts the app
Create `index.html`. This page gives the app a root element, imports `mount()` from app.js, and calls it. `mount` means “put this application inside that element.”

::: example-code examples/notepaint/index.html html

Do not add CDN scripts. Everything this application needs stays in its own folder.

## 5. Copy the reusable artwork and font
From the engine checkout, copy these files into your own folder:

| Copy from | Paste to |
|---|---|
| `examples/notepaint/assets/ui/tools.png` | `my-notepaint/assets/ui/tools.png` |
| `examples/notepaint/assets/ui/tools.png.meta.json` | Same name inside your UI folder |
| `examples/notepaint/assets/fonts/inter.woff2` | Your fonts folder |
| `examples/notepaint/assets/fonts/LICENSE` | Your fonts folder; keep the licence |

You can use a file manager; no image editor is required. The picture contains sixteen separate UI symbols. The app selects a symbol by its row and column, rather than downloading sixteen files.

<figure class="shot"><img src="assets/tutorials/notepaint-tools.png" alt="Notepaint's original 4 by 4 sheet of paper, drawing, undo and file icons" loading="lazy"><figcaption>Reusable UI sprites: examples/notepaint/assets/ui/tools.png. These are source assets, not a screenshot of the finished application.</figcaption></figure>

Read `examples/notepaint/assets.md` for the numbered inventory; `ART_DIRECTION.md` records the exact built-in ImageGen prompt. The original art is MIT; Inter is OFL-1.1.

## 6. Add the small DOM helper
Create `_kit.js` using the code below, or copy `examples/notepaint/_kit.js`. This reuses Nord's existing app helper. The function `h(tag, properties, children...)` creates elements. Text children become text, so document titles and notes are not treated as HTML.

Only `h` is imported by this app. The other functions belong to the shared engine kit and do not change this app's layout.

::: example-code examples/notepaint/_kit.js javascript

## 7. Design one document
Each document has these values:

| Value | Why it exists |
|---|---|
| id | A unique name the database uses internally. Two documents can have the same visible title. |
| title | The visible name on the left and above the editors. |
| text | The plain text from the textarea. |
| image | A PNG stored as a data URL: the picture bytes travel with the document. |
| updatedAt | A timestamp for ordering recently edited documents. |

IndexedDB is a browser database. It can hold larger pictures more comfortably than putting every PNG into a tiny localStorage string. It still belongs to this browser and address, so portable export remains necessary.

## 8. Create store.js
Paste the complete file. `openNotebook()` opens the database, creates a documents store the first time, and gives the app all/put/remove operations.

A **transaction** is one database operation that either finishes or fails. Saving reports success only after the transaction finishes, not merely after requesting a write. `readDocument` checks a portable import before accepting it. `download` creates a local download and releases its temporary URL afterwards.

::: example-code examples/notepaint/store.js javascript

## 9. Understand the drawing canvas
The drawing has a fixed **960×640** working area. CSS can display it smaller. Pointer coordinates therefore need converting from screen pixels into canvas pixels:

```javascript
const x = (event.clientX - rect.left) * canvas.width / rect.width;
const y = (event.clientY - rect.top) * canvas.height / rect.height;
```

Without this conversion, the brush would draw in the wrong place whenever the window shrinks. Pointer events support a mouse, touchscreen and pen with the same handlers.

## 10. Add drawing.js
Paste the complete file. Read it in these groups:

1. **Settings:** the chosen tool, ink and brush size.
2. **Snapshots:** undo saves the canvas before a complete action. Redo holds the image that undo replaced. History is capped at twenty pictures.
3. **Freehand tools:** pencil/brush/eraser draw short segments as the pointer moves. Eraser draws white because this app uses an opaque white page.
4. **Shapes:** line/rectangle/ellipse restore the before-picture each move, then draw one fresh preview. This avoids leaving a trail of rectangles.
5. **Fill:** walk connected pixels of exactly the starting colour, changing each once. A typed-array queue avoids recursive calls that could overflow.
6. **Load:** decode a picture, preserve its shape, centre it and fit it within the page. A revision number stops an old image load from replacing a newer document.
7. **Cleanup:** remove pointer listeners when the app closes.

::: example-code examples/notepaint/drawing.js javascript

::: dummies
A snapshot is a copy of the picture before your brush stroke. Undo puts that copy back. This is easy to understand, but it uses memory, so this small app limits its history instead of keeping every brush movement forever.
:::

## 11. Add style.css
Paste the complete stylesheet. The main layout has a notebook list and a workspace. Inside the workspace, the note and picture sit beside each other on a wide window and stack on a smaller window.

The white paper, gentle green controls and coral/mint sprites give the app one consistent look. Buttons have text or accessible labels. The textarea allows text selection. The drawing canvas disables browser touch scrolling only inside the canvas.

The `.np-sprite` rule displays a 4×4 atlas with `background-size: 400% 400%`. `icon(index)` chooses the position. This lets you reuse the PNG without editing or cropping it.

::: example-code examples/notepaint/style.css css

## 12. Connect the app in app.js
Paste this complete file. Its flow is:

1. Create the visible elements and the drawing controller.
2. Open storage and load existing documents. If browser storage is blocked, keep the current session usable and explain that export is required.
3. Select a document: finish saving the previous one, load both text and picture, then re-enable the workspace.
4. On a text edit or completed drawing action, schedule autosave after a short pause. A save queue preserves the order of database writes.
5. Build the sidebar from document data. Search looks through title and text; it does not delete hidden results.
6. Wire the buttons to new/duplicate/delete, drawing tools and import/export.
7. Add shortcuts and remove listeners when the app is destroyed.

::: example-code examples/notepaint/app.js javascript

## 13. Understand import and export
**Export document** writes one `.notepaint.json` file. It contains the title, text and PNG. Importing that file creates a new document instead of replacing another one by accident.

**TXT** exports the note. **PNG** exports the picture. Importing a text file adds a new note. Importing an image asks before replacing the active drawing, and the image replacement can be undone.

An export is a real portable backup. “Saved on this device” is a local browser save. Explain the distinction in your own apps too.

## 14. Open your app
From the directory containing your project:

```bash
nord serve my-notepaint
```

Open the local address the command prints. Leave the terminal running while you edit. This serves local files; it does not upload your notebook anywhere.

You should see a notebook list, a note page, drawing tools and a white drawing page. If an icon is missing, check the PNG path. If an import fails, the app displays the reason. If the whole page cannot start, read the browser Console for the first missing file or syntax error.

## 15. Export the finished app
When you choose to share it, use the editor's Export or:

```bash
nord export my-notepaint --target html
```

Keep your editable folder separately. Share the complete exported folder. Browser storage at a new address starts as a separate notebook, so import your portable document files there.

## 16. Grow it carefully
Add one useful feature at a time: an image-size selector, a simple brush preset or an “export all documents” command. First write down what the user should see and what must happen to their existing data.

For a bigger project, [the next design guide](tut-t21-project-design.html) shows an actual folder plan and how to divide a game into small responsibilities. The same approach works for this app: data rules in one place, storage in one place, and the screen in one place.
