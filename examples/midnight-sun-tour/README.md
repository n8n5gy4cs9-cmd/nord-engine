# Midnight Sun Tour

*Mikko Levon's: Midnight Sun Tour* — a Finnish road-trip adventure, band business and Ruisrock festival manager.
Drive the rusty sauna-bus from Kuusamo to Turku in 1991. Manage fuel, food, morale, gigs, merchandise and
repairs on the road, then take over the three-day festival: book artists, develop the grounds, hire staff,
set ticket prices and balance the budget. Ruisrock plays the booked artists' recordings automatically;
it contains no rhythm minigames.

The owner's title art is unchanged. The rest of the art and UI use new original Amiga-inspired assets,
including weathered band portraits, map, event cards, vehicles and stage/campsite/harbor environments.
The activities include the rewritten Phone-booth Sprint and Roadside Shootout, regular-timing gigs,
clearer sound checks and two new city jobs, Backstage Express and Harbor Rescue.

Start with `nord serve examples/midnight-sun-tour`, or open it in Nord Editor. Read `GUIDE.md` for
controls and strategy; `ASSETS.md` contains asset paths, audio replacement instructions and ImageGen prompts.
P pauses the game. The private developer reference is `commands.txt`.

Source: `tools/examples/midnight-sun-tour/`. Regenerate with `node tools/gen_examples.mjs midnight-sun-tour`.
Tests: `node tools/midnight-sun-test.mjs [frames] [seed]` and `node tools/midnight-sun-view-test.mjs`.
The original NordScrap modules run through the local canvas/Nord-audio compatibility layer. No new online
runtime dependencies. Crowelian 2026 + Sonnet.
