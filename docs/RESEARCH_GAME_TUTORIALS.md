# Source research for the complete game tutorials

Research date: 2026-10-21. Credit for the original Nord tutorial implementations: **Crowelian 2026 + Sonnet**.

This report records actual source inspection, not just README descriptions. All links pin the inspected revision. The repositories are study references; no source, ROM data, graphics, models, music, or sound from them is included in Nord's tutorial projects. Recommendations below are original design conclusions, distinguished from observed upstream behavior.

## Pinned source inventory and boundaries

| Reference | Inspected revision | Observed licensing / distribution boundary |
| --- | --- | --- |
| Kirpich | `a6e2df3b8c75a8dbd1c4ae0c82ea481dd51ec2b0` | AGPL v3; the project obtains cartridge graphics and audio from the user's own ROM. [License](https://github.com/etroimcasso/Kirpich/blob/a6e2df3b8c75a8dbd1c4ae0c82ea481dd51ec2b0/LICENSE), [asset policy](https://github.com/etroimcasso/Kirpich/blob/a6e2df3b8c75a8dbd1c4ae0c82ea481dd51ec2b0/README.md#content-and-licensing-posture) |
| TengenTetrisDisasm | `df38b4ff812bc57c1fa356665aa3b1439620b337` | Its LICENSE contains a warranty/liability disclaimer only; it does not contain the usual affirmative permission grant. Its disassembly workflow requires `clean.nes`. Treat it as reference-only, without assuming permission to redistribute its code or art. [License](https://github.com/zohassadar/TengenTetrisDisasm/blob/df38b4ff812bc57c1fa356665aa3b1439620b337/LICENSE), [build instructions](https://github.com/zohassadar/TengenTetrisDisasm/blob/df38b4ff812bc57c1fa356665aa3b1439620b337/README.md) |
| OutRun | `6882721c99bc79365f815f68d389bf5078129e68` | GPL v3. Nord uses its own implementation and existing original Amiga-style sprites. [License](https://github.com/ZgzInfinity/OutRun/blob/6882721c99bc79365f815f68d389bf5078129e68/LICENSE) |
| StarFoxSNESRecomp | `1b6b0598ef8d93030a723eaa595d8a478a658ed3` | PolyForm Noncommercial 1.0.0. Its README explicitly excludes ROM and ROM-derived generated code from distribution. Nord's shooter is an original game, not a recompilation or ROM loader. [License](https://github.com/mstan/StarFoxSNESRecomp/blob/1b6b0598ef8d93030a723eaa595d8a478a658ed3/LICENSE), [README](https://github.com/mstan/StarFoxSNESRecomp/blob/1b6b0598ef8d93030a723eaa595d8a478a658ed3/README.md) |

Local reference clones are `third_party/kirpich-reference`, `third_party/tengen-reference`, `third_party/outrun-reference`, and `third_party/starfox-reference`. Reading did not require building or executing the cartridge-dependent projects, and no ROM was obtained.

## Kirpich: four occupied cells and explicit round state

### Geometry, collision, and rejected movement

`activePieceCells()` derives exactly four occupied board cells from the active sprite's four parts. `detectCollision()` checks those cells against the board's empty-cell value. Rotation changes the orientation, renders the proposed geometry, tests collision, and restores the previous orientation when blocked. Horizontal movement uses a similar apply/test/revert approach. Input repeat is separate from collision. [piece.cpp, four-cell invariant and collision/rotation](https://github.com/etroimcasso/Kirpich/blob/a6e2df3b8c75a8dbd1c4ae0c82ea481dd51ec2b0/src/systems/piece.cpp#L68-L164)

**Nord lesson:** represent the active shape as four integer offsets and test a candidate `(x, y, rotation)` before committing it. Four sprite children are a useful view of those cells, but visual entity positions must not be the authoritative grid. An ordinary `this.entity.pos.y += dropSpeed` animation alone cannot handle discrete locking, row clearing, or top-out.

### Gravity, lock, scan, compact, score

The main gameplay function has a deliberate order: rotate/shift, drop, check rows, lock, compact, score. Its row scan is guarded by lock stage 2; locking stage 1 becomes stage 2 later in that frame, so scanning that lock happens on the following update. The board and displayed tile map are written separately at lock. This is an important state-machine detail rather than a recipe to blindly copy the visible call order. [gameplay.cpp](https://github.com/etroimcasso/Kirpich/blob/a6e2df3b8c75a8dbd1c4ae0c82ea481dd51ec2b0/src/systems/gameplay.cpp#L305-L338), [lockPieceIntoBackground](https://github.com/etroimcasso/Kirpich/blob/a6e2df3b8c75a8dbd1c4ae0c82ea481dd51ec2b0/src/systems/piece.cpp#L268-L297)

The clear system scans each eligible row's ten cells, records at most four full rows, then runs a timed flashing/wipe process. Its compaction intentionally reproduces a cartridge quirk: clearing several rows can leave copies of the old top row because row zero is cleared only once after all shifts. [row detection](https://github.com/etroimcasso/Kirpich/blob/a6e2df3b8c75a8dbd1c4ae0c82ea481dd51ec2b0/src/systems/line_clear.cpp#L113-L163), [compaction](https://github.com/etroimcasso/Kirpich/blob/a6e2df3b8c75a8dbd1c4ae0c82ea481dd51ec2b0/src/systems/line_clear.cpp#L245-L276)

**Nord lesson:** use a simpler original lock transaction: write four cells; filter full rows; prepend the same number of empty rows; award score; deliver pending attacks at a safe boundary; spawn; test top-out. Preserve survivor order and avoid copying the historic top-row quirk. Optional clear animation should delay the next spawn rather than repeatedly award the same rows. Test two adjacent clears, a blocked spawn, and repeated restart.

### Piece selection and multiplayer limits

`nextPiece()` promotes the preview, then selects another piece. Its single-player random path retries candidates up to three times with a bitwise rejection rule; its demo/multiplayer path walks a shared indexed piece list. These are not a modern seven-bag shuffle. [piece pipeline](https://github.com/etroimcasso/Kirpich/blob/a6e2df3b8c75a8dbd1c4ae0c82ea481dd51ec2b0/src/systems/piece.cpp#L299-L365)

`multiplayer_state.h` distinguishes outgoing stack/attack/end status, received versus pending garbage, round results, and match wins. Crucially, its own comments say that this file carries state only and describe transport and gameplay systems as future wiring. It is evidence for the protocol's vocabulary, not evidence of a completed browser multiplayer service. [multiplayer state](https://github.com/etroimcasso/Kirpich/blob/a6e2df3b8c75a8dbd1c4ae0c82ea481dd51ec2b0/src/state/multiplayer_state.h#L1-L95)

**Nord lesson:** use an original seeded seven-bag for understandable fairness. A Node battle server should own rooms, participants, attack authorization, disconnect cleanup, and round outcomes. Distinguish received attacks from attacks already applied to a board; never apply one attack again merely because a client polls or reconnects. A casual client-simulated battle is not cheat-proof unless the server also simulates every board.

The source has explicit geometry and collision tests covering four cells, all orientations, empty versus occupied cells, and hidden-piece behavior. This supports testing the pure rule layer without loading a renderer. [piece tests](https://github.com/etroimcasso/Kirpich/blob/a6e2df3b8c75a8dbd1c4ae0c82ea481dd51ec2b0/tests/test_piece_system.cpp#L96-L160)

## Tengen disassembly: packed geometry and distinct player state

`orientationTable` stores four orientations per shape as packed occupancy bits. The preceding helper computes the orientation lookup from shape and rotation, and the collision routine scans occupied bits against a local board buffer. This is a compact NES representation; it is not a requirement for a clear JavaScript tutorial. [orientation table](https://github.com/zohassadar/TengenTetrisDisasm/blob/df38b4ff812bc57c1fa356665aa3b1439620b337/main.asm#L1057-L1125)

The RAM declarations give each player separate Y/X, current/next piece, rotation, and RNG state. `playMode` documents solo, versus, and cooperative modes. [RAM model](https://github.com/zohassadar/TengenTetrisDisasm/blob/df38b4ff812bc57c1fa356665aa3b1439620b337/tetris-ram.asm#L30-L88)

`checkCoopCollision` compares the two active pieces' relative coordinates and shifted occupancy masks when cooperative mode is selected. Comments in the disassembly explicitly mark parts of the routine as needing further exploration, so the code should not be presented as a fully documented design specification. [cooperative collision](https://github.com/zohassadar/TengenTetrisDisasm/blob/df38b4ff812bc57c1fa356665aa3b1439620b337/main.asm#L1826-L1905)

`genNextPseudoRandom` updates a two-byte state through XOR and rotate operations, with wrappers advancing it two, three, or five times. This is a deterministic generator, not cryptographic randomness. [RNG](https://github.com/zohassadar/TengenTetrisDisasm/blob/df38b4ff812bc57c1fa356665aa3b1439620b337/main.asm#L3804-L3847)

**Nord lessons:** keep each player's board and timers independent; define whether a mode means separate boards or shared-board collision; use readable cell arrays rather than transliterating assembly; seed the original generator so tests can replay the same match. The new physics mode should be a separate rule set: a rotating rigid body does not occupy stable grid cells, so classic row-clearing assumptions cannot be applied unchanged. Arcade's nonrotating bodies cannot supply genuine toppling; use a rotating rigid-body engine and explain the different objective.

## OutRun: perspective road and shared traffic

`Line::projection()` subtracts the camera position, computes a reciprocal depth scale, then maps world X/Y and road width to screen coordinates. Sprite rendering reuses depth scale and object offsets. [projection and sprites](https://github.com/ZgzInfinity/OutRun/blob/6882721c99bc79365f815f68d389bf5078129e68/src/Scene/Line/Line.cpp#L74-L139)

`Map::updateCars()` walks traffic, finds each car's road segment, and compares its position with the player's segment and draw distance. Other map logic supplies terrain wheel effects and skidding in strong curves. [traffic](https://github.com/ZgzInfinity/OutRun/blob/6882721c99bc79365f815f68d389bf5078129e68/src/Scene/Map/Map.cpp#L329-L400), [skid conditions](https://github.com/ZgzInfinity/OutRun/blob/6882721c99bc79365f815f68d389bf5078129e68/src/Scene/Map/Map.cpp#L840-L863)

**Nord lesson:** use original perspective math with a positive near plane, far-to-near strips, sprite cropping, and a separate driver state for each split viewport. Advance a shared traffic simulation once per frame, then render it twice. Drawing two views must not double traffic speed or share one driver's timer/input.

## StarFox recompilation: ground points are geometry, shaders are another layer

`starfox_ground_dots.hpp` traverses a 15-by-15 point grid, transforms it with a Q15 camera matrix, rejects shallow depth, projects through a reciprocal, clips screen pixels, and gives near points a second pixel. This is an actual source implementation of a moving ground reference, not a screen-space noise effect. [ground-dot routine](https://github.com/mstan/StarFoxSNESRecomp/blob/1b6b0598ef8d93030a723eaa595d8a478a658ed3/src/starfox_ground_dots.hpp#L1-L49)

The source-seams documentation explains the signed PointEffect flag: positive means ground points, zero means no points, negative means stars. It also explains that the host point pass latches the same camera picture and does not advance guest game state. [ground-dot integration notes](https://github.com/mstan/StarFoxSNESRecomp/blob/1b6b0598ef8d93030a723eaa595d8a478a658ed3/docs/ARWING64_SOURCE_SEAMS.md#L180-L193)

**Nord lesson:** scrolling world-space dots communicate motion and altitude even on an otherwise sparse ground plane. Use original low-poly Blocksmith models and separate combat rules from their Babylon view. Vertex snapping, a small framebuffer, palette quantization, and ordered dithering are deliberate artistic controls in Nord's shader; they are not a claim that the tutorial reproduces either the SNES Super FX hardware or the PS1 GPU. Ground dots should move with the world independently of those shader controls.

## Applying the research to Nord Engine Office

None of these four repositories is an office job multiplayer game or a Node server template. The office design is an original application of the separation seen above: canonical task/player state, input commands, pure update rules, and a visual projection. This is an inference and design recommendation, not an upstream feature claim.

Use a server-owned room with bounded movement commands and authoritative proximity checks. A client requests a task action; the server checks the player's position, role, cooldown, task state, and round status before advancing progress. Intern sabotage and employee repair must mutate the same task records, so two simultaneous completions cannot award the same task twice. A local deterministic AI coworker can select an unfinished job and move toward it under the same movement and proximity rules; label it as a game bot rather than implying a hosted language-model service.

For both Node examples, demonstrate two real browser clients, not only a mocked fetch. Verify joining, visible remote movement, room isolation, duplicate actions, disconnect expiry, and a complete round. Explain which code runs in Nord/browser and which remains on the Node host: exporting a static HTML/WASM game does not deploy its server.


## Reader and sketch app references (2026-10-21)

Paper Worlds is an original small drawing application; Excalidraw is product inspiration and no source/assets were copied. RSS River likewise uses [FreshRSS](https://github.com/FreshRSS/FreshRSS) and [NetNewsWire](https://github.com/Ranchero-Software/NetNewsWire) as product context, not source ports. FreshRSS currently identifies AGPL-3.0 (rather than the prompt's shorthand GPL-3.0); NetNewsWire is MIT.

Default feed endpoints were fetched read-only with a local-origin request header: all returned HTTP 200. HN (`https://hnrss.org/frontpage`) omitted Access-Control-Allow-Origin; Simon Willison (`https://simonwillison.net/atom/everything/`) and GitHub Engineering (`https://github.blog/engineering/feed/`) returned `*`. This is a point-in-time observation, not an availability guarantee. Primary feed references: [hnrss feed documentation](https://hnrss.github.io/), [Simon Willison feed inventory](https://feeds.simonwillison.net/about/), [GitHub engineering feed](https://github.blog/engineering/feed/). The implementation deliberately supports XML import and Nord's existing host HTTP bridge instead of silently requiring a public CORS proxy. No article bodies were stored in the repository during the endpoint check.
