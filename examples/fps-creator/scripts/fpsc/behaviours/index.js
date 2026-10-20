// Built-in scripts (behaviours). One file per script; the editor lists these, the runtime resolves them by id.
// Your own scripts live in <project>/fpsc/scripts/*.js and are listed in <project>/fpsc/bank.json ("scripts"). Contract: docs/FPS_CREATOR.md §Scripts.
// GENERATED LIST: add a new file to this folder and re-run `node tools/fpsc-tools.mjs index` (or add the import by hand).
import sAiBoss from './ai-boss.js';
import sAiFlyer from './ai-flyer.js';
import sAiMelee from './ai-melee.js';
import sAiPatrol from './ai-patrol.js';
import sAiShooter from './ai-shooter.js';
import sAiSniper from './ai-sniper.js';
import sAiTurret from './ai-turret.js';
import sAmbientSound from './ambient-sound.js';
import sBreakable from './breakable.js';
import sEmitter from './emitter.js';
import sExplosive from './explosive.js';
import sHazard from './hazard.js';
import sLightFlicker from './light-flicker.js';
import sLightPulse from './light-pulse.js';
import sNpcTalk from './npc-talk.js';
import sObjectiveKillAll from './objective-kill-all.js';
import sPickup from './pickup.js';
import sSpawner from './spawner.js';
import sSpin from './spin.js';
import sSwitch from './switch.js';
import sTimer from './timer.js';
import sTriggerCheckpoint from './trigger-checkpoint.js';
import sTriggerMessage from './trigger-message.js';
import sTriggerSpawn from './trigger-spawn.js';
import sTriggerTeleport from './trigger-teleport.js';
import sTriggerWin from './trigger-win.js';
import sTriggerZone from './trigger-zone.js';
import sUsableMessage from './usable-message.js';

export const BUILTIN_SCRIPTS = [
  sAiBoss, sAiFlyer, sAiMelee, sAiPatrol, sAiShooter, sAiSniper, sAiTurret, sAmbientSound, sBreakable, sEmitter, sExplosive, sHazard, sLightFlicker, sLightPulse, sNpcTalk, sObjectiveKillAll, sPickup, sSpawner, sSpin, sSwitch, sTimer, sTriggerCheckpoint, sTriggerMessage, sTriggerSpawn, sTriggerTeleport, sTriggerWin, sTriggerZone, sUsableMessage,
];
