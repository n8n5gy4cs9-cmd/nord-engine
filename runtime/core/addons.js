// Addon loader (M10-27). A project lists addons in nord.project.json:  "addons": ["addons/dice"]
// Each folder has addon.json { id, name, version, type: plugin|behavior|effect|mixed, main: "addon.js" } and an ES module exporting
//   export function register(nord) { nord.registerPlugin('Dice', { expressions: { Roll: (r, a) => … } }); }
// `nord` = { registerPlugin, registerObjectAces, registerBehavior, Behavior, registerDataType, registerEffect, registerComponent, game, version }.
// A broken addon is reported (game.reportError) and skipped; it never stops the game from starting.
import { registerPlugin, registerObjectAces } from './eventsheet/aces.js';
import { registerBehavior, Behavior } from './behaviors/index.js';
import { registerDataType } from './eventsheet/objects.js';
import { registerEffect } from './effects.js';
import { registerComponent } from './entity.js';

export async function loadAddons(game) {
  const list = game.project.addons ?? [];
  game.addons = [];
  for (const dir of list) {
    try {
      const meta = await game.loadJSON(`${dir}/addon.json`);
      const mod = await game.importScript(`${dir}/${meta.main ?? 'addon.js'}`);
      const nord = { registerPlugin, registerObjectAces, registerBehavior, Behavior, registerDataType, registerEffect, registerComponent, game, version: 1 };
      await (mod.register ?? mod.default)?.(nord);
      game.addons.push({ dir, ...meta });
    } catch (err) { game.reportError(err, { constructor: { name: `addon ${dir}` } }, 'register'); }
  }
}
