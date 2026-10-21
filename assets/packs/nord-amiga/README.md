# Nord Amiga collection

Original mature Amiga-inspired pixel art. **Crowelian 2026 + Sonnet**. MIT, same as the repository.
Generated with built-in ImageGen; packed offline with Pillow. No pixels from the reference games or Kenney packs are shipped.

23 PNG sheets, 284 frame cells (including alternate size versions): human adventurer, woman and guard run cycles;
adventurer combat/jump poses; investigator directional walks; officer walk; industrial/outdoor platform tiles;
top-down terrain/architecture and props; tiny overhead football players with four 4-frame running cycles;
other sports poses and equipment; sports grounds; UI and touch controls; rear-view steering cars, overhead vehicles,
roadside scenery and four backgrounds.

Open **Amiga Arcade — Art in Motion** in the editor's Examples browser (`examples/amiga-showcase`),
or serve it with `nord serve examples/amiga-showcase`. It runs an automatic platformer/patrol/soccer/racer tour.
Press 5 for the complete automatically paged asset gallery, 1–4 for scenes, A for auto tour, Space to pause.
This is an animated attract-mode demonstration, not complete playable sports/racing games.

## Use in a project

Copy the required PNGs **and their `.png.meta.json` sidecars** into your project's `assets/` folder.
`catalog.json` lists frame sizes, columns, names and animation frame arrays. Filter: nearest. Rows are indexed left-to-right.
Use `frameWidth`/`frameHeight` for spritesheet import and choose the named animation for animatedSprite.
Sidecar animation arrays contain explicit indices, not a start/end range. Props are independent frames, not animations.
Use horizontal flipping for the reverse side-scroller direction and the investigator's westward walk.
Football uses its own overhead north/east/south/west cycles. The demo tints the red team blue at draw time.
The legacy `sports-side-actions` sheet now contains the simple guard/woman cycles; it is not used for overhead football.

## Size conventions

| Sheets | Frame size | Reference convention |
|---|---|---|
| Platform terrain | 70×70, 128×128, 16×16 | extended/industrial, remastered, tiny dungeon |
| Side-scroller runs | 48×64; alternate 128×256 | compact original; remastered character canvas |
| Investigator/officer | 32×48 | original human proportions |
| Soccer overhead | 21×31 | sports player canvas |
| Top-down terrain, props, equipment, vehicles, UI | 64×64 | shooter/sports/UI base grid |
| Racing rear-view cars | 64×40 | original wide car canvas |
| Roadside scenery | 64×96 | original tall scenery canvas |
| Backgrounds | 320×180 | engine's background convention |

This is a curated original collection inspired by the roles in `TEMP/ART`, not a filename-for-filename replacement
of the thousands of duplicate Kenney/controller-prompt assets. UI art is packed into uniform cells; nine-slice margins
must be selected for the individual cropped panel. Tile edge continuity and animation timing may need hand-polishing.

## Sources / rebuilding

Masters: `tools/art/amiga/sources/`; prompts: `tools/art/amiga/prompts.json` and `side-characters-prompt.txt`; current replacements use `revision-prompts.json`.
`python3 tools/art/amiga/pack.py` crops reviewed rectangles, uses binary alpha for cutouts, nearest resizing,
6–16-colour ramps per frame, consistent scale within each character strip and generates metadata/catalogue.
Then `node tools/gen_examples.mjs amiga-showcase` copies the collection into the standalone example.
Keep masters: generated cell grids are not always exact, so crop boundaries are deliberately recorded in the packer.
The mixed top-down master contains a painted checkerboard behind props; those cells are unused and replaced by `props.png`.
The attached Amiga screenshots were visual direction only; no trademarks or existing game characters were reproduced.

Later editor integration is tracked as M12-21 and M12-22: a 2D equivalent of FPS Level plus a bundled bank using this catalogue.
No new editor panel is implemented by this art task. Owner requested no tests or runtime/browser runs for this change.

## Reference simplification (M6-50)
The current humans use flat colour blocks with four-step runs at 7 fps. Soccer keeps 21×31 source-compatible cells, but each player is only 8×12 pixels inside that canvas, matching the tiny reference figures. Side-scroller art is drawn on a 24×32 working grid, top-down people on 16×24. Rear racing cars have exactly left/back/right poses plus a separately drawn front view, red and white variants; there is no steering animation in their sidecars. The demo selects a pose from bend direction, rather than cycling through angles, and uses a jump pose in the air. Animation strips share crop/scale so individual frames are not resized independently. Character and vehicle masters were redrawn with the supplied soccer, IK+ and Lotus screenshots as direct ImageGen references. Older masters remain as provenance and are unused for the replaced characters/cars. No tests, browser runs, engine builds or manual builds were performed.
