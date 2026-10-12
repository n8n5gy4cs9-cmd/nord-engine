// @nord {"id":"app.router-state","title":"Router + state mini-framework","category":"apps","tier":["html"],"tags":["router","state","spa","framework"],"description":"~60-line SPA core: hash router (routes with :params), reactive store with subscribe(), and mount helper. createApp({routes}) → app.start(root). Use for multi-page UI apps without dependencies."}
export function createStore(initial = {}) {
  const subs = new Set(); let state = initial;
  return { get: () => state, set: (patch) => { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }; subs.forEach((f) => f(state)); }, subscribe: (f) => { subs.add(f); return () => subs.delete(f); } };
}
export function matchRoute(pattern, path) {
  const a = pattern.split('/').filter(Boolean), b = path.split('/').filter(Boolean), params = {};
  if (a.length !== b.length && !pattern.endsWith('*')) return null;
  for (let i = 0; i < a.length; i++) { if (a[i] === '*') return params; if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]); else if (a[i] !== b[i]) return null; }
  return params;
}
/** routes: { '/': (ctx)=>HTMLElement|string, '/user/:id': … }; ctx = { params, store, go }. */
export function createApp({ routes, state = {}, notFound = () => '404' }) {
  const store = createStore(state), go = (p) => { location.hash = '#' + p; };
  return {
    store, go,
    start(root) {
      const render = () => {
        const path = location.hash.slice(1) || '/';
        for (const [pat, view] of Object.entries(routes)) { const params = matchRoute(pat, path); if (params) { const v = view({ params, store, go }); return root.replaceChildren(v instanceof Node ? v : document.createTextNode(String(v))); } }
        root.replaceChildren(document.createTextNode(String(notFound({ path }))));
      };
      addEventListener('hashchange', render); store.subscribe(render); render(); return () => removeEventListener('hashchange', render);
    },
  };
}
export function mount(root) {
  const app = createApp({ state: { n: 0 }, routes: {
    '/': ({ store, go }) => { const d = document.createElement('div'); d.innerHTML = `<h3>Home</h3><p>Count: ${store.get().n}</p>`; const b = document.createElement('button'); b.textContent = '+1'; b.onclick = () => store.set((s) => ({ n: s.n + 1 })); const a = document.createElement('button'); a.textContent = 'Go to /hello/world'; a.onclick = () => go('/hello/world'); d.append(b, ' ', a); return d; },
    '/hello/:name': ({ params, go }) => { const d = document.createElement('div'); d.innerHTML = `<h3>Hello ${params.name.replace(/[<>&]/g, '')}</h3>`; const b = document.createElement('button'); b.textContent = 'Back'; b.onclick = () => go('/'); d.append(b); return d; },
  } });
  const stop = app.start(root); return { destroy: () => { stop(); root.replaceChildren(); } };
}
