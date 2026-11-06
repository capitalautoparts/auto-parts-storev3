// R1/R7 aa064791: one focused integrated real-staging journey, VM511 only.
// Reuse the PR14 refusal latch: no API interception, challenge retries or mocks.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { firefox } from '@playwright/test';
import { preview } from 'vite';
import { createProductSmokeMonitor } from './product-links-monitor.mjs';

const output = process.env.ROYS_CONTEXT_OUTPUT || '/tmp/roys-aa064791-r1-r7-context';
await mkdir(output, { recursive: true });
const server = await preview({ configFile: 'vite.config.ts', preview: { host: '127.0.0.1', port: 0 } });
const origin = server.resolvedUrls.local[0];
const browser = await firefox.launch();
const report = { task: 'aa064791', scope: 'First bounded R1/R7 batch',
  recordedEastern: new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', timeZoneName: 'short' }),
  cases: [], apiResponses: [], pageErrors: [], screenshots: [], searches: [] };
const monitor = createProductSmokeMonitor(report);
const run = action => monitor.run(action);
const key = 'roysauto.original-vehicle.v1';
try {
  const context = await run(() => browser.newContext({ viewport: { width: 1440, height: 900 },
    userAgent: 'RoysAuto-Vehicle-Context-Firefox-Smoke/1.0 (+Autrex; staging read-only)' }));
  const page = await run(() => context.newPage());
  monitor.observe(page); page.setDefaultTimeout(45_000);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === '/api/catalog' && url.searchParams.get('resource') === 'search') report.searches.push(Object.fromEntries(url.searchParams));
  });
  await run(() => page.goto(origin));
  const tree = page.getByTestId('vehicle-tree');
  const banner = page.getByTestId('selected-context');
  const click = control => run(() => control.click());
  const open = async control => {
    await run(() => control.waitFor());
    if (await control.getAttribute('aria-expanded') !== 'true') await click(control);
  };
  const year = page.locator('#vehicle-year-2020');
  await open(year);
  const yearBranch = year.locator('..');
  const make = yearBranch.getByRole('button', { name: 'Toyota', exact: true });
  await open(make);
  const model = make.locator('..').getByRole('button', { name: 'Camry', exact: true });
  await open(model);
  const engines = model.locator('..').locator('button[id^="vehicle-engine-"]');
  await run(() => engines.nth(1).waitFor());
  const engineA = engines.filter({ hasText: '2.5L 4-Cyl L' });
  assert.equal(await engineA.count(), 1);
  const aId = await engineA.getAttribute('id');
  const engineB = engines.filter({ hasNotText: '2.5L 4-Cyl L' }).first();
  const bId = await engineB.getAttribute('id');
  const aName = await engineA.textContent(), bName = await engineB.textContent();
  report.sample = { aId, aName, bId, bName };
  const categoriesFor = id => page.locator(`#${id.replace('vehicle-engine-', 'vehicle-categories-')}`);
  // Preserve the established browser-smoke engineButton.locator('..') scope.
  const aCategories = engineA.locator('..');
  const brakes = aCategories.getByRole('button', { name: 'Brakes', exact: true });
  const pad = aCategories.getByRole('button', { name: 'Brake Pad', exact: true });
  const choosePad = async () => { await open(brakes); await click(pad); await waitParts(); };
  const waitParts = async () => {
    await run(() => page.locator('[data-testid="inline-parts"][aria-busy="false"] [data-part-id]').first().waitFor());
    assert.equal(await page.getByRole('alert').count(), 0);
  };
  const saved = () => run(() => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key));
  const assertActive = async id => {
    assert.equal(await page.locator(`#${id}`).getAttribute('aria-current'), 'true');
    assert.equal((await saved()).engineId, Number(id.split('-').at(-1)));
  };
  await click(engineA); await choosePad();
  // Recreate the exact stale-storage sequence: A leaf -> B -> still-open A leaf.
  await click(engineB); await assertActive(bId);
  await click(pad); await waitParts(); await assertActive(aId);
  assert.match(await banner.textContent(), /Brake Pad/);
  await run(() => page.reload());
  await run(() => page.locator(`#${aId}[aria-current="true"]`).waitFor());
  assert.equal(await categoriesFor(aId).isVisible(), true);
  assert.equal(await page.getByTestId('inline-parts').count(), 0, 'Category hydration is deliberately deferred');
  report.cases.push('Real staging A Brake Pad -> B engine -> still-open A Brake Pad -> reload reopens A; category restoration deferred');

  await choosePad();
  const midTable = async () => {
    const rows = page.locator('[data-part-id]');
    const count = await rows.count();
    await run(() => rows.nth(Math.min(6, count - 1)).scrollIntoViewIfNeeded());
  };
  const focusIs = async id => run(() => page.waitForFunction(expected => document.activeElement?.id === expected, id));
  const returnButton = name => banner.getByRole('button', { name, exact: true });
  for (const width of [1440, 390]) {
    await run(() => page.setViewportSize({ width, height: width === 390 ? 844 : 900 }));
    await waitParts();
    const beforeTextSearch = report.searches.length;
    const search = page.getByRole('combobox', { name: 'Search by vehicle or part number' });
    await run(() => search.fill('brake')); await run(() => search.press('Enter')); await waitParts();
    assert.equal(await banner.getByRole('button', { name: 'Brake Pad', exact: true }).count(), 0,
      'Current breadcrumb must omit the retained return category during a cross-category text search');
    const textRequests = report.searches.slice(beforeTextSearch).filter(request => request.q === 'brake');
    assert.ok(textRequests.length, 'A real text search request must be observed');
    for (const request of textRequests) {
      assert.equal(request.category, undefined); assert.equal(request.engine_base_id, '17637'); assert.equal(request.page, '1');
    }
    await assertActiveStorage(aId);
    const searchShot = `${width}-text-search-scope.png`;
    await run(() => page.screenshot({ path: `${output}/${searchShot}` })); report.screenshots.push(searchShot);
    const beforeReturn = report.searches.length;
    await click(page.getByRole('button', { name: 'Return to vehicle catalog', exact: true })); await waitParts();
    assert.equal(await banner.getByRole('button', { name: 'Brake Pad', exact: true }).count(), 1);
    const returnRequests = report.searches.slice(beforeReturn);
    assert.ok(returnRequests.length);
    for (const request of returnRequests) {
      assert.equal(request.q, undefined); assert.equal(request.category, 'brakes-brake-pads');
      assert.equal(request.engine_base_id, '17637'); assert.equal(request.page, '1');
    }
    assert.equal(await pad.getAttribute('aria-current'), 'true');
    report.cases.push(`${width}px: category -> text search -> return; visible breadcrumb and outgoing category/vehicle query scope agree, retained category restored on return`);
    await midTable();
    assert.match(await banner.textContent(), new RegExp(aName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(await banner.textContent(), /Brake Pad/);
    const bannerBox = await banner.boundingBox();
    assert.ok(bannerBox.y >= 0 && bannerBox.y + bannerBox.height <= page.viewportSize().height);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.locator('main').evaluate(el => el.scrollWidth > el.clientWidth), false);
    const screenshot = `${width}-mid-table-context.png`;
    await run(() => page.screenshot({ path: `${output}/${screenshot}` })); report.screenshots.push(screenshot);
    await click(returnButton('Categories')); await focusIs(await brakes.getAttribute('id'));
    await run(() => page.keyboard.press('Enter')); // Native disclosure, preserves selection/storage.
    assert.match(await banner.textContent(), /Brake Pad/); await assertActive(aId);
    await click(returnButton('Categories')); await focusIs(await brakes.getAttribute('id'));
    assert.equal(await pad.getAttribute('aria-current'), 'true');
    await waitParts(); await midTable();
    await click(returnButton('Change engine')); await focusIs(aId);
    await run(() => page.keyboard.press('Enter')); // Already-open engine has a single-action selection.
    await assertActive(aId);
    assert.equal(await page.getByTestId('inline-parts').count(), 0);
    await choosePad(); await midTable();
    await click(returnButton('Change vehicle')); await focusIs('vehicle-year-2020');
    await run(() => page.keyboard.press('Enter')); // Collapse every ancestor, retain current selection.
    assert.match(await banner.textContent(), /Brake Pad/); await assertActiveStorage(aId);
    await click(returnButton('Change engine')); await focusIs(aId); // Reopens year/make/model.
    await click(year); // Collapse again; Categories must reopen the full path and selected parent.
    await click(returnButton('Categories')); await focusIs(await brakes.getAttribute('id'));
    await run(() => pad.waitFor()); assert.equal(await pad.getAttribute('aria-current'), 'true');
    await waitParts();
    const focusShot = `${width}-categories-focus.png`;
    await run(() => page.screenshot({ path: `${output}/${focusShot}` })); report.screenshots.push(focusShot);
    report.cases.push(`${width}px: persistent engine/category mid-table, wrapping/no horizontal overflow, Categories/Change engine/Change vehicle native keyboard focus, collapsed ancestors reopen, already-open engine selection`);
  }
  async function assertActiveStorage(id) {
    assert.equal((await saved()).engineId, Number(id.split('-').at(-1)));
  }
  // A disclosure on another engine cannot switch the active vehicle.
  const bDisclosure = page.locator(`#${bId}`).locator('..').getByRole('button').first();
  await click(bDisclosure); await assertActive(aId);
  await click(bDisclosure); await assertActive(aId);
  report.cases.push('Opening/collapsing a different engine disclosure leaves selected/saved A unchanged');

  // Dirty filters and page, then switch the leaf; capture the first next request.
  const results = page.getByTestId('inline-parts');
  const brand = results.getByRole('combobox', { name: 'Brand', exact: true });
  const brandValue = await brand.locator('option').nth(1).getAttribute('value');
  assert.ok(brandValue, 'Real staging sample needs a brand facet');
  await run(() => brand.selectOption(brandValue)); await waitParts();
  const beforeLeaf = report.searches.length;
  await click(aCategories.getByRole('button', { name: 'View all Brakes', exact: true })); await waitParts();
  const leafRequests = report.searches.slice(beforeLeaf);
  assert.ok(leafRequests.length);
  for (const request of leafRequests) { assert.equal(request.brand, undefined); assert.equal(request.page, '1'); }
  await run(() => brand.selectOption(brandValue)); await waitParts();
  const beforeEngine = report.searches.length;
  await click(page.locator(`#${bId}`));
  assert.equal(report.searches.length, beforeEngine, 'Engine selection clears the leaf before a request');
  const bCategories = categoriesFor(bId);
  await open(bCategories.getByRole('button', { name: 'Brakes', exact: true }));
  await click(bCategories.getByRole('button', { name: 'Brake Pad', exact: true }));
  // B may have no inventory; verify request completion without inventing coverage.
  await run(() => page.locator('[data-testid="inline-parts"][aria-busy="false"]').waitFor());
  for (const request of report.searches.slice(beforeEngine)) { assert.equal(request.brand, undefined); assert.equal(request.page, '1'); }
  await assertActive(bId);
  // Assert nonfirst-page transitions explicitly, using real unfiltered A Brakes.
  await click(page.locator(`#${aId}`)); await open(brakes);
  const allBrakes = aCategories.getByRole('button', { name: 'View all Brakes', exact: true });
  await click(allBrakes); await waitParts();
  const next = results.getByRole('button', { name: 'Next', exact: true });
  assert.equal(await next.isEnabled(), true, 'Real unfiltered Brakes sample must have page 2');
  await click(next); await waitParts();
  assert.equal(report.searches.at(-1).page, '2');
  const page2Leaf = report.searches.length;
  await click(pad); await waitParts();
  assert.equal(report.searches[page2Leaf].page, '1');
  assert.equal(report.searches[page2Leaf].category, 'brakes-brake-pads');
  await click(allBrakes); await waitParts(); await click(next); await waitParts();
  assert.equal(report.searches.at(-1).page, '2');
  const page2Engine = report.searches.length;
  await click(page.locator(`#${bId}`));
  assert.equal(report.searches.length, page2Engine);
  assert.equal(await page.getByTestId('inline-parts').count(), 0);
  await click(bCategories.getByRole('button', { name: 'Brake Pad', exact: true }));
  await run(() => page.locator('[data-testid="inline-parts"][aria-busy="false"]').waitFor());
  assert.equal(report.searches[page2Engine].page, '1');
  assert.equal(report.searches[page2Engine].engine_base_id, '2091');
  await assertActive(bId);
  report.cases.push('Explicit real Brakes page 2 -> leaf starts at page 1; page 2 -> B engine clears leaf without stale request, next B leaf starts at page 1');
  report.cases.push('Dependent brand/page reset in first leaf/engine requests; engine switch clears leaf without a stale request');

  // Isolated storage fault only; all catalog data remains real staging.
  await run(() => page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Disabled', 'SecurityError'); }; }));
  await click(page.locator(`#${aId}`));
  await run(() => page.getByText('Your vehicle could not be saved in this browser.', { exact: true }).waitFor());
  assert.equal(await page.locator(`#${aId}`).getAttribute('aria-current'), 'true');
  report.cases.push('Storage write failure reports a toast and selection remains usable');

  // Reuse real vehicle labels with the documented unspecified-engine sentinel.
  // This checks local saved-state compatibility only, not real product coverage for ID 0.
  await run(() => page.reload());
  const vehicle = await saved();
  await run(() => page.evaluate(({ k, v }) => localStorage.setItem(k, JSON.stringify({ ...v, engineId: 0, engineName: 'Engine unspecified' })), { k: key, v: vehicle }));
  await run(() => page.reload());
  await run(() => banner.getByRole('button', { name: 'Engine unspecified', exact: true }).waitFor());
  assert.equal((await saved()).engineId, 0);
  report.cases.push('Validated saved engine ID 0 survives reload as Engine unspecified (storage sentinel check, no coverage claim)');
  assert.deepEqual(report.pageErrors, []);
  await run(() => context.close());
} catch (error) {
  report.failure = error.message; throw error;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close(); await new Promise(resolve => server.httpServer.close(resolve));
}
