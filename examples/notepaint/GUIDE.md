# notepaint — user guide

1. Open the example in NordEditor, or run `nord serve examples/notepaint` from the engine checkout.
2. Select a document on the left. Rename it at the top. Type on the left page and draw on the right.
3. New document makes a blank note + drawing. Search looks through titles and text. Duplicate copies both; Delete asks before removing both.
4. Drawing tools: pencil, brush, white eraser, connected-colour fill, line, rectangle, ellipse and eyedropper. Choose ink and size; drag with mouse, pen or touch. Shapes preview until release. The eraser paints white; this example has an opaque white canvas.
5. Undo/Redo stores up to 20 drawing snapshots for the current document. Switching documents clears drawing history. Text undo uses the browser's normal textarea history. Cmd/Ctrl+Z outside a text field undoes drawing; Shift+Cmd/Ctrl+Z or Ctrl+Y redoes it.
6. Autosave writes text + PNG to IndexedDB after a short pause. `Saved on this device` means the write completed. If storage is blocked or full, export your work.
7. Export document (or Cmd/Ctrl+S) downloads `.notepaint.json`, containing BOTH note and drawing. TXT and PNG export the separate parts. Import a portable document or text file adds a new document, preserving existing ones. Import a picture replaces the current drawing after confirmation and can be undone.
8. Browser saves belong to the current address/browser profile. Export portable files before moving computers, clearing browser data or changing the serving address.

## Rebuild it
The complete step-by-step manual is `docs/manual/nord/tutorials/tut-t19-notepaint.html`. It gives the folder layout, every source file, explains the data/drawing/app layers, and includes a larger-project organization guide.

Source: `tools/examples/notepaint/`. Regenerate the runnable example with `node tools/gen_examples.mjs notepaint`. Files in `examples/notepaint/` are generated copies.

Crowelian 2026 + Sonnet. App code/art MIT; Inter OFL-1.1. No external requests or account.
