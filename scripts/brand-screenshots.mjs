// Manual: brand visual check. Run on VM511 after `npx vite build`; serves dist via vite preview, no API interception.
// Captures the default view and a parts-table view (2020 > Toyota > Camry > first engine > Brakes > Brake Pad).
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { firefox } from '@playwright/test';
const out = process.env.BRAND_OUT || 'docs/evidence/roys-brand';
await mkdir(out, { recursive: true });
const port = 4391;
const p = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 3000));
const browser = await firefox.launch();
const texts = page => page.locator('main button, aside button, nav button').allInnerTexts().catch(() => []);
async function clickText(page, re) {
  const b = page.getByRole('button', { name: re }).first();
  await b.waitFor({ timeout: 20000 });
  await b.scrollIntoViewIfNeeded();
  await b.click();
  await page.waitForTimeout(1500);
}
try {
  for (const [name, w, h] of [['desktop-1440', 1440, 900], ['mobile-390', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    console.log(name, 'title', await page.title());
    await page.screenshot({ path: `${out}/${name}.png` });
    try {
      await clickText(page, /^2020$/);
      await clickText(page, /^Toyota$/i);
      await clickText(page, /^Camry$/i);
      const before = new Set(await texts(page));
      const all = page.locator('button');
      const n0 = await all.count();
      // first engine: first button in the tree following Camry that is not in the earlier set
      const engineLabel = (await page.getByRole('button', { name: /L\d|V\d|\d\.\d/ }).first().innerText()).trim();
      console.log(name, 'engine', JSON.stringify(engineLabel), 'buttons', n0, before.size);
      await clickText(page, new RegExp(engineLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      await clickText(page, /^Brakes$/i);
      console.log(name, 'brakes children', JSON.stringify((await page.locator('button').allInnerTexts()).filter(t => /brake|pad|rotor|disc/i.test(t))));
      await clickText(page, /Brake Pad/i);
      await page.waitForTimeout(3500);
      console.log(name, 'bodyText', await page.evaluate(() => document.body.innerText.length), 'hasAdd', await page.getByRole('button', { name: /^Add/ }).count());
      await page.screenshot({ path: `${out}/${name.split('-')[0]}-parts-${w}.png` });
      if (w === 390) {
        const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, offenders: [...document.querySelectorAll('button')].filter(b => /^\s*Add/.test(b.innerText) && (b.getBoundingClientRect().right > innerWidth || b.getBoundingClientRect().left < 0)).length }));
        console.log('mobile overflow', JSON.stringify(overflow));
      }
    } catch (e) { console.log(name, 'parts-table navigation failed:', String(e).split('\n')[0]); await page.screenshot({ path: `${out}/${name.split('-')[0]}-parts-${w}-failed.png` }); }
    await page.close();
  }
} finally { await browser.close(); p.kill('SIGTERM'); }
