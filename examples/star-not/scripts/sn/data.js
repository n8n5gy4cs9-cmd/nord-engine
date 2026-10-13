// Original solar-system campaign data. Map positions are a readable diagram, not astronomical scale.
export const WIDTH = 1024, HEIGHT = 720, ARENA = { left: 28, top: 100, right: 696, bottom: 650 };
export const RACES = {
  earth: { name: 'Earth-race', captain: 'Captain Ada Vale', color: '#89c7eb', portrait: 0, ship: 0, hp: 24, thrust: 155, speed: 235, turn: 3.1, shot: 1, cooldown: 0.25, greeting: 'The solar relay is failing. Bring the three relay cores home, and convince Mars and Venus to share the network.' },
  mars: { name: 'Mars-race', captain: 'Commander Rook', color: '#eb9c79', portrait: 1, ship: 1, hp: 19, thrust: 180, speed: 265, turn: 3.6, shot: 2, cooldown: 0.48, greeting: 'We built the outer relay, and Earth forgot us. Bring two units of scrap, or prove your resolve in a friendly duel. Then we will sign.' },
  venus: { name: 'Venutians', captain: 'Speaker Vela', color: '#a4e0ba', portrait: 2, ship: 2, hp: 21, thrust: 130, speed: 205, turn: 2.7, shot: 1, cooldown: 0.2, greeting: 'Our floating gardens need clean ice. Bring a sample from Jupiter orbit, and our engineers will join your relay project.' },
};
const locations = [
  ['mercury','Mercury',5,54,-2.5,'earth','An abandoned survey station holds the first relay core. Salvage it and two units of scrap.'],
  ['venus','Venus',6,89,-1.9,'venus','A bright world of cloud cities. The Venutians want an ice sample from Jupiter orbit.'],
  ['earth','Earth',7,120,-.8,'earth','Home port. Repair, refuel, improve your ship and assemble the final solar relay.'],
  ['mars','Mars',8,151,.1,'mars','The Mars-race will sign an accord for two scrap, or after a friendly duel.'],
  ['jupiter','Jupiter',9,190,.85,'earth','Recover a clean ice sample from a research buoy. This helps the Venutians.'],
  ['saturn','Saturn',10,225,1.65,'mars','A rogue Mars-race patrol guards the second relay core. Defeat it to recover the core.'],
  ['uranus','Uranus',11,262,2.55,'venus','An empty weather buoy contains fuel and repair supplies. Claim it once.'],
  ['neptune','Neptune',12,300,3.2,'venus','A rogue Venutian patrol guards the final relay core. Defeat it and return to Earth.'],
];
export const PLANETS = locations.map(([id,name,frame,radius,angle,race,description],i)=>({id,name,frame,radius,race,description,x:350+Math.cos(angle)*radius,y:376+Math.sin(angle)*radius,size:i===4?83:i===5?96:61}));
export const planet = id => PLANETS.find(p=>p.id===id);
export function freshCampaign() { return { version:1, location:'earth', day:1, fuel:14, crew:24, scrap:0, cores:[], accords:{earth:true,mars:false,venus:false}, visits:{}, ice:false, upgraded:false, won:false, lost:false, journal:['Day 1: Earth launches the solar-relay mission.'] }; }
export function travelCost(from,to) { const a=PLANETS.findIndex(p=>p.id===from),b=PLANETS.findIndex(p=>p.id===to); return {fuel:Math.min(6,2+Math.ceil(Math.abs(a-b)/2)),days:1+Math.ceil(Math.abs(a-b)/3)}; }
export const missionReady = c => c.cores.length===3 && c.accords.mars && c.accords.venus;
export function record(c,text) { c.journal.push(`Day ${c.day}: ${text}`); c.journal=c.journal.slice(-40); if(c.day>40)c.lost=true; }
export function validCampaign(c) {
  return c?.version===1 && PLANETS.some(p=>p.id===c.location) && Number.isInteger(c.day) && c.day>=1 && c.day<=60 && Number.isFinite(c.fuel) && c.fuel>=0 && c.fuel<=14 && Number.isFinite(c.crew) && c.crew>=0 && c.crew<=24 && Number.isInteger(c.scrap) && c.scrap>=0 && c.scrap<=100 && Array.isArray(c.cores) && c.cores.length<=3 && new Set(c.cores).size===c.cores.length && c.cores.every(p=>['mercury','saturn','neptune'].includes(p)) && c.accords && ['earth','mars','venus'].every(k=>typeof c.accords[k]==='boolean') && c.visits && typeof c.visits==='object' && !Array.isArray(c.visits) && typeof c.ice==='boolean' && typeof c.upgraded==='boolean' && typeof c.won==='boolean' && typeof c.lost==='boolean' && Array.isArray(c.journal) && c.journal.length<=40 && c.journal.every(s=>typeof s==='string'&&s.length<500);
}
