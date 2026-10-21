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
