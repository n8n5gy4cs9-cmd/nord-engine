// @nord {"id":"gameplay.crafting","title":"Crafting & shop","category":"gameplay","tier":["2d","3d"],"tags":["crafting","shop","recipes"],"requires":["gameplay.inventory"],"description":"Recipes {out,n,needs:{id:n}} crafted from an Inventory script on the same entity: craft(recipeId). Shop mode: buy(itemId) spends the 'coin' item. Emits 'crafted'/'bought'."}
import { NordScript } from 'nord';

export default class Crafting extends NordScript {
  static attributes = { recipes: { type: 'array', default: [], label: '[{id,out:{id,name},n,needs:{itemId:count}}]' }, currency: { type: 'string', default: 'coin' }, prices: { type: 'string', default: '{}', label: 'JSON {itemId: price}' } };
  get inv() { return this.entity.scripts.find((s) => s.add && s.remove && s.count); }
  canCraft(id) { const r = this.attrs.recipes.find((x) => x.id === id); return !!r && Object.entries(r.needs).every(([k, n]) => this.inv.has(k, n)); }
  craft(id) {
    if (!this.canCraft(id)) return false; const r = this.attrs.recipes.find((x) => x.id === id);
    for (const [k, n] of Object.entries(r.needs)) this.inv.remove(k, n);
    this.inv.add(r.out, r.n ?? 1); this.events.emit('crafted', r); return true;
  }
  buy(item) {
    const price = JSON.parse(this.attrs.prices)[item.id]; if (price == null || !this.inv.remove(this.attrs.currency, price)) return false;
    this.inv.add(item, 1); this.events.emit('bought', item); return true;
  }
}
