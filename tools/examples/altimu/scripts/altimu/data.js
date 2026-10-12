// Altimu 5.7 — all content in one place: party, people and what they say, monsters, quest flags.
// Dialogue works like Ultima V: the player types a word (only the first 4 letters matter), the person answers, and words in [brackets] are
// topics you can ask about next. A reply is a string or a function (ctx) => string; ctx = { f (flags), set(k,v), give(gold), join(id), ... }.
// To add a person: add an entry to NPCS, give them a sprite row from assets/sprites/folk.png (see assets.md) and a position. See GUIDE.md.
export const START = { x: 49, y: 24, dir: 'down', hour: 8, gold: 30, food: 18, herbs: 1 };

export const PARTY = {
  avatar:  { name: 'AVATAR',  sprite: 'avatar',  hp: 40, melee: [4, 9], hit: 78, ranged: null },
  iolo:    { name: 'IOLO',    sprite: 'iolo',    hp: 32, melee: [2, 5], hit: 70, ranged: { name: 'CROSSBOW', dmg: [4, 8], range: 6 } },
  shamino: { name: 'SHAMINO', sprite: 'shamino', hp: 30, melee: [2, 5], hit: 72, ranged: { name: 'BOW', dmg: [3, 7], range: 7 } },
  dupre:   { name: 'DUPRE',   sprite: 'dupre',   hp: 44, melee: [4, 8], hit: 74, ranged: null },
};
export const START_PARTY = ['avatar', 'iolo'];

export const MONSTERS = {
  wolf:   { name: 'WOLF',   hp: 12, dmg: [2, 5], hit: 62, speed: 2, xp: 8,  gold: 0,  tex: 'beasts', frames: [0, 1], flip: true },
  spider: { name: 'SPIDER', hp: 10, dmg: [1, 4], hit: 66, speed: 1, xp: 9,  gold: 0,  tex: 'beasts', frames: [2, 3], poison: true },
  bandit: { name: 'BANDIT', hp: 16, dmg: [3, 6], hit: 62, speed: 1, xp: 12, gold: 12, folk: 'bandit' },
  chief:  { name: 'HOB THE RED', hp: 42, dmg: [4, 9], hit: 70, speed: 1, xp: 60, gold: 80, folk: 'chief', boss: true },
};
// roaming groups: they chase when the party comes within `aggro` tiles (clearings are safe at night? no — they never sleep)
export const GROUPS = [
  { id: 'wolves_w',  at: [12, 21], members: ['wolf', 'wolf'], aggro: 5 },
  { id: 'wolves_n',  at: [30, 6],  members: ['wolf', 'wolf', 'wolf'], aggro: 5 },
  { id: 'spiders_e', at: [59, 4],  members: ['spider', 'spider'], aggro: 4 },
  { id: 'wolves_s',  at: [8, 36],  members: ['wolf', 'wolf'], aggro: 5 },
  { id: 'camp',      at: [11, 6],  members: ['bandit', 'bandit', 'chief', 'bandit'], aggro: 4, camp: true },
];

// Things you can examine/search: keyed by "x,y". Chests are described by CHESTS.
export const CHESTS = {
  '8,3':  { gold: 60, item: 'letter', text: 'A bandit chest. Inside: coins and a LETTER sealed with a black medallion.' },
  '25,21': { gold: 25, text: 'The Mayor keeps a little gold for the town.' },
};
export const SEARCH = {
  '51,19': { flag: 'rag',  say: 'A bloody boot print. Wedged in the straw: a torn strip of black cloth with a RED SASH thread.' },
  '52,20': { flag: 'rag',  say: 'More blood. The trail leads out of the door and north.' },
  '53,20': { flag: 'rag',  say: 'Dried blood. The boot print points north, toward the forest road.' },
};
export const SIGNS = {
  '29,23': 'MAYOR FINNIGAN - OPEN TO ALL CITIZENS',
  '29,26': 'THE WAYFARER INN - FOOD AND BEDS',
  '49,23': 'TRINSIC STABLES - CLOSED BY ORDER OF THE MAYOR',
  '51,26': 'THE FELLOWSHIP - MEETINGS EVERY NIGHT AT NINE',
  '46,36': 'SMITHY - CLOSED IN MOURNING',
  '56,41': 'TRINSIC HARBOUR',
  '66,18': 'HUNTER BARNES - KEEP OUT',
};
export const LOOKS = {
  corpse_smith: 'CHRISTOPHER THE BLACKSMITH. STRUCK DOWN FROM BEHIND. A FELLOWSHIP BOOK LIES NEAR HIM.',
  corpse_gargoyle: 'INAMO THE GARGOYLE, WHO TENDED THE STABLES. HIS STONE WINGS ARE CHIPPED.',
};

const T = (...lines) => lines.join(' ');

// ---- people ---------------------------------------------------------------------------------------------------------------
// wander: tiles from home they roam (0 = stands still). join: party id they can join as.
export const NPCS = {
  gilberto: { name: 'GILBERTO', sprite: 'guard', x: 39, y: 15, wander: 0,
    greeting: 'A GUARD SALUTES. "HALT! ..AH, THE AVATAR. HAIL."',
    talk: {
      NAME: 'I AM GILBERTO, CAPTAIN OF THE [GATE] WATCH.',
      JOB: T('I GUARD THE NORTH [GATE]. SINCE THE [MURDERS] THE MAYOR HAS KEPT IT SHUT AFTER DARK, AND', 'SHUT TO ALL STRANGERS BY DAY.'),
      GATE: (c) => (c.f.gateOpen ? 'THE GATE STANDS OPEN FOR THEE, AVATAR. MIND THE [FOREST].' : c.f.quest ? (c.set('gateOpen', true), c.openGate(), 'MAYOR [FINNIGAN] SENT WORD! *HE HAULS THE WINCH* THE GATE IS OPEN. MIND THE [FOREST].') : 'NONE PASS WITHOUT THE LEAVE OF MAYOR [FINNIGAN].'),
      MURDERS: 'CHRISTOPHER THE SMITH AND INAMO THE GARGOYLE, FOUND DEAD IN THE [STABLES]. A FOUL DEED.',
      STABLES: 'THE STABLES ARE IN THE NORTH-EAST CORNER OF TOWN. THE MAYOR HAS SEALED THEM FOR THY INQUEST.',
      FINNIGAN: 'OUR MAYOR. HIS HOUSE IS THE GREAT ONE IN THE NORTH-WEST CORNER.',
      FOREST: 'WOLVES, SPIDERS... AND HOODED MEN ON THE OLD NORTH ROAD. TAKE THY PARTY, AND FOOD.',
    } },
  finnigan: { name: 'MAYOR FINNIGAN', sprite: 'finnigan', x: 30, y: 17, wander: 0,
    greeting: (c) => (c.f.letter && c.f.chiefDead ? 'THE MAYOR RISES. "THOU HAST NEWS? SPEAK, AVATAR, I AM ANXIOUS TO HEAR IT. ASK ME OF [PROOF]."' : 'THE MAYOR WRINGS HIS HANDS. "AVATAR! THE VIRTUES BE PRAISED. TRINSIC IS IN [TROUBLE]."'),
    talk: {
      NAME: 'I AM FINNIGAN, MAYOR OF TRINSIC.',
      JOB: 'I SEE TO THE TOWN. TWO OF MY CITIZENS LIE DEAD AND I HAVE NO ANSWERS. THE [MURDERS] WEIGH ON ME.',
      TROUBLE: 'THE [MURDERS], AVATAR. CHRISTOPHER THE SMITH AND THE GARGOYLE INAMO. FIND THE KILLER!',
      MURDERS: (c) => (c.set('quest', 1), T('SEARCH THE [STABLES] FOR CLUES, SPEAK WITH [SPARK], CHRISTOPHER\'S SON, AND BRING ME PROOF.', 'I HAVE SENT WORD TO [GILBERTO]: THE NORTH GATE WILL OPEN FOR THEE.')),
      STABLES: 'THE STABLES ARE IN THE NORTH-EAST CORNER. LOOK CLOSELY - THE KILLER MUST HAVE LEFT TRACES.',
      SPARK: 'POOR LAD. HE SAW SOMETHING THAT NIGHT, BUT HE WILL ONLY WHISPER IT. BE GENTLE.',
      KLOG: 'THE FELLOWSHIP LEADER? HE AND CHRISTOPHER QUARRELLED LAST WEEK. I DO NOT LIKE IT, BUT I HAVE NO PROOF.',
      FELLOWSHIP: 'A SOCIETY OF GOOD FOLK, SO THEY SAY. THEIR HALL IS SOUTH OF THE MAIN STREET.',
      GATE: 'GILBERTO OPENS IT ON MY ORDER.',
      PROOF: (c) => (c.f.letter && c.f.chiefDead ? (c.set('won', true), c.win(), 'THE LETTER... SIGNED WITH THE BLACK MEDALLION! HOB WAS PAID TO SPILL BLOOD IN TRINSIC. THOU HAST CLEARED OUR NAME AND SAVED OUR TOWN. WE ARE IN THY DEBT, AVATAR!') : c.f.letter ? 'THIS LETTER IS DAMNING, BUT THE KILLER STILL RIDES FREE. END HIS BAND IN THE NORTH FOREST FIRST.' : 'I NEED MORE THAN THY WORD. FIND THE KILLER\'S CAMP IN THE NORTH FOREST.'),
      LETTER: (c) => (c.f.letter ? 'GIVE IT HERE - ASK ME OF [PROOF].' : 'WHAT LETTER?'),
    } },
  spark: { name: 'SPARK', sprite: 'spark', x: 51, y: 23, wander: 1,
    greeting: 'A BOY WITH RED EYES LOOKS UP. "...AVATAR?"',
    talk: {
      NAME: 'I AM SPARK. CHRISTOPHER WAS MY [FATHER].',
      JOB: 'I WAS HIS PRENTICE AT THE FORGE. NOW THERE IS NO FORGE.',
      FATHER: 'HE WENT TO FEED THE HORSES AT [NIGHT] AND... *HE CANNOT FINISH*',
      NIGHT: (c) => (c.set('witness', true), T('I SAW THEM FROM THE LOFT. FOUR MEN IN HOODS WITH RED [SASHES]. THEY RAN OUT AND NORTH.', 'ONE DROPPED A BLACK [MEDALLION] AND WENT BACK FOR IT.')),
      SASHES: 'THEY WORE RED SASHES, LIKE A BAND. NOT LIKE THE FELLOWSHIP. THE FELLOWSHIP WEARS NO SASHES.',
      MEDALLION: 'IT WAS BLACK WITH A TWO-FACED MARK. I HAVE NEVER SEEN ONE. ASK [KLOG], MAYBE.',
      KLOG: 'HE FIGHTS WITH FATHER ABOUT PAYING A TITHE. BUT I DO NOT THINK HE WOULD...',
      STABLES: 'LOOK AROUND THE FRONT OF THE STALLS. THE BLOOD WAS ON THE FLOOR WHERE THEY FELL.',
    } },
  klog: { name: 'KLOG', sprite: 'klog', x: 50, y: 29, wander: 0,
    greeting: 'A SMOOTH MAN BOWS. "THE FELLOWSHIP WELCOMES THEE, AVATAR."',
    talk: {
      NAME: 'I AM KLOG, LEADER OF THE TRINSIC BRANCH OF THE [FELLOWSHIP].',
      JOB: 'I GUIDE THE FELLOWSHIP IN TRINSIC. WE MEET HERE EVERY NIGHT AT NINE.',
      FELLOWSHIP: 'STRIVE FOR UNITY. TRUST GUIDES THE WAY. WORTHINESS PRECEDES REWARD. THOU ART WELCOME TO ATTEND.',
      MURDERS: 'A TRAGEDY! WE PRAY FOR CHRISTOPHER AND INAMO. THE FELLOWSHIP HAD NO PART.',
      CHRISTOPHER: 'WE... DISAGREED ABOUT THE TITHE. IT WAS NOTHING. I AM SORRY HE IS GONE.',
      MEDALLION: (c) => (c.f.witness ? 'THE BLACK KIND? NO. OURS ARE GOLD. DO NOT LINK US TO OUTLAWS!' : 'THE FELLOWSHIP WEARS A GOLDEN MEDALLION.'),
      SASHES: 'RED SASHES? SOME FOREST OUTLAWS. I KNOW NOTHING MORE. *HE LOOKS AWAY*',
      TITHE: 'A DONATION, FREELY GIVEN. NOTHING MORE.',
    } },
  ellen: { name: 'ELLEN', sprite: 'ellen', x: 47, y: 29, wander: 0,
    greeting: 'A WOMAN SMILES NERVOUSLY.',
    talk: {
      NAME: 'I AM ELLEN, KLOG\'S WIFE.',
      JOB: 'I KEEP THE HALL AND ITS BOOKS.',
      KLOG: 'HE HAS BEEN RESTLESS. HE IS OUT LATE. I TELL MYSELF IT IS MEETINGS.',
      MURDERS: 'I HAVE NOT SLEPT. CHRISTOPHER WAS SO KIND TO US.',
      FELLOWSHIP: 'WE ARE JUST FOLK WHO WANT TO HELP. PLEASE, NOTHING BAD CAN COME OF IT.',
    } },
  brom: { name: 'BROM', sprite: 'innkeeper', x: 28, y: 28, wander: 0, shop: 'inn',
    greeting: 'THE INNKEEPER WIPES A MUG. "WELCOME TO THE WAYFARER."',
    talk: {
      NAME: 'BROM, AT THY SERVICE.',
      JOB: 'I SELL [FOOD] AND LET [ROOMS].',
      FOOD: (c) => (c.gold() >= 10 ? (c.give(-10), c.food(5), 'FIVE RATIONS FOR TEN GOLD. A FAIR PRICE, AND NO ONE SELLS THEM CHEAPER.') : 'TEN GOLD FOR FIVE RATIONS, AND THOU HAST LESS.'),
      ROOMS: (c) => (c.gold() >= 8 ? (c.give(-8), c.rest(), 'A BED, A WARM MEAL... *THE PARTY SLEEPS UNTIL DAWN AND WAKES HEALED*') : 'A ROOM IS EIGHT GOLD.'),
      MURDERS: 'THE TOWN TALKS OF NOTHING ELSE. SOME SAY THE FELLOWSHIP KNOWS MORE. I SAY NOTHING.',
      SHAMINO: 'THAT RANGER IN THE CORNER? HE ASKED AFTER THEE. AN OLD FRIEND, HE SAYS.',
    } },
  shamino: { name: 'SHAMINO', sprite: 'shamino', x: 34, y: 30, wander: 0, join: 'shamino',
    greeting: 'A RANGER GRINS. "AVATAR! IT HAS BEEN TOO LONG."',
    talk: {
      NAME: 'SHAMINO, THY OLD COMPANION - OR HAVE YEARS ERASED ME?',
      JOB: 'WANDERER, SCOUT, ARCHER. I WOULD HAPPILY [JOIN] THEE.',
      MURDERS: 'I HEARD. A BAND OF OUTLAWS HAS BEEN TERRORISING THE NORTH ROAD. SEARCH THE FOREST.',
      JOIN: (c) => (c.join('shamino') ? 'MY BOW IS THINE, AVATAR!' : 'I AM ALREADY WITH THEE, OR THY PARTY IS FULL.'),
    } },
  dupre: { name: 'DUPRE', sprite: 'dupre', x: 44, y: 41, wander: 1, join: 'dupre',
    greeting: 'A KNIGHT RAISES A FLASK. "AVATAR! WELL MET!"',
    talk: {
      NAME: 'SIR DUPRE. YES, THE ONE FROM THE STORIES.',
      JOB: 'KNIGHT-ERRANT. SOMETIMES KNIGHT-DRINKING. I WILL [JOIN] A GOOD CAUSE.',
      MURDERS: 'I HEARD THE BELLS. THERE IS WORK FOR A SWORD HERE.',
      JOIN: (c) => (c.join('dupre') ? 'MY SWORD AND MY FLASK ARE THINE!' : 'I AM ALREADY WITH THEE, OR THY PARTY IS FULL.'),
    } },
  jaana: { name: 'JAANA', sprite: 'jaana', x: 27, y: 37, wander: 0, shop: 'heal',
    greeting: 'A HEALER LOOKS UP FROM HER HERBS.',
    talk: {
      NAME: 'JAANA, HEALER OF TRINSIC.',
      JOB: 'I [HEAL] THE WOUNDED AND SELL [HERBS].',
      HEAL: (c) => (c.gold() >= 15 ? (c.give(-15), c.healAll(), 'FIFTEEN GOLD. *HER HANDS GLOW* THERE. THE WHOLE PARTY IS WELL AGAIN.') : 'FIFTEEN GOLD, AND THOU HAST NOT SO MUCH.'),
      HERBS: (c) => (c.gold() >= 10 ? (c.give(-10), c.herb(1), 'ONE HEALING HERB, TEN GOLD. USE IT WITH [H].') : 'A HERB COSTS TEN GOLD.'),
      MURDERS: 'I WASHED CHRISTOPHER\'S BODY. THE WOUNDS WERE FROM A SHORT BLADE - AND A HEAVY BOOT KICKED HIM AFTER HE FELL.',
    } },
  weston: { name: 'WESTON', sprite: 'weston', x: 38, y: 43, wander: 2,
    greeting: 'A SCRUFFY MAN LOOKS UP. "I DID NOTHING!"',
    talk: {
      NAME: 'WESTON. ...I STOLE ONE LOAF, YOU KNOW. ONE.',
      JOB: 'I SLEEP BY THE DOCK AND WATCH THE ROAD. NOBODY WATCHES ME.',
      MURDERS: 'I SAW LANTERNS ON THE FOREST ROAD THAT NIGHT. THEY WENT WEST, TO THE OLD WOODCUTTER\'S CLEARING IN THE NORTH-WEST.',
      LANTERNS: 'FOUR OR FIVE MEN. THE CAMP IS BEYOND THE NORTH GATE, WEST ALONG THE ROAD. DO NOT GO ALONE!',
    } },
  marta: { name: 'MARTA', sprite: 'villagerf', x: 35, y: 25, wander: 3,
    greeting: 'A WOMAN CLUTCHES HER BASKET.',
    talk: {
      NAME: 'MARTA THE WASHERWOMAN.', JOB: 'I WASH, I MEND, I LISTEN.',
      MURDERS: 'THEY SAY THE FELLOWSHIP IS BEHIND IT. BUT I HAVE SEEN THEM GIVE BREAD TO THE POOR.',
      FELLOWSHIP: 'THEY ARE KIND TO MY FAMILY. I WOULD NOT SPEAK ILL.',
    } },
  tobin: { name: 'OLD TOBIN', sprite: 'elder', x: 43, y: 21, wander: 2,
    greeting: 'AN OLD MAN LEANS ON THE WELL.',
    talk: {
      NAME: 'TOBIN. I HAVE DRAWN WATER HERE FIFTY YEARS.',
      JOB: 'I DRAW WATER AND GIVE ADVICE NOBODY ASKS FOR.',
      MURDERS: 'IN MY DAY WE HANGED THIEVES. BUT THESE KILLERS ARE NO MERE THIEVES.',
      WELL: 'THE WELL OF TRINSIC NEVER RUNS DRY.',
    } },
  joren: { name: 'JOREN', sprite: 'villager', x: 36, y: 20, wander: 0, home: [36, 20],
    greeting: 'A MAN MUTTERS.',
    talk: {
      NAME: 'JOREN, A CARPENTER.', JOB: 'I BUILD THINGS. LATELY, COFFINS.',
      MURDERS: 'TWO COFFINS IN ONE WEEK. I HAVE NEVER BUILT SO MANY.',
    } },
  dalla: { name: 'DALLA', sprite: 'merchant', x: 57, y: 37, wander: 0, shop: 'goods',
    greeting: 'A MERCHANT BOWS. "FINE GOODS, AVATAR."',
    talk: {
      NAME: 'DALLA, HARBOUR MERCHANT.',
      JOB: 'I SELL [FOOD] FOR THE ROAD, AND [GOSSIP] FOR FREE.',
      FOOD: (c) => (c.gold() >= 8 ? (c.give(-8), c.food(4), 'FOUR RATIONS, EIGHT GOLD.') : 'EIGHT GOLD FOR FOUR RATIONS.'),
      GOSSIP: 'WESTON SLEEPS NEAR THE DOCK AND SEES MORE THAN HE SAYS. ASK HIM ABOUT THE [LANTERNS].',
      LANTERNS: 'IF ANYONE KNOWS WHERE THE KILLERS HIDE, IT IS WESTON.',
    } },
  guard2: { name: 'TOWN GUARD', sprite: 'guard', x: 45, y: 24, wander: 2,
    greeting: 'A GUARD NODS.',
    talk: { NAME: 'JUST A GUARD OF TRINSIC.', JOB: 'WE PATROL THE STREETS. NO STRANGERS INSIDE THE WALLS.', MURDERS: 'GILBERTO KNOWS MORE. HE HOLDS THE GATE.' } },
};
export const DEAD = [
  { id: 'corpse_smith', x: 51, y: 17, frame: 4 },
  { id: 'corpse_gargoyle', x: 53, y: 18, frame: 5 },
];
export const DEFAULT_REPLY = ['HE SHRUGS.', 'NO ANSWER.', 'THOU ART NOT UNDERSTOOD.'];
export const BYE = ['BYE', 'GOOD', 'FARE', 'LEAV', 'QUIT'];
