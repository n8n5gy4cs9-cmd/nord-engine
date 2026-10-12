// Item definitions. Numbers follow Shattered Pixel Dungeon (GPL-3.0): MeleeWeapon min = tier, max = 5*(tier+1); STR req = 8+2*tier;
// Armor DRMax = tier*(2+lvl); accuracy / 1.5^missing STR, attack delay * 1.2^missing STR (Weapon.java, Armor.java).
export const WEAPONS = {
  wornSword: { name: 'Worn Shortsword', tier: 1, min: 1, max: 10, str: 10, desc: 'It is worn, but still sharp enough to kill a rat.' },
  sword: { name: 'Sword', tier: 3, min: 3, max: 20, str: 14, desc: 'A heavy, honest blade. Needs 14 strength to wield properly.' },
};
export const ARMORS = {
  clothArmor: { name: 'Cloth Armor', tier: 1, str: 10, desc: 'Not much protection, but better than none.' },
  leatherArmor: { name: 'Leather Armor', tier: 2, str: 12, desc: 'Boiled leather. Absorbs 0-4 damage per hit.' },
};
// potion colours -> effects are shuffled per run (like SPD): you learn them by drinking
export const POTION_COLORS = ['crimson', 'azure', 'jade', 'amber', 'violet'];
export const POTION_EFFECTS = {
  healing: { name: 'Healing', desc: 'Restores most of your health.' },
  strength: { name: 'Strength', desc: 'Permanently +1 strength.' },
  haste: { name: 'Haste', desc: 'You move and act twice as fast for a while.' },
  experience: { name: 'Experience', desc: 'Grants enough experience for a new level.' },
  shadows: { name: 'Shadows', desc: 'Monsters have a hard time noticing you for a while.' },
};
export const SCROLL_RUNES = ['rune', 'blue'];
export const SCROLL_EFFECTS = {
  mapping: { name: 'Magic Mapping', desc: 'Reveals the layout of the level.' },
  teleport: { name: 'Teleportation', desc: 'Teleports you to a random place on the level.' },
};
export const drMax = (tier, lvl = 0) => tier * (2 + lvl);
