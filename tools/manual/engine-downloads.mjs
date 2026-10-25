// Publish upstream references only inside deterministic, versioned ZIP downloads.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { engineDocs } from './engine-docs.mjs';

export function engineDownloads({ root, add, renderMd, esc, slug }) {
  const pages = [];
  engineDocs({ root, add: p => pages.push(p), renderMd, esc, slug });
  const archives = [];
  for (const [engine, version, prefix] of [['Phaser', '4.2.1', 'phaser/4.2'], ['Babylon', '9.30.0', 'babylon/9.30']]) {
    const selected = pages.filter(p => p.section === 'Engine docs' && p.outputFile?.startsWith(`engines/${prefix}/`));
    const mapping = new Map(selected.map(p => [p.file, p.outputFile.replace(`engines/${prefix}/`, '')]));
    const entries = selected.map(p => {
      const file = mapping.get(p.file);
      const body = p.html.replace(/href="([^"#]+)(#[^"]*)?"/g, (_, target, hash = '') => {
        const dest = mapping.get(target);
        return dest ? `href="${path.posix.relative(path.posix.dirname(file), dest)}${hash}"` : 'href="https://'+(engine === 'Phaser' ? 'docs.phaser.io/' : 'doc.babylonjs.com/typedoc/')+'"';
      });
      return [file, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(p.title)}</title><style>body{font:16px/1.6 system-ui;max-width:1000px;margin:2rem auto;padding:1rem}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eee;padding:1rem}table{border-collapse:collapse}td,th{padding:.5rem;border:1px solid #bbb}a{color:#1455a0}</style><p>${engine} ${version} · preserved public declarations and JSDoc · <a href="${path.posix.relative(path.posix.dirname(file), 'index.html') || 'index.html'}">Index</a></p><h1>${esc(p.title)}</h1>${body}</html>`];
    });
    entries.push(['index.html', `<!doctype html><html lang="en"><meta charset="utf-8"><title>${engine} ${version} API</title><h1>${engine} ${version} API</h1><p>Exact pinned package declarations and JSDoc. This is an API reference, not a copy of the rolling upstream website. Inherited members are documented on base types.</p><ul>${selected.map(p => `<li><a href="${mapping.get(p.file)}">${esc(p.title)}</a></li>`).join('')}</ul></html>`]);
    const dir = path.join(root, 'vendor/engine-docs');
    for (const name of fs.readdirSync(dir).filter(n => n === 'SOURCES.json' || (n.startsWith(engine === 'Phaser' ? 'phaser' : 'babylonjs') && !n.includes('snapshot')))) {
      entries.push([`sources/${name}`, fs.readFileSync(path.join(dir, name)).toString('base64'), 'base64']);
    }
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nord-api-'));
    try {
      fs.writeFileSync(path.join(temp, 'entries.json'), JSON.stringify(entries));
      execFileSync('python3', ['-c', `import json,zipfile,sys,base64
with zipfile.ZipFile(sys.argv[2], 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
 for e in json.load(open(sys.argv[1])):
  info=zipfile.ZipInfo(e[0], (2026,10,25,0,0,0)); info.compress_type=zipfile.ZIP_DEFLATED; info.external_attr=0o644<<16
  z.writestr(info,base64.b64decode(e[1]) if len(e)>2 else e[1].encode())`, path.join(temp, 'entries.json'), path.join(temp, 'api.zip')]);
      archives.push([`assets/downloads/${engine.toLowerCase()}-${version}-api.zip`, fs.readFileSync(path.join(temp, 'api.zip'))]);
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  }
  // Keep old index links useful without republishing upstream content in the site.
  for (const file of ['engine-docs.html', 'phaser-api-index.html', 'babylon-api-index.html', 'phaser-archive.html', 'babylon-guides.html', 'babylon-guide-index.html']) {
    add({ file, title: file === 'engine-docs.html' ? 'Phaser and Babylon API downloads' : 'Upstream API downloads', section: 'Reference', order: 90, html: renderMd(`
Download the reference for the engine version bundled with Nord. Extract the ZIP and open **index.html**. No installation or internet connection is needed to read it.

::: dummies
Nord is the editor and scripting layer you use. Phaser draws 2D games; Babylon draws 3D games. These downloads explain the underlying libraries. Start with [Nord Unity API](api-unity.html) for normal game scripts.
:::

| Bundled engine | Offline API download | Official online API | Exact version source |
|---|---|---|---|
| Phaser **4.2.1** | [Download Phaser 4.2.1 API ZIP](assets/downloads/phaser-4.2.1-api.zip) | [Phaser API manual](https://docs.phaser.io/api-documentation/api-documentation) | [4.2.1 declarations and JSDoc](https://github.com/phaserjs/phaser/blob/v4.2.1/types/phaser.d.ts) |
| Babylon.js **9.30.0** | [Download Babylon 9.30.0 API ZIP](assets/downloads/babylon-9.30.0-api.zip) | [Babylon API manual](https://doc.babylonjs.com/typedoc/modules/BABYLON) | [9.30.0 declarations and JSDoc](https://github.com/BabylonJS/Babylon.js/tree/9.30.0/packages/dev/core/src) |

## Which version should I trust?
The ZIPs are generated from Nord's pinned packages, with original declarations, licences and source provenance included. Babylon's download covers core, GUI, loaders, materials, post-processes, procedural textures and serializers. They contain public declarations and their available JSDoc; they do not claim to reproduce every online tutorial or example.

Online manuals can change independently. Phaser's online manual was labelled **4.1.0** when checked on 25 October 2026. Babylon's online manual is rolling. Neither link is advertised as an immutable manual for Nord's exact version: use the ZIP or the exact-version source link to confirm a signature. The old Phaser 4.1 archive is not the API for Nord's bundled engine.

## Check yourself
- The ZIP filename matches **4.2.1** or **9.30.0**.
- Extract the whole archive before opening its index, so relative links work.
- Use upstream methods on the appropriate native engine object, not on a Nord entity.

Next: [Nord API reference](api.html). Back to: [2D](2d.html) or [3D](3d.html).
`)});
  }
  return archives;
}
