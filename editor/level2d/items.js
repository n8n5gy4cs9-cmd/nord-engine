// Game item definitions retain the scripts/body/settings of the project's working objects.
import { clone, uid } from './model.js';
function signature(e){const kind=e.scripts?.find(s=>s.attributes?.kind)?.attributes.kind;return JSON.stringify([e.asset,e.body,e.trigger,kind??e.scripts,e.tags]);}
export function itemBank(level){
  const out=clone(level.items??[]),seen=new Set(out.map(i=>signature(i.entity)));
  for(const e of level.entities??[]){const key=signature(e);if(seen.has(key))continue;seen.add(key);const kind=e.scripts?.find(s=>s.attributes?.kind)?.attributes.kind;
    const title=(kind&& !['score','heal','custom'].includes(kind)?kind:e.name).replace(/\s+\d+(?:,\d+)?$/,'');
    out.push({id:'item-'+out.length,title:title.charAt(0).toUpperCase()+title.slice(1),entity:clone(e)});
  }return out;
}
export function instantiateItem(level,item,x,y,layer){const e=clone(item.entity);Object.assign(e,{id:uid(),x,y,layer});level.entities.push(e);return e;}
