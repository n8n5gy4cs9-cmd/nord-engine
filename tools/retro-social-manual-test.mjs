import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { withPage, loadPlaywright, ROOT } from './e2e-lib.mjs';
if (process.env.PW_CHROMIUM) {
  const { chromium } = loadPlaywright(),
    launch = chromium.launch.bind(chromium);
  chromium.launch = (o) => launch({ ...o, executablePath: process.env.PW_CHROMIUM });
}
for (const [id, slug] of [
  ['coastline-sprint', 'tut-t38-coastline-sprint'],
  ['vector-patrol', 'tut-t39-vector-patrol'],
  ['jengatedris', 'tut-t40-jengatedris'],
  ['nord-office', 'tut-t41-nord-office'],
  ['paper-worlds', 'tut-t42-paper-worlds'],
  ['rss-river', 'tut-t43-rss-river'],
]) {
  execFileSync('python3', [
    '-c',
    `
import pathlib,zipfile,sys
root=pathlib.Path(sys.argv[1]); archive=zipfile.ZipFile(sys.argv[2])
files=[p for p in root.rglob('*') if p.is_file() and not any(x in ('dist','target','.nord-cache','.nord-lock','.DS_Store') for x in p.relative_to(root).parts)]
assert set(archive.namelist())=={root.name+'/'+p.relative_to(root).as_posix() for p in files}
for p in files: assert archive.read(root.name+'/'+p.relative_to(root).as_posix())==p.read_bytes(),str(p)
`,
    `${ROOT}/examples/${id}`,
    `${ROOT}/docs/tutorial-downloads/${id}-source.zip`,
  ]);
  const prose = fs.readFileSync(`${ROOT}/docs/manual-src/${slug}.md`, 'utf8');
  assert(/## Complete (project|game) source/.test(prose));
  assert(prose.includes('Complete nord.project.json'));
  const walk = (dir) =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((e) =>
        e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
      );
  for (const file of walk(`${ROOT}/examples/${id}`)) {
    const relative = file.slice(`${ROOT}/examples/${id}/`.length);
    if (relative.startsWith('vendor/') || relative.startsWith('lib/')) continue;
    if (!/\.(js|mjs|json|html|css|xml)$/.test(file) && relative !== '.offline-allow')
      continue;
    assert(
      prose.includes(fs.readFileSync(file, 'utf8').trimEnd()),
      `${id}: full source listing differs from ${relative}`,
    );
  }
  const { errors } = await withPage(
    `${ROOT}/docs/manual`,
    async (page) => {
      const frames = page.locator('.code-frame');
      assert((await frames.count()) >= 8);
      const frame = frames.first();
      await frame.scrollIntoViewIfNeeded();
      await frame.locator('.cm-editor').waitFor();
      const wrap = frame.getByRole('button', { name: 'Toggle code word wrap' });
      const before = await wrap.getAttribute('aria-pressed');
      await wrap.click();
      assert.notEqual(await wrap.getAttribute('aria-pressed'), before);
      assert(await frame.getByRole('button', { name: 'Copy code example' }).isEnabled());
      const detail = page
        .locator('details')
        .filter({
          has: page.locator('summary', { hasText: 'Complete nord.project.json' }),
        })
        .first();
      await detail.locator('summary').click();
      await detail.locator('.code-frame').scrollIntoViewIfNeeded();
      await detail.locator('.cm-editor').waitFor();
      const href = await page
        .locator('a[href$="source.zip"]')
        .first()
        .getAttribute('href');
      const res = await page.request.get(new URL(href, page.url()).href);
      assert.equal(res.status(), 200);
      assert.equal((await res.body()).subarray(0, 2).toString(), 'PK');
      await page.locator('figure.shot img').evaluateAll((imgs) =>
        Promise.all(
          imgs.map((i) => {
            i.loading = 'eager';
            return i.decode();
          }),
        ),
      );
    },
    { path: `/nord/tutorials/${slug}.html` },
  );
  assert.deepEqual(errors, []);
  console.log(
    id,
    'exact complete archive, CodeMirror, full code, screenshots and download OK',
  );
}
