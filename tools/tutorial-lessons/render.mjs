// Render authored teaching notes against complete, consecutive ranges of real project code.
import fs from 'node:fs';
import path from 'node:path';
export const LESSON_START = '<!-- GENERATED FILE WALKTHROUGH -->';
export const LESSON_END = '<!-- END GENERATED FILE WALKTHROUGH -->';
export function renderLessons(root, project, plans) {
  const coverage = [];
  let markdown = `${LESSON_START}\n\n## Walk through every project file {#file-walkthrough}\n\nWork through these files in order using your downloaded project in Nord. Each numbered part shows the **next consecutive lines** of that file, not a selection of highlights. Read the explanation before changing anything. Edit the existing code in place; do not append another copy of a function. Finish one experiment, observe its result, and undo that change before moving on. The complete files and download at the end remain your reference.\n\nThe walkthrough covers the app/game modules, shared helpers used by them, page, styles and project configuration. Binary art/audio/models and minified vendor dependencies are resources rather than lessons in their internal implementation; their paths and contracts are explained where the app uses them.\n\n`;
  markdown += '| File | What you will build or understand |\n| --- | --- |\n';
  for (const plan of plans)
    markdown += `| [${plan.file}](#walk-${plan.file.replace(/[^a-z0-9]/gi, '-')}) | ${plan.intro} |\n`;
  let number = 0;
  for (const plan of plans) {
    const raw = fs
      .readFileSync(path.join(root, 'examples', project, plan.file), 'utf8')
      .trimEnd();
    const lines = raw.split('\n');
    const starts = [];
    plan.parts.forEach((part, index) => {
      const from =
        index === 0
          ? 0
          : lines.findIndex((line, n) => n > starts.at(-1) && line.includes(part.at));
      if (from < 0)
        throw Error(
          `${project}/${plan.file}: missing/out-of-order lesson anchor ${part.at}`,
        );
      starts.push(from);
    });
    markdown += `\n### ${++number}. ${plan.file} {#walk-${plan.file.replace(/[^a-z0-9]/gi, '-')}}\n\n${plan.intro}\n\n`;
    plan.parts.forEach((part, index) => {
      const start = starts[index],
        end = starts[index + 1] ?? lines.length;
      if (end <= start)
        throw Error(`${project}/${plan.file}: lesson anchors out of order at ${part.at}`);
      if (end - start > 85)
        throw Error(
          `${project}/${plan.file}: ${part.title} is ${end - start} lines; split the teaching step`,
        );
      const language =
        { mjs: 'js', js: 'js', json: 'json', css: 'css', html: 'html', xml: 'xml' }[
          path.extname(plan.file).slice(1)
        ] ?? 'text';
      markdown += `#### ${number}.${index + 1} — ${part.title}\n\n**Read:** \`${plan.file}\`, lines ${start + 1}–${end}.${part.before ? ' ' + part.before : ''}\n\n`;
      const where = index === 0 ? 'the beginning of the file' : 'the next part of this file; it goes **below** the code of the previous step';
      markdown += `<!-- taught-source: ${project}/${plan.file}:${start + 1}-${end} -->\n\n**File: \`${plan.file}\`** (step ${number}.${index + 1}, ${part.title.charAt(0).toLowerCase() + part.title.slice(1)}: ${where})\n\`\`\`${language}\n${lines.slice(start, end).join('\n')}\n\`\`\`\n\n`;
      markdown += `**What and why:** ${part.why}\n\n**Try it / expected result:** ${part.try}\n\n`;
      coverage.push({ file: plan.file, start: start + 1, end });
    });
  }
  markdown += `${LESSON_END}\n\n`;
  return { markdown, coverage };
}
