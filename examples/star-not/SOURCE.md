# Star-Not source attribution

Requested upstream: `0xDEC0DE/sc2-uqm`, branch `uqm-ee`, cloned into ignored `third_party/sc2-uqm/`.
Commit: **d0f959d013b52c275f27d944039073d066dc8c93**.

`sc2/src/uqm/ship.c`, `inertial_thrust()`'s normal-acceleration branch was studied/adapted into `scripts/sn/flight.js`: add forward thrust to velocity, compare squared speed against a maximum, and cap speed. The original code uses fixed-point units/ticks and more branches; this small floating-point version uses seconds and omits gravity slingshots. Arena wrapping and shortest-angle steering are simplified for this original small game. Original copyrights: Paul Reiche and Fred Ford 1992–2002; UQM code GPL-2.0-or-later. The complete original COPYING notice is retained.

The campaign, solar chart, dialogue, race names/designs, co-op support and UI are original Nord example code, distributed with the GPL-2.0-or-later game. © Crowelian 2026 + Sonnet. No original Star Control/UQM story, graphics, voices or music were copied. The original upstream content licence listed in COPYING describes upstream content only; **all Star-Not art/audio are new MIT-licensed assets**, with prompts/inventory in ART_DIRECTION.md/assets.md. Inter remains OFL-1.1.
