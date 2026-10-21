import { Save } from './save.js';
import { DEFAULT_FEEDS, parseFeed, mergeArticles, safeLink } from './feeds.js';
import { createRiver } from './river.js';
import { download } from './desk.js';
export async function mount(root) {
  root.innerHTML = /* HTML */ `
    <link rel="stylesheet" href="style.css" />
    <main>
      <header>
        <div class="brand">
          <span class="boat"></span>
          <div>
            <h1>RSS River</h1>
            <p>A quieter current for curious developers.</p>
          </div>
        </div>
        <nav>
          <button id="refresh">Refresh feeds</button>
          <button id="native">Fetch with Nord host</button>
          <button id="mode">3D paper river</button>
          <button id="backup">Backup library</button>
        </nav>
      </header>
      <section class="layout">
        <aside>
          <h3>SOURCES</h3>
          <select id="feed">
            <option value="all">All sources</option>
          </select>
          <input id="search" placeholder="Search titles & summaries" />
          <label>
            <input id="unread" type="checkbox" />
            Unread only
          </label>
          <label>
            <input id="stars" type="checkbox" />
            Starred only
          </label>
          <button id="readall">Mark visible read</button>
          <hr />
          <h3>IMPORT A FEED</h3>
          <label>
            RSS / Atom XML
            <input id="import" type="file" accept=".xml,.rss,.atom,.json" />
          </label>
          <input id="custom" placeholder="https://example.org/feed.xml" />
          <button id="add">Add feed URL</button>
          <button id="demo">Load local demo</button>
          <p>
            Feeds refresh only when asked. Read cached news offline. If a site blocks
            browser CORS, import its XML or use Nord host fetch.
          </p>
          <div id="counts"></div>
        </aside>
        <div class="content">
          <div class="viewbar">
            <b id="heading">Your reading room</b>
            <span id="status">Local cache ready</span>
          </div>
          <div id="list"></div>
          <canvas id="river" hidden></canvas>
        </div>
        <article id="reader">
          <p class="eyebrow">SELECT A PAPER</p>
          <h2>Welcome to the river.</h2>
          <p>
            Your saved articles stay on this device. The initial demo is original tutorial
            content, clearly marked as local demo.
          </p>
        </article>
      </section>
      <footer>Local-first RSS + Atom · no account · Crowelian 2026 + Sonnet</footer>
    </main>
  `;
  const $ = (id) => root.querySelector('#' + id),
    save = new Save('rss-river');
  let feeds = save.get('feeds', DEFAULT_FEEDS),
    articles = save.get('articles', []),
    selected = null,
    river = null,
    in3d = false,
    alive = true;
  if (!Array.isArray(feeds) || !feeds.length) feeds = [...DEFAULT_FEEDS];
  if (!Array.isArray(articles)) articles = [];
  const say = (t) => ($('status').textContent = t);
  const persist = () => {
    try {
      save.set('feeds', feeds);
      save.set('articles', articles);
    } catch {
      say('Storage is full; use Backup library.');
    }
  };
  function feedOptions() {
    const select = $('feed'),
      value = select.value;
    select.replaceChildren();
    for (const f of [{ id: 'all', name: 'All sources' }, ...feeds]) {
      const o = document.createElement('option');
      o.value = f.id;
      o.textContent = f.name;
      select.append(o);
    }
    select.value = [...select.options].some((o) => o.value === value) ? value : 'all';
  }
  feedOptions();
  const visible = () =>
    articles
      .filter(
        (a) =>
          ($('feed').value === 'all' || a.feed === $('feed').value) &&
          (!$('unread').checked || !a.read) &&
          (!$('stars').checked || a.star) &&
          (a.title + ' ' + a.summary)
            .toLowerCase()
            .includes($('search').value.toLowerCase()),
      )
      .slice()
      .reverse();
  function read(id) {
    selected = id;
    const a = articles.find((a) => a.id === id);
    if (!a) return;
    a.read = true;
    persist();
    const reader = $('reader');
    reader.replaceChildren();
    const source = document.createElement('p');
    source.className = 'eyebrow';
    source.textContent = a.source;
    const h = document.createElement('h2');
    h.textContent = a.title;
    const date = document.createElement('p');
    date.className = 'date';
    date.textContent = a.date ? new Date(a.date).toLocaleString() : '';
    const text = document.createElement('p');
    text.textContent = a.summary;
    const star = document.createElement('button');
    star.textContent = a.star ? '★ Starred' : '☆ Star';
    star.onclick = () => {
      a.star = !a.star;
      persist();
      read(id);
      if (in3d) showRiver();
    };
    const flick = document.createElement('button');
    flick.textContent = 'Flick this paper';
    flick.onclick = () => river?.flick(id);
    reader.append(source, h, date, text, star, flick);
    const link = safeLink(a.link);
    if (link) {
      const aTag = document.createElement('a');
      aTag.textContent = 'Read original ↗';
      aTag.href = link;
      aTag.target = '_blank';
      aTag.rel = 'noopener noreferrer';
      reader.append(aTag);
    }
    renderList();
  }
  function renderList() {
    const list = $('list');
    list.replaceChildren();
    const items = visible();
    for (const a of items) {
      const b = document.createElement('button');
      b.className =
        'news ' + (a.read ? 'read ' : '') + (a.id === selected ? 'selected' : '');
      const tag = document.createElement('span');
      tag.textContent = (a.star ? '★ ' : '') + a.source;
      const title = document.createElement('strong');
      title.textContent = a.title;
      const summary = document.createElement('p');
      summary.textContent = a.summary.slice(0, 150);
      b.append(tag, title, summary);
      b.onclick = () => read(a.id);
      list.append(b);
    }
    if (!items.length)
      list.textContent =
        'No articles match. Refresh, import a feed, or load the local demo.';
    $('counts').textContent =
      `${articles.length} cached · ${articles.filter((a) => !a.read).length} unread · ${articles.filter((a) => a.star).length} starred`;
    $('heading').textContent = `${items.length} papers in your current`;
  }
  let riverVersion = 0;
  async function showRiver() {
    const version = ++riverVersion;
    try {
      say('Preparing Babylon + Havok…');
      const next = await createRiver($('river'), visible(), read);
      // A newer filter/view request owns the UI; release this stale scene.
      if (version !== riverVersion || !alive) {
        next.dispose();
        return;
      }
      river?.dispose();
      river = next;
      in3d = true;
      $('list').hidden = true;
      $('river').hidden = false;
      $('mode').textContent = '2D reading list';
      river.resize();
      say('Orbit slowly · click a paper to read · Flick drops it with Havok');
    } catch (e) {
      say(e.message);
    }
  }
  $('mode').onclick = () => {
    if (in3d) {
      riverVersion++;
      in3d = false;
      $('list').hidden = false;
      $('river').hidden = true;
      $('mode').textContent = '3D paper river';
      river?.dispose();
      river = null;
    } else showRiver();
  };
  for (const id of ['feed', 'search', 'unread', 'stars'])
    $(id).addEventListener('input', () => {
      renderList();
      if (in3d) showRiver();
    });
  async function refresh(native = false) {
    $('refresh').disabled = true;
    let count = 0;
    const errors = [];
    let desktop;
    if (native) {
      try {
        desktop = (await import('./nord-desktop.js')).default;
      } catch (e) {
        errors.push(e.message);
      }
    }
    for (const feed of feeds.filter((f) => !f.demo)) {
      try {
        let xml;
        if (native) {
          if (!desktop) throw Error('Nord desktop bridge unavailable');
          const r = await desktop.http.fetch(feed.url);
          if (r.status >= 400) throw Error('HTTP ' + r.status);
          xml = r.body;
        } else {
          const r = await fetch(feed.url, { signal: AbortSignal.timeout(12000) });
          if (!r.ok) throw Error('HTTP ' + r.status);
          xml = await r.text();
        }
        const items = parseFeed(xml, feed);
        articles = mergeArticles(articles, items);
        count += items.length;
      } catch (e) {
        errors.push(feed.name + ': ' + e.message);
      }
    }
    persist();
    renderList();
    if (in3d) await showRiver();
    say(
      `Updated ${count} entries${errors.length ? ' · Some feeds blocked/offline; XML import or Nord host fetch works. ' + errors.join(' | ') : ''}`,
    );
    $('refresh').disabled = false;
  }
  $('refresh').onclick = () => refresh();
  $('native').onclick = () => refresh(true);
  $('readall').onclick = () => {
    visible().forEach((a) => (a.read = true));
    persist();
    renderList();
  };
  $('add').onclick = () => {
    const url = safeLink($('custom').value);
    if (!url) {
      say('Enter an HTTP or HTTPS feed URL.');
      return;
    }
    if (feeds.some((f) => f.url === url)) {
      say('Already subscribed.');
      return;
    }
    feeds.push({ id: 'custom-' + Date.now(), name: new URL(url).hostname, url });
    feedOptions();
    persist();
    say(
      'Feed added; click Refresh. Native fetch needs that host in project permissions.',
    );
  };
  async function demo() {
    const r = await fetch('demo.xml');
    const f = {
      id: 'demo',
      name: 'Local demo — tutorial stories',
      url: 'https://example.org/',
      demo: true,
    };
    if (!feeds.some((v) => v.id === 'demo')) feeds.push(f);
    articles = mergeArticles(articles, parseFeed(await r.text(), f));
    feedOptions();
    persist();
    renderList();
    say('Original local demo loaded — not live news.');
  }
  $('demo').onclick = demo;
  $('import').onchange = async () => {
    const file = $('import').files[0];
    if (!file) return;
    try {
      if (file.size > 2000000) throw Error('Choose a file below 2 MB');
      const text = await file.text();
      if (file.name.endsWith('.json')) {
        const data = JSON.parse(text);
        if (!Array.isArray(data.feeds) || !Array.isArray(data.articles))
          throw Error('Expected RSS River backup');
        feeds = data.feeds
          .slice(0, 30)
          .filter((f) => typeof f.name === 'string' && safeLink(f.url));
        articles = data.articles
          .slice(-240)
          .filter(
            (a) =>
              typeof a.id === 'string' &&
              typeof a.title === 'string' &&
              typeof a.summary === 'string',
          );
      } else {
        const f = {
          id: 'import-' + Date.now(),
          name: file.name,
          url: 'https://example.org/',
          demo: true,
        };
        articles = mergeArticles(articles, parseFeed(text, f));
        feeds.push(f);
      }
      feedOptions();
      persist();
      renderList();
      say('Imported ' + file.name);
    } catch (e) {
      say(e.message);
    }
  };
  $('backup').onclick = () =>
    download('rss-river-library.json', JSON.stringify({ feeds, articles }, null, 2));
  renderList();
  if (!articles.length) await demo();
  window.__rss = {
    get articles() {
      return articles;
    },
    get feeds() {
      return feeds;
    },
    get river() {
      return river;
    },
    read,
  };
  return () => {
    alive = false;
    river?.dispose();
    root.replaceChildren();
  };
}
