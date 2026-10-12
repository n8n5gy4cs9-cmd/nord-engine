// Types for window.nord.desktop (runtime/desktop/nord-desktop.js). See docs/DESKTOP_APPS.md.
export class NordDesktopError extends Error { code: 'denied' | 'unsupported' | 'not_found' | 'invalid' | 'io' | 'cancelled' }
export interface Entry { name: string; isDir: boolean; size: number; modified: number }
export interface FsEvent { kind: 'created' | 'modified' | 'removed'; path: string }
export interface FileFilter { name: string; extensions: string[] }
export interface DialogOptions { title?: string; filters?: FileFilter[]; directory?: string; fileName?: string; multiple?: boolean }
export interface MenuItem { id?: string; label?: string; accelerator?: string; separator?: boolean; checked?: boolean; enabled?: boolean; role?: string; items?: MenuItem[] }
export interface WindowOptions { id: string; title?: string; url?: string; width?: number; height?: number; frameless?: boolean; transparent?: boolean; alwaysOnTop?: boolean; fullscreen?: boolean; resizable?: boolean }
export interface Desktop {
  readonly transport: 'ipc' | 'http' | 'web' | null;
  ready: Promise<void>;
  app: { info(): Promise<{ name: string; version: string; id: string; os: string; arch: string; shell: string }>; paths(): Promise<Record<string, string | null>>; permissions(): Promise<{ summary: string[]; granted: unknown }>; launch(): Promise<{ files: string[]; urls: string[] }>; audit(o?: { limit?: number }): Promise<string[]>; quit(): Promise<void>; setQuitGuard(enable?: boolean): Promise<void>; setAutostart(enable?: boolean): Promise<void> };
  /** Paths: `appData:x/y` (or bare `x/y`), `documents:`, `downloads:`, `temp:` (if granted), or an absolute path the user picked in a dialog. */
  fs: { readText(p: string): Promise<string>; writeText(p: string, t: string): Promise<void>; append(p: string, t: string): Promise<void>; read(p: string): Promise<Uint8Array>; write(p: string, d: Uint8Array | ArrayBuffer | string): Promise<void>; readJson<T = unknown>(p: string): Promise<T>; writeJson(p: string, v: unknown): Promise<void>; list(p?: string): Promise<Entry[]>; stat(p: string): Promise<Entry>; exists(p: string): Promise<boolean>; mkdir(p: string): Promise<void>; remove(p: string, o?: { recursive?: boolean }): Promise<void>; rename(a: string, b: string): Promise<void>; copy(a: string, b: string): Promise<void>; watch(p: string, cb: (e: FsEvent) => void, o?: { recursive?: boolean; interval?: number }): Promise<() => void> };
  dialog: { open(o?: DialogOptions): Promise<string[] | null>; save(o?: DialogOptions): Promise<string | null>; folder(o?: DialogOptions): Promise<string | null>; recent(): Promise<string[]>; message(text: string, o?: { title?: string; level?: 'info' | 'warning' | 'error' }): Promise<void>; confirm(text: string, o?: { title?: string }): Promise<boolean> };
  notify: { (title: string, body?: string): Promise<void>; setBadge(text: string | number | null): Promise<void>; setProgress(value: number | null): Promise<void> };
  clipboard: { readText(): Promise<string | null>; writeText(t: string): Promise<void>; readImage(): Promise<string | null>; writeImage(png: Uint8Array): Promise<void> };
  store: { get<T = unknown>(k: string, fallback?: T): Promise<T>; set(k: string, v: unknown): Promise<void>; remove(k: string): Promise<void>; keys(): Promise<string[]>; clear(): Promise<void> };
  secret: { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void>; delete(k: string): Promise<void> };
  shell: { openUrl(u: string): Promise<void>; openPath(p: string): Promise<void>; reveal(p: string): Promise<void> };
  process: { run(program: string, args?: string[], o?: { cwd?: string }): Promise<{ code: number | null; stdout: string; stderr: string }> };
  http: { fetch(url: string, o?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; body: string }> };
  window: { open(o: WindowOptions): Promise<void>; close(id: string): Promise<void>; setTitle(t: string): Promise<void>; setFullscreen(on?: boolean): Promise<void>; setAlwaysOnTop(on?: boolean): Promise<void> };
  menu: { set(items: MenuItem[]): Promise<void>; context(items: MenuItem[], pos?: { x?: number; y?: number }): Promise<void> };
  tray: { set(o: { icon?: string; tooltip?: string; items?: MenuItem[] }): Promise<void>; remove(): Promise<void> };
  shortcut: { register(id: string, accelerator: string, cb?: () => void): Promise<void>; unregister(id: string): Promise<void> };
  on(event: 'menu' | 'tray' | 'drop' | 'open' | 'quit-requested' | `shortcut:${string}` | (string & {}), fn: (payload: any) => void): () => void;
  off(event: string, fn: (payload: any) => void): void;
}
export function create(appId?: string, force?: 'ipc' | 'http' | 'web'): Desktop;
declare const desktop: Desktop;
export default desktop;
