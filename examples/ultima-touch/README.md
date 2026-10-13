# Ultima-ish (keyboard-only RPG + touch controls) — proof of concept
A tiny Ultima I-style game in one `index.html`: procedural overworld (grass/forest/mountains/water), a castle quest (slay 8 monsters), 4 towns with a shop (food, weapons, healing), 4 dungeons with chests and tougher monsters, HP/food/gold/exp/levels, wandering monsters, thieves, starvation. Bump into monsters to attack.

The game only reads the **keyboard** (arrows/WASD move, **Enter** act/enter/confirm, **Space** wait, **Esc** back). The last line of the page adds phone/tablet controls with `nord-touch.js` — that is the whole integration:
```html
<script src="nord-touch.js" data-dpad="dpad" data-keys="ArrowUp,ArrowLeft,ArrowDown,ArrowRight" data-buttons="Enter:Act,Space:Wait,Escape:Back"></script>
```
Open it on a phone, or with `?touch=1` on a desktop. Original code; the genre/structure only is borrowed from Ultima I (1981). Not a faithful clone: no spells/ships/space, no real quests beyond the first.
