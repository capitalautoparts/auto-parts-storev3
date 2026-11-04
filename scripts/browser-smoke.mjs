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
const accountRequests = [];
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
  page.on('request', request => {
    if (request.url().includes('/api/catalog?')) report.apiRequests++;
    if (/\/api\/(auth|checkout|orders)(?:\/|\?|$)/.test(request.url())) accountRequests.push(request.url());
  });
  const screenshot = async name => {
    await page.screenshot({ path: `${output}/${name}.png` });
    report.screenshots.push(`${name}.png`);
  };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const waitParts = async () => {
    await page.locator('[data-testid="inline-parts"][aria-busy="false"] [data-part-id]').first().waitFor();
    assert.equal(await page.locator('[role="alert"]').count(), 0);
  };
  const clickTree = async label => page.getByTestId('vehicle-tree').getByRole('button', { name: label, exact: true }).click();
  await page.goto(origin);
  await page.getByRole('heading', { name: 'Capital Auto Parts', exact: true }).waitFor();
  await page.getByTestId('vehicle-tree').getByRole('button', { name: '2020', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Account', exact: true }).filter({ visible: true }).click();
  await page.getByText('Accounts are not enabled during catalog testing.', { exact: true }).waitFor();
  assert.equal(await page.locator('input[type="password"]').count(), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('cap-auth-user')), null);
  report.cases.push('Account action stays disabled; no login form, API call or mock user is created');
  await screenshot('desktop-original-home');
  for (const label of ['2020', 'Toyota', 'Camry', '2.5L 4-Cyl L', 'Brakes', 'Brake Pad']) await clickTree(label);
  await waitParts();
  assert.match(await page.getByTestId('inline-parts').textContent(), /2020 Toyota Camry/);
  assert.equal(await page.getByTestId('inline-parts').count(), 1);
  await page.getByTestId('inline-parts').locator('table').first().locator('thead').scrollIntoViewIfNeeded();
  await screenshot('desktop-original-parts');
  report.cases.push('Original tree → year → make → model → engine → category → inline real ERP parts');
  const row = page.locator('[data-part-id="DVNJ_ALD1212M"]');
  const rowAvailability = await row.getByTestId('part-availability').textContent();
  await row.getByRole('button', { name: 'Details', exact: true }).click();
  assert.ok((await page.getByRole('dialog').getByTestId('part-availability').textContent()).startsWith(rowAvailability));
  await page.getByRole('tab', { name: 'Fitments', exact: true }).click();
  assert.match(await page.getByRole('dialog').textContent(), /Application notes/);
  await screenshot('desktop-original-details');
  await page.keyboard.press('Escape');
  await row.getByRole('button', { name: 'Add', exact: true }).click();
  const quickCart = page.getByRole('complementary', { name: 'Quick Cart' });
  await quickCart.getByText('ALD1212M', { exact: true }).waitFor();
  await quickCart.getByRole('button', { name: 'Increase quantity for ALD1212M' }).click();
  await page.reload();
  await quickCart.getByText('ALD1212M', { exact: true }).waitFor();
  assert.match(await quickCart.textContent(), /56.00/);
  assert.equal(await quickCart.getByRole('button', { name: 'Checkout disabled for testing' }).isDisabled(), true);
  assert.equal(await page.getByPlaceholder('1234 5678 9012 3456').count(), 0);
  report.cases.push('Original detail modal and persistent Quick Cart; quantity survives reload; no card/order flow');

  const search = page.getByRole('combobox', { name: 'Search by vehicle or part number' });
  await search.fill('ALD1212M'); await search.press('Enter');
  await waitParts();
  assert.match(await page.getByTestId('parts-table').textContent(), /ALD1212M/);
  await page.getByLabel('In stock only', { exact: true }).check();
  await waitParts();
  report.cases.push('ERP part-number search and stock filter inside the same page');

  await page.getByRole('button', { name: 'Return to vehicle catalog' }).click();
  // Same model/engine IDs occur across years. Opening another year must not
  // expand the first year's model/engine or duplicate its selected part table.
  await clickTree('2021');
  const nextYear = page.locator('[data-vehicle-year="2021"]');
  for (const label of ['Toyota', 'Camry', '2.5L 4-Cyl L', 'Brakes', 'Brake Pad']) await nextYear.getByRole('button', { name: label, exact: true }).click();
  await waitParts();
  assert.equal(await page.getByTestId('inline-parts').count(), 1);
  assert.match(await page.getByTestId('inline-parts').textContent(), /2021 Toyota Camry/);
  assert.equal(await search.inputValue(), '', 'Vehicle/category navigation clears the prior part search text');
  report.cases.push('Year/model/engine/category state remains isolated across two vehicles');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('main').evaluate(element => { element.scrollTop = 0; });
  await screenshot('mobile-original-home');
  await page.getByTestId('inline-parts').locator('table').first().locator('thead').scrollIntoViewIfNeeded();
  const rowHeights = await page.locator('[data-part-id]').evaluateAll(rows => rows.map(row => row.getBoundingClientRect().height));
  assert.ok(Math.max(...rowHeights) < 280, 'Compact rows retain usable dimensions on mobile');
  await screenshot('mobile-original-parts');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No page overflow at 390px; wide parts tables scroll within their own panel');
  await page.getByRole('button', { name: 'Open Quick Cart', exact: true }).filter({ visible: true }).click();
  await page.getByRole('dialog').getByText('ALD1212M', { exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(255, 255, 255)');
  await screenshot('mobile-original-cart');
  await page.keyboard.press('Escape');
  report.cases.push('Original mobile tree, internally scrolling parts table and Quick Cart sheet');
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(accountRequests, [], 'Catalog testing must not call account, checkout or order endpoints');
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
