import{NordScript}from'nord';
export default class TankObject extends NordScript{
 static attributes={kind:{type:'enum',options:['player','enemy','brick','steel','base'],default:'enemy'},hp:{type:'number',default:1,min:1},speed:{type:'number',default:80,min:0},fireDelay:{type:'number',default:1.6,min:.1},score:{type:'number',default:100}};
}
