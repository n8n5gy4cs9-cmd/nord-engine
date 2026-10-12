import { suites, withPage, nonBlank, ROOT } from '../e2e-lib.mjs';

suites['html-lite'] = async () => {
  const { errors, result } = await withPage(`${ROOT}/examples/html-lite`, async (page) => {
    await page.waitForFunction(() => window.__lite);
    await page.keyboard.press('Space'); await page.waitForTimeout(100);
    await page.keyboard.press('Space'); await page.waitForTimeout(300);
    const s = await page.evaluate(() => ({ ...window.__lite, ls: localStorage.getItem('nord:html-lite-clicker:best') }));
    return { s, colors: await nonBlank(page, await page.screenshot()) };
  });
  if (errors.length) throw new Error(errors.join('\n'));
  if (result.s.score !== 2 || result.s.ls !== '2') throw new Error(`lite clicker state wrong: ${JSON.stringify(result.s)}`);
  if (result.colors < 4) throw new Error('blank');
};
