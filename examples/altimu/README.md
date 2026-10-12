# Altimu 5.7

A one-area proof of concept of **an Ultima V game set in Ultima VII's Trinsic**: modern hand-pixelled sprites, Ultima V rules.
You play the Avatar in **Trinsic and its surrounding forest**. Two citizens (Christopher the smith and Inamo the gargoyle) lie murdered in the stables —
talk to the town, search the stables, recruit companions, track the killers to their forest camp, and bring proof to Mayor Finnigan. One level, a few hours of
play per minute of reading: about 15 minutes.

**Controls** — arrows / WASD move · **T** talk · **L** look · **E** examine/search · **G** get/open · **H** herb · **I** party · **J** journal · Space wait.
Bump into people to talk, doors to open them, chests to loot. In conversation, *type a word* and press Enter (only the first 4 letters count; Tab cycles the
words you have learned); in battle, arrows move/strike, **F** + direction fires a bow/crossbow, Space passes.

**What is Ultima V here**: tile-by-tile steps on a time-of-day clock, a party that walks in a line behind you, typed keyword conversations, hunger and food, a
separate tactical battle screen, companions you meet in town and ask to JOIN.
**What is new**: all art (tiles, people, monsters) is original hand-pixelled 16×16 work, the world is plain text (`assets/maps/trinsic.map`).

**Honesty about "exact"**: the repositories this was cloned from ship *no original game data* (Exult, the Ultima V engine and the U7 decompilation all need
your own copy of the game). The Trinsic map here is a faithful hand-built layout of the town (north gate, stables, mayor, Fellowship hall, harbour, forest road) —
not a tile-for-tile import. `GUIDE.md` explains how to import the real map from your own copy of Ultima VII and how to grow this into the full game.

Code: `scripts/altimu.js` (view/controller/combat) · `scripts/altimu/data.js` (people, dialogue, monsters, quest) · `scripts/altimu/rules.js` (pure rules) ·
`scripts/altimu/mapfile.js` (the `.map` parser). Art: `assets.md`. Credits: Crowelian 2026 + Sonnet; ideas from Ultima V (Origin 1988), Exult and the
Ultima V web engine (`synthwave-pixel/ultima5`) — see `THIRD_PARTY.md` in the engine repository. No Origin/EA art, data or text is included.
