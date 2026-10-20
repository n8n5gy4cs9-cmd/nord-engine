// The asset bank: built-ins (textures, wall pieces, entities, models, scripts, weapons) merged with a project's fpsc/bank.json.
// Shared by the runtime and the editor so what you place is exactly what plays.
import { TEXTURES } from './bank/textures.js';
import { PIECES, CELL_PIECES, STAIRS } from './bank/segments.js';
import { ENTITIES, CATEGORIES } from './bank/entities.js';
import { MODELS } from './models.js';
import { WEAPONS } from './weapons.js';
import { BUILTIN_SCRIPTS } from './behaviours/index.js';

const byId = (list) => new Map(list.map((x) => [x.id, x]));

/**
 * custom = parsed <project>/fpsc/bank.json (or {}):
 *   textures [{id,label,cat,size,url,alpha?}]   pieces [{id,label,cat,parts,door?}]   cellPieces [...]   entities [{id,label,cat,extends?,model?,props?,scripts?,…}]
 *   models {id: spec}   weapons {id: def}   sounds {name: url}   scripts ["fpsc/scripts/my-script.js", …]
 * opts.importer(path) → module (for custom scripts); opts.urlOf(path) → URL for custom texture/model files.
 */
export async function createBank(custom = {}, opts = {}) {
  const urlOf = opts.urlOf ?? ((p) => p);
  const warns = [];
  const textures = [...TEXTURES, ...(custom.textures ?? []).map((t) => ({ size: 2, cat: 'wall', label: t.id, ...t, url: t.url ? urlOf(t.url) : t.file ? urlOf(t.file) : undefined, custom: true }))];
  const pieces = [...PIECES, ...(custom.pieces ?? []).map((p) => ({ cat: 'Custom', label: p.id, ...p, custom: true }))];
  const cellPieces = [...CELL_PIECES, ...(custom.cellPieces ?? []).map((p) => ({ label: p.id, ...p, custom: true }))];
  const stairs = [...STAIRS, ...(custom.stairs ?? [])];
  const T = byId(textures), P = byId(pieces), CP = byId(cellPieces), ST = byId(stairs);
  // entities: custom ones may "extends" a built-in or another custom entity
  const entMap = byId(ENTITIES);
  for (const raw of custom.entities ?? []) {
    const base = raw.extends ? entMap.get(raw.extends) : null;
    if (raw.extends && !base) warns.push(`entity "${raw.id}" extends unknown "${raw.extends}"`);
    const def = { cat: 'Custom', color: '#c0c0c0', glyph: '?', ...(base ?? {}), ...raw, props: { ...(base?.props ?? {}), ...(raw.props ?? {}) }, custom: true };
    if (!raw.scripts && base) def.scripts = base.scripts;
    const m = def.model; if (m && typeof m === 'object' && m.url) def.model = { ...m, url: urlOf(m.url) };
    entMap.set(def.id, def);
  }
  const models = { ...MODELS, ...(custom.models ?? {}) };
  const weapons = { ...WEAPONS, ...(custom.weapons ?? {}) };
  const scripts = new Map(BUILTIN_SCRIPTS.map((s) => [s.id, s]));
  const customScripts = [];
  for (const path of custom.scripts ?? []) {
    try {
      if (!opts.importer) { warns.push(`custom script ${path}: no importer available`); continue; }
      const mod = await opts.importer(path); const s = mod.default ?? mod;
      if (!s?.id) { warns.push(`custom script ${path}: needs "export default { id: '…', … }"`); continue; }
      s.custom = true; s.file = path; scripts.set(s.id, s); customScripts.push(s);
    } catch (e) { warns.push(`custom script ${path} failed to load: ${e.message}`); }
  }
  const cats = [...new Set([...CATEGORIES, ...[...entMap.values()].map((e) => e.cat)])];
  return {
    warns, sounds: Object.fromEntries(Object.entries(custom.sounds ?? {}).map(([k, v]) => [k, urlOf(v)])),
    textures, pieces, cellPieces, stairs, entities: [...entMap.values()], scripts: [...scripts.values()], categories: cats,
    texture: (id) => T.get(id) ?? null, piece: (id) => P.get(id) ?? null, cellPiece: (id) => CP.get(id) ?? null, stair: (id) => ST.get(id) ?? null,
    entity: (id) => entMap.get(id) ?? null, model: (id) => models[id] ?? null, weapon: (id) => weapons[id] ?? null, script: (id) => scripts.get(id) ?? null,
  };
}

/**
 * The scripts that run on an entity: the bank definition's default scripts, overridden/extended by the level entity's own `scripts` list.
 * level entity script entry: { id, params?, off?:true (keep but disabled), remove?:true (drop a default script) }
 */
export function resolveScripts(def, data, bank = null) {
  const out = new Map();
  for (const s of def?.scripts ?? []) out.set(s.id, { id: s.id, params: { ...(s.params ?? {}) } });
  for (const s of data?.scripts ?? []) {
    if (s.remove) { out.delete(s.id); continue; }
    const prev = out.get(s.id);
    out.set(s.id, { id: s.id, params: { ...(prev?.params ?? {}), ...(s.params ?? {}) }, off: s.off });
  }
  void bank;
  return [...out.values()];
}
