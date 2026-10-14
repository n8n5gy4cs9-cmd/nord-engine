// Render preserved official declarations/prose with the same offline documentation shell.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
export function engineDocs({ root, add, renderMd, esc, slug }) {
  const dir = path.join(root, 'vendor/engine-docs');
  const load = name => JSON.parse(gunzipSync(fs.readFileSync(path.join(dir, name))).toString());
  const declarations = load('api.json.gz');
  const guides = load('babylon-guides.json.gz');
  const provenance = JSON.parse(fs.readFileSync(path.join(dir, 'SOURCES.json')));
  const typeLinks = new Map();
  const files = new Map();
  const unique = new Map(), usedFiles = new Set(), usedOutputFiles = new Set();
  const apiOutput = d => {
    const engine = d.engine === 'Phaser' ? 'phaser/4.2' : 'babylon/9.30';
    const parts = d.fullname.split('.').map(slug).filter(Boolean);
    const leaf = parts.pop() || 'global';
    const bucket = createHash('sha256').update(`${d.package}:${d.fullname}`).digest('hex').slice(0, 2);
    return path.posix.join('engines', engine, 'api', slug(d.package), ...(parts.length ? parts : ['global']), bucket, `${leaf}.html`);
  };
  const guideOutput = guidePath => {
    const parts = guidePath.replace(/\.md$/, '').split('/').map(slug).filter(Boolean);
    const leaf = parts.pop() || 'index';
    return path.posix.join('engines', 'babylon', 'guides', ...parts, `${leaf}.html`);
  };
  for (const d of declarations) {
    const key = `${d.package}:${d.fullname}`, base = `engine-${slug(d.package)}-${slug(d.fullname)}`;
    if (!unique.has(key)) {
      const file = usedFiles.has(base + '.html') ? `${base}-${createHash('sha256').update(key).digest('hex').slice(0, 8)}.html` : base + '.html';
      let outputFile = apiOutput(d);
      if (usedOutputFiles.has(outputFile)) outputFile = outputFile.replace(/\.html$/, `-${createHash('sha256').update(key).digest('hex').slice(0, 8)}.html`);
      usedFiles.add(file); usedOutputFiles.add(outputFile);
      unique.set(key, { ...d, overloads: [], file, outputFile }); typeLinks.set(d.fullname.toLowerCase(), file);
    }
    else unique.get(key).overloads.push(d);
  }
  for (const g of guides) files.set(g.path.replace(/\.md$/, '').toLowerCase(), { legacy: `babylon-guide-${slug(g.path.replace(/\.md$/, ''))}.html`, output: guideOutput(g.path) });
  const cleanDoc = text => text.replace(/\{@link\s+([^}|]+)(?:[| ]([^}]+))?\}/g, (_, target, label) => label || target).replace(/https?:\/\/[^\s)<>]+/g, '(online reference)');
  const prose = text => renderMd(cleanDoc(text || '').replace(/^@(param|returns?|default|example|deprecated|since|see|remarks)\b/gm, '**$1** '), { upstream: true, resolve: href => typeLinks.get(href.toLowerCase()) || null });
  const signature = (d, id) => `<h3 id="${id}">${esc(d.name)} <a class="anchor" href="#${id}">#</a></h3><pre class="code" data-lang="ts"><code>${esc(d.signature)}</code></pre>${prose(d.description)}`;
  function member(m, id) {
    return signature(m, id) + (m.params.length ? `<table><thead><tr><th>Parameter</th><th>Type</th><th>Required / default</th></tr></thead><tbody>${m.params.map(p => `<tr><td><code>${esc(p.rest ? '...' + p.name : p.name)}</code></td><td><code>${esc(p.type || 'unspecified')}</code></td><td>${p.optional ? 'Optional' : 'Required'}${p.default ? ` · <code>${esc(p.default)}</code>` : ''}</td></tr>`).join('')}</tbody></table>` : '') + (m.returns ? `<p><b>Type / return:</b> <code>${esc(m.returns)}</code></p>` : '') + (m.members?.length ? `<details><summary>Nested members (${m.members.length})</summary>${m.members.map((child, i) => member(child, `${id}-${i}`)).join('')}</details>` : '');
  }
  const nordLinks = engine => engine === 'Phaser' ? '<a href="2d.html">2D manual</a> · <a href="component-sprite.html">sprite</a> · <a href="component-animatedSprite.html">animatedSprite</a> · <a href="physics.html">physics</a>' : '<a href="3d.html">3D manual</a> · <a href="component-mesh.html">mesh</a> · <a href="component-model.html">model</a> · <a href="component-camera.html">camera</a>';
  for (const d of unique.values()) {
    const version = d.engine === 'Phaser' ? '4.2.1' : '9.30.0';
    let html = `<p><span class="badge">Underlying ${d.engine} ${version} API</span> <span class="badge">${esc(d.kind.replace('Declaration', ''))}</span></p><p class="muted">Official public declarations and JSDoc from <code>${esc(d.package)}</code>. Use with engine objects, not directly on a Nord entity.</p><aside class="box tip"><div class="box-title">The Nord way</div><p>${nordLinks(d.engine)}. Access raw objects only when the Nord wrapper does not cover your feature. <a href="reference.html#escape-hatch">How escape hatches work</a>.</p></aside>`;
    html += member({ ...d, members: [] }, 'declaration');
    if (d.overloads.length) html += `<h2 id="overloads">Overloads</h2>${d.overloads.map((m, i) => member(m, `overload-${i}`)).join('')}`;
    if (d.members.length) html += `<h2 id="members">Public members (${d.members.length})</h2><p>Private, protected and explicitly internal declarations are excluded. Inherited members belong to the base type listed in the declaration.</p>${d.members.map((m, i) => member({ ...m, members: m.members ?? [] }, `member-${slug(m.name)}-${i}`)).join('')}`;
    // Base class/interface links avoid implying inherited methods are missing.
    const bases = d.signature.split(/\b(?:extends|implements)\s+/).slice(1).flatMap(part => part.replace(/<[^>]*>/g, '').split(',')).map(s => s.trim());
    const linked = bases.map(b => { const target = typeLinks.get(b.toLowerCase()) || typeLinks.get(`${d.engine === 'Phaser' ? 'Phaser' : 'BABYLON'}.${b}`.toLowerCase()); return target ? `<a href="${target}">${esc(b)}</a>` : `<code>${esc(b)}</code>`; });
    if (linked.length) html += `<h2 id="base-types">Base types</h2><p>${linked.join(' · ')}</p>`;
    add({ file: d.file, outputFile: d.outputFile, title: d.fullname, section: 'Engine docs', order: 50, html, summary: `${d.engine} ${version} · ${d.package} · ${d.kind}`, searchMembers: d.members.map((m, i) => ({ id: `member-${slug(m.name)}-${i}`, name: m.name, text: m.description + ' ' + m.signature })) });
  }
  for (const g of guides) {
    let md = g.markdown;
    const fm = md.match(/^---\n([\s\S]*?)\n---\n/), title = fm?.[1].match(/^title:\s*(.+)$/m)?.[1]?.replace(/^['"]|['"]$/g, '') || g.path.replace(/\.md$/, '').split('/').at(-1);
    if (fm) md = md.slice(fm[0].length);
    const resolve = href => {
      const [pathname, hash] = href.split('#');
      if (pathname.startsWith('http')) return null;
      if (pathname.startsWith('/typedoc/')) return typeLinks.get(pathname.split('/').at(-1).replace(/^babylon\./i, 'babylon.').toLowerCase()) || null;
      const normalized = (pathname.startsWith('/') ? pathname.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(g.path), pathname))).replace(/\.md$/, '').replace(/\/$/, '').toLowerCase();
      // Upstream heading conventions differ; keep page links, without inventing matching anchors.
      return files.get(normalized)?.legacy || files.get(pathname.replace(/^\//, '').replace(/\.md$/, '').toLowerCase())?.legacy || null;
    };
    const html = `<p><span class="badge">Official Babylon guide · source snapshot</span></p><aside class="box warn"><div class="box-title">Read this as an underlying-engine guide</div><p>The prose snapshot can describe newer features. Nord's API pages match <b>9.30.0</b>. Start with ${nordLinks('Babylon')} for Nord scene files and scripts. Online playgrounds, videos and upstream images are not embedded in this offline edition.</p></aside>` + renderMd(md, { upstream: true, resolve });
    const guideFile = files.get(g.path.replace(/\.md$/, '').toLowerCase());
    add({ file: guideFile.legacy, outputFile: guideFile.output, title: `Babylon guide: ${title}`, section: 'Engine docs', html, summary: `Official documentation · ${g.path}` });
  }
  if (fs.existsSync(path.join(dir, 'phaser-snapshot.json.gz'))) {
    const snap = load('phaser-snapshot.json.gz');
    let html = `<p class="lead">Owner-supplied Phaser ${esc(snap.meta.docsApiLevel)} documentation snapshot (${snap.symbols.length} symbols).</p><aside class="box warn"><div class="box-title">Archived version</div><p>This snapshot predates Nord's Phaser 4.2.1. Some event/type groups contain names only. Use the matching public declaration reference for complete current signatures.</p></aside>`;
    html += '<ul class="cards">';
    for (const [i, s] of snap.symbols.entries()) {
      const file = `phaser-archive-${i}-${slug(s.longname)}.html`;
      html += `<li><a href="${file}"><b>${esc(s.longname)}</b><span>${esc(s.kind)}</span></a></li>`;
      const params = p => p?.length ? `<table><thead><tr><th>Parameter</th><th>Type</th><th>Details</th></tr></thead><tbody>${p.map(v => `<tr><td><code>${esc(v.name)}</code></td><td><code>${esc((v.type ?? []).join(' | '))}</code></td><td>${v.optional ? 'Optional. ' : ''}${esc(v.description || '')}${v.defaultValue != null ? ` Default: <code>${esc(v.defaultValue)}</code>` : ''}</td></tr>`).join('')}</tbody></table>` : '';
      const group = `${String(Math.floor(i / 100) * 100).padStart(3, '0')}-${String(Math.floor(i / 100) * 100 + 99).padStart(3, '0')}`;
      add({ file, outputFile: path.posix.join('engines', 'phaser', '4.1-archive', 'api', group, `${i}-${slug(s.longname)}.html`), title: `Phaser archive: ${s.longname}`, section: 'Engine docs', html: `<p><span class="badge">Phaser 4.1.0 archive</span> · <a href="phaser-api-index.html">Matching 4.2.1 API</a></p>${prose(s.description || 'This snapshot contains no description for this group. See the matching API declaration reference.')}${s.constructor?.signature ? `<h2 id="constructor">Constructor</h2><pre class="code" data-lang="ts"><code>${esc(s.constructor.signature)}</code></pre>${params(s.constructor.params)}` : ''}${['members', 'methods'].map(k => s[k]?.length ? `<h2 id="${k}">${k}</h2>${s[k].map((m, n) => `<h3 id="${k}-${n}">${esc(m.name)}</h3><pre class="code" data-lang="ts"><code>${esc(m.signature || m.name)}</code></pre>${prose(m.description)}${params(m.params)}${m.returns ? `<p>Returns: <code>${esc((m.returns.type ?? []).join(' | '))}</code> ${esc(m.returns.description || '')}</p>` : ''}`).join('')}` : '').join('')}`, summary: `Archived ${s.kind} · 4.1.0` });
    }
    add({ file: 'phaser-archive.html', outputFile: 'engines/phaser/4.1-archive/index.html', title: 'Phaser documentation archive', section: 'Reference', order: 92, html: html + '</ul>' });
  }
  for (const engine of ['Phaser', 'Babylon']) {
    const list = [...unique.values()].filter(d => d.engine === engine);
    let html = `<p class="lead">${list.length} public types, functions and constants from the exact packages Nord vendors. Choose a name, or search for a method.</p><p>${nordLinks(engine)}</p>`;
    const groups = new Map(); for (const d of list) { const key = d.package + ' / ' + (d.fullname.split('.').slice(0, -1).join('.') || 'Global'); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(d); }
    for (const [name, ds] of [...groups].sort(([a], [b]) => a.localeCompare(b))) html += `<h2 id="group-${slug(name)}">${esc(name)}</h2><ul>${ds.sort((a, b) => a.name.localeCompare(b.name)).map(d => `<li><a href="${d.file}">${esc(d.fullname)}</a> <span class="muted">${esc(d.kind.replace('Declaration', ''))}</span></li>`).join('')}</ul>`;
    add({ file: `${engine.toLowerCase()}-api-index.html`, outputFile: engine === 'Phaser' ? 'engines/phaser/4.2/index.html' : 'engines/babylon/9.30/index.html', title: `${engine} ${engine === 'Phaser' ? '4.2.1' : '9.30.0'} API`, section: 'Reference', order: 90, html });
  }
  add({ file: 'babylon-guide-index.html', outputFile: 'engines/babylon/guides/index.html', title: 'Babylon documentation library', section: 'Reference', order: 91, html: `<p class="lead">All ${guides.length} Markdown guides from the pinned official documentation source. This advanced library keeps the original engine terminology.</p><ul>${guides.map(g => `<li><a href="${files.get(g.path.replace(/\.md$/, '').toLowerCase()).legacy}">${esc(g.path.replace(/\.md$/, ''))}</a></li>`).join('')}</ul>` });
  add({ file: 'engine-docs.html', title: 'Phaser & Babylon documentation', section: 'Reference', order: 89, html: `<p class="lead">Nord wraps existing engines. This library documents their public APIs when you need to work with an underlying engine object.</p><aside class="box tip"><div class="box-title">Begin with Nord</div><p>Build with <a href="components.html">Nord components</a> and <a href="api-namespaces.html">game services</a>. The underlying engine API is an advanced reference, not a second setup guide.</p></aside><ul class="cards"><li><a href="phaser-api-index.html"><b>Phaser 4.2.1 API</b><span>All public declarations, members, signatures, types and JSDoc from Nord's exact version.</span></a></li><li><a href="babylon-api-index.html"><b>Babylon 9.30.0 API</b><span>Core, loaders, GUI, materials, post-process, procedural textures and serializers.</span></a></li><li><a href="babylon-guide-index.html"><b>Official Babylon guides</b><span>${guides.length} cloned prose guides. Online media omitted; prose can describe newer features.</span></a></li><li><a href="phaser-archive.html"><b>Supplied Phaser documentation</b><span>4.1.0 archive retained and labelled separately from the matching reference.</span></a></li></ul><h2 id="sources">Sources and licences</h2><p>MIT (Phaser), Apache-2.0 (Babylon). Original declarations and guide text, source commits and licences are preserved in the downloadable source archive.</p><p><a href="assets/engine-docs/SOURCES.json">Source manifest</a> · <a href="assets/engine-docs/phaser-LICENSE.txt">Phaser licence</a> · <a href="assets/engine-docs/babylon-guides-LICENSE.txt">Babylon documentation licence</a></p><pre class="code" data-lang="json"><code>${esc(JSON.stringify(provenance, null, 2))}</code></pre>` });
}
