// Manual integrated check: run on VM511 after npm run build. No API interception.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { firefox } from '@playwright/test';

const output = process.env.ROYS_SMOKE_OUTPUT || '/tmp/roysauto-browser-smoke';
await mkdir(output, { recursive: true });
const reservation = createServer().listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
let previewLog = '';
preview.stdout.on('data', chunk => { previewLog += chunk; });
preview.stderr.on('data', chunk => { previewLog += chunk; });
let browser;
let activePage;
const report = { cases: [], apiRequests: 0, pageErrors: [], screenshots: [] };
try {
  for (let attempt = 0; attempt < 30; attempt++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* bounded server startup */ }
    if (attempt === 29) throw new Error(`Preview did not start: ${previewLog}`);
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  activePage = page;
  page.setDefaultTimeout(45_000);
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('request', request => { if (request.url().includes('/api/catalog?')) report.apiRequests++; });
  const screenshot = async name => {
    await page.screenshot({ path: `${output}/${name}.png` });
    report.screenshots.push(`${name}.png`);
  };
  const waitParts = async () => {
    await page.locator('.parts-list[aria-busy="false"] .part-row').first().waitFor();
    assert.equal(await page.locator('[role="alert"]').count(), 0);
  };
  await page.goto(origin);
  await page.getByLabel('Year', { exact: true }).selectOption('2020');
  await page.getByLabel('Make', { exact: true }).selectOption('Toyota');
  await page.getByLabel('Model', { exact: true }).selectOption('Camry');
  await page.getByLabel('Engine (optional)', { exact: true }).selectOption('17637');
  await page.getByRole('navigation', { name: 'Browse categories' }).getByRole('button', { name: 'Brakes', exact: true }).click();
  await waitParts();
  assert.match(page.url(), /engine_base_id=17637/);
  assert.match(await page.locator('.result-status').textContent(), /matching parts/);
  await screenshot('desktop-vehicle-brakes');
  report.cases.push('Real ERP Year→Make→Model→Engine selection and category results');

  await page.getByRole('button', { name: 'Application details' }).first().click();
  await page.getByRole('dialog').waitFor();
  assert.match(await page.getByRole('dialog').textContent(), /Application notes/);
  await screenshot('desktop-application-details');
  await page.keyboard.press('Escape');
  report.cases.push('Application details modal, notes and keyboard dismissal');

  await page.getByRole('button', { name: 'Clear vehicle' }).click();
  await page.getByLabel('Part number, brand or keyword').fill('ALD1212M');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await waitParts();
  assert.match(await page.locator('.part-number').first().textContent(), /ALD1212M/);
  await page.getByRole('button', { name: 'Save to test cart', exact: true }).first().click();
  await page.reload();
  await waitParts();
  await page.getByRole('button', { name: /Test cart/ }).click();
  assert.match(await page.getByRole('dialog').textContent(), /ALD1212M/);
  await page.getByLabel('Quantity for ALD1212M').selectOption('2');
  await page.keyboard.press('Escape');
  report.cases.push('Exact part-number search and persisted cart with quantity changes');

  await page.getByLabel('In stock only').check();
  await waitParts();
  assert.match(page.url(), /in_stock_only=true/);
  await page.goBack();
  await waitParts();
  assert.equal(await page.getByLabel('In stock only').isChecked(), false);
  report.cases.push('Stock filter and browser Back restore query state');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/?year=2020&make=Toyota&model=Camry&category=brakes&engine_base_id=17637`);
  await waitParts();
  await screenshot('mobile-vehicle');
  await page.locator('#catalog-results').scrollIntoViewIfNeeded();
  await screenshot('mobile-parts');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false, 'No horizontal overflow at 390px');
  await page.getByRole('button', { name: /Test cart/ }).click();
  assert.equal(await page.getByLabel('Quantity for ALD1212M').inputValue(), '2');
  await screenshot('mobile-test-cart');
  await page.keyboard.press('Escape');
  report.cases.push('390px responsive results and persisted test cart');

  await page.getByLabel('Year', { exact: true }).selectOption('2021');
  assert.equal(await page.getByLabel('Make', { exact: true }).inputValue(), '');
  assert.equal(await page.getByLabel('Model', { exact: true }).inputValue(), '');
  assert.equal(await page.getByLabel('Engine (optional)', { exact: true }).inputValue(), '');
  report.cases.push('Changing year clears dependent vehicle and fitment state');
  assert.deepEqual(report.pageErrors, []);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.failure = error.message;
  if (activePage) {
    await activePage.screenshot({ path: `${output}/failure.png` }).catch(() => {});
    report.visibleText = (await activePage.locator('body').innerText().catch(() => '')).slice(0, 3000);
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  preview.kill('SIGTERM');
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(`SMOKE_OUTPUT=${output}`);
}
