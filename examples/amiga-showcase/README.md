# Amiga Arcade — Art in Motion

One automatic offline demo: side-scroller chase, top-down patrol, overhead football and pseudo-3D racing, plus the complete animated asset gallery. Scenes change every 18 seconds. Buttons/1–5 select scenes; A toggles auto tour, Space pauses. Touch buttons work too. No external dependencies.

Run `nord serve examples/amiga-showcase` or open this example from the editor. Authoritative code: tools/examples/amiga-showcase/. Artwork: assets/packs/nord-amiga/. Regenerate with `python3 tools/art/amiga/pack.py` then `node tools/gen_examples.mjs amiga-showcase`.

This is an attract-mode art demonstration, not four complete playable games. Soccer uses true overhead players with four directional running cycles; blue-team colours are tinted at draw time. All sheets appear in the gallery.

Crowelian 2026 + Sonnet. Original art/code MIT.
