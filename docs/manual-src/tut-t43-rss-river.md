---
title: T43 RSS River — build a calm reader with a physical paper view
section: Tutorials
order: 43
summary: A complete HTML news reader with RSS/Atom import, three default subscriptions, offline cache, search/read/star state and a Babylon/Havok river of papers. Full source and original sprites.
---

Build **RSS River**, an original local-first news reader for developers. Its ordinary reading view gives you a source list, search, unread/star filters and readable article summaries. Its optional 3D view turns those stories into slowly flowing papers over a desk. Starred stories become larger and float higher. Click a paper to read it, then flick it onto the desk with real Havok physics.

**Download:** [Complete RSS River app, source and sprites](assets/downloads/rss-river-source.zip). Extract, open `nord.project.json` in Nord and press **Play**. This is a complete **HTML-tier** project with local Babylon/Havok files and no npm step. An original local demo makes every feature usable before you fetch external news. Demo stories are explicitly labelled and are not presented as current reporting.

![RSS River list, filters and reading pane](assets/screenshots/ed-rss-list.png)

**Full-code learning route:** After the orientation below, continue to [the complete file-by-file walkthrough](#file-walkthrough). It teaches every main project file in consecutive sections, with the actual code, an explanation of what and why, and a change to try. The expandable complete files at the end are a reference, not the lesson.

## 1. Learn the finished reader

Click a story to read its summary and mark it read. Star it to keep it important. Search matches titles and summaries; Unread only and Starred only combine with the source selector. Mark visible read affects only your current filtered list. Backup library downloads your subscriptions, cached entries and reading flags as JSON; the Import control accepts that backup as well as RSS/Atom XML.

Click **3D paper river** to explore the same filtered stories spatially. Drag to orbit and use the wheel to zoom. Click a paper to open its reading pane, then **Flick this paper** to drop that paper with an impulse. The ordinary list remains available at any time. Flicking is a temporary visual action: it does not delete an article from your library.

The initial subscriptions are:

| Source | Purpose | Default endpoint |
| --- | --- | --- |
| Hacker News through hnrss | Developer/community news | `https://hnrss.org/frontpage` |
| Simon Willison | AI/LLMs and practical development | `https://simonwillison.net/atom/everything/` |
| GitHub Engineering | Coding and engineering | `https://github.blog/engineering/feed/` |

These endpoints were checked while building the tutorial. Feeds change and network access can fail; the reader shows an update error and keeps cached content. Nothing fetches until you click Refresh. The local demo is a fourth, clearly marked source used only for the tutorial.

## 2. Open and edit the real project

| File | Responsibility |
| --- | --- |
| `feeds.js` | Default subscriptions, RSS/Atom parsing, safe links and merge rules |
| `app.js` | Reader UI, filters, refresh/import, reading flags and local save |
| `river.js` | Article textures, flow, importance and physics flicks |
| `desk.js` | Shared Babylon/Havok desk, local script loading and downloads |
| `save.js` | Nord Save class backed by localStorage |
| `demo.xml` | Original local sample articles |
| `nord-desktop.js` | Existing Nord host bridge for permitted HTTP requests |
| `.offline-allow` | Explicit feed hosts used as app data, not CDN dependencies |
| `style.css` | Modern list, reading page, sidebar and responsive layout |

Change the subtitle in `app.js` and stop/start Play to see it. Change an original demo title in `demo.xml` and click Load local demo to merge the updated entry. Use the Console for source errors. The guide's code blocks are editable/copyable CodeMirror views; the complete files at the end are the runnable solution.

This project is inspired by reader workflows in FreshRSS and NetNewsWire. Their repositories were consulted for product context; no PHP/Swift source or assets were copied. This app implements its own small browser data model and renderer rather than claiming to port a complete mature aggregator.

## 3. Parse RSS and Atom into one article model

RSS uses `item`, `title`, `link`, `description` and often `guid`. Atom uses `entry`, link attributes, `summary`/`content` and `id`. `parseFeed()` accepts both and converts each entry into the same shape:

```js
{
  id: 'source:stable-entry-id', feed: 'source', source: 'Source name',
  title: 'Article title', link: 'https://example.org/article',
  summary: 'Plain text excerpt', date: '', read: false, star: false
}
```

The source ID is part of the article key, so identical entry IDs from different feeds do not collide. Prefer a feed's stable ID, then a link, with a final title-based fallback. Limit entries and text lengths so one huge feed cannot overwhelm the view.

The parser rejects malformed XML and accepts only HTTP/HTTPS article links. It converts description markup to plain text using an inert parsed document, removes active container elements, and reads `textContent`. The UI creates DOM nodes and sets `textContent`; it does not insert remote description HTML into its controls. Remote images and tracking pixels are not loaded by the summary reader.

**Learning check:** import a tiny RSS file with two items. Give one a description containing bold text and verify it appears as text, then try malformed XML and check the visible error. Add an Atom `entry` with an alternate `link href` and confirm Read original points to that link.

## 4. Merge updates without losing reading state

`mergeArticles(old, incoming)` indexes existing entries by stable ID. Incoming content updates a record while preserving its old `read` and `star` flags. Refreshing should not turn every article unread again or remove a star.

```js
const previous = map.get(article.id);
map.set(article.id, { ...article,
  read: previous?.read || false,
  star: previous?.star || false
});
```

The cache is capped at 240 entries; this is a small personal reading room rather than an archival database. Search and source filters operate on that cache. Switching between list and river changes the view, not the stored articles.

Try starring a demo article, loading the demo again and refreshing the page. The star should remain. Mark visible read with a source filter active, then remove the filter and confirm other sources were not affected.

## 5. Handle browser CORS honestly

A feed being public does not guarantee browsers can fetch it from your app's origin. At verification time Simon Willison and GitHub Engineering returned permissive CORS headers; the Hacker News endpoint did not. A browser may therefore reject that request even though opening its URL directly works.

RSS River offers three explicit paths:

- Refresh feeds uses normal browser `fetch()` with a timeout and reports per-feed failures.
- Import accepts a downloaded RSS/Atom XML file, so any source can be read without a public proxy.
- Fetch with Nord host calls Nord's existing capability-checked `desktop.http.fetch()` bridge when running under Nord's host/dev server.

The project manifest declares only the three default feed hosts for native HTTP. Adding a custom feed URL does not silently expand those permissions; add its hostname to `desktop.permissions.net.hosts` and review Nord's normal grant prompt if using host fetch. A plain static browser export has no native bridge and should use CORS-enabled feeds or XML import.

The `.offline-allow` file tells Nord's static URL scanner that these explicit feed endpoints are intentional app data. All JavaScript, physics, fonts used by the page and the sprite sheet remain local. The app needs a connection only when refreshing external news. Do not solve CORS by pasting a random public proxy into a supposedly private reader.

## 6. Build a readable HTML list first

`renderList()` creates one button per visible story, with source, title and a short summary. Clicking opens a separate article pane, marks the item read and writes the library. The read pane uses a comfortable light paper surface and a large serif title; the surrounding app uses a dark developer-tool palette.

A safe Read original anchor uses the normalized URL, a new tab and `noopener noreferrer`. The app caches summaries rather than claiming to scrape full articles. Read the publisher's original when you want the complete story.

The supplied original sprite sheet includes paper, three sticky colours, a ghost, pen, clip and boat. RSS River uses the boat as its identity; Paper Worlds uses the ghost. It is bundled at `assets/dev-desk-sprites.png`. You can replace it with your own 4×2 sheet and keep the CSS background positions.

**Learning check:** narrow the browser window. The reading pane should move below the list rather than crush the article text. Confirm an empty filter produces a useful message and that the local demo can restore a working view without network access.

## 7. Paint articles onto Babylon papers

![The optional 3D river with readable article papers](assets/screenshots/ed-rss-river.png)

`createRiver()` receives up to eighteen filtered articles. For each it creates a plane and a DynamicTexture. A canvas painter wraps the title and summary, prints the source and reading status, and fills an ivory page. The material is unlit/emissive for stable text legibility; the mesh casts a shadow onto the illuminated desk.

```js
const paper = desk.paper('Article', width, height, context => {
  context.fillStyle = '#f7f4e9';
  context.fillRect(0, 0, 1024, 768);
  // Draw source, wrapped title, excerpt and status here.
});
```

The complete wrapping helper in `river.js` measures words and limits line count. It does not depend on remote fonts or a website screenshot. Every paper has metadata containing its article ID; Babylon picking sends that ID back to the same `read()` function used by the list.

A render-loop callback moves floating papers slowly along Z and wraps them to the start. A small sine offset gives gentle vertical motion and tilt. Starred papers use larger dimensions and a higher base Y, making importance visible in space. This movement is a view effect and does not change article order or reading flags.

## 8. Flick a floating paper into real physics

A floating paper initially follows its authored river animation. Clicking Flick creates an invisible thin box collider of the same dimensions and parents the visual plane to it. A dynamic Babylon PhysicsAggregate takes over and receives an impulse. That paper stops participating in the river movement loop.

```js
aggregate.body.applyImpulse(
  new BABYLON.Vector3(1.6, 2.8, -1.2), body.position);
```

Havok handles gravity, collision with the desk, bounce and friction. The collider is a thin box rather than a zero-thickness plane, which gives the rigid-body solver useful dimensions. Returning to list and reopening the river rebuilds the temporary papers; your saved library is unchanged.

The desk helper loads the pinned Havok WASM from the project's local vendor folder. It disposes physics aggregates, scene, engine and resize listener when a view is replaced. Search or starring can rebuild the river, so cleanup prevents old render loops from accumulating.

## 9. Save and back up the useful parts

Nord's Save service stores subscriptions and articles in versioned localStorage slots. In a scene script you access that service as `game.save`; this HTML app creates `new Save('rss-river')` directly. Read/star changes persist immediately. Offline opening shows the cache or the original local demo, with no automatic network refresh.

Backup library downloads JSON. Import restores that JSON or adds XML as a clearly named imported source. Local storage belongs to the current browser origin, so use backups when changing machines, server ports or browser profiles. Storage quota errors ask you to back up rather than claiming your changes were saved.

## 10. Export and understand the boundaries

Export through Nord's **HTML** target and serve the output over HTTP. The folder includes the list/river code, demo, generated sprites, Babylon, Havok loader and WASM. Offline cache, XML import and the demo remain available; external news refresh naturally requires connectivity and the source's CORS policy or a Nord host.

Optional hosting: serve the HTML export as static files, and add a trusted Node feed relay only if you later need same-origin remote feed fetching; no Node implementation is included.

**WASM, briefly:** the included Havok `.wasm` is compiled physics called from JavaScript; this reader's UI and feed parsing remain HTML/JavaScript. A Rust/WASM export would require a Rust implementation of the relevant app logic, not simply selecting a different target for this project.

## 11. Finish with a short useful check

Load the demo, read/star a story, search it, refresh the page, import XML, back up JSON, switch to 3D and flick a paper. Then refresh your chosen live feed and confirm failures leave cached content usable. The focused automated smoke checks parsing errors, cache/star persistence, real 3D paper creation and Havok flicks. Feed headers were checked separately; external availability and complete native permission dialogs are not asserted by the offline browser smoke test.

<!-- GENERATED FILE WALKTHROUGH -->

## Walk through every project file {#file-walkthrough}

Work through these files in order using your downloaded project in Nord. Each numbered part shows the **next consecutive lines** of that file, not a selection of highlights. Read the explanation before changing anything. Edit the existing code in place; do not append another copy of a function. Finish one experiment, observe its result, and undo that change before moving on. The complete files and download at the end remain your reference.

The walkthrough covers the app/game modules, shared helpers used by them, page, styles and project configuration. Binary art/audio/models and minified vendor dependencies are resources rather than lessons in their internal implementation; their paths and contracts are explained where the app uses them.

| File | What you will build or understand |
| --- | --- |
| [feeds.js](#walk-feeds-js) | Build all feed configuration, parsing, safe-link and cache-merge logic. |
| [app.js](#walk-app-js) | Build the complete reader host, filters, both fetch paths, river lifetime and import/backup flow. |
| [river.js](#walk-river-js) | Follow every texture, pick, movement, physics and cleanup operation in the 3D reader. |
| [desk.js](#walk-desk-js) | Build the complete reusable Babylon/Havok desk and browser-download helper. |
| [save.js](#walk-save-js) | Understand the complete existing Nord Save helper bundled with this app. |
| [demo.xml](#walk-demo-xml) | Read the complete original local RSS fixture; it is also an example of the input format. |
| [.offline-allow](#walk--offline-allow) | Read the entire explicit feed-host allowlist. |
| [index.html](#walk-index-html) | Read the complete Nord page entry point and its failure path. |
| [nord.project.json](#walk-nord-project-json) | Read every project field that tells Nord which host, display and services to use. |
| [style.css](#walk-style-css) | Read every stylesheet rule, grouped by the UI responsibility it controls. |
| [nord-desktop.js](#walk-nord-desktop-js) | Read the complete bundled Nord bridge used by the optional host-fetch button. |

### 1. feeds.js {#walk-feeds-js}

Build all feed configuration, parsing, safe-link and cache-merge logic.

#### 1.1 — Give subscriptions stable identities

**Read:** `feeds.js`, lines 1–21.

<!-- taught-source: rss-river/feeds.js:1-21 -->

```js
// Feed URLs are user data, not CDN dependencies. Nothing is requested until Refresh.
export const DEFAULT_FEEDS = [
  {
    id: 'hn',
    name: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    topic: 'Community',
  },
  {
    id: 'ai',
    name: 'Simon Willison — AI & LLMs',
    url: 'https://simonwillison.net/atom/everything/',
    topic: 'AI',
  },
  {
    id: 'code',
    name: 'GitHub Engineering',
    url: 'https://github.blog/engineering/feed/',
    topic: 'Coding',
  },
];
```

**What and why:** Each feed has an app ID, display name, endpoint and topic. IDs are used for filtering and article namespacing; labels can change without losing identity. The three sources are defaults, not automatic requests or a bundled current-news database. Fetch is a separate user action so startup can remain offline.

**Try it / expected result:** Change a source name without changing its ID. Existing cached items should still belong to that source.

#### 1.2 — Normalize links before creating anchors

**Read:** `feeds.js`, lines 22–35.

<!-- taught-source: rss-river/feeds.js:22-35 -->

```js
export function safeLink(value, base = 'https://example.org/') {
  try {
    const u = new URL(value, base);
    return ['https:', 'http:'].includes(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
}
export function parseFeed(xml, feed) {
  if (xml.length > 2000000) throw Error('Feed is larger than 2 MB');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw Error('Invalid RSS/Atom XML');
  const entries = [...doc.querySelectorAll('item, entry')];
  if (!entries.length) throw Error('No RSS items or Atom entries found');
```

**What and why:** URL resolves relative links against a feed’s address and lets the helper inspect the protocol. Only HTTP/HTTPS survive; malformed input becomes an empty link instead of throwing through the reader. parseFeed then bounds input size and checks XML parser errors and item/entry presence. A successful HTTP response is not enough to prove its body is a feed.

**Try it / expected result:** Import an HTML error page renamed .xml. It should be rejected rather than shown as fake articles.

#### 1.3 — Extract inert text and choose a usable link

**Read:** `feeds.js`, lines 36–48.

<!-- taught-source: rss-river/feeds.js:36-48 -->

```js
  const plain = (html) => {
    const d = new DOMParser().parseFromString(html, 'text/html');
    d.querySelectorAll('script,style,iframe,object').forEach((e) => e.remove());
    return (d.body.textContent || '').replace(/\s+/g, ' ').trim();
  };
  return entries.slice(0, 80).map((node, index) => {
    const title = plain(node.querySelector('title')?.textContent || 'Untitled').slice(
        0,
        180,
      ),
      linkNode = [...node.querySelectorAll('link')].find(
        (n) => !n.getAttribute('rel') || n.getAttribute('rel') === 'alternate',
      );
```

**What and why:** The helper parses description markup in an inert document, removes active container elements, then reads normalized textContent. Entry iteration is capped. RSS text links and Atom href links have different forms, so linkNode selects an alternate/default link before safeLink resolves it. Title length is bounded. No publisher HTML is inserted into app controls.

**Try it / expected result:** Import a description containing bold markup and a script tag. The reader should show text without executing the script or creating a live script element.

#### 1.4 — Choose stable keys and a single article schema

**Read:** `feeds.js`, lines 49–67.

<!-- taught-source: rss-river/feeds.js:49-67 -->

```js
    const raw = linkNode?.getAttribute('href') || linkNode?.textContent || '',
      link = safeLink(raw, feed.url),
      guid = node.querySelector('guid, id')?.textContent || link || title + index;
    return {
      id: feed.id + ':' + guid,
      feed: feed.id,
      source: feed.name,
      title,
      link,
      summary: plain(
        node.querySelector('description, summary, content')?.textContent ||
          'Open the original to read the full article.',
      ).slice(0, 1200),
      date: node.querySelector('pubDate, published, updated')?.textContent || '',
      read: false,
      star: false,
    };
  });
}
```

**What and why:** The GUID/Atom ID is preferred, then a resolved link, then a title/index fallback. Prefixing with feed.id prevents collisions across sources. All entries become the same fields for title, summary, date, read and star; the UI does not need separate RSS and Atom rendering paths. Summary limits keep the cache practical and the original URL preserves access to the full publisher article.

**Try it / expected result:** Import one RSS item and one Atom entry. Verify both produce a usable title, plain summary and Read original link.

#### 1.5 — Preserve reading choices while refreshing content

**Read:** `feeds.js`, lines 68–75.

<!-- taught-source: rss-river/feeds.js:68-75 -->

```js
export function mergeArticles(old, items) {
  const map = new Map(old.map((a) => [a.id, a]));
  for (const a of items) {
    const prev = map.get(a.id);
    map.set(a.id, { ...a, read: prev?.read || false, star: prev?.star || false });
  }
  return [...map.values()].slice(-240);
}
```

**What and why:** A Map indexes old records by stable ID. Each incoming record replaces content but retains previous read/star flags. New IDs become new entries. Converting back to an array and taking the last 240 bounds the small library. This is a deliberate personal cache, not a permanent archive with unlimited history.

**Try it / expected result:** Star a demo entry, load the demo again, then reload the page. Its star should survive both merging and persistence.


### 2. app.js {#walk-app-js}

Build the complete reader host, filters, both fetch paths, river lifetime and import/backup flow.

#### 2.1 — Create the reading room header and source controls

**Read:** `app.js`, lines 1–54.

<!-- taught-source: rss-river/app.js:1-54 -->

```js
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
```

**What and why:** The imports select one schema/merge path, one 3D view owner and existing save/download helpers. Header controls make refresh, native fetch, 3D and backup explicit actions. The sidebar source selector and filters determine a view of cached data, not separate databases. This keeps search usable without networking.

**Try it / expected result:** Disconnect networking and type in Search after loading the demo. Filtering cached content should still work.

#### 2.2 — Provide separate list, river and reading surfaces

**Read:** `app.js`, lines 55–84.

<!-- taught-source: rss-river/app.js:55-84 -->

```js
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
```

**What and why:** The list and river occupy one content area while the article pane remains readable alongside it. Status can report fetch failures without deleting current content. After markup, the host reads saved subscriptions/articles and keeps selected ID and river lifetime separately. Invalid top-level storage values fall back to defaults.

**Try it / expected result:** Switch list/river and confirm the reading pane does not become a different copy of the article state.

#### 2.3 — Persist carefully and create filter options

**Read:** `app.js`, lines 85–119.

<!-- taught-source: rss-river/app.js:85-119 -->

```js
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
```

**What and why:** Persistence writes subscriptions and articles through Nord Save and reports quota errors. feedOptions rebuilds option elements with textContent and preserves a still-valid selection. visible applies source/unread/star/search predicates, then reverses a copy rather than mutating the stored order. Filters compose, so a starred item from another source can still be hidden by source choice.

**Try it / expected result:** Enable Starred only with no stars. You should see an empty state, not a broken render or an automatic network refresh.

#### 2.4 — Open one article without trusting its markup

**Read:** `app.js`, lines 120–160.

<!-- taught-source: rss-river/app.js:120-160 -->

```js
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
```

**What and why:** read finds by ID, marks read and persists. It builds source/title/date/summary nodes using textContent, then wires Star and Flick. Star changes the shared record and may rebuild the river; Flick is temporary visual physics. safeLink controls whether an original anchor is created; noopener/noreferrer isolates the new tab. The final render updates list read styling.

**Try it / expected result:** Click a story, star it, then search for it. Its title and state should agree between the article pane and list.

#### 2.5 — Rebuild an understandable list from filtered records

**Read:** `app.js`, lines 161–185.

<!-- taught-source: rss-river/app.js:161-185 -->

```js
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
```

**What and why:** Each button gets source, title and a bounded summary preview. Classes express read/selected state without changing article content. Empty state tells users how to obtain data. Cached/unread/star counts summarize the whole library, while the heading counts the current filtered list. These are derived values, not counters incremented independently.

**Try it / expected result:** Mark visible read with a source selected. Other-source unread counts should remain until you read them.

#### 2.6 — Discard superseded asynchronous scenes

**Read:** `app.js`, lines 186–224.

<!-- taught-source: rss-river/app.js:186-224 -->

```js
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
```

**What and why:** A version number identifies the newest river request. createRiver can await libraries/physics; if a later filter/mode request wins, this finished scene is disposed instead of taking over the UI. The previous visible river is released only when a current replacement is ready. Mode changes and filters reuse this lifecycle; hiding the river invalidates pending requests.

**Try it / expected result:** Double-click 3D or change filters rapidly. You should end with the latest view and one live Babylon engine.

#### 2.7 — Fetch intentionally through browser or Nord host

**Read:** `app.js`, lines 225–264.

<!-- taught-source: rss-river/app.js:225-264 -->

```js
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
```

**What and why:** Refresh disables the main button and gathers partial failures. The optional bridge is imported only for the native action. Each non-demo source is fetched with an HTTP status check; browser fetch has a timeout and remains subject to CORS, while Nord host fetch goes through declared capabilities. Parsed entries merge into the cache, then the UI is saved/rebuilt. One failed source does not erase successful source results.

**Try it / expected result:** Refresh while one endpoint is unavailable. Read cached articles afterward and inspect the per-source error text.

#### 2.8 — Wire batch actions and add subscriptions as data

**Read:** `app.js`, lines 265–288.

<!-- taught-source: rss-river/app.js:265-288 -->

```js
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
```

**What and why:** The two refresh buttons choose transport explicitly. Mark visible read acts on the current filter. Adding a URL normalizes it, rejects duplicates, creates an identity/name and persists it. Adding a source does not silently grant native host permission, which is why the status explains the manifest requirement.

**Try it / expected result:** Add the same endpoint twice. The second attempt should report Already subscribed rather than create duplicate source options.

#### 2.9 — Use a real local feed fixture and restore backups

**Read:** `app.js`, lines 289–343.

<!-- taught-source: rss-river/app.js:289-343 -->

```js
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
```

**What and why:** demo loads packaged XML through the same parser/merge path as live feeds and clearly names its source as local demo. Import distinguishes a full JSON backup from XML, limits file size, checks required collection/item shapes and rebuilds options/list after success. Imported XML becomes its own named source. Errors go to status.

**Try it / expected result:** Back up, import that JSON, then import a small XML feed. Verify the first restores state while the second adds a source.

#### 2.10 — Finish startup and release a replaced view

**Read:** `app.js`, lines 344–365.

<!-- taught-source: rss-river/app.js:344-365 -->

```js
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
```

**What and why:** Backup serializes both subscriptions and article flags. Initial render happens before the demo fallback, and only an empty cache loads that local fixture. The inspection interface exposes current arrays/view for checks. Teardown marks the host inactive so a pending river request cannot attach later, disposes the view and clears the root.

**Try it / expected result:** Reload after starring an item. Existing cached data should appear without re-fetching news or replacing it with the demo.


### 3. river.js {#walk-river-js}

Follow every texture, pick, movement, physics and cleanup operation in the 3D reader.

#### 3.1 — Wrap text into bounded canvas lines

**Read:** `river.js`, lines 1–20.

<!-- taught-source: rss-river/river.js:1-20 -->

```js
import { createDesk } from './desk.js';
export async function createRiver(canvas, articles, open) {
  const d = await createDesk(canvas),
    { B, scene } = d;
  const papers = [],
    bodies = [];
  let time = 0;
  const wrapText = (ctx, text, x, y, width, lineHeight, max = 4) => {
    let line = '',
      n = 0;
    for (const word of text.split(/\s+/)) {
      if (ctx.measureText(line + word).width > width && line) {
        ctx.fillText(line, x, y + n * lineHeight);
        if (++n >= max) return;
        line = '';
      }
      line += word + ' ';
    }
    if (n < max) ctx.fillText(line, x, y + n * lineHeight);
  };
```

**What and why:** The view owns a desk and lists of papers/physics bodies. wrapText measures prospective words against available width, paints a line when full and stops at a maximum line count. Line height determines baseline spacing. It works with system fonts and plain strings, avoiding remote page screenshots and publisher images.

**Try it / expected result:** Use a long title in a demo copy. It should wrap into bounded lines rather than painting across neighbouring paper edges.

#### 3.2 — Paint each article and encode importance spatially

**Read:** `river.js`, lines 21–48.

<!-- taught-source: rss-river/river.js:21-48 -->

```js
  articles.slice(0, 18).forEach((a, i) => {
    const width = a.star ? 4.5 : 3.6,
      height = a.star ? 3.2 : 2.5,
      p = d.paper('Article ' + i, width, height, (ctx) => {
        ctx.fillStyle = a.star ? '#fff2c9' : '#f7f4e9';
        ctx.fillRect(0, 0, 1024, 768);
        ctx.fillStyle = '#298a86';
        ctx.fillRect(58, 60, 72, 8);
        ctx.font = '22px system-ui';
        ctx.fillText(a.source.toUpperCase().slice(0, 45), 58, 112);
        ctx.fillStyle = '#1e3548';
        ctx.font = 'bold 48px system-ui';
        wrapText(ctx, a.title, 58, 205, 900, 60, 4);
        ctx.fillStyle = '#5f737b';
        ctx.font = '27px system-ui';
        wrapText(ctx, a.summary, 58, 500, 890, 36, 5);
        ctx.font = '22px system-ui';
        ctx.fillText(
          a.star ? 'STARRED · FLOATING HIGHER' : a.read ? 'READ' : 'UNREAD',
          58,
          728,
        );
      });
    p.mesh.position.set(((i % 3) - 1) * 5, a.star ? 2 : 1, Math.floor(i / 3) * 4.6 - 12);
    p.mesh.rotation.z = i % 2 ? 0.035 : -0.035;
    p.mesh.metadata = { article: a.id };
    papers.push({ ...p, article: a, width, height, phase: i, dropped: false });
  });
```

**What and why:** Only eighteen visible entries become papers. A star changes width/height, tint and later elevation. The painter reserves separate areas for source, title, summary and status with appropriate fonts/line limits. Metadata stores article ID for the host callback; grid placement prevents opening all papers at the same location. These are views of shared records, not a second article store.

**Try it / expected result:** Star one story and reopen the river. Its paper should be larger/higher, and clicking it should open that same article ID.

#### 3.3 — Route picks and animate only floating papers

**Read:** `river.js`, lines 49–65.

<!-- taught-source: rss-river/river.js:49-65 -->

```js
  scene.onPointerObservable.add((info) => {
    if (info.type === B.PointerEventTypes.POINTERPICK) {
      const id = info.pickInfo?.pickedMesh?.metadata?.article;
      if (id) open(id);
    }
  });
  d.update.add((dt) => {
    time += dt;
    for (const p of papers)
      if (!p.dropped) {
        p.mesh.position.z += dt * 0.65;
        if (p.mesh.position.z > 15) p.mesh.position.z = -14;
        p.mesh.position.y =
          (p.article.star ? 2 : 1) + Math.sin(time * 0.7 + p.phase) * 0.15;
        p.mesh.rotation.z = Math.sin(time * 0.35 + p.phase) * 0.035;
      }
  });
```

**What and why:** A completed pick reads article metadata and calls the same host read function used by list buttons. The update callback moves floating papers slowly, wraps travel at the far edge and uses small sine motions. dropped excludes bodies now owned by physics so animation and Havok do not fight over position.

**Try it / expected result:** Read one paper from the river, then flick it. Its original read flag remains even after its visual motion changes.

#### 3.4 — Hand one paper over to a rigid body

**Read:** `river.js`, lines 66–96.

<!-- taught-source: rss-river/river.js:66-96 -->

```js
  return {
    ...d,
    papers,
    flick(id) {
      const p = papers.find((p) => p.article.id === id);
      if (!p || p.dropped) return;
      p.dropped = true;
      const body = B.MeshBuilder.CreateBox(
        'Paper collider',
        { width: p.width, height: 0.05, depth: p.height },
        scene,
      );
      body.position.copyFrom(p.mesh.position);
      body.visibility = 0;
      p.mesh.parent = body;
      p.mesh.position.set(0, 0, 0);
      const aggregate = new B.PhysicsAggregate(
        body,
        B.PhysicsShapeType.BOX,
        { mass: 0.2, restitution: 0.5, friction: 0.5 },
        scene,
      );
      aggregate.body.applyImpulse(new B.Vector3(1.6, 2.8, -1.2), body.position);
      bodies.push(aggregate);
    },
    dispose() {
      bodies.forEach((v) => v.dispose());
      d.dispose();
    },
  };
}
```

**What and why:** flick ignores missing/already-dropped records, then makes a thin box of matching dimensions. The collider is invisible and receives the old world position; parenting the visual and zeroing its local position preserves appearance. The aggregate adds mass/contact properties, an impulse starts motion, and disposal later releases these aggregates before the desk owner.

**Try it / expected result:** Press Flick twice on the same story. The second click should not create another body or duplicate the paper.


### 4. desk.js {#walk-desk-js}

Build the complete reusable Babylon/Havok desk and browser-download helper.

#### 4.1 — Share pending local script loads

**Read:** `desk.js`, lines 1–20.

<!-- taught-source: rss-river/desk.js:1-20 -->

```js
// Cache the pending promise too: rapid view changes must wait for the same script.
const scriptLoads = new Map();
export function loadScript(src) {
  if (!scriptLoads.has(src)) {
    const pending = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.dataset.local = src;
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        scriptLoads.delete(src);
        reject(Error('Cannot load ' + src));
      };
      document.head.append(script);
    });
    scriptLoads.set(src, pending);
  }
  return scriptLoads.get(src);
}
```

**What and why:** The Map caches the promise, not just the presence of a script tag. Rapid callers must all wait until the library is actually ready. onerror removes the failed element/cache entry so a later attempt can retry. This is important because both mode buttons and filter changes can request 3D before the first load finishes.

**Try it / expected result:** Click the 3D mode button twice rapidly. There should be one ready view, not an undefined BABYLON error.

#### 4.2 — Create one engine, scene and controllable camera

**Read:** `desk.js`, lines 21–42.

<!-- taught-source: rss-river/desk.js:21-42 -->

```js
export async function createDesk(canvas, { physics = true } = {}) {
  await loadScript('vendor/babylonjs/babylon.js');
  const B = window.BABYLON;
  const engine = new B.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    }),
    scene = new B.Scene(engine);
  scene.clearColor = B.Color4.FromHexString('#101b2bff');
  const camera = new B.ArcRotateCamera(
    'Orbit',
    -Math.PI / 2,
    0.67,
    28,
    new B.Vector3(0, 0, 0),
    scene,
  );
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 4;
  camera.upperRadiusLimit = 70;
  camera.wheelPrecision = 25;
  camera.minZ = 0.1;
```

**What and why:** createDesk loads the local Babylon file, owns an Engine for the supplied canvas and sets an opaque background. ArcRotateCamera uses alpha/beta/radius around a target; attachControl gives orbit/zoom input. Radius limits avoid entering the paper surface or losing the whole desk at extreme zoom. minZ controls near clipping.

**Try it / expected result:** Compare orbit dragging with moving a paper: the camera changes the view without altering saved document coordinates.

#### 4.3 — Light a surface and prepare shadow ownership

**Read:** `desk.js`, lines 43–62.

<!-- taught-source: rss-river/desk.js:43-62 -->

```js
  const fill = new B.HemisphericLight('Sky', new B.Vector3(0, 1, 0), scene);
  fill.intensity = 0.65;
  const light = new B.DirectionalLight('Sun', new B.Vector3(-0.4, -1, 0.5), scene);
  light.position.set(8, 18, -8);
  light.intensity = 1.2;
  const shadows = new B.ShadowGenerator(1024, light);
  shadows.useBlurExponentialShadowMap = true;
  shadows.blurKernel = 16;
  const mat = new B.StandardMaterial('Desk surface', scene);
  mat.diffuseColor = B.Color3.FromHexString('#253a46');
  mat.specularColor = new B.Color3(0.1, 0.1, 0.1);
  const desk = B.MeshBuilder.CreateBox(
    'Desk',
    { width: 45, depth: 35, height: 0.6 },
    scene,
  );
  desk.position.y = -0.45;
  desk.material = mat;
  desk.receiveShadows = true;
  const aggregates = [];
```

**What and why:** The hemispheric light supplies broad fill; the directional light supplies a direction and shadow map. A restrained specular colour avoids a distracting glossy desk. A solid box, not a zero-thickness drawing, supplies the tabletop. Materials and meshes are scene-owned. The aggregates array will additionally own physics handles that need disposing.

**Try it / expected result:** Change the directional light direction temporarily and observe where shadows fall, while paper text remains readable.

#### 4.4 — Load the packaged physics binary

**Read:** `desk.js`, lines 63–77.

<!-- taught-source: rss-river/desk.js:63-77 -->

```js
  if (physics) {
    await loadScript('vendor/havok/HavokPhysics_umd.js');
    const havok = await window.HavokPhysics({
      locateFile: (name) => 'vendor/havok/' + name,
    });
    scene.enablePhysics(new B.Vector3(0, -9.81, 0), new B.HavokPlugin(true, havok));
    aggregates.push(
      new B.PhysicsAggregate(
        desk,
        B.PhysicsShapeType.BOX,
        { mass: 0, restitution: 0.2 },
        scene,
      ),
    );
  }
```

**What and why:** The local Havok loader receives locateFile so its WASM resolves beside the supplied loader. enablePhysics connects it to this Babylon scene with a gravity vector in 3D units. The tabletop aggregate has mass zero, making it a fixed collider rather than another falling toy. Physics is an optional helper setting, not an editor tier switch.

**Try it / expected result:** Temporarily set physics false at the helper call. Static papers should still render, but there will be no physical sticky/flick response.

#### 4.5 — Create a writable texture rather than a screenshot file

**Read:** `desk.js`, lines 78–104.

<!-- taught-source: rss-river/desk.js:78-104 -->

```js
  const paper = (name, width, height, paint) => {
    const mesh = B.MeshBuilder.CreatePlane(
      name,
      { width, height, sideOrientation: B.Mesh.DOUBLESIDE },
      scene,
    );
    mesh.rotation.x = Math.PI / 2;
    const texture = new B.DynamicTexture(
      name + ' texture',
      { width: 1024, height: 768 },
      scene,
      false,
    );
    const material = new B.StandardMaterial(name + ' material', scene);
    material.emissiveTexture = texture;
    material.emissiveColor = B.Color3.White();
    material.disableLighting = true;
    material.diffuseColor = B.Color3.Black();
    material.specularColor = B.Color3.Black();
    material.backFaceCulling = false;
    mesh.material = material;
    shadows.addShadowCaster(mesh);
    mesh.receiveShadows = true;
    paint?.(texture.getContext());
    texture.update();
    return { mesh, texture, material };
  };
```

**What and why:** A double-sided plane is laid across the desk. DynamicTexture owns a canvas context that callers can paint, then upload with update. The emissive/unlit material preserves readable colour from either side; zero specular avoids highlights washing out text. The mesh still casts a shadow. The return object exposes mesh, texture and material for later drawing and picking.

**Try it / expected result:** Draw a bold line in 2D and switch views. It should appear as actual texture content on the corresponding paper.

#### 4.6 — Create a visible rigid sticky toy

**Read:** `desk.js`, lines 105–126.

<!-- taught-source: rss-river/desk.js:105-126 -->

```js
  const box = (name, pos, color = '#f6d675', mass = 0.2) => {
    const mesh = B.MeshBuilder.CreateBox(
      name,
      { width: 1.1, height: 0.13, depth: 0.9 },
      scene,
    );
    mesh.position.copyFromFloats(...pos);
    const material = new B.StandardMaterial(name + ' paint', scene);
    material.diffuseColor = B.Color3.FromHexString(color);
    mesh.material = material;
    shadows.addShadowCaster(mesh);
    const aggregate = physics
      ? new B.PhysicsAggregate(
          mesh,
          B.PhysicsShapeType.BOX,
          { mass, restitution: 0.55, friction: 0.45 },
          scene,
        )
      : null;
    if (aggregate) aggregates.push(aggregate);
    return { mesh, aggregate };
  };
```

**What and why:** A small box has physical thickness, a colour material and a shadow caster. A dynamic aggregate supplies mass, restitution and friction. Registering that aggregate gives one disposal owner. The returned mesh supports picking and position inspection; the returned aggregate supports impulses. These are different handles for appearance and physics.

**Try it / expected result:** Increase restitution slightly and flick a sticky. It should bounce more without changing the original 2D note shape.

#### 4.7 — Own the render loop and resize lifecycle

**Read:** `desk.js`, lines 127–156.

<!-- taught-source: rss-river/desk.js:127-156 -->

```js
  const update = new Set(),
    render = () => {
      for (const fn of update) fn(Math.min(0.05, engine.getDeltaTime() / 1000));
      scene.render();
    };
  engine.runRenderLoop(render);
  const resize = () => engine.resize();
  window.addEventListener('resize', resize);
  return {
    B,
    engine,
    scene,
    camera,
    shadows,
    paper,
    box,
    update,
    resize,
    setActive(on) {
      engine.stopRenderLoop(render);
      if (on) engine.runRenderLoop(render);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      for (const a of aggregates) a.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
```

**What and why:** The update Set lets app-specific animations run before scene.render. Delta is converted to seconds and capped for those callbacks. A single resize listener updates the engine. setActive can stop/restart the stored render callback, and dispose releases listeners, aggregates, scene and engine. Replacing a view must call this owner, not merely hide its canvas.

**Try it / expected result:** Switch back to 2D and observe that the old desk stops animating. Reopening 3D creates one fresh owner.

#### 4.8 — Hand a browser a real downloadable object

**Read:** `desk.js`, lines 157–165.

<!-- taught-source: rss-river/desk.js:157-165 -->

```js
export function download(name, content, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

**What and why:** download accepts a Blob or creates one, creates a temporary object URL and triggers a named anchor download. Revoking shortly afterward releases the temporary URL without invalidating the click immediately. The browser still controls the save destination; this is not an arbitrary filesystem write.

**Try it / expected result:** Download JSON and verify its suggested filename and contents. Cancel the save if you do not need another copy.


### 5. save.js {#walk-save-js}

Understand the complete existing Nord Save helper bundled with this app.

#### 5.1 — Namespace slots and read versioned data

**Read:** `save.js`, lines 1–20.

<!-- taught-source: rss-river/save.js:1-20 -->

```js
// Versioned save slots on top of localStorage (or any Storage-like object).
export class Save {
  constructor(gameId, { version = 1, storage = globalThis.localStorage, migrate = null } = {}) {
    this.prefix = `nord:${gameId}:`;
    this.version = version;
    this.storage = storage ?? new MemoryStorage();
    this.migrate = migrate; // (data, fromVersion) => data
    this.slotId = 0;
  }
  slot(n) { this.slotId = n; return this; }
  #key(n = this.slotId) { return `${this.prefix}slot${n}`; }
  #read(n) {
    try {
      const raw = this.storage.getItem(this.#key(n));
      if (!raw) return { v: this.version, data: {} };
      const o = JSON.parse(raw);
      if (o.v < this.version && this.migrate) { o.data = this.migrate(o.data, o.v); o.v = this.version; }
      return o;
    } catch { return { v: this.version, data: {} }; }
  }
```

**What and why:** The prefix includes the app identity, and slotId chooses one save slot. A private key method keeps naming in one place. Reading returns an empty versioned envelope when missing or invalid, and an optional migration callback upgrades older data. This helper stores serializable values, not engine objects. MemoryStorage is available when no Storage implementation is supplied.

**Try it / expected result:** Compare the Paper Worlds and RSS River storage prefixes in browser tools. Their saves should not overwrite each other.

#### 5.2 — Read and write values, then define memory storage

**Read:** `save.js`, lines 21–32.

<!-- taught-source: rss-river/save.js:21-32 -->

```js
  get(k, def) { const d = this.#read().data; return k in d ? d[k] : def; }
  set(k, v) { const o = this.#read(); o.data[k] = v; o.v = this.version; o.t = Date.now(); this.storage.setItem(this.#key(), JSON.stringify(o)); }
  all() { return this.#read().data; }
  has(n = this.slotId) { return this.storage.getItem(this.#key(n)) != null; }
  delete(n = this.slotId) { this.storage.removeItem(this.#key(n)); }
}
export class MemoryStorage {
  #m = new Map();
  getItem(k) { return this.#m.has(k) ? this.#m.get(k) : null; }
  setItem(k, v) { this.#m.set(k, String(v)); }
  removeItem(k) { this.#m.delete(k); }
}
```

**What and why:** get supplies a caller default when a value is absent. set reads the envelope, replaces one key, records version/time and serializes through the Storage interface. all/has/delete expose slot operations. MemoryStorage implements the same getItem/setItem/removeItem contract using a Map, which is useful in tests but does not survive page reload. App callers still need to catch storage quota/permission failures on writes.

**Try it / expected result:** Back up your document, reload the page and verify it returns. Then inspect how the app reports a failed write instead of assuming success.


### 6. demo.xml {#walk-demo-xml}

Read the complete original local RSS fixture; it is also an example of the input format.

#### 6.1 — Recognize an RSS channel and stable item IDs

**Read:** `demo.xml`, lines 1–10.

<!-- taught-source: rss-river/demo.xml:1-10 -->

```xml
<?xml version="1.0"?><rss version="2.0"><channel><title>Original tutorial demo — not live news</title><link>https://example.org/</link><description>Fictional local content for learning RSS River.</description>
<item><guid>demo-1</guid><title>A small app can be a place you want to visit</title><link>https://example.org/demo/1</link><description>This is original tutorial demo content, not a published news report. Try starring this paper, switching to the 3D river and flicking it onto the desk.</description></item>
<item><guid>demo-2</guid><title>AI reading list: keep the source next to the summary</title><link>https://example.org/demo/2</link><description>Demo: a good reading tool preserves the original link. The app stores plain text and lets you open the publisher when you want the complete article.</description></item>
<item><guid>demo-3</guid><title>Why seconds and milliseconds deserve different names</title><link>https://example.org/demo/3</link><description>Demo coding note: engines often give delta time in seconds while a physics API expects milliseconds. Write the conversion at the boundary.</description></item>
<item><guid>demo-4</guid><title>Offline-first means your notes survive a train ride</title><link>https://example.org/demo/4</link><description>Demo: refresh news when connected, then read the cached titles and summaries offline. Back up the library before clearing browser storage.</description></item>
<item><guid>demo-5</guid><title>Make important things a little bigger</title><link>https://example.org/demo/5</link><description>Demo design idea: starred papers are physically larger and float higher. One data flag changes both the reading list and spatial view.</description></item>
<item><guid>demo-6</guid><title>Read a feed without trusting its markup</title><link>https://example.org/demo/6</link><description>Demo security lesson: convert feed descriptions to text. Never execute a publisher's script or insert its HTML into your app's controls.</description></item>
<item><guid>demo-7</guid><title>Slow motion is a feature of a calm interface</title><link>https://example.org/demo/7</link><description>Demo: the river is a gentle browse mode. Use the ordinary list and keyboard for precise reading, and keep motion optional.</description></item>
<item><guid>demo-8</guid><title>Ship the smallest complete version</title><link>https://example.org/demo/8</link><description>Demo: include import, backup, empty states and connection errors before adding an account system. A complete local app is already useful.</description></item>
</channel></rss>
```

**What and why:** The XML declaration describes encoding; rss/channel wraps title, link and description for the source. Every item has a guid, title, original link and description. The stories are explicitly original tutorial demonstrations, not scraped current reporting. Stable GUIDs let reload merge a revised demo item without losing its star/read choices.

**Try it / expected result:** Add a ninth item with a new GUID and load the demo again. Existing stars should remain and one new story should appear.


### 7. .offline-allow {#walk--offline-allow}

Read the entire explicit feed-host allowlist.

#### 7.1 — Distinguish intentional news endpoints from library dependencies

**Read:** `.offline-allow`, lines 1–3.

<!-- taught-source: rss-river/.offline-allow:1-3 -->

```text
hnrss.org
simonwillison.net
github.blog
```

**What and why:** These three hostnames declare the app’s deliberate external feed data to Nord’s static URL checker. They do not make browser CORS disappear and do not grant native HTTP capabilities; those are separate boundaries. Babylon, Havok and artwork still load from the project. A new default feed needs an intentional update here and in the appropriate permission configuration.

**Try it / expected result:** Add a custom source through the UI and compare the stored subscription with this file. They have different responsibilities.


### 8. index.html {#walk-index-html}

Read the complete Nord page entry point and its failure path.

#### 8.1 — Load the local runtime and start the app

**Read:** `index.html`, lines 1–8.

<!-- taught-source: rss-river/index.html:1-8 -->

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="nord-app-id" content="com.crowelian.rssriver"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RSS River — a calm reading desk</title>
<style>html,body{margin:0;height:100%;background:#2e3440}#app{height:100vh}</style></head>
<body><div id="app"></div>
<script type="module">
import { mount } from './app.js';
try { await mount(document.getElementById('app')); window.__nord_ready = true; } catch (e) { console.error(e); window.__nord_error = String(e); }
</script></body></html>
```

**What and why:** The document declares encoding and viewport, creates the mount container and loads local code. The module imports mount from app.js and awaits initialization for the HTML-tier root. The ready/error flags are inspection signals used by browser checks; they are not a second simulation. The catch logs and exposes initialization errors. The page is served over HTTP so local module and asset URLs resolve consistently.

**Try it / expected result:** Temporarily rename the imported main module on a copy and reopen Play. Inspect the Console/error path, then restore the correct name.


### 9. nord.project.json {#walk-nord-project-json}

Read every project field that tells Nord which host, display and services to use.

#### 9.1 — Identify the project and choose its presentation

**Read:** `nord.project.json`, lines 1–22.

<!-- taught-source: rss-river/nord.project.json:1-22 -->

```json
{
  "format": 1,
  "name": "RSS River",
  "id": "com.crowelian.rssriver",
  "type": "html",
  "engineVersion": "0.1.0",
  "startScene": "",
  "display": {
    "width": 640,
    "height": 360,
    "scale": "fit",
    "pixelArt": false,
    "background": "#2e3440"
  },
  "physics": {
    "engine": "none",
    "gravity": [
      0,
      0,
      0
    ]
  },
```

**What and why:** format and engineVersion identify the serialized contract, while name/id give human and stable application identity. type chooses the host; startScene is used by a scene backend and is empty for these HTML apps. Display fields request dimensions, fit behaviour, pixel-art treatment and background. Physics selects a runtime engine; the rail shooter uses custom rules with none, while HTML-hosted libraries are initialized in their own modules.

**Try it / expected result:** Change only the display title/name in a copy and reopen the project. Do not change the stable ID casually if you want to keep the same save namespace.

#### 9.2 — Distinguish scene actions from HTML event handling

**Read:** `nord.project.json`, lines 23–75.

<!-- taught-source: rss-river/nord.project.json:23-75 -->

```json
  "input": {
    "actions": {
      "left": [
        "KeyA",
        "ArrowLeft"
      ],
      "right": [
        "KeyD",
        "ArrowRight"
      ],
      "up": [
        "KeyW",
        "ArrowUp"
      ],
      "down": [
        "KeyS",
        "ArrowDown"
      ],
      "jump": [
        "Space",
        "KeyW",
        "ArrowUp"
      ],
      "fire": [
        "Space",
        "Mouse0"
      ],
      "interact": [
        "KeyE",
        "Enter"
      ]
    }
  },
  "plugins": [
    "ui",
    "audio"
  ],
  "ui": {
    "skin": "cyber",
    "theme": "nord"
  },
  "desktop": {
    "permissions": {
      "net": {
        "hosts": [
          "hnrss.org",
          "simonwillison.net",
          "github.blog"
        ]
      }
    }
  }
}
```

**What and why:** The input object maps action names to keyboard codes for Nord scene scripts. Vector Patrol reads these through this.input. HTML-tier hosts in the other projects read their own DOM events, so editing this action table alone does not rewrite those handlers. plugins/ui declare ordinary scene services and skin/theme; any remaining desktop configuration is the native capability contract rather than a browser CORS override.

**Try it / expected result:** For Vector Patrol, add a second fire key and test it. For an HTML app, locate its key handler instead of expecting this table to change DOM input.


### 10. style.css {#walk-style-css}

Read every stylesheet rule, grouped by the UI responsibility it controls.

#### 10.1 — Set the app foundation and reusable visual language

**Read:** `style.css`, lines 1–68.

<!-- taught-source: rss-river/style.css:1-68 -->

```css
html,
body {
  height: auto;
  min-height: 100%;
  background: #101b2b;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  color: #dce9ee;
  font: 14px system-ui;
}
main {
  max-width: 1500px;
  padding: 22px;
  margin: auto;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding-bottom: 24px;
}
.brand {
  display: flex;
  gap: 12px;
  align-items: center;
}
.boat {
  display: block;
  width: 66px;
  height: 66px;
  background: url(assets/dev-desk-sprites.png) 100% 100%/400% 200%;
}
h1 {
  font-size: 30px;
  margin: 0;
  letter-spacing: -1px;
}
header p {
  color: #8fa9b7;
  margin: 5px 0;
}
button,
input,
select {
  font: inherit;
  background: #20364b;
  color: #e7f3f6;
  border: 1px solid #3c5b71;
  border-radius: 7px;
  padding: 9px;
}
button {
  cursor: pointer;
}
button:hover {
  background: #33546c;
}
nav button {
  margin: 3px;
}
#mode {
  background: #297f7b;
}
```

**What and why:** The opening rules give html/body a continuous background and minimum height, apply border-box sizing, reset margins and choose system typography. Header, heading and basic control rules establish the app’s hierarchy and affordances. Keeping this local avoids remote font or stylesheet dependencies.

**Try it / expected result:** Change one accent colour on a copy and reopen Play; no gameplay or saved-document data should change.

#### 10.2 — Arrange source, list and reading columns

**Read:** `style.css`, lines 69–125.

<!-- taught-source: rss-river/style.css:69-125 -->

```css
.layout {
  display: grid;
  grid-template-columns: 205px minmax(350px, 1fr) 330px;
  gap: 18px;
  align-items: start;
}
aside {
  background: #14283a;
  border-radius: 12px;
  padding: 15px;
}
h3,
.eyebrow {
  font-size: 11px;
  letter-spacing: 1.5px;
  color: #83cfc3;
}
aside select,
aside > input,
aside button {
  width: 100%;
  margin: 6px 0;
}
label {
  display: block;
  margin: 12px 0;
  font-size: 12px;
}
input[type='file'] {
  max-width: 175px;
  font-size: 11px;
}
aside p,
#counts {
  font-size: 12px;
  color: #94aebc;
  line-height: 1.6;
}
hr {
  border: 0;
  border-top: 1px solid #34495d;
  margin: 22px 0;
}
.viewbar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 15px;
  background: #203448;
  border-radius: 10px 10px 0 0;
}
#status {
  font-size: 11px;
  color: #8dc6c5;
  max-height: 65px;
  overflow: auto;
}
```

**What and why:** The three-column layout gives navigation, a flexible current and a readable article width. Sidebar controls/filter labels and status/count styling distinguish actions from information. Native inputs remain usable; this app does not paint its text fields into 3D.

**Try it / expected result:** Narrow the window and observe which areas move before changing any article data.

#### 10.3 — Give list entries useful reading states

**Read:** `style.css`, lines 126–167.

<!-- taught-source: rss-river/style.css:126-167 -->

```css
#list {
  height: 680px;
  overflow: auto;
  background: #142536;
  padding: 12px;
  border-radius: 0 0 10px 10px;
}
.news {
  display: block;
  width: 100%;
  text-align: left;
  background: #20374b;
  border: 1px solid #35556a;
  padding: 17px;
  margin-bottom: 10px;
}
.news span {
  display: block;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #8bcfc4;
}
.news strong {
  display: block;
  font-size: 17px;
  line-height: 1.4;
  margin: 8px 0;
}
.news p {
  font-size: 12px;
  line-height: 1.5;
  color: #a0b8c5;
  margin-bottom: 0;
}
.news.read {
  opacity: 0.65;
}
.news.selected {
  border-color: #66cbbd;
  opacity: 1;
}
```

**What and why:** The bounded list scrolls independently. Each story is a full-width button with source, title and excerpt typography. read reduces emphasis while selected restores a clear active border. These classes are a visual projection of article flags, not storage themselves.

**Try it / expected result:** Read a story and then select another. The first should remain read while the selected border moves.

#### 10.4 — Make article text calm and readable

**Read:** `style.css`, lines 168–211.

<!-- taught-source: rss-river/style.css:168-211 -->

```css
#reader {
  background: #f7f4e9;
  color: #253a4c;
  border-radius: 10px;
  padding: 24px;
  min-height: 400px;
  line-height: 1.8;
  box-shadow: 0 8px 30px #0003;
}
#reader .eyebrow {
  color: #277e7a;
}
#reader h2 {
  font:
    600 25px/1.35 Georgia,
    serif;
}
#reader .date {
  font-size: 11px;
  color: #71818a;
}
#reader a {
  display: block;
  color: #267b78;
  margin-top: 18px;
}
#reader button {
  margin: 4px;
}
#river {
  height: 680px;
  width: 100%;
  display: block;
  touch-action: none;
  border-radius: 0 0 10px 10px;
}
footer {
  font-size: 12px;
  color: #7895a6;
  padding-top: 22px;
}
[hidden] {
  display: none !important;
}
```

**What and why:** The article pane uses a light paper surface, comfortable line height and a serif title. Source/date/link/button rules retain clear hierarchy. The river canvas has its own bounded area and touch handling so it can be optional. No publisher stylesheet is imported.

**Try it / expected result:** Open a long summary and inspect line length. The pane should remain useful even when the 3D river is hidden.

#### 10.5 — Adapt columns at two viewport widths

**Read:** `style.css`, lines 212–236.

<!-- taught-source: rss-river/style.css:212-236 -->

```css
@media (max-width: 1050px) {
  .layout {
    grid-template-columns: 180px minmax(300px, 1fr);
  }
  #reader {
    grid-column: 2;
  }
  header {
    flex-wrap: wrap;
  }
}
@media (max-width: 650px) {
  main {
    padding: 8px;
  }
  .layout {
    display: block;
  }
  aside {
    margin-bottom: 12px;
  }
  #reader {
    margin-top: 12px;
  }
}
```

**What and why:** The first breakpoint reduces to two columns and places the article below content; the smaller breakpoint stacks the page. The hidden rule ensures list/river mode switching continues to work at either width. Responsive CSS changes presentation, not the subscription cache.

**Try it / expected result:** Try both breakpoints, then restore a wide window. Your active story and reading flags should still be present.


### 11. nord-desktop.js {#walk-nord-desktop-js}

Read the complete bundled Nord bridge used by the optional host-fetch button.

#### 11.1 — Normalize errors and choose request transports

**Read:** `nord-desktop.js`, lines 1–34.

<!-- taught-source: rss-river/nord-desktop.js:1-34 -->

```js
// Nord desktop API (M9, ADR-020): window.nord.desktop.* — files, dialogs, notifications, clipboard, storage, windows, menus, tray.
// One API, three transports, picked automatically:
//   ipc  — inside the native player (wry): window.ipc.postMessage ⇄ Rust `nord-desktop` bridge, capability-checked
//   http — `nord serve` / editor Play: POST /__desktop/call (same Rust bridge, same permissions)
//   web  — plain browser export: graceful fallbacks (localStorage store + virtual appData files, Notification API, navigator.clipboard,
//          <input type=file> / download for dialogs); everything else rejects with code "unsupported".
// Every method returns a Promise; failures reject with NordDesktopError { code: denied|unsupported|not_found|invalid|io|cancelled }.
export class NordDesktopError extends Error {
  constructor(code, message) { super(message); this.name = 'NordDesktopError'; this.code = code; }
}
const unsupported = (m) => Promise.reject(new NordDesktopError('unsupported', `${m} is not available in this environment`));
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const bytes = (d) => (typeof d === 'string' ? new TextEncoder().encode(d) : d instanceof ArrayBuffer ? new Uint8Array(d) : d);

// ---- transports: (method, params) -> Promise<result> ------------------------------------------------------------------------------
function ipcTransport() {
  let next = 1; const pending = new Map();
  window.__nordDesktop = {
    reply(id, json) { const p = pending.get(id); if (!p) return; pending.delete(id); const r = typeof json === 'string' ? JSON.parse(json) : json; r.error ? p[1](new NordDesktopError(r.error.code, r.error.message)) : p[0](r.ok); },
    emit(name, payload) { emit(name, payload); },
  };
  return (method, params) => new Promise((ok, no) => { const id = next++; pending.set(id, [ok, no]); window.ipc.postMessage(JSON.stringify({ id, method, params: params ?? {} })); });
}
function httpTransport() {
  return async (method, params) => {
    const r = await fetch('/__desktop/call', { method: 'POST', headers: { 'content-type': 'application/json', 'x-nord': '1' }, body: JSON.stringify({ method, params: params ?? {} }) });
    const j = await r.json();
    if (j.error) throw new NordDesktopError(j.error.code, j.error.message);
    return j.ok;
  };
}

// ---- web fallbacks ---------------------------------------------------------------------------------------------------------------
```

**What and why:** The bridge exposes Promise-based operations with stable error codes. Binary helpers convert bytes to/from base64 for transport. IPC assigns request IDs and resolves pending promises when the native host replies; HTTP wraps the same method/params request shape through the local desktop endpoint. RSS River consumes http.fetch but the bridge is shared with other Nord apps.

**Try it / expected result:** Find where RSS River calls desktop.http.fetch and where this module converts that call into a method/params request.

#### 11.2 — Build bounded browser fallbacks

**Read:** `nord-desktop.js`, lines 35–49.

<!-- taught-source: rss-river/nord-desktop.js:35-49 -->

```js
function webTransport(appId) {
  const ls = (() => { try { return window.localStorage; } catch { return null; } })();
  const mem = new Map();
  const kv = { get: (k) => (ls ? ls.getItem(k) : mem.get(k) ?? null), set: (k, v) => (ls ? ls.setItem(k, v) : mem.set(k, v)), del: (k) => (ls ? ls.removeItem(k) : mem.delete(k)), keys: () => (ls ? Object.keys(ls) : [...mem.keys()]) };
  const S = `nord.${appId}.store.`, F = `nord.${appId}.fs.`;
  const norm = (p) => { p = String(p).replace(/^appData:/, ''); if (/^[a-z]+:/i.test(p) || p.startsWith('/') || p.split('/').includes('..') || p.includes('\\')) throw new NordDesktopError('denied', 'only app-data paths exist in the browser'); return p.split('/').filter((x) => x && x !== '.').join('/'); };
  // files are stored as base64 so binary survives; helpers convert from/to text
  const fsRaw = (p) => { const v = kv.get(F + norm(p)); if (v === null) throw new NordDesktopError('not_found', p); return v; };
  const fsRead = (p) => new TextDecoder().decode(unb64(fsRaw(p)));
  const fsPut = (p, u8) => kv.set(F + norm(p), b64(u8));
  const enc = (t) => new TextEncoder().encode(t);
  const fsPaths = () => kv.keys().filter((k) => k.startsWith(F)).map((k) => k.slice(F.length));
  const fileDialog = (accept, multiple) => new Promise((ok) => { const i = Object.assign(document.createElement('input'), { type: 'file', multiple, accept }); i.onchange = () => ok([...i.files]); i.oncancel = () => ok(null); i.click(); });
  let wid = 0; const watchers = new Map();
  const snap = (p) => new Map(fsPaths().filter((x) => !p || x === p || x.startsWith(p + '/')).map((x) => [x, kv.get(F + x)]));
```

**What and why:** Browser storage is namespaced per app, with an in-memory fallback when localStorage cannot be used. Path normalization rejects external/parent paths for the emulated app-data filesystem. Helpers encode binary files, provide file pickers and snapshot watches. These are browser equivalents of selected desktop features, not unrestricted access to your disk.

**Try it / expected result:** Run a static browser export and inspect desktop.transport after readiness: it should choose web rather than claim a native host exists.

#### 11.3 — Map supported browser operations explicitly

**Read:** `nord-desktop.js`, lines 50–85.

<!-- taught-source: rss-river/nord-desktop.js:50-85 -->

```js
  const m = {
    'app.info': () => ({ name: document.title, version: '', id: appId, os: 'web', arch: '', shell: 'web' }),
    'app.paths': () => ({ appData: 'appData:' }), 'app.permissions': () => ({ summary: ['browser sandbox'], granted: {} }), 'app.launch': () => ({ files: [], urls: [] }),
    'app.quit': () => window.close(), 'app.quitGuard': () => { },
    'store.get': ({ key }) => { const v = kv.get(S + key); return v === null ? null : JSON.parse(v); },
    'store.set': ({ key, value }) => kv.set(S + key, JSON.stringify(value)), 'store.remove': ({ key }) => kv.del(S + key),
    'store.keys': () => kv.keys().filter((k) => k.startsWith(S)).map((k) => k.slice(S.length)).sort(),
    'store.clear': () => kv.keys().filter((k) => k.startsWith(S)).forEach((k) => kv.del(k)),
    'secret.get': ({ key }) => kv.get(`nord.${appId}.secret.${key}`), 'secret.set': ({ key, value }) => kv.set(`nord.${appId}.secret.${key}`, value), 'secret.delete': ({ key }) => kv.del(`nord.${appId}.secret.${key}`),
    'fs.readText': ({ path }) => fsRead(path), 'fs.writeText': ({ path, text }) => fsPut(path, enc(text)), 'fs.append': ({ path, text }) => fsPut(path, enc((kv.get(F + norm(path)) === null ? '' : fsRead(path)) + text)),
    'fs.read': ({ path }) => fsRaw(path), 'fs.write': ({ path, data }) => kv.set(F + norm(path), data),
    'fs.exists': ({ path }) => { const p = norm(path); return p === '' || kv.get(F + p) !== null || fsPaths().some((x) => x.startsWith(p + '/')); },
    'fs.stat': ({ path }) => { const p = norm(path), v = kv.get(F + p); if (v !== null) return { name: p.split('/').pop(), isDir: false, size: unb64(v).length, modified: 0 }; if (p === '' || fsPaths().some((x) => x.startsWith(p + '/'))) return { name: p.split('/').pop(), isDir: true, size: 0, modified: 0 }; throw new NordDesktopError('not_found', path); },
    'fs.list': ({ path }) => { const p = norm(path), pre = p ? p + '/' : '', seen = new Map(); for (const x of fsPaths().filter((x) => x.startsWith(pre))) { const rest = x.slice(pre.length), n = rest.split('/')[0], dir = rest.includes('/'); seen.set(n, { name: n, isDir: dir, size: dir ? 0 : unb64(kv.get(F + x)).length, modified: 0 }); } return [...seen.values()].sort((a, b) => b.isDir - a.isDir || a.name.localeCompare(b.name)); },
    'fs.mkdir': () => { },
    'fs.watch': ({ path }) => { const p = norm(path), id = ++wid; watchers.set(id, { p, snap: snap(p) }); return id; },
    'fs.poll': ({ id }) => { const w = watchers.get(id); if (!w) throw new NordDesktopError('not_found', 'no such watcher'); const now = snap(w.p), ev = []; for (const [k, v] of now) { if (!w.snap.has(k)) ev.push({ kind: 'created', path: k }); else if (w.snap.get(k) !== v) ev.push({ kind: 'modified', path: k }); } for (const k of w.snap.keys()) if (!now.has(k)) ev.push({ kind: 'removed', path: k }); w.snap = now; return ev; },
    'fs.unwatch': ({ id }) => { watchers.delete(id); },
    'fs.remove': ({ path, recursive }) => { const p = norm(path); if (kv.get(F + p) !== null) return kv.del(F + p); const ch = fsPaths().filter((x) => x.startsWith(p + '/')); if (ch.length && !recursive) throw new NordDesktopError('io', 'directory not empty'); ch.forEach((x) => kv.del(F + x)); },
    'fs.rename': ({ from, to }) => { const v = fsRaw(from); kv.set(F + norm(to), v); kv.del(F + norm(from)); }, 'fs.copy': ({ from, to }) => kv.set(F + norm(to), fsRaw(from)),
    'dialog.message': ({ text }) => alert(text), 'dialog.confirm': ({ text }) => confirm(text), 'dialog.recent': () => [],
    'dialog.open': async ({ filters, multiple }) => { const f = await fileDialog((filters ?? []).flatMap((x) => x.extensions.map((e) => '.' + e)).join(','), !!multiple); if (!f) return null; for (const x of f) fsPut('picked/' + x.name, new Uint8Array(await x.arrayBuffer())); return f.map((x) => 'appData:picked/' + x.name); },
    'dialog.save': ({ fileName }) => 'appData:saved/' + (fileName ?? 'untitled.txt'),
    'notify.show': async ({ title, body }) => { if (!('Notification' in window)) throw new NordDesktopError('unsupported', 'Notification API'); if (Notification.permission === 'default') await Notification.requestPermission(); if (Notification.permission !== 'granted') throw new NordDesktopError('denied', 'notifications blocked'); new Notification(title, { body }); },
    'notify.badge': ({ text }) => { if (navigator.setAppBadge) return text ? navigator.setAppBadge(parseInt(text, 10) || undefined) : navigator.clearAppBadge(); }, 'notify.progress': () => { },
    'clipboard.readText': () => navigator.clipboard.readText(), 'clipboard.writeText': ({ text }) => navigator.clipboard.writeText(text),
    'shell.openUrl': ({ url }) => { if (!/^(https?:|mailto:)/i.test(url)) throw new NordDesktopError('denied', 'only http(s)/mailto'); window.open(url, '_blank', 'noopener'); },
  };
  return async (method, params) => {
    const f = m[method];
    if (!f) throw new NordDesktopError('unsupported', `${method} is not available in the browser`);
    try { return await f(params ?? {}); } catch (e) { throw e instanceof NordDesktopError ? e : new NordDesktopError('io', String(e?.message ?? e)); }
  };
}

// ---- events ----------------------------------------------------------------------------------------------------------------------
```

**What and why:** The dispatch table implements app info, local store, virtual files, dialogs, notifications and clipboard using browser APIs and permissions. Files are stored as encoded content; list/stat/watch operate on that virtual namespace. Unsupported methods are rejected after lookup. In particular, this fallback does not grant a browser a universal CORS-bypassing HTTP client.

**Try it / expected result:** Use Refresh feeds in a plain browser. A blocked publisher still needs XML import or a genuine Nord host, not this fallback.

#### 11.4 — Deliver events and await transport readiness

**Read:** `nord-desktop.js`, lines 86–111.

<!-- taught-source: rss-river/nord-desktop.js:86-111 -->

```js
const handlers = new Map();
function emit(name, payload) { for (const f of handlers.get(name) ?? []) { try { f(payload); } catch (e) { console.error(e); } } }
let poller = null;
function startPolling() {
  if (poller) return;
  poller = setInterval(async () => { try { for (const e of await (await fetch('/__desktop/events')).json()) emit(e.name, e.payload); } catch { /* server gone */ } }, 400);
}

// ---- API -------------------------------------------------------------------------------------------------------------------------
export function create(appId = 'web-app', force) {
  const mode = force ?? (window.ipc?.postMessage && location.protocol !== 'http:' && location.protocol !== 'https:' ? 'ipc' : null);
  let call = mode === 'ipc' ? ipcTransport() : null, transport = mode;
  const ready = (async () => {
    if (call) return;
    try { const r = await fetch('/__desktop/events', { cache: 'no-store' }); if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) { call = httpTransport(); transport = 'http'; startPolling(); return; } } catch { /* no server bridge */ }
    call = webTransport(appId); transport = 'web';
  })();
  const c = async (method, params) => { await ready; return call(method, params); };
  const sub = (ns, names) => Object.fromEntries(names.map((n) => [n, (p) => c(`${ns}.${n}`, p)]));
  const d = {
    get transport() { return transport; },
    ready,
    app: {
      ...sub('app', ['info', 'paths', 'permissions', 'launch', 'audit', 'quit']),
      setQuitGuard: (enable = true) => c('app.quitGuard', { enable }), setAutostart: (enable = true) => c('app.autostart', { enable }),
    },
```

**What and why:** The event Map keeps listener sets, and polling relays host events on the HTTP transport. create chooses native IPC when appropriate, otherwise probes the local host and falls back to web. The internal c function awaits readiness before dispatch, preventing an early click from calling an unselected transport. sub reduces repeated wrapper construction while preserving method names.

**Try it / expected result:** Call a bridge method just after app startup. It should wait for ready rather than failing because call is still null.

#### 11.5 — Expose capability-shaped wrappers and the shared instance

**Read:** `nord-desktop.js`, lines 112–157.

<!-- taught-source: rss-river/nord-desktop.js:112-157 -->

```js
    fs: {
      readText: (path) => c('fs.readText', { path }), writeText: (path, text) => c('fs.writeText', { path, text }), append: (path, text) => c('fs.append', { path, text }),
      read: async (path) => unb64(await c('fs.read', { path })), write: (path, data) => c('fs.write', { path, data: b64(bytes(data)) }),
      list: (path = '') => c('fs.list', { path }), stat: (path) => c('fs.stat', { path }), exists: (path) => c('fs.exists', { path }), mkdir: (path) => c('fs.mkdir', { path }),
      remove: (path, { recursive = false } = {}) => c('fs.remove', { path, recursive }), rename: (from, to) => c('fs.rename', { from, to }), copy: (from, to) => c('fs.copy', { from, to }),
      readJson: async (path) => JSON.parse(await c('fs.readText', { path })), writeJson: (path, v) => c('fs.writeText', { path, text: JSON.stringify(v, null, 2) }),
      /** Calls cb({kind: created|modified|removed, path}) on changes (polled every `interval` ms). Returns an unwatch function. */
      async watch(path, cb, { recursive = false, interval = 700 } = {}) {
        const id = await c('fs.watch', { path, recursive });
        const t = setInterval(async () => { try { for (const e of await c('fs.poll', { id })) cb(e); } catch { clearInterval(t); } }, interval);
        return () => { clearInterval(t); c('fs.unwatch', { id }).catch(() => { }); };
      },
    },
    dialog: {
      open: (o = {}) => c('dialog.open', o), save: (o = {}) => c('dialog.save', o), folder: (o = {}) => c('dialog.folder', o), recent: () => c('dialog.recent'),
      message: (text, o = {}) => c('dialog.message', { text, ...o }), confirm: (text, o = {}) => c('dialog.confirm', { text, ...o }),
    },
    notify: Object.assign((title, body = '') => c('notify.show', { title, body }), { setBadge: (text) => c('notify.badge', { text: text == null ? null : String(text) }), setProgress: (value) => c('notify.progress', { value }) }),
    clipboard: { readText: () => c('clipboard.readText'), writeText: (text) => c('clipboard.writeText', { text }), readImage: () => c('clipboard.readImage'), writeImage: (png) => c('clipboard.writeImage', { png: b64(bytes(png)) }) },
    store: { ...sub('store', ['get', 'remove', 'keys', 'clear']), set: (key, value) => c('store.set', { key, value }), get: (key, fallback = null) => c('store.get', { key }).then((v) => v ?? fallback) },
    secret: { get: (key) => c('secret.get', { key }), set: (key, value) => c('secret.set', { key, value }), delete: (key) => c('secret.delete', { key }) },
    shell: { openUrl: (url) => c('shell.openUrl', { url }), openPath: (path) => c('shell.openPath', { path }), reveal: (path) => c('shell.reveal', { path }) },
    process: { run: (program, args = [], opts = {}) => c('process.run', { program, args, ...opts }) },
    /** Local static web server (needs `server: true`): start({root, port?, cors?, spa?, listing?, liveReload?, lan?, cache?}) → {id, port, url} */
    server: { start: (o) => c('server.start', o), stop: (id) => c('server.stop', { id }), list: () => c('server.list'), logs: (id, since = 0) => c('server.logs', { id, since }) },
    http: { fetch: (url, o = {}) => c('http.fetch', { url, ...o }) },
    window: { open: (o) => c('window.open', o), close: (id) => c('window.close', { id }), setTitle: (title) => c('window.setTitle', { title }), setFullscreen: (on = true) => c('window.setFullscreen', { on }), setAlwaysOnTop: (on = true) => c('window.setAlwaysOnTop', { on }) },
    menu: { set: (items) => c('menu.set', { items }), context: (items, pos = {}) => c('menu.context', { items, ...pos }) },
    tray: { set: (o) => c('tray.set', o), remove: () => c('tray.remove') },
    shortcut: { register: async (id, accelerator, cb) => { if (cb) d.on('shortcut:' + id, cb); return c('shortcut.register', { id, accelerator }); }, unregister: (id) => c('shortcut.unregister', { id }) },
    /** Events from the shell: `menu` {id}, `tray` {id}, `shortcut:<id>`, `drop` {files}, `open` {files, urls}, `quit-requested`. Returns an off function. */
    on(name, fn) { (handlers.get(name) ?? handlers.set(name, new Set()).get(name)).add(fn); return () => handlers.get(name)?.delete(fn); },
    off(name, fn) { handlers.get(name)?.delete(fn); },
  };
  // drag & drop of files from the OS onto the page (browser + webview): reported as `drop` with File objects (web) — the native shell adds absolute paths
  if (typeof window !== 'undefined') {
    window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
    window.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) { e.preventDefault(); emit('drop', { files: [...e.dataTransfer.files] }); } });
  }
  return d;
}

/** The shared instance: `import desktop from './nord-desktop.js'` (also exposed as window.nord.desktop). */
const desktop = create(globalThis.NORD_APP_ID ?? document.querySelector('meta[name=nord-app-id]')?.content ?? location.host ?? 'web-app');
(globalThis.nord ??= {}).desktop = desktop;
export default desktop;
```

**What and why:** The public object groups file/dialog/notification/clipboard/store/process/network/window/menu operations. Wrappers marshal arguments; real native permissions are enforced by the host. watch returns an unwatch function, and on/off manage callback lifetime. Drag/drop becomes an event. The module finally exports one app-identified instance and exposes it on window.nord.desktop. These APIs do not mean RSS River requests every capability.

**Try it / expected result:** Compare this API surface with nord.project.json permissions. The reader only declares the feed hosts it needs, not every bridge feature.

<!-- END GENERATED FILE WALKTHROUGH -->

## Complete project source

All authored text files follow in offline CodeMirror viewers. The archive includes the original sprite sheet and all pinned binary/vendor dependencies and licences. It contains no scraped article collection: `demo.xml` is original, explicitly fictional tutorial material, and real news comes from the subscriptions you choose to refresh.

<!-- GENERATED GAME SOURCE: regenerate with node tools/build-code-workshops.mjs -->

<details>
<summary>Complete app.js</summary>

```js
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
```

</details>

<details>
<summary>Complete .offline-allow</summary>

```text
hnrss.org
simonwillison.net
github.blog
```

</details>

<details>
<summary>Complete demo.xml</summary>

```xml
<?xml version="1.0"?><rss version="2.0"><channel><title>Original tutorial demo — not live news</title><link>https://example.org/</link><description>Fictional local content for learning RSS River.</description>
<item><guid>demo-1</guid><title>A small app can be a place you want to visit</title><link>https://example.org/demo/1</link><description>This is original tutorial demo content, not a published news report. Try starring this paper, switching to the 3D river and flicking it onto the desk.</description></item>
<item><guid>demo-2</guid><title>AI reading list: keep the source next to the summary</title><link>https://example.org/demo/2</link><description>Demo: a good reading tool preserves the original link. The app stores plain text and lets you open the publisher when you want the complete article.</description></item>
<item><guid>demo-3</guid><title>Why seconds and milliseconds deserve different names</title><link>https://example.org/demo/3</link><description>Demo coding note: engines often give delta time in seconds while a physics API expects milliseconds. Write the conversion at the boundary.</description></item>
<item><guid>demo-4</guid><title>Offline-first means your notes survive a train ride</title><link>https://example.org/demo/4</link><description>Demo: refresh news when connected, then read the cached titles and summaries offline. Back up the library before clearing browser storage.</description></item>
<item><guid>demo-5</guid><title>Make important things a little bigger</title><link>https://example.org/demo/5</link><description>Demo design idea: starred papers are physically larger and float higher. One data flag changes both the reading list and spatial view.</description></item>
<item><guid>demo-6</guid><title>Read a feed without trusting its markup</title><link>https://example.org/demo/6</link><description>Demo security lesson: convert feed descriptions to text. Never execute a publisher's script or insert its HTML into your app's controls.</description></item>
<item><guid>demo-7</guid><title>Slow motion is a feature of a calm interface</title><link>https://example.org/demo/7</link><description>Demo: the river is a gentle browse mode. Use the ordinary list and keyboard for precise reading, and keep motion optional.</description></item>
<item><guid>demo-8</guid><title>Ship the smallest complete version</title><link>https://example.org/demo/8</link><description>Demo: include import, backup, empty states and connection errors before adding an account system. A complete local app is already useful.</description></item>
</channel></rss>
```

</details>

<details>
<summary>Complete desk.js</summary>

```js
// Cache the pending promise too: rapid view changes must wait for the same script.
const scriptLoads = new Map();
export function loadScript(src) {
  if (!scriptLoads.has(src)) {
    const pending = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.dataset.local = src;
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        scriptLoads.delete(src);
        reject(Error('Cannot load ' + src));
      };
      document.head.append(script);
    });
    scriptLoads.set(src, pending);
  }
  return scriptLoads.get(src);
}
export async function createDesk(canvas, { physics = true } = {}) {
  await loadScript('vendor/babylonjs/babylon.js');
  const B = window.BABYLON;
  const engine = new B.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    }),
    scene = new B.Scene(engine);
  scene.clearColor = B.Color4.FromHexString('#101b2bff');
  const camera = new B.ArcRotateCamera(
    'Orbit',
    -Math.PI / 2,
    0.67,
    28,
    new B.Vector3(0, 0, 0),
    scene,
  );
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 4;
  camera.upperRadiusLimit = 70;
  camera.wheelPrecision = 25;
  camera.minZ = 0.1;
  const fill = new B.HemisphericLight('Sky', new B.Vector3(0, 1, 0), scene);
  fill.intensity = 0.65;
  const light = new B.DirectionalLight('Sun', new B.Vector3(-0.4, -1, 0.5), scene);
  light.position.set(8, 18, -8);
  light.intensity = 1.2;
  const shadows = new B.ShadowGenerator(1024, light);
  shadows.useBlurExponentialShadowMap = true;
  shadows.blurKernel = 16;
  const mat = new B.StandardMaterial('Desk surface', scene);
  mat.diffuseColor = B.Color3.FromHexString('#253a46');
  mat.specularColor = new B.Color3(0.1, 0.1, 0.1);
  const desk = B.MeshBuilder.CreateBox(
    'Desk',
    { width: 45, depth: 35, height: 0.6 },
    scene,
  );
  desk.position.y = -0.45;
  desk.material = mat;
  desk.receiveShadows = true;
  const aggregates = [];
  if (physics) {
    await loadScript('vendor/havok/HavokPhysics_umd.js');
    const havok = await window.HavokPhysics({
      locateFile: (name) => 'vendor/havok/' + name,
    });
    scene.enablePhysics(new B.Vector3(0, -9.81, 0), new B.HavokPlugin(true, havok));
    aggregates.push(
      new B.PhysicsAggregate(
        desk,
        B.PhysicsShapeType.BOX,
        { mass: 0, restitution: 0.2 },
        scene,
      ),
    );
  }
  const paper = (name, width, height, paint) => {
    const mesh = B.MeshBuilder.CreatePlane(
      name,
      { width, height, sideOrientation: B.Mesh.DOUBLESIDE },
      scene,
    );
    mesh.rotation.x = Math.PI / 2;
    const texture = new B.DynamicTexture(
      name + ' texture',
      { width: 1024, height: 768 },
      scene,
      false,
    );
    const material = new B.StandardMaterial(name + ' material', scene);
    material.emissiveTexture = texture;
    material.emissiveColor = B.Color3.White();
    material.disableLighting = true;
    material.diffuseColor = B.Color3.Black();
    material.specularColor = B.Color3.Black();
    material.backFaceCulling = false;
    mesh.material = material;
    shadows.addShadowCaster(mesh);
    mesh.receiveShadows = true;
    paint?.(texture.getContext());
    texture.update();
    return { mesh, texture, material };
  };
  const box = (name, pos, color = '#f6d675', mass = 0.2) => {
    const mesh = B.MeshBuilder.CreateBox(
      name,
      { width: 1.1, height: 0.13, depth: 0.9 },
      scene,
    );
    mesh.position.copyFromFloats(...pos);
    const material = new B.StandardMaterial(name + ' paint', scene);
    material.diffuseColor = B.Color3.FromHexString(color);
    mesh.material = material;
    shadows.addShadowCaster(mesh);
    const aggregate = physics
      ? new B.PhysicsAggregate(
          mesh,
          B.PhysicsShapeType.BOX,
          { mass, restitution: 0.55, friction: 0.45 },
          scene,
        )
      : null;
    if (aggregate) aggregates.push(aggregate);
    return { mesh, aggregate };
  };
  const update = new Set(),
    render = () => {
      for (const fn of update) fn(Math.min(0.05, engine.getDeltaTime() / 1000));
      scene.render();
    };
  engine.runRenderLoop(render);
  const resize = () => engine.resize();
  window.addEventListener('resize', resize);
  return {
    B,
    engine,
    scene,
    camera,
    shadows,
    paper,
    box,
    update,
    resize,
    setActive(on) {
      engine.stopRenderLoop(render);
      if (on) engine.runRenderLoop(render);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      for (const a of aggregates) a.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
export function download(name, content, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

</details>

<details>
<summary>Complete feeds.js</summary>

```js
// Feed URLs are user data, not CDN dependencies. Nothing is requested until Refresh.
export const DEFAULT_FEEDS = [
  {
    id: 'hn',
    name: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    topic: 'Community',
  },
  {
    id: 'ai',
    name: 'Simon Willison — AI & LLMs',
    url: 'https://simonwillison.net/atom/everything/',
    topic: 'AI',
  },
  {
    id: 'code',
    name: 'GitHub Engineering',
    url: 'https://github.blog/engineering/feed/',
    topic: 'Coding',
  },
];
export function safeLink(value, base = 'https://example.org/') {
  try {
    const u = new URL(value, base);
    return ['https:', 'http:'].includes(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
}
export function parseFeed(xml, feed) {
  if (xml.length > 2000000) throw Error('Feed is larger than 2 MB');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw Error('Invalid RSS/Atom XML');
  const entries = [...doc.querySelectorAll('item, entry')];
  if (!entries.length) throw Error('No RSS items or Atom entries found');
  const plain = (html) => {
    const d = new DOMParser().parseFromString(html, 'text/html');
    d.querySelectorAll('script,style,iframe,object').forEach((e) => e.remove());
    return (d.body.textContent || '').replace(/\s+/g, ' ').trim();
  };
  return entries.slice(0, 80).map((node, index) => {
    const title = plain(node.querySelector('title')?.textContent || 'Untitled').slice(
        0,
        180,
      ),
      linkNode = [...node.querySelectorAll('link')].find(
        (n) => !n.getAttribute('rel') || n.getAttribute('rel') === 'alternate',
      );
    const raw = linkNode?.getAttribute('href') || linkNode?.textContent || '',
      link = safeLink(raw, feed.url),
      guid = node.querySelector('guid, id')?.textContent || link || title + index;
    return {
      id: feed.id + ':' + guid,
      feed: feed.id,
      source: feed.name,
      title,
      link,
      summary: plain(
        node.querySelector('description, summary, content')?.textContent ||
          'Open the original to read the full article.',
      ).slice(0, 1200),
      date: node.querySelector('pubDate, published, updated')?.textContent || '',
      read: false,
      star: false,
    };
  });
}
export function mergeArticles(old, items) {
  const map = new Map(old.map((a) => [a.id, a]));
  for (const a of items) {
    const prev = map.get(a.id);
    map.set(a.id, { ...a, read: prev?.read || false, star: prev?.star || false });
  }
  return [...map.values()].slice(-240);
}
```

</details>

<details>
<summary>Complete index.html</summary>

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="nord-app-id" content="com.crowelian.rssriver"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RSS River — a calm reading desk</title>
<style>html,body{margin:0;height:100%;background:#2e3440}#app{height:100vh}</style></head>
<body><div id="app"></div>
<script type="module">
import { mount } from './app.js';
try { await mount(document.getElementById('app')); window.__nord_ready = true; } catch (e) { console.error(e); window.__nord_error = String(e); }
</script></body></html>
```

</details>

<details>
<summary>Complete nord-desktop.js</summary>

```js
// Nord desktop API (M9, ADR-020): window.nord.desktop.* — files, dialogs, notifications, clipboard, storage, windows, menus, tray.
// One API, three transports, picked automatically:
//   ipc  — inside the native player (wry): window.ipc.postMessage ⇄ Rust `nord-desktop` bridge, capability-checked
//   http — `nord serve` / editor Play: POST /__desktop/call (same Rust bridge, same permissions)
//   web  — plain browser export: graceful fallbacks (localStorage store + virtual appData files, Notification API, navigator.clipboard,
//          <input type=file> / download for dialogs); everything else rejects with code "unsupported".
// Every method returns a Promise; failures reject with NordDesktopError { code: denied|unsupported|not_found|invalid|io|cancelled }.
export class NordDesktopError extends Error {
  constructor(code, message) { super(message); this.name = 'NordDesktopError'; this.code = code; }
}
const unsupported = (m) => Promise.reject(new NordDesktopError('unsupported', `${m} is not available in this environment`));
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const bytes = (d) => (typeof d === 'string' ? new TextEncoder().encode(d) : d instanceof ArrayBuffer ? new Uint8Array(d) : d);

// ---- transports: (method, params) -> Promise<result> ------------------------------------------------------------------------------
function ipcTransport() {
  let next = 1; const pending = new Map();
  window.__nordDesktop = {
    reply(id, json) { const p = pending.get(id); if (!p) return; pending.delete(id); const r = typeof json === 'string' ? JSON.parse(json) : json; r.error ? p[1](new NordDesktopError(r.error.code, r.error.message)) : p[0](r.ok); },
    emit(name, payload) { emit(name, payload); },
  };
  return (method, params) => new Promise((ok, no) => { const id = next++; pending.set(id, [ok, no]); window.ipc.postMessage(JSON.stringify({ id, method, params: params ?? {} })); });
}
function httpTransport() {
  return async (method, params) => {
    const r = await fetch('/__desktop/call', { method: 'POST', headers: { 'content-type': 'application/json', 'x-nord': '1' }, body: JSON.stringify({ method, params: params ?? {} }) });
    const j = await r.json();
    if (j.error) throw new NordDesktopError(j.error.code, j.error.message);
    return j.ok;
  };
}

// ---- web fallbacks ---------------------------------------------------------------------------------------------------------------
function webTransport(appId) {
  const ls = (() => { try { return window.localStorage; } catch { return null; } })();
  const mem = new Map();
  const kv = { get: (k) => (ls ? ls.getItem(k) : mem.get(k) ?? null), set: (k, v) => (ls ? ls.setItem(k, v) : mem.set(k, v)), del: (k) => (ls ? ls.removeItem(k) : mem.delete(k)), keys: () => (ls ? Object.keys(ls) : [...mem.keys()]) };
  const S = `nord.${appId}.store.`, F = `nord.${appId}.fs.`;
  const norm = (p) => { p = String(p).replace(/^appData:/, ''); if (/^[a-z]+:/i.test(p) || p.startsWith('/') || p.split('/').includes('..') || p.includes('\\')) throw new NordDesktopError('denied', 'only app-data paths exist in the browser'); return p.split('/').filter((x) => x && x !== '.').join('/'); };
  // files are stored as base64 so binary survives; helpers convert from/to text
  const fsRaw = (p) => { const v = kv.get(F + norm(p)); if (v === null) throw new NordDesktopError('not_found', p); return v; };
  const fsRead = (p) => new TextDecoder().decode(unb64(fsRaw(p)));
  const fsPut = (p, u8) => kv.set(F + norm(p), b64(u8));
  const enc = (t) => new TextEncoder().encode(t);
  const fsPaths = () => kv.keys().filter((k) => k.startsWith(F)).map((k) => k.slice(F.length));
  const fileDialog = (accept, multiple) => new Promise((ok) => { const i = Object.assign(document.createElement('input'), { type: 'file', multiple, accept }); i.onchange = () => ok([...i.files]); i.oncancel = () => ok(null); i.click(); });
  let wid = 0; const watchers = new Map();
  const snap = (p) => new Map(fsPaths().filter((x) => !p || x === p || x.startsWith(p + '/')).map((x) => [x, kv.get(F + x)]));
  const m = {
    'app.info': () => ({ name: document.title, version: '', id: appId, os: 'web', arch: '', shell: 'web' }),
    'app.paths': () => ({ appData: 'appData:' }), 'app.permissions': () => ({ summary: ['browser sandbox'], granted: {} }), 'app.launch': () => ({ files: [], urls: [] }),
    'app.quit': () => window.close(), 'app.quitGuard': () => { },
    'store.get': ({ key }) => { const v = kv.get(S + key); return v === null ? null : JSON.parse(v); },
    'store.set': ({ key, value }) => kv.set(S + key, JSON.stringify(value)), 'store.remove': ({ key }) => kv.del(S + key),
    'store.keys': () => kv.keys().filter((k) => k.startsWith(S)).map((k) => k.slice(S.length)).sort(),
    'store.clear': () => kv.keys().filter((k) => k.startsWith(S)).forEach((k) => kv.del(k)),
    'secret.get': ({ key }) => kv.get(`nord.${appId}.secret.${key}`), 'secret.set': ({ key, value }) => kv.set(`nord.${appId}.secret.${key}`, value), 'secret.delete': ({ key }) => kv.del(`nord.${appId}.secret.${key}`),
    'fs.readText': ({ path }) => fsRead(path), 'fs.writeText': ({ path, text }) => fsPut(path, enc(text)), 'fs.append': ({ path, text }) => fsPut(path, enc((kv.get(F + norm(path)) === null ? '' : fsRead(path)) + text)),
    'fs.read': ({ path }) => fsRaw(path), 'fs.write': ({ path, data }) => kv.set(F + norm(path), data),
    'fs.exists': ({ path }) => { const p = norm(path); return p === '' || kv.get(F + p) !== null || fsPaths().some((x) => x.startsWith(p + '/')); },
    'fs.stat': ({ path }) => { const p = norm(path), v = kv.get(F + p); if (v !== null) return { name: p.split('/').pop(), isDir: false, size: unb64(v).length, modified: 0 }; if (p === '' || fsPaths().some((x) => x.startsWith(p + '/'))) return { name: p.split('/').pop(), isDir: true, size: 0, modified: 0 }; throw new NordDesktopError('not_found', path); },
    'fs.list': ({ path }) => { const p = norm(path), pre = p ? p + '/' : '', seen = new Map(); for (const x of fsPaths().filter((x) => x.startsWith(pre))) { const rest = x.slice(pre.length), n = rest.split('/')[0], dir = rest.includes('/'); seen.set(n, { name: n, isDir: dir, size: dir ? 0 : unb64(kv.get(F + x)).length, modified: 0 }); } return [...seen.values()].sort((a, b) => b.isDir - a.isDir || a.name.localeCompare(b.name)); },
    'fs.mkdir': () => { },
    'fs.watch': ({ path }) => { const p = norm(path), id = ++wid; watchers.set(id, { p, snap: snap(p) }); return id; },
    'fs.poll': ({ id }) => { const w = watchers.get(id); if (!w) throw new NordDesktopError('not_found', 'no such watcher'); const now = snap(w.p), ev = []; for (const [k, v] of now) { if (!w.snap.has(k)) ev.push({ kind: 'created', path: k }); else if (w.snap.get(k) !== v) ev.push({ kind: 'modified', path: k }); } for (const k of w.snap.keys()) if (!now.has(k)) ev.push({ kind: 'removed', path: k }); w.snap = now; return ev; },
    'fs.unwatch': ({ id }) => { watchers.delete(id); },
    'fs.remove': ({ path, recursive }) => { const p = norm(path); if (kv.get(F + p) !== null) return kv.del(F + p); const ch = fsPaths().filter((x) => x.startsWith(p + '/')); if (ch.length && !recursive) throw new NordDesktopError('io', 'directory not empty'); ch.forEach((x) => kv.del(F + x)); },
    'fs.rename': ({ from, to }) => { const v = fsRaw(from); kv.set(F + norm(to), v); kv.del(F + norm(from)); }, 'fs.copy': ({ from, to }) => kv.set(F + norm(to), fsRaw(from)),
    'dialog.message': ({ text }) => alert(text), 'dialog.confirm': ({ text }) => confirm(text), 'dialog.recent': () => [],
    'dialog.open': async ({ filters, multiple }) => { const f = await fileDialog((filters ?? []).flatMap((x) => x.extensions.map((e) => '.' + e)).join(','), !!multiple); if (!f) return null; for (const x of f) fsPut('picked/' + x.name, new Uint8Array(await x.arrayBuffer())); return f.map((x) => 'appData:picked/' + x.name); },
    'dialog.save': ({ fileName }) => 'appData:saved/' + (fileName ?? 'untitled.txt'),
    'notify.show': async ({ title, body }) => { if (!('Notification' in window)) throw new NordDesktopError('unsupported', 'Notification API'); if (Notification.permission === 'default') await Notification.requestPermission(); if (Notification.permission !== 'granted') throw new NordDesktopError('denied', 'notifications blocked'); new Notification(title, { body }); },
    'notify.badge': ({ text }) => { if (navigator.setAppBadge) return text ? navigator.setAppBadge(parseInt(text, 10) || undefined) : navigator.clearAppBadge(); }, 'notify.progress': () => { },
    'clipboard.readText': () => navigator.clipboard.readText(), 'clipboard.writeText': ({ text }) => navigator.clipboard.writeText(text),
    'shell.openUrl': ({ url }) => { if (!/^(https?:|mailto:)/i.test(url)) throw new NordDesktopError('denied', 'only http(s)/mailto'); window.open(url, '_blank', 'noopener'); },
  };
  return async (method, params) => {
    const f = m[method];
    if (!f) throw new NordDesktopError('unsupported', `${method} is not available in the browser`);
    try { return await f(params ?? {}); } catch (e) { throw e instanceof NordDesktopError ? e : new NordDesktopError('io', String(e?.message ?? e)); }
  };
}

// ---- events ----------------------------------------------------------------------------------------------------------------------
const handlers = new Map();
function emit(name, payload) { for (const f of handlers.get(name) ?? []) { try { f(payload); } catch (e) { console.error(e); } } }
let poller = null;
function startPolling() {
  if (poller) return;
  poller = setInterval(async () => { try { for (const e of await (await fetch('/__desktop/events')).json()) emit(e.name, e.payload); } catch { /* server gone */ } }, 400);
}

// ---- API -------------------------------------------------------------------------------------------------------------------------
export function create(appId = 'web-app', force) {
  const mode = force ?? (window.ipc?.postMessage && location.protocol !== 'http:' && location.protocol !== 'https:' ? 'ipc' : null);
  let call = mode === 'ipc' ? ipcTransport() : null, transport = mode;
  const ready = (async () => {
    if (call) return;
    try { const r = await fetch('/__desktop/events', { cache: 'no-store' }); if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) { call = httpTransport(); transport = 'http'; startPolling(); return; } } catch { /* no server bridge */ }
    call = webTransport(appId); transport = 'web';
  })();
  const c = async (method, params) => { await ready; return call(method, params); };
  const sub = (ns, names) => Object.fromEntries(names.map((n) => [n, (p) => c(`${ns}.${n}`, p)]));
  const d = {
    get transport() { return transport; },
    ready,
    app: {
      ...sub('app', ['info', 'paths', 'permissions', 'launch', 'audit', 'quit']),
      setQuitGuard: (enable = true) => c('app.quitGuard', { enable }), setAutostart: (enable = true) => c('app.autostart', { enable }),
    },
    fs: {
      readText: (path) => c('fs.readText', { path }), writeText: (path, text) => c('fs.writeText', { path, text }), append: (path, text) => c('fs.append', { path, text }),
      read: async (path) => unb64(await c('fs.read', { path })), write: (path, data) => c('fs.write', { path, data: b64(bytes(data)) }),
      list: (path = '') => c('fs.list', { path }), stat: (path) => c('fs.stat', { path }), exists: (path) => c('fs.exists', { path }), mkdir: (path) => c('fs.mkdir', { path }),
      remove: (path, { recursive = false } = {}) => c('fs.remove', { path, recursive }), rename: (from, to) => c('fs.rename', { from, to }), copy: (from, to) => c('fs.copy', { from, to }),
      readJson: async (path) => JSON.parse(await c('fs.readText', { path })), writeJson: (path, v) => c('fs.writeText', { path, text: JSON.stringify(v, null, 2) }),
      /** Calls cb({kind: created|modified|removed, path}) on changes (polled every `interval` ms). Returns an unwatch function. */
      async watch(path, cb, { recursive = false, interval = 700 } = {}) {
        const id = await c('fs.watch', { path, recursive });
        const t = setInterval(async () => { try { for (const e of await c('fs.poll', { id })) cb(e); } catch { clearInterval(t); } }, interval);
        return () => { clearInterval(t); c('fs.unwatch', { id }).catch(() => { }); };
      },
    },
    dialog: {
      open: (o = {}) => c('dialog.open', o), save: (o = {}) => c('dialog.save', o), folder: (o = {}) => c('dialog.folder', o), recent: () => c('dialog.recent'),
      message: (text, o = {}) => c('dialog.message', { text, ...o }), confirm: (text, o = {}) => c('dialog.confirm', { text, ...o }),
    },
    notify: Object.assign((title, body = '') => c('notify.show', { title, body }), { setBadge: (text) => c('notify.badge', { text: text == null ? null : String(text) }), setProgress: (value) => c('notify.progress', { value }) }),
    clipboard: { readText: () => c('clipboard.readText'), writeText: (text) => c('clipboard.writeText', { text }), readImage: () => c('clipboard.readImage'), writeImage: (png) => c('clipboard.writeImage', { png: b64(bytes(png)) }) },
    store: { ...sub('store', ['get', 'remove', 'keys', 'clear']), set: (key, value) => c('store.set', { key, value }), get: (key, fallback = null) => c('store.get', { key }).then((v) => v ?? fallback) },
    secret: { get: (key) => c('secret.get', { key }), set: (key, value) => c('secret.set', { key, value }), delete: (key) => c('secret.delete', { key }) },
    shell: { openUrl: (url) => c('shell.openUrl', { url }), openPath: (path) => c('shell.openPath', { path }), reveal: (path) => c('shell.reveal', { path }) },
    process: { run: (program, args = [], opts = {}) => c('process.run', { program, args, ...opts }) },
    /** Local static web server (needs `server: true`): start({root, port?, cors?, spa?, listing?, liveReload?, lan?, cache?}) → {id, port, url} */
    server: { start: (o) => c('server.start', o), stop: (id) => c('server.stop', { id }), list: () => c('server.list'), logs: (id, since = 0) => c('server.logs', { id, since }) },
    http: { fetch: (url, o = {}) => c('http.fetch', { url, ...o }) },
    window: { open: (o) => c('window.open', o), close: (id) => c('window.close', { id }), setTitle: (title) => c('window.setTitle', { title }), setFullscreen: (on = true) => c('window.setFullscreen', { on }), setAlwaysOnTop: (on = true) => c('window.setAlwaysOnTop', { on }) },
    menu: { set: (items) => c('menu.set', { items }), context: (items, pos = {}) => c('menu.context', { items, ...pos }) },
    tray: { set: (o) => c('tray.set', o), remove: () => c('tray.remove') },
    shortcut: { register: async (id, accelerator, cb) => { if (cb) d.on('shortcut:' + id, cb); return c('shortcut.register', { id, accelerator }); }, unregister: (id) => c('shortcut.unregister', { id }) },
    /** Events from the shell: `menu` {id}, `tray` {id}, `shortcut:<id>`, `drop` {files}, `open` {files, urls}, `quit-requested`. Returns an off function. */
    on(name, fn) { (handlers.get(name) ?? handlers.set(name, new Set()).get(name)).add(fn); return () => handlers.get(name)?.delete(fn); },
    off(name, fn) { handlers.get(name)?.delete(fn); },
  };
  // drag & drop of files from the OS onto the page (browser + webview): reported as `drop` with File objects (web) — the native shell adds absolute paths
  if (typeof window !== 'undefined') {
    window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
    window.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) { e.preventDefault(); emit('drop', { files: [...e.dataTransfer.files] }); } });
  }
  return d;
}

/** The shared instance: `import desktop from './nord-desktop.js'` (also exposed as window.nord.desktop). */
const desktop = create(globalThis.NORD_APP_ID ?? document.querySelector('meta[name=nord-app-id]')?.content ?? location.host ?? 'web-app');
(globalThis.nord ??= {}).desktop = desktop;
export default desktop;
```

</details>

<details>
<summary>Complete nord.project.json</summary>

```json
{
  "format": 1,
  "name": "RSS River",
  "id": "com.crowelian.rssriver",
  "type": "html",
  "engineVersion": "0.1.0",
  "startScene": "",
  "display": {
    "width": 640,
    "height": 360,
    "scale": "fit",
    "pixelArt": false,
    "background": "#2e3440"
  },
  "physics": {
    "engine": "none",
    "gravity": [
      0,
      0,
      0
    ]
  },
  "input": {
    "actions": {
      "left": [
        "KeyA",
        "ArrowLeft"
      ],
      "right": [
        "KeyD",
        "ArrowRight"
      ],
      "up": [
        "KeyW",
        "ArrowUp"
      ],
      "down": [
        "KeyS",
        "ArrowDown"
      ],
      "jump": [
        "Space",
        "KeyW",
        "ArrowUp"
      ],
      "fire": [
        "Space",
        "Mouse0"
      ],
      "interact": [
        "KeyE",
        "Enter"
      ]
    }
  },
  "plugins": [
    "ui",
    "audio"
  ],
  "ui": {
    "skin": "cyber",
    "theme": "nord"
  },
  "desktop": {
    "permissions": {
      "net": {
        "hosts": [
          "hnrss.org",
          "simonwillison.net",
          "github.blog"
        ]
      }
    }
  }
}
```

</details>

<details>
<summary>Complete river.js</summary>

```js
import { createDesk } from './desk.js';
export async function createRiver(canvas, articles, open) {
  const d = await createDesk(canvas),
    { B, scene } = d;
  const papers = [],
    bodies = [];
  let time = 0;
  const wrapText = (ctx, text, x, y, width, lineHeight, max = 4) => {
    let line = '',
      n = 0;
    for (const word of text.split(/\s+/)) {
      if (ctx.measureText(line + word).width > width && line) {
        ctx.fillText(line, x, y + n * lineHeight);
        if (++n >= max) return;
        line = '';
      }
      line += word + ' ';
    }
    if (n < max) ctx.fillText(line, x, y + n * lineHeight);
  };
  articles.slice(0, 18).forEach((a, i) => {
    const width = a.star ? 4.5 : 3.6,
      height = a.star ? 3.2 : 2.5,
      p = d.paper('Article ' + i, width, height, (ctx) => {
        ctx.fillStyle = a.star ? '#fff2c9' : '#f7f4e9';
        ctx.fillRect(0, 0, 1024, 768);
        ctx.fillStyle = '#298a86';
        ctx.fillRect(58, 60, 72, 8);
        ctx.font = '22px system-ui';
        ctx.fillText(a.source.toUpperCase().slice(0, 45), 58, 112);
        ctx.fillStyle = '#1e3548';
        ctx.font = 'bold 48px system-ui';
        wrapText(ctx, a.title, 58, 205, 900, 60, 4);
        ctx.fillStyle = '#5f737b';
        ctx.font = '27px system-ui';
        wrapText(ctx, a.summary, 58, 500, 890, 36, 5);
        ctx.font = '22px system-ui';
        ctx.fillText(
          a.star ? 'STARRED · FLOATING HIGHER' : a.read ? 'READ' : 'UNREAD',
          58,
          728,
        );
      });
    p.mesh.position.set(((i % 3) - 1) * 5, a.star ? 2 : 1, Math.floor(i / 3) * 4.6 - 12);
    p.mesh.rotation.z = i % 2 ? 0.035 : -0.035;
    p.mesh.metadata = { article: a.id };
    papers.push({ ...p, article: a, width, height, phase: i, dropped: false });
  });
  scene.onPointerObservable.add((info) => {
    if (info.type === B.PointerEventTypes.POINTERPICK) {
      const id = info.pickInfo?.pickedMesh?.metadata?.article;
      if (id) open(id);
    }
  });
  d.update.add((dt) => {
    time += dt;
    for (const p of papers)
      if (!p.dropped) {
        p.mesh.position.z += dt * 0.65;
        if (p.mesh.position.z > 15) p.mesh.position.z = -14;
        p.mesh.position.y =
          (p.article.star ? 2 : 1) + Math.sin(time * 0.7 + p.phase) * 0.15;
        p.mesh.rotation.z = Math.sin(time * 0.35 + p.phase) * 0.035;
      }
  });
  return {
    ...d,
    papers,
    flick(id) {
      const p = papers.find((p) => p.article.id === id);
      if (!p || p.dropped) return;
      p.dropped = true;
      const body = B.MeshBuilder.CreateBox(
        'Paper collider',
        { width: p.width, height: 0.05, depth: p.height },
        scene,
      );
      body.position.copyFrom(p.mesh.position);
      body.visibility = 0;
      p.mesh.parent = body;
      p.mesh.position.set(0, 0, 0);
      const aggregate = new B.PhysicsAggregate(
        body,
        B.PhysicsShapeType.BOX,
        { mass: 0.2, restitution: 0.5, friction: 0.5 },
        scene,
      );
      aggregate.body.applyImpulse(new B.Vector3(1.6, 2.8, -1.2), body.position);
      bodies.push(aggregate);
    },
    dispose() {
      bodies.forEach((v) => v.dispose());
      d.dispose();
    },
  };
}
```

</details>

<details>
<summary>Complete save.js</summary>

```js
// Versioned save slots on top of localStorage (or any Storage-like object).
export class Save {
  constructor(gameId, { version = 1, storage = globalThis.localStorage, migrate = null } = {}) {
    this.prefix = `nord:${gameId}:`;
    this.version = version;
    this.storage = storage ?? new MemoryStorage();
    this.migrate = migrate; // (data, fromVersion) => data
    this.slotId = 0;
  }
  slot(n) { this.slotId = n; return this; }
  #key(n = this.slotId) { return `${this.prefix}slot${n}`; }
  #read(n) {
    try {
      const raw = this.storage.getItem(this.#key(n));
      if (!raw) return { v: this.version, data: {} };
      const o = JSON.parse(raw);
      if (o.v < this.version && this.migrate) { o.data = this.migrate(o.data, o.v); o.v = this.version; }
      return o;
    } catch { return { v: this.version, data: {} }; }
  }
  get(k, def) { const d = this.#read().data; return k in d ? d[k] : def; }
  set(k, v) { const o = this.#read(); o.data[k] = v; o.v = this.version; o.t = Date.now(); this.storage.setItem(this.#key(), JSON.stringify(o)); }
  all() { return this.#read().data; }
  has(n = this.slotId) { return this.storage.getItem(this.#key(n)) != null; }
  delete(n = this.slotId) { this.storage.removeItem(this.#key(n)); }
}
export class MemoryStorage {
  #m = new Map();
  getItem(k) { return this.#m.has(k) ? this.#m.get(k) : null; }
  setItem(k, v) { this.#m.set(k, String(v)); }
  removeItem(k) { this.#m.delete(k); }
}
```

</details>

<details>
<summary>Complete style.css</summary>

```css
html,
body {
  height: auto;
  min-height: 100%;
  background: #101b2b;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  color: #dce9ee;
  font: 14px system-ui;
}
main {
  max-width: 1500px;
  padding: 22px;
  margin: auto;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding-bottom: 24px;
}
.brand {
  display: flex;
  gap: 12px;
  align-items: center;
}
.boat {
  display: block;
  width: 66px;
  height: 66px;
  background: url(assets/dev-desk-sprites.png) 100% 100%/400% 200%;
}
h1 {
  font-size: 30px;
  margin: 0;
  letter-spacing: -1px;
}
header p {
  color: #8fa9b7;
  margin: 5px 0;
}
button,
input,
select {
  font: inherit;
  background: #20364b;
  color: #e7f3f6;
  border: 1px solid #3c5b71;
  border-radius: 7px;
  padding: 9px;
}
button {
  cursor: pointer;
}
button:hover {
  background: #33546c;
}
nav button {
  margin: 3px;
}
#mode {
  background: #297f7b;
}
.layout {
  display: grid;
  grid-template-columns: 205px minmax(350px, 1fr) 330px;
  gap: 18px;
  align-items: start;
}
aside {
  background: #14283a;
  border-radius: 12px;
  padding: 15px;
}
h3,
.eyebrow {
  font-size: 11px;
  letter-spacing: 1.5px;
  color: #83cfc3;
}
aside select,
aside > input,
aside button {
  width: 100%;
  margin: 6px 0;
}
label {
  display: block;
  margin: 12px 0;
  font-size: 12px;
}
input[type='file'] {
  max-width: 175px;
  font-size: 11px;
}
aside p,
#counts {
  font-size: 12px;
  color: #94aebc;
  line-height: 1.6;
}
hr {
  border: 0;
  border-top: 1px solid #34495d;
  margin: 22px 0;
}
.viewbar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 15px;
  background: #203448;
  border-radius: 10px 10px 0 0;
}
#status {
  font-size: 11px;
  color: #8dc6c5;
  max-height: 65px;
  overflow: auto;
}
#list {
  height: 680px;
  overflow: auto;
  background: #142536;
  padding: 12px;
  border-radius: 0 0 10px 10px;
}
.news {
  display: block;
  width: 100%;
  text-align: left;
  background: #20374b;
  border: 1px solid #35556a;
  padding: 17px;
  margin-bottom: 10px;
}
.news span {
  display: block;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #8bcfc4;
}
.news strong {
  display: block;
  font-size: 17px;
  line-height: 1.4;
  margin: 8px 0;
}
.news p {
  font-size: 12px;
  line-height: 1.5;
  color: #a0b8c5;
  margin-bottom: 0;
}
.news.read {
  opacity: 0.65;
}
.news.selected {
  border-color: #66cbbd;
  opacity: 1;
}
#reader {
  background: #f7f4e9;
  color: #253a4c;
  border-radius: 10px;
  padding: 24px;
  min-height: 400px;
  line-height: 1.8;
  box-shadow: 0 8px 30px #0003;
}
#reader .eyebrow {
  color: #277e7a;
}
#reader h2 {
  font:
    600 25px/1.35 Georgia,
    serif;
}
#reader .date {
  font-size: 11px;
  color: #71818a;
}
#reader a {
  display: block;
  color: #267b78;
  margin-top: 18px;
}
#reader button {
  margin: 4px;
}
#river {
  height: 680px;
  width: 100%;
  display: block;
  touch-action: none;
  border-radius: 0 0 10px 10px;
}
footer {
  font-size: 12px;
  color: #7895a6;
  padding-top: 22px;
}
[hidden] {
  display: none !important;
}
@media (max-width: 1050px) {
  .layout {
    grid-template-columns: 180px minmax(300px, 1fr);
  }
  #reader {
    grid-column: 2;
  }
  header {
    flex-wrap: wrap;
  }
}
@media (max-width: 650px) {
  main {
    padding: 8px;
  }
  .layout {
    display: block;
  }
  aside {
    margin-bottom: 12px;
  }
  #reader {
    margin-top: 12px;
  }
}
```

</details>
