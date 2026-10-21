import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderLessons, LESSON_START, LESSON_END } from './tutorial-lessons/render.mjs';
const root = process.cwd();
const plans = JSON.parse(fs.readFileSync('tools/tutorial-lessons/plans.json', 'utf8'));
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(name) : [name];
  });
for (const [id, files] of Object.entries(plans)) {
  test(`${id}: every main code file is taught completely, in consecutive explained parts`, () => {
    const project = path.join(root, 'examples', id);
    const expected = walk(project)
      .map((file) => path.relative(project, file))
      .filter(
        (file) =>
          !file.startsWith('vendor/') &&
          !file.startsWith('assets/') &&
          !file.startsWith('lib/') &&
          (/\.(js|mjs|css|html|xml)$/.test(file) ||
            file === 'nord.project.json' ||
            file.startsWith('scenes/') ||
            file === '.offline-allow'),
      );
    const names = files.map((file) => file.file);
    assert.equal(new Set(names).size, names.length, 'each file is taught once');
    for (const file of expected)
      assert(names.includes(file), `${file} needs a file walkthrough`);
    const { markdown, coverage } = renderLessons(root, id, files);
    for (const file of files) {
      const ranges = coverage.filter((range) => range.file === file.file);
      let next = 1;
      for (const range of ranges) {
        assert.equal(range.start, next, `${file.file}: no skipped or duplicated lines`);
        next = range.end + 1;
      }
      const source = fs.readFileSync(path.join(project, file.file), 'utf8').trimEnd();
      assert.equal(next - 1, source.split('\n').length, `${file.file}: reach the end`);
      for (const part of file.parts) {
        assert(part.why.length >= 160, `${file.file}: explain what and why`);
        assert(part.try.length >= 60, `${file.file}: give an observable exercise`);
      }
    }
    assert.equal(
      (markdown.match(/\*\*What and why:\*\*/g) ?? []).length,
      coverage.length,
    );
    assert.equal(
      (markdown.match(/\*\*Try it \/ expected result:\*\*/g) ?? []).length,
      coverage.length,
    );
  });
}
test('published lessons are current and original screenshots/full-source references remain', () => {
  const guideNames = [
    'tut-t38-coastline-sprint',
    'tut-t39-vector-patrol',
    'tut-t40-jengatedris',
    'tut-t41-nord-office',
    'tut-t42-paper-worlds',
    'tut-t43-rss-river',
  ];
  for (const [index, [id, files]] of Object.entries(plans).entries()) {
    const guide = fs.readFileSync(`docs/manual-src/${guideNames[index]}.md`, 'utf8');
    const start = guide.indexOf(LESSON_START),
      end = guide.indexOf(LESSON_END);
    assert(start > 0 && end > start);
    const actual = guide.slice(start, end + LESSON_END.length);
    assert.equal(actual, renderLessons(root, id, files).markdown.trimEnd());
    assert(
      guide.slice(0, start).includes('assets/screenshots/'),
      `${id}: keep illustrated opening`,
    );
    assert(
      guide.slice(end).includes('<!-- GENERATED GAME SOURCE:'),
      `${id}: keep full files at end`,
    );
    assert(guide.includes(`assets/downloads/${id}-source.zip`));
  }
});
