// Skins (font pairs) + dark + light themes, shared by the runtime UI, the editor webviews and the code editor.
// Data lives in assets/themes/themes.json (generated into themes.data.js). Everything is offline: fonts come from vendor/fonts.
import data from './themes.data.js';

export const SKINS = data.skins;
export const THEMES = data.themes;
export const FONTS = data.fonts;
export const DEFAULTS = data.defaults;
export const skin = (id) => SKINS.find((s) => s.id === id) ?? SKINS[0];
export const theme = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];

/** @font-face rules for every vendored family (or only `families`). `base` is where vendor/fonts is served (dev: '/vendor/fonts'). */
export function fontFaceCSS(base = '/vendor/fonts', families = Object.keys(FONTS)) {
  return families.map((fam) => {
    const f = FONTS[fam];
    return f.weights.map((w) => `@font-face{font-family:'${fam}';font-weight:${w};font-style:normal;font-display:swap;src:url('${base}/${f.dir}/${f.dir}-latin-${w}-normal.woff2') format('woff2')}`).join('');
  }).join('\n');
}

const stack = (fam, kind) => `'${fam}',${kind === 'mono' ? "ui-monospace,Menlo,Consolas,monospace" : "system-ui,-apple-system,'Segoe UI',sans-serif"}`;

/** CSS custom properties for a skin+theme pair: `--nord-*` (UI colors), `--nord-font-ui`, `--nord-font-code`, `--nord-code-*` (syntax). */
export function themeVars(skinId = DEFAULTS.skin, themeId = DEFAULTS.theme) {
  const s = skin(skinId), t = theme(themeId), v = {};
  for (const [k, c] of Object.entries(t.ui)) v[`--nord-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`] = c;
  for (const [k, c] of Object.entries(t.code)) v[`--nord-code-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`] = c;
  v['--nord-font-ui'] = stack(s.ui, 'sans');
  v['--nord-font-code'] = stack(s.code, 'mono');
  v['--nord-code-ligatures'] = s.ligatures ? 'normal' : 'none';
  return v;
}

/** Inject fonts once and apply vars to `el` (default: <html>). Persists the choice. Returns { skin, theme }. */
export function applyTheme(el = globalThis.document?.documentElement, { skin: sk, theme: th, base = '/vendor/fonts', storage = globalThis.localStorage } = {}) {
  const read = (k, d) => { try { return storage?.getItem(`nord:${k}`) ?? d; } catch { return d; } };
  const skinId = skin(sk ?? read('skin', DEFAULTS.skin)).id, themeId = theme(th ?? read('theme', DEFAULTS.theme)).id;
  const doc = el.ownerDocument;
  if (!doc.getElementById('nord-fonts')) { const st = doc.createElement('style'); st.id = 'nord-fonts'; st.textContent = fontFaceCSS(base); doc.head.appendChild(st); }
  for (const [k, val] of Object.entries(themeVars(skinId, themeId))) el.style.setProperty(k, val);
  el.style.setProperty('font-family', 'var(--nord-font-ui)');
  try { storage?.setItem('nord:skin', skinId); storage?.setItem('nord:theme', themeId); } catch { /* storage unavailable */ }
  return { skin: skinId, theme: themeId };
}

/** Styles for a <pre>/<code> editor surface using the code vars (ligatures follow the skin). */
export const CODE_CSS = `.nord-code{font-family:var(--nord-font-code);font-variant-ligatures:var(--nord-code-ligatures,normal);font-feature-settings:"liga" 1,"calt" 1;background:var(--nord-code-bg);color:var(--nord-code-fg)}`;
