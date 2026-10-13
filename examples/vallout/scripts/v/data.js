// Vallout 2: New Kerava — game data (pure). Items, enemies, locations, quests, dialogue.
export const QUOTA = 30;                       // aliens killed → the hive collapses (victory ending)
export const SPECIAL = ['ST', 'PE', 'EN', 'CH', 'IN', 'AG', 'LK'];
export const SPECIAL_NAMES = { ST: 'Strength', PE: 'Perception', EN: 'Endurance', CH: 'Charisma', IN: 'Intelligence', AG: 'Agility', LK: 'Luck' };
export const SPECIAL_DESC = {
  ST: 'Hits harder, carries more. Kerava winters build character.', PE: 'Sight range and ranged accuracy.', EN: 'Hit points and healing.',
  CH: 'Speech skill. Helps with drunks and sergeants.', IN: 'Skill points per level. Repair + Doctor.', AG: 'Action Points, armor class, small guns.', LK: 'Critical hits. Also: finding the green fuzzy dice.' };
export const SKILLS = ['guns', 'unarmed', 'melee', 'speech', 'repair', 'doctor'];
export const SKILL_NAMES = { guns: 'Small Guns', unarmed: 'Unarmed', melee: 'Melee', speech: 'Speech', repair: 'Repair', doctor: 'Doctor' };
export const SKILL_DESC = { guns: 'Pistols, rifles, shotguns, ray guns.', unarmed: 'Fists and the legendary wall-kick.', melee: 'Knives, pipes, Nokia 3310.', speech: 'Talk your way out. Or into free Kossu.', repair: 'Fix mopeds, engines, relationships.', doctor: 'Salmiakki heals more.' };
export const PRESETS = {
  Tero: { ST: 6, PE: 6, EN: 6, CH: 5, IN: 5, AG: 6, LK: 6, tags: ['unarmed', 'guns'] },
  'Ex-Army': { ST: 7, PE: 7, EN: 6, CH: 3, IN: 4, AG: 6, LK: 5, tags: ['guns', 'melee'] },
  Charmer: { ST: 4, PE: 6, EN: 5, CH: 9, IN: 6, AG: 6, LK: 4, tags: ['speech', 'guns'] },
};

// ---- items ------------------------------------------------------------------------------------------------------------
// type: weapon | armor | aid | ammo | misc | quest.   weapon: skill, dmg[min,max], modes [{n, ap, kind:'melee'|'ranged'|'unarmed', aimed?, ammo?:n}], range, minST
export const ITEMS = {
  fists: { name: 'Fists', icon: 'puukko', type: 'weapon', w: 0, skill: 'unarmed', dmg: [1, 3], range: 1, modes: [{ n: 'PUNCH', ap: 3, kind: 'unarmed' }, { n: 'KICK', ap: 4, kind: 'unarmed', dmg: [2, 6] }], desc: 'Two fists and a Kerava attitude.', hidden: true },
  nokia: { name: 'Nokia 3310', icon: 'nokia', type: 'weapon', w: 1, skill: 'melee', dmg: [2, 6], range: 1, modes: [{ n: 'SMASH', ap: 3, kind: 'melee' }, { n: 'SNAKE', ap: 4, kind: 'melee', aimed: true }], value: 80, desc: 'Indestructible. Contains Snake II. Cannot be killed. Probably.' },
  puukko: { name: 'Puukko', icon: 'puukko', type: 'weapon', w: 1, skill: 'melee', dmg: [3, 8], range: 1, modes: [{ n: 'SLASH', ap: 3, kind: 'melee' }, { n: 'STAB', ap: 4, kind: 'melee', aimed: true }], value: 60, desc: 'Every Finn owns one. Pena gave you his.' },
  pipe: { name: 'Lamp Post Pipe', icon: 'pipe', type: 'weapon', w: 4, skill: 'melee', dmg: [5, 12], range: 1, minST: 5, modes: [{ n: 'SWING', ap: 3, kind: 'melee' }, { n: 'SMASH', ap: 4, kind: 'melee', aimed: true }], value: 40, desc: 'Reclaimed municipal property.' },
  pistol: { name: 'Sako .22 Pistol', icon: 'pistol', type: 'weapon', w: 3, skill: 'guns', dmg: [4, 10], range: 18, modes: [{ n: 'SINGLE', ap: 4, kind: 'ranged', ammo: 1 }, { n: 'AIMED', ap: 6, kind: 'ranged', ammo: 1, aimed: true }], ammo: 'ammo22', value: 220, desc: 'Reliable, Finnish, slightly damp.' },
  shotgun: { name: 'Hunting Shotgun', icon: 'rifle', type: 'weapon', w: 8, skill: 'guns', dmg: [12, 22], range: 10, minST: 6, modes: [{ n: 'BLAST', ap: 5, kind: 'ranged', ammo: 1 }, { n: 'AIMED', ap: 7, kind: 'ranged', ammo: 1, aimed: true }], ammo: 'ammoShell', value: 420, desc: 'For moose. Moose is now an alien.' },
  rifle: { name: 'Sako Hunting Rifle', icon: 'rifle', type: 'weapon', w: 7, skill: 'guns', dmg: [9, 22], range: 40, minST: 5, modes: [{ n: 'SINGLE', ap: 5, kind: 'ranged', ammo: 1 }, { n: 'AIMED', ap: 7, kind: 'ranged', ammo: 1, aimed: true }], ammo: 'ammoRifle', value: 650, desc: 'Long range. Long Finnish silences.' },
  raygun: { name: 'Alien Ray Gun', icon: 'raygun', type: 'weapon', w: 4, skill: 'guns', dmg: [11, 24], range: 30, modes: [{ n: 'ZAP', ap: 5, kind: 'ranged', ammo: 1 }, { n: 'AIMED', ap: 7, kind: 'ranged', ammo: 1, aimed: true }], ammo: 'cell', value: 900, desc: 'Warm. Hums. Smells like a sauna.' },
  ammo22: { name: '.22 Rounds', icon: 'ammo', type: 'ammo', w: 0.1, value: 4, desc: 'Tiny bullets.' }, ammoShell: { name: 'Shotgun Shells', icon: 'ammo', type: 'ammo', w: 0.2, value: 8, desc: 'Moose-grade.' },
  ammoRifle: { name: 'Rifle Rounds', icon: 'ammo', type: 'ammo', w: 0.2, value: 7, desc: '.308. Not for squirrels.' }, cell: { name: 'Energy Cells', icon: 'ammo', type: 'ammo', w: 0.1, value: 15, desc: 'Glowing green.' },
  denim: { name: 'Denim Jacket', icon: 'jacket', type: 'armor', w: 3, ac: 4, dt: 0, dr: 5, value: 50, desc: 'Tero\'s own. 80% cotton, 20% attitude.' },
  tracksuit: { name: 'Tracksuit (Verkkarit)', icon: 'tracksuit', type: 'armor', w: 2, ac: 6, dt: 0, dr: 10, value: 70, desc: 'Three white stripes, zero fear.' },
  leather: { name: 'Leather Jacket', icon: 'jacket', type: 'armor', w: 5, ac: 9, dt: 1, dr: 20, value: 200, desc: 'Rane approved. Cheap, but the cheapest tough.' },
  vest: { name: 'Army Vest', icon: 'vest', type: 'armor', w: 8, ac: 14, dt: 3, dr: 30, value: 480, desc: 'Puolustusvoimat issue. Mostly pockets.' },
  kossu: { name: 'Kossu', icon: 'kossu', type: 'aid', w: 1, heal: [6, 9], drunk: 1, value: 25, desc: '+HP, but you are Drunk: -15 to hit, +2 unarmed damage.' },
  lonkero: { name: 'Lonkero', icon: 'lonkero', type: 'aid', w: 1, heal: [5, 8], value: 15, desc: 'Gin long drink. Citrus. Medicinal.' },
  salmiakki: { name: 'Salmiakki', icon: 'salmiakki', type: 'aid', w: 0.3, heal: [12, 18], value: 40, desc: 'Salty liquorice. Heals what hurts.' },
  makkara: { name: 'Grill Sausage', icon: 'makkara', type: 'aid', w: 1, heal: [8, 12], value: 20, desc: 'Makkara. Nothing else needs saying.' },
  dice: { name: 'Green Fuzzy Dice', icon: 'dice', type: 'quest', w: 0.2, value: 0, desc: 'THE green fuzzy dice. They hang from the mirror and give +luck. Rane needs them.' },
  plug: { name: 'Spark Plug', icon: 'sparkplug', type: 'quest', w: 0.2, value: 0, desc: 'Sytytystulppa. The moped needs one.' },
  key: { name: 'Station Key', icon: 'key', type: 'quest', w: 0.1, value: 0, desc: 'Opens the station kiosk shutters.' },
  cash: { name: 'Markka', icon: 'cash', type: 'misc', w: 0, value: 1, desc: 'Finnish markka. €? Not yet.' },
};
export const START_ITEMS = [['nokia', 1], ['puukko', 1], ['denim', 1], ['lonkero', 2], ['makkara', 1]];

// ---- enemies -----------------------------------------------------------------------------------------------------------
// frames: row name in actors.png. weapon: attack definition. sight: tiles.
export const ENEMIES = {
  blob: { name: 'Lonkero Mutant', row: 'blob', hp: 16, ac: 0, ap: 6, skill: 55, sight: 9, xp: 25, speed: 2.1, atk: { kind: 'melee', dmg: [3, 7], ap: 4, range: 1 }, die: 'goo', gore: 'goo', alien: true, desc: 'A can of lonkero that got ideas.', loot: [['cash', 3], ['lonkero', 0.4]] },
  gull: { name: 'Mutant Gull', row: 'gull', hp: 9, ac: 12, ap: 9, skill: 60, sight: 10, xp: 15, speed: 3.4, atk: { kind: 'melee', dmg: [2, 5], ap: 4, range: 1 }, die: 'blood', gore: 'blood', desc: 'It wants your sausage. All of it.', loot: [] },
  harmaa: { name: 'Grey Alien', row: 'harmaa', hp: 24, ac: 5, ap: 7, skill: 60, sight: 11, xp: 40, speed: 2.3, atk: { kind: 'ranged', dmg: [5, 11], ap: 4, range: 12, bolt: true }, die: 'goo', gore: 'goo', alien: true, desc: 'Big head. Big eyes. Small manners.', loot: [['cell', 0.5], ['cash', 5]], dr: 0 },
  komentaja: { name: 'Alien Commander', row: 'komentaja', hp: 55, ac: 15, ap: 8, skill: 70, sight: 12, xp: 120, speed: 2.4, atk: { kind: 'ranged', dmg: [9, 17], ap: 4, range: 14, bolt: true }, die: 'goo', gore: 'goo', alien: true, desc: 'Gold braid on the ray gun. Purple. Very Soviet.', loot: [['raygun', 0.5], ['cell', 1], ['salmiakki', 0.5]], dt: 2, dr: 20 },
  boss: { name: 'Overmind', row: 'boss', big: true, hp: 180, ac: 10, ap: 10, skill: 80, sight: 16, xp: 600, speed: 2.0, atk: { kind: 'ranged', dmg: [13, 24], ap: 4, range: 16, bolt: true }, die: 'goo', gore: 'goo', alien: true, desc: 'The hive brain. It is NOT a big fan of Keski-Uusimaa.', loot: [['raygun', 1], ['cell', 3], ['salmiakki', 2]], dt: 3, dr: 25 },
  brawler: { name: 'Angry Drunk', row: 'kalle', hp: 14, ac: 2, ap: 6, skill: 45, sight: 8, xp: 18, speed: 1.8, atk: { kind: 'melee', dmg: [1, 5], ap: 3, range: 1 }, die: 'blood', gore: 'blood', desc: 'He has opinions. And a bottle.', loot: [['kossu', 0.7], ['cash', 4]] },
};

// ---- locations ---------------------------------------------------------------------------------------------------------
export const LOCS = {
  asema: { name: 'Kerava Station', fi: 'Keravan asema', kind: 'asema', map: [70, 250], size: 30, seed: 11, desc: 'The old yellow wooden station. The 7:12 to Helsinki never arrived.', links: ['keskusta'], enemies: { blob: 4, gull: 1 } },
  keskusta: { name: 'Kauppakaari Centre', fi: 'Kauppakaari / Karuselli', kind: 'keskusta', map: [210, 180], size: 36, seed: 22, desc: 'Brutalist towers, the Posti, Karuselli mall. Christmas lights still blink.', links: ['asema', 'sampola', 'kuopat'], enemies: { blob: 4, gull: 2, harmaa: 3 } },
  sampola: { name: 'Sampola & Ahjo', fi: 'Sampola / Ahjo', kind: 'sampola', map: [350, 120], size: 36, seed: 33, desc: 'Housing blocks, the ice rink, a car park of regrets.', links: ['keskusta', 'joki'], enemies: { blob: 3, harmaa: 5, komentaja: 1 } },
  kuopat: { name: 'Janikselinna Sand Pits', fi: 'Jaeniksenlinnan hiekkakuopat', kind: 'kuopat', map: [350, 295], size: 32, seed: 66, desc: 'Real Kerava sand pits, now a fortified camp of the Uusimaa Republic Rangers.', links: ['keskusta', 'joki'], enemies: { blob: 2, harmaa: 3, gull: 1 } },
  joki: { name: 'Keravanjoki Hive', fi: 'Keravanjoki', kind: 'joki', map: [470, 210], size: 36, seed: 44, desc: 'The river bridge. The aliens built a hive on it. Obviously.', links: ['sampola', 'kuopat', 'klaukkala'], enemies: { harmaa: 6, komentaja: 2, blob: 3 }, boss: true },
  klaukkala: { name: 'Klaukkala Safe Zone', fi: 'Klaukkala', kind: 'klaukkala', map: [575, 90], size: 24, seed: 55, desc: 'Fences, floodlights, a flag. Sausage grill. Safe.', links: ['joki'], enemies: {} },
};
export const LOC_ORDER = ['asema', 'keskusta', 'sampola', 'kuopat', 'joki', 'klaukkala'];

// ---- quests --------------------------------------------------------------------------------------------------------------
export const QUESTS = {
  main: { title: 'Get Out of Kerava', steps: { 1: 'Leave the station. Find Rane in Kauppakaari — he has a moped.', 2: 'Rane needs the green fuzzy dice and a spark plug. Search Sampola.', 3: 'Moped ready. The river bridge is held by the Overmind. Clear the Hive.', 4: 'The road is open. Ride to Klaukkala!', 5: 'Safe in Klaukkala. Asiaa!' }, xp: 500 },
  kossu: { title: "Pena's Kossu", steps: { 1: 'Pena needs one Kossu to survive until Tuesday. Find one in Kauppakaari.', 2: 'Bring Kossu to Pena at the station.', 3: 'Pena has his Kossu. He gave you his puukko. Good man.' }, xp: 100 },
  wall: { title: 'Wall-Kicking World Championship', steps: { 1: 'Saku and Mottonen are kicking the Posti wall. Beat their record!', 2: 'You kicked the wall harder than anyone. Legend.' }, xp: 150 },
  dice: { title: 'The Green Fuzzy Dice', steps: { 1: 'Rane lost his lucky green fuzzy dice. Probably on a wreck in Sampola.', 2: 'You have the dice. Take them to Rane.', 3: 'Dice delivered. The mirror is complete.' }, xp: 200 },
  plug: { title: 'Spark Plug Hunt', steps: { 1: 'Seppo the kiosk guy has a spark plug, for a favour.', 2: 'You have the spark plug.', 3: 'Spark plug delivered.' }, xp: 120 },
  ncr: { title: 'Rangers: Sweep the Pits', steps: { 1: 'Captain Lehtonen of the Uusimaa Republic Rangers wants 4 aliens cleared from the sand pits.', 2: 'Pits cleared. Report to Captain Lehtonen.', 3: 'The Republic is grateful. Good vest, too.' }, xp: 250 },
  kill: { title: 'Pest Control', steps: { 1: `Kill ${QUOTA} aliens and the hive collapses by itself. Or find another way out.` }, xp: 0 },
};

// ---- dialogue ------------------------------------------------------------------------------------------------------------
// opts: {t, go, end, if:[flag…], not:[flag…], act:['flag x','give item n','take item n','xp n','quest id n'], skill:[name, target] → on fail go `fail`}
const FIN = ['Perkele.', 'Asiaa!', 'Hei Rane!', 'Kippis!'];
export const NPCS = {
  pena: { name: 'Pena', row: 'pena', start: [['pena_done', 'pena_end'], ['kossu_has', 'pena_kossu'], ['pena_met', 'pena_again'], [null, 'pena1']] },
  kalle: { name: 'Kalle', row: 'kalle', start: [['kalle_given', 'drunk_end'], [null, 'drunk1']] },
  saku: { name: 'Saku', row: 'saku', start: [['wall_done', 'saku_end'], ['wall_active', 'saku_again'], ['rane_seen', 'saku2'], [null, 'saku1']] },
  mottonen: { name: 'Mottonen', row: 'mottonen', start: [['wall_done', 'mot_end'], [null, 'mot1']] },
  rane: { name: 'Rane', row: 'rane', start: [['moped_ready', 'rane_ready'], ['dice_given', 'rane_dice'], ['rane_met', 'rane_again'], [null, 'rane1']] },
  seppo: { name: 'Seppo (Kioski)', row: 'pena', start: [['plug_done', 'seppo_end'], ['plug_active', 'seppo_again'], [null, 'seppo1']] },
  capt: { name: 'Capt. Lehtonen', row: 'ranger', start: [['ncr_done', 'capt_end'], ['ncr_ready', 'capt_done'], ['ncr_active', 'capt_again'], [null, 'capt1']] },
  ranger: { name: 'Ranger', row: 'ranger', start: [[null, 'ranger1']] },
  sgt: { name: 'Sgt. Hakkarainen', row: 'soldier', start: [[null, 'sgt1']] },
};
export const DIALOG = {
  pena1: { say: ['Pena stirs on the station bench, clutching an empty bottle.', '"Huh? Tero? Perkele, what a Friday... Did the 7:12 come? No? ...Wait. Why is the sky green?"'], act: ['flag pena_met'], opts: [
    { t: 'There are aliens, Pena. Everything is on fire.', go: 'pena2' }, { t: 'Where am I? Why do I feel like a Nokia 3310?', go: 'pena2' }, { t: '[Leave]', end: true }] },
  pena2: { say: ['"Aliens. Right. Army sealed the whole town, the whole of Kerava. Roadblocks at Kehä III, the lot."', '"The only safe place is Klaukkala. North-west. Everyone says so on the radio."', '"Go to the centre, find Rane. The moped guy. If anyone can ride out of here, Rane can. And... could you spare a Kossu? My hands. They have opinions."'], opts: [
    { t: 'I will bring you a Kossu.', go: 'pena3', act: ['quest kossu 1'] }, { t: 'Take this lonkero for now.', go: 'pena_lonkero', if: ['has_lonkero'] }, { t: 'Not now, Pena.', end: true }] },
  pena3: { say: ['"God bless Kerava. And God bless Alko, if it still exists."', 'Tip: walk to the east edge of the station (the green arrow) to leave.'], opts: [{ t: '[Leave]', end: true }] },
  pena_lonkero: { say: ['"Lonkero? It is... not Kossu. But it is something. Kiitos."', 'Pena drinks it in one go. "Still need Kossu though."'], act: ['take lonkero 1', 'xp 15'], opts: [{ t: '[Leave]', end: true }] },
  pena_again: { say: ['"Find Rane in the centre, Tero. And Kossu. Always Kossu."'], opts: [{ t: '[Leave]', end: true }] },
  pena_kossu: { say: ['Pena\'s eyes light up. "Is that... Kossu? Tero. You absolute legend."'], opts: [{ t: 'Here you go.', go: 'pena_thanks', act: ['take kossu 1', 'give puukko 1', 'give cash 50', 'xp 100', 'quest kossu 3', 'flag pena_done'] }, { t: 'Not yet.', end: true }] },
  pena_thanks: { say: ['"Take my puukko. And 50 markkaa. Rest in Kerava. Hei hei."'], opts: [{ t: '[Leave]', end: true }] },
  pena_end: { say: ['Pena hums happily. "Hei Rane..." he mumbles in his sleep.'], opts: [{ t: '[Leave]', end: true }] },
  drunk1: { say: ['"Moi! Oletko sinä... are you real? I think I fought a lamp post."', '"Got any Kossu? I can pay in... in vibes."'], opts: [
    { t: '[Speech 35] Here, calm down. Have some respect for the lamp post.', skill: ['speech', 35], go: 'drunk_ok', fail: 'drunk_angry' }, { t: 'Kossu? Get lost.', go: 'drunk_angry' }, { t: '[Leave]', end: true }] },
  drunk_ok: { say: ['"You get me, kaveri. Take this lonkero. I have two. Or six."'], act: ['give lonkero 1', 'xp 10', 'flag kalle_given'], opts: [{ t: '[Leave]', end: true }] },
  drunk_end: { say: ['Kalle waves a lonkero at you. "Hei hei! Still love you, kaveri."'], opts: [{ t: '[Leave]', end: true }] },
  drunk_angry: { say: ['"Whaaat? You calling me drunk?! I am just... horizontally inclined!"'], act: ['hostile'], opts: [{ t: 'Uh-oh.', end: true }] },
  saku1: { say: ['Saku and Mottonen are kicking a concrete wall. Again. And again.', 'Saku: "Hei! Wanna try? Tough guys kick the wall. It is the Kerava way. Like Rane."'], opts: [
    { t: 'Rane?', go: 'saku_rane' }, { t: 'Sure. How tough is tough?', go: 'saku_wall' }, { t: '[Leave]', end: true }] },
  saku_rane: { say: ['Mottonen: "RANE! The coolest! Moped, sunglasses, leather. Asiaa! He is by the Posti."', 'Saku: "If you meet him, say Hei Rane. It is the law."'], act: ['flag rane_seen'], opts: [{ t: 'Okay. And the wall?', go: 'saku_wall' }, { t: '[Leave]', end: true }] },
  saku2: { say: ['Saku: "Hei! Wall time?" Mottonen groans on the ground, holding his foot. "I am fine. It is just character."'], opts: [{ t: 'I will kick the wall.', go: 'saku_wall' }, { t: '[Leave]', end: true }] },
  saku_wall: { say: ['Saku: "Kick the wall. Press SPACE when the bar is in the green. Three good kicks beat the record. World championship, Kerava, no rules."'], act: ['quest wall 1', 'flag wall_active'], opts: [{ t: 'Let me at it.', end: true, act: ['minigame wall'] }, { t: 'Later.', end: true }] },
  saku_again: { say: ['Saku: "Kick! Kick! Kick!"'], opts: [{ t: 'Kick the wall.', end: true, act: ['minigame wall'] }, { t: '[Leave]', end: true }] },
  saku_end: { say: ['Saku and Mottonen bow slightly. "Hei Tero. Asiaa."'], opts: [{ t: '[Leave]', end: true }] },
  mot1: { say: ['Mottonen limps. "Ouch. I mean... asiaa! This wall has 14 000 kicks in it."', '"If you can beat the record, I give you my tracksuit. It is cheap, but the stripes are legit."'], opts: [{ t: '[Leave]', end: true }] },
  mot_end: { say: ['Mottonen: "Hei Tero! Tough guy!"'], opts: [{ t: '[Leave]', end: true }] },
  rane1: { say: ['Rane leans on his moped, sunglasses on, in the grey alien dusk. He does not look up.', '"Moi."'], act: ['flag rane_met', 'quest main 1'], opts: [
    { t: 'Hei Rane!', go: 'rane2' }, { t: 'Rane, aliens. I need a ride out of Kerava.', go: 'rane2' }, { t: '[Leave]', end: true }] },
  rane2: { say: ['"A ride."', '"Moped does not start without the green fuzzy dice. They hang on the mirror. Lost them in Sampola, on a wreck, in the car park."', '"And I need a spark plug. Seppo at the kiosk may have one."'], opts: [
    { t: 'Dice and plug. Got it.', go: 'rane3', act: ['quest main 2', 'quest dice 1', 'quest plug 1', 'flag dice_active'] }, { t: 'That is a lot of asks.', go: 'rane3', act: ['quest main 2', 'quest dice 1', 'quest plug 1', 'flag dice_active'] }] },
  rane3: { say: ['"Asiaa."', '"After that, the bridge. The Overmind sits on it. Take it out, and I ride you to Klaukkala."'], opts: [{ t: '[Leave]', end: true }] },
  rane_again: { say: ['"Dice. Plug. Sampola. Seppo."', 'He nods slowly at nothing.'], opts: [{ t: '[Leave]', end: true }], extra: 'rane_check' },
  rane_dice: { say: ['"The dice. Hm."', 'He hangs them on the mirror. The moped hums approvingly.', '"Still need that plug."'], opts: [{ t: 'On it.', end: true }], extra: 'rane_check' },
  rane_ready: { say: ['"Moped is ready."', '"Kill the Overmind at the river. Then I ride you to Klaukkala. Hei Tero."'], opts: [{ t: 'Asiaa.', end: true }] },
  seppo1: { say: ['Seppo peers from the kiosk shutters. "Closed. Because of the aliens."', '"I have a spark plug. Not for sale. But if you get me the station key, I could... reconsider."'], opts: [
    { t: '[Speech 45] Seppo, ihminen. Please.', skill: ['speech', 45], go: 'seppo_give', fail: 'seppo_no' }, { t: 'Where is the key?', go: 'seppo_key' }, { t: '[Leave]', end: true }] },
  seppo_key_ok: { say: ['Seppo takes the key and sniffs it. "From the dead guy? Good. Here, the plug."', '"I never saw you. Hei hei."'], act: ['take key 1', 'give plug 1', 'quest plug 2', 'flag plug_has', 'flag plug_done', 'xp 40'], opts: [{ t: 'Kiitos, Seppo.', end: true }] },
  seppo_key: { say: ['"The key is on a dead guy in the kiosk behind the Posti. Do not ask whose."'], act: ['quest plug 1', 'flag plug_active'], opts: [{ t: '[Leave]', end: true }] },
  seppo_no: { say: ['"Hmm. No. Persuasion is not what it used to be. Bring the key."'], opts: [{ t: '[Leave]', end: true }] },
  seppo_give: { say: ['"...Ugh, fine. Take it. And for the love of Kerava, do not tell Rane it was free."'], act: ['give plug 1', 'quest plug 2', 'flag plug_has', 'flag plug_done'], opts: [{ t: 'Kiitos, Seppo.', end: true }] },
  seppo_again: { say: ['"Key. Posti. Dead guy. Go."'], opts: [{ t: '[Leave]', end: true }], extra: 'seppo_check' },
  seppo_end: { say: ['Seppo is polishing a can of lonkero. "Closed."'], opts: [{ t: '[Leave]', end: true }] },
  capt1: { say: ['A blue-and-yellow banner snaps in the wind over the sand pits. Captain Lehtonen salutes with a clipboard.', '"Uusimaa Republic Rangers, Third Sand Pit Battalion. We have order, paperwork and a flag. We do not have enough bullets."', '"Sampola fell, the army sealed Kehä III and left us to manage the Republic ourselves. Democracy is a lot of forms."'], opts: [
    { t: 'What does the Republic need?', go: 'capt2' }, { t: 'Rane told me about a bridge. Any advice?', go: 'capt_bridge' }, { t: '[Leave]', end: true }] },
  capt2: { say: ['"Four aliens cleared from the pits. Then the Republic grants you a vest, 100 markkaa and a very official thank-you."'], opts: [{ t: 'Consider it done, Captain.', end: true, act: ['quest ncr 1', 'flag ncr_active'] }, { t: 'Not my forms.', end: true }] },
  capt_bridge: { say: ['"The Overmind sits on the river bridge. Hit it hard. Its guards are thin after dark."', '"Ranger intel says: the brain has about 180 HP and hates shotgun blasts. Take a shotgun."'], opts: [{ t: 'Thanks. About the pits...', go: 'capt2' }, { t: '[Leave]', end: true }] },
  capt_again: { say: ['"Four aliens in the pits. Report back when done, citizen."'], opts: [{ t: '[Leave]', end: true }] },
  capt_done: { say: ['"Four down! The Republic thanks you, Tero. Sign here. And here. And here."'], act: ['give vest 1', 'give cash 100', 'xp 60', 'quest ncr 3', 'flag ncr_done'], opts: [{ t: 'Asiaa.', end: true }] },
  capt_end: { say: ['"For Uusimaa!" Lehtonen stamps another form.'], opts: [{ t: '[Leave]', end: true }] },
  ranger1: { say: ['The Ranger stands at attention. "Halt, citizen. State your business. Or do not, we are on break."', '"We have a flag, a constitution and one working generator. Do not touch the generator."'], opts: [{ t: '[Leave]', end: true }] },
  sgt1: { say: ['Sgt. Hakkarainen salutes. "Tero? From Kerava?! You rode through the cordon?!"', '"We saw the green glow all night. The hive collapsed? Stand down, men! Someone get this man a sausage."'], opts: [{ t: 'Asiaa.', end: true, act: ['ending escape'] }] },
};

export const BARKS = ['Hei hei!', 'Perkele.', 'Onks lonkeroo?', 'Asiaa!', 'Kippis!', 'Moi!', 'Hei Rane!'];
export const TITLE_QUIPS = ['Fallout, but Finnish.', 'Kerava, 1997 + 30 years of aliens.', 'Hei Rane!', 'Asiaa!', 'The green glow comes from Savio.'];
export const INTRO = [
  'KERAVA, 2031.',
  'It started with a green light over Sampola.',
  'Then the aliens landed. The army sealed the whole town.',
  'Roadblocks at Kehä III. No signal. No sausage. Just wasteland.',
  'Tero wakes up on a bench at Kerava Station.',
  'Hangover: critical. Phone: Nokia 3310. Goal: Klaukkala.',
];
export const ENDINGS = {
  escape: ['You ride into Klaukkala on Rane\'s moped, the green fuzzy dice swinging from the mirror.', '"Asiaa," says Rane. It is the longest sentence you ever heard him say.', 'The aliens are still out there. But Kerava remembers. And so does the wall.', 'THE END — Escape from Kerava.'],
  victory: [`The ${QUOTA}th alien drops. The hive shrieks. The green glow over Sampola goes out.`, 'The mothership folds itself into the sky like a bad kebab wrapper.', 'Saku and Mottonen kick the wall in celebration. Rane tips his sunglasses.', 'THE END — Kerava Liberated.'],
  death: ['Tero is no more. The wall, the dice and the sausage live on.', 'THE END — Hei hei.'],
};
