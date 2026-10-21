// GPL-3.0-or-later — see LICENSE.md and SOURCE.md in this example.
import {NordScript} from 'nord';
export default class DungeonObject extends NordScript{
 static attributes={kind:{type:'enum',options:['hero','rat','guard','potion','gold','key','door','stairs','relic','trap'],default:'rat'},hp:{type:'number',default:8,min:1},accuracy:{type:'number',default:8},defense:{type:'number',default:2},damageMin:{type:'number',default:1},damageMax:{type:'number',default:4},armor:{type:'number',default:1},value:{type:'number',default:1},next:{type:'string',default:'scenes/floor2.scene.json'}};
}
