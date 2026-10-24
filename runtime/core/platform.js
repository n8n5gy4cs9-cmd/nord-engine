// Where is the game running? (Unity's Application.platform / isEditor.) Plain browser facts; no engine state.
const hasWindow = typeof window !== 'undefined' && typeof navigator !== 'undefined';
const q = () => (hasWindow ? new URLSearchParams(window.location.search) : new URLSearchParams());

/** 'mac' | 'win' | 'linux' | 'ios' | 'android' | 'unknown' (the machine, not the shell). */
function detectOs() {
  if (!hasWindow) return typeof process !== 'undefined' ? ({ darwin: 'mac', win32: 'win', linux: 'linux' }[process.platform] ?? 'unknown') : 'unknown';
  const ua = `${navigator.userAgentData?.platform ?? ''} ${navigator.platform ?? ''} ${navigator.userAgent ?? ''}`;
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua) || (/mac/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/mac/i.test(ua)) return 'mac';
  if (/win/i.test(ua)) return 'win';
  if (/linux|x11|cros/i.test(ua)) return 'linux';
  return 'unknown';
}

const os = detectOs();
/** Inside the Nord editor's Game view (the editor adds `editor=1` to the page address). */
export const isEditor = q().get('editor') === '1';
/** Inside the exported desktop app (Mac/Windows/Linux shell). */
export const isDesktopApp = hasWindow && !!window.__nordDesktop;
export const isMobile = os === 'ios' || os === 'android';
/** Unity's RuntimePlatform names. */
export const RuntimePlatform = Object.freeze({
  OSXEditor: 'OSXEditor', WindowsEditor: 'WindowsEditor', LinuxEditor: 'LinuxEditor',
  OSXPlayer: 'OSXPlayer', WindowsPlayer: 'WindowsPlayer', LinuxPlayer: 'LinuxPlayer',
  WebGLPlayer: 'WebGLPlayer', IPhonePlayer: 'IPhonePlayer', Android: 'Android',
});
const EDITOR = { mac: 'OSXEditor', win: 'WindowsEditor', linux: 'LinuxEditor' };
const PLAYER = { mac: 'OSXPlayer', win: 'WindowsPlayer', linux: 'LinuxPlayer', ios: 'IPhonePlayer', android: 'Android' };

export function runtimePlatform() {
  if (isEditor) return EDITOR[os] ?? 'LinuxEditor';
  if (isDesktopApp) return PLAYER[os] ?? 'LinuxPlayer';
  return 'WebGLPlayer'; // anything running in a browser tab / exported web game, whatever the OS
}
/** The operating system of the machine: 'mac' | 'win' | 'linux' | 'ios' | 'android'. */
export const operatingSystem = () => os;

/**
 * Editor-only niceties for the Game view. Standalone / exported games never get these.
 *  - Esc releases a locked mouse (Unity editor behaviour; Settings ▸ "Esc releases a locked mouse", `esc=0` turns it off).
 *  - Tells the editor when the Game view gains/loses keyboard focus, so editor shortcuts (Q/W/E/R…) stay silent while playing.
 */
export function installEditorHooks() {
  if (!hasWindow || !isEditor || window.__nordEditorHooks) return;
  window.__nordEditorHooks = true;
  const send = (m) => { try { fetch('/api/ipc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(m), keepalive: true }); } catch { /* editor gone */ } };
  if (q().get('esc') !== '0') {
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.pointerLockElement) document.exitPointerLock?.(); }, true);
  }
  window.addEventListener('focus', () => send({ t: 'gameFocus', on: true }));
  window.addEventListener('blur', () => send({ t: 'gameFocus', on: false }));
  window.addEventListener('pointerdown', () => send({ t: 'gameFocus', on: true }), true);
}
