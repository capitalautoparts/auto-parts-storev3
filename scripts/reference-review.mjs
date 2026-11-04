// Read-only visual/navigation comparison, run on VM511 only.
import { firefox } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const output = '/tmp/roysauto-reference-review';
await mkdir(output, { recursive: true });
const browser = await firefox.launch();
const report = [];
try {
  for (const [name, url] of [['original', 'https://auto-parts-storev3.vercel.app/'], ['rockauto', 'https://www.rockauto.com/']]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15000);
    const entry = { name, url, steps: [] };
    report.push(entry);
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      entry.status = response.status();
      await page.screenshot({ path: `${output}/${name}-home.png` });
      entry.home = (await page.locator('body').innerText()).slice(0, 4000);
      if (response.status() >= 400) continue;
      if (name === 'rockauto') {
        for (const label of ['TOYOTA', '2020', 'CAMRY', '2.5L L4', 'Brake & Wheel Hub', 'Brake Pad']) {
          await page.getByText(label, { exact: true }).filter({ visible: true }).first().click();
          entry.steps.push(label);
        }
      } else {
        for (const label of ['2010', 'Hyundai', 'Elantra', '2.0L L4', 'Brake & Wheel Hub', 'Brake Pad']) {
          await page.getByText(label, { exact: true }).filter({ visible: true }).first().click();
          entry.steps.push(label);
        }
      }
      await page.getByText(name === 'rockauto' ? 'Economy' : 'Daily Driver', { exact: true }).filter({ visible: true }).first().waitFor();
      entry.finalUrl = page.url();
      await page.screenshot({ path: `${output}/${name}-expanded.png` });
      entry.expanded = (await page.locator('body').innerText()).slice(0, 6500);
      entry.inputs = await page.locator('input:visible').evaluateAll(nodes => nodes.map(node => ({ id: node.id, placeholder: node.placeholder, type: node.type })));
    } catch (error) {
      entry.error = error.message;
      entry.visibleText = (await page.locator('body').innerText().catch(() => '')).slice(0, 7000);
      await page.screenshot({ path: `${output}/${name}-stopped.png` }).catch(() => {});
    }
    await page.close();
  }
} finally { await browser.close(); }
await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
