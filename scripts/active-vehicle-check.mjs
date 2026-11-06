// Bounded integrated Firefox check; VM511 only, fixed real staging upstream.
// Reuses the shared refusal latch. No API fixtures, retries or access bypasses.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { firefox } from '@playwright/test';
import { createServer } from 'vite';
import { createProductSmokeMonitor } from './product-links-monitor.mjs';

const output = process.env.ROYS_ACTIVE_OUTPUT || '/tmp/roys-active-vehicle-aa064791';
await mkdir(output, { recursive: true });
const server = await createServer({ configFile: 'vite.config.ts', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const origin = server.resolvedUrls.local[0];
const browser = await firefox.launch();
const report = { task: 'WP-ROYS-ACTIVE-VEHICLE1',
  recordedEastern: new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', timeZoneName: 'short' }),
  cases: [], screenshots: [], apiResponses: [], pageErrors: [], searches: [] };
const monitor = createProductSmokeMonitor(report);
const run = action => monitor.run(action);
const layoutOnly = process.env.ROYS_ACTIVE_LAYOUT_ONLY === '1';
report.mode = layoutOnly ? 'final-copy-and-exact-name-check' : process.env.ROYS_ACTIVE_FINAL_BATCH === '1' ? 'desktop-final-copy-mobile-full-journey' : 'bounded-active-vehicle-journey';
const key = 'roysauto.original-vehicle.v1';
const listKeys = ['roysauto.original-cart.v1', 'roysauto.original-wishlist.v1'];
try {
  for (const width of [1440, 390]) {
    const context = await run(() => browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 },
      userAgent: 'RoysAuto-Active-Vehicle-Firefox/1.0 (+Autrex; staging read-only)' }));
    await context.addInitScript(vehicleKey => {
      const set = Storage.prototype.setItem;
      window.vehicleWrites = [];
      Storage.prototype.setItem = function(k, v) {
        if (k === vehicleKey) window.vehicleWrites.push(v);
        return set.call(this, k, v);
      };
    }, key);
    const page = await run(() => context.newPage());
    monitor.observe(page); page.setDefaultTimeout(45_000);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/api/catalog' && url.searchParams.get('resource') === 'search') report.searches.push(Object.fromEntries(url.searchParams));
    });
    await run(() => page.goto(origin));
    const click = control => run(() => control.click());
    const open = async control => {
      await run(() => control.waitFor());
      if (await control.getAttribute('aria-expanded') !== 'true') await click(control);
    };
    const saved = () => run(() => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key));
    const lists = () => run(() => page.evaluate(keys => keys.map(k => localStorage.getItem(k)), listKeys));
    const writes = () => run(() => page.evaluate(() => window.vehicleWrites.length));
    const banner = page.getByTestId('selected-context');
    const results = page.getByTestId('inline-parts');
    const waitParts = async () => {
      await run(() => page.locator('[data-testid="inline-parts"][aria-busy="false"]').waitFor());
      assert.equal(await page.getByRole('alert').count(), 0);
    };
    const shot = async name => {
      const file = `${width}-${name}.png`;
      await run(() => page.screenshot({ path: `${output}/${file}` })); report.screenshots.push(file);
    };
    const focusIs = id => run(() => page.waitForFunction(value => document.activeElement?.id === value, id));
    const noActive = async () => {
      assert.equal(await banner.count(), 0);
      assert.equal(await page.locator('[id^="vehicle-engine-"][aria-current="true"]').count(), 0);
      assert.equal(await results.count(), 0);
      assert.equal(await page.getByText('All vehicles. Select a vehicle to narrow results.', { exact: true }).isVisible(), true);
    };
    const year = page.locator('#vehicle-year-2020');
    await open(year);
    const make = year.locator('..').getByRole('button', { name: 'Toyota', exact: true });
    await open(make);
    const model = make.locator('..').getByRole('button', { name: 'Camry', exact: true });
    await open(model);
    const engines = model.locator('..').locator('button[id^="vehicle-engine-"]');
    await run(() => engines.nth(1).waitFor());
    const aId = await engines.filter({ hasText: '2.5L 4-Cyl L' }).getAttribute('id');
    const bId = await engines.filter({ hasNotText: '2.5L 4-Cyl L' }).first().getAttribute('id');
    const a = page.locator(`#${aId}`), b = page.locator(`#${bId}`);
    const engineNames = { [aId]: await a.textContent(), [bId]: await b.textContent() };
    const categories = id => page.locator(`#${id.replace('vehicle-engine-', 'vehicle-categories-')}`);
    const choosePad = async id => {
      const branch = categories(id);
      await open(branch.getByRole('button', { name: 'Brakes', exact: true }));
      await click(branch.getByRole('button', { name: 'Brake Pad', exact: true })); await waitParts();
    };
    const activeIs = async id => {
      await run(() => page.locator(`#${id}[aria-current="true"]`).waitFor());
      assert.equal(await page.locator('[id^="vehicle-engine-"][aria-current="true"]').count(), 1);
      assert.equal((await saved()).engineId, Number(id.split('-').at(-1)));
      assert.match(await banner.textContent(), /Current vehicle/);
      assert.equal(await page.locator(`#${id}`).locator('..').getByRole('button', { name: engineNames[id], exact: true }).count(), 1, 'Current engine preserves its exact accessible name, including after reload');
    };
    await click(a); await activeIs(aId);
    assert.equal(await writes(), 1, 'A complete selection persists once');
    await choosePad(aId);
    assert.equal(await writes(), 1, 'Category under the same active vehicle does not persist again');
    if (layoutOnly || (process.env.ROYS_ACTIVE_FINAL_BATCH === '1' && width === 1440)) {
      await shot('final-current-a');
      const box = await banner.boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height < page.viewportSize().height / 2, 'Compact banner leaves more than half the viewport for catalog/header');
      report.cases.push(`${width}: current banner height ${Math.round(box.height)}px; selected engine exact accessible name preserved`);
      await run(() => page.reload()); await activeIs(aId);
      await click(banner.getByRole('button', { name: 'Clear vehicle', exact: true })); await focusIs('vehicle-picker'); await noActive();
      await run(() => page.getByRole('combobox', { name: 'Search by vehicle or part number' }).fill('ALD1212M'));
      await run(() => page.getByRole('combobox', { name: 'Search by vehicle or part number' }).press('Enter')); await waitParts();
      assert.equal(await page.getByText('All vehicles. Select a vehicle to narrow results.', { exact: true }).isVisible(), true);
      assert.equal(await banner.count(), 0);
      await shot('final-global-mpn');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator('main').evaluate(el => el.scrollWidth > el.clientWidth), false);
      report.cases.push(`${width}: reload retains exact selected-engine name; clear focuses picker; global MPN remains optional vehicle scope, no overflow`);
      await run(() => context.close());
      continue;
    }
    // Populate only browser-local test lists with a real row; no ERP mutations.
    const row = page.locator('[data-part-id]').filter({ has: page.getByRole('button', { name: 'Add', exact: true, disabled: false }) }).first();
    const add = row.getByRole('button', { name: 'Add', exact: true });
    const wish = row.getByTitle('Add to wishlist', { exact: true });
    await run(() => add.focus()); await run(() => add.press('Enter'));
    await run(() => wish.focus()); await run(() => wish.press('Enter'));
    await run(() => page.waitForFunction(keys => keys.every(k => { const value = JSON.parse(localStorage.getItem(k)); return (Array.isArray(value) ? value.length : value?.items?.length) > 0; }), listKeys));
    const preservedLists = await lists();
    const search = page.getByRole('combobox', { name: 'Search by vehicle or part number' });
    await run(() => search.fill('brake')); await run(() => search.press('Enter')); await waitParts();
    assert.equal(await banner.getByRole('button', { name: 'Brake Pad', exact: true }).count(), 0);
    await click(page.getByRole('button', { name: 'Return to vehicle catalog', exact: true })); await waitParts();
    assert.equal(await banner.getByRole('button', { name: 'Brake Pad', exact: true }).count(), 1);
    report.cases.push(`${width}: category -> text -> return retains A scope/category`);
    const brand = results.getByRole('combobox', { name: 'Brand', exact: true });
    const brandId = await brand.locator('option').nth(1).getAttribute('value');
    assert.ok(brandId);
    await run(() => search.fill('brake')); await run(() => search.press('Enter')); await waitParts();
    await run(() => brand.selectOption(brandId)); await waitParts();
    // Change is browsing until commit; native disclosure on B also leaves A active.
    await click(banner.getByRole('button', { name: 'Change vehicle', exact: true })); await focusIs('vehicle-year-2020');
    await activeIs(aId);
    const bDisclosure = b.locator('..').getByRole('button').first();
    await click(bDisclosure); await activeIs(aId);
    const beforeB = report.searches.length, beforeWrite = await writes();
    await click(b); await activeIs(bId);
    assert.equal(await writes(), beforeWrite + 1);
    assert.equal(report.searches.length, beforeB, 'Commit clears category before making a stale request');
    assert.equal(await results.count(), 0);
    assert.equal(await categories(aId).isVisible(), true, 'A disclosure remains open while B alone is active');
    await choosePad(bId);
    for (const request of report.searches.slice(beforeB)) {
      assert.equal(request.q, undefined); assert.equal(request.brand, undefined); assert.equal(request.page, '1');
      assert.equal(request.engine_base_id, bId.split('-').at(-1));
    }
    assert.equal(await brand.inputValue(), '');
    await shot('current-b');
    await run(() => page.reload()); await activeIs(bId);
    assert.deepEqual(await lists(), preservedLists);
    const beforeClear = report.searches.length;
    await click(banner.getByRole('button', { name: 'Clear vehicle', exact: true })); await focusIs('vehicle-picker');
    await noActive(); assert.equal(await saved(), null);
    assert.equal(report.searches.length, beforeClear, 'Clear makes no stale results request');
    assert.deepEqual(await lists(), preservedLists); await shot('clear-focused');
    await run(() => page.reload()); await run(() => year.waitFor()); await noActive();
    assert.equal(await saved(), null); assert.deepEqual(await lists(), preservedLists);
    report.cases.push(`${width}: A -> B -> reload -> clear -> reload; one active scope, saved once, dependency reset, no stale request, focus and populated cart/wishlist unchanged`);
    // Incomplete YMM from the actual search must discard the previous saved vehicle.
    await open(year); await open(make); await open(model); await click(a); await activeIs(aId);
    await run(() => search.fill('2015 Chevrolet Silverado 1500'));
    const option = page.getByRole('option').filter({ hasText: '2015 Chevrolet Silverado 1500' }).first();
    await click(option); await noActive(); assert.equal(await saved(), null);
    await run(() => page.reload()); await run(() => year.waitFor()); await noActive();
    assert.equal(await saved(), null); assert.deepEqual(await lists(), preservedLists);
    report.cases.push(`${width}: incomplete real YMM selection clears saved A; reload cannot resurrect A`);
    // Isolated browser-storage failures; catalog calls still use real staging.
    await open(year); await open(make); await open(model); await click(a);
    await run(() => page.evaluate(() => {
      window.originalStorageSet = Storage.prototype.setItem;
      window.originalStorageRemove = Storage.prototype.removeItem;
      Storage.prototype.setItem = () => { throw new DOMException('Disabled', 'SecurityError'); };
    }));
    await click(b);
    assert.equal(await saved(), null, 'Failed set removes stale A when removal is allowed');
    assert.equal(await b.getAttribute('aria-current'), 'true');
    await run(() => page.getByTestId('vehicle-storage-notice').waitFor());
    assert.match(await page.getByTestId('vehicle-storage-notice').textContent(), /Select it again after reload/);
    await click(banner.getByRole('button', { name: 'Clear vehicle', exact: true })); await focusIs('vehicle-picker'); await noActive();
    await run(() => page.reload()); await run(() => year.waitFor()); await noActive();
    report.cases.push(`${width}: set fails/removal works: no saved A resurrection, live B remains usable, clear/reload succeeds`);
    await open(year); await open(make); await open(model); await click(a); await activeIs(aId);
    await run(() => page.evaluate(() => {
      window.originalStorageSet = Storage.prototype.setItem;
      window.originalStorageRemove = Storage.prototype.removeItem;
      Storage.prototype.setItem = () => { throw new DOMException('Disabled', 'SecurityError'); };
      Storage.prototype.removeItem = () => { throw new DOMException('Disabled', 'SecurityError'); };
    }));
    await click(b); assert.equal(await b.getAttribute('aria-current'), 'true');
    assert.match(await page.getByTestId('vehicle-storage-notice').textContent(), /previous vehicle may return/);
    await click(banner.getByRole('button', { name: 'Clear vehicle', exact: true })); await focusIs('vehicle-picker'); await noActive();
    assert.equal((await saved()).engineId, Number(aId.split('-').at(-1)), 'Blocked storage remains unchanged; never promise persistence');
    assert.match(await page.getByTestId('vehicle-storage-notice').textContent(), /may return after reload/);
    assert.deepEqual(await lists(), preservedLists); await shot('storage-blocked-clear');
    await run(() => page.evaluate(() => {
      Storage.prototype.setItem = window.originalStorageSet;
      Storage.prototype.removeItem = window.originalStorageRemove;
    }));
    await click(page.getByRole('button', { name: 'Retry clearing saved vehicle', exact: true }));
    assert.equal(await page.getByTestId('vehicle-storage-notice').count(), 0);
    await run(() => page.reload()); await run(() => year.waitFor()); await noActive();
    assert.equal(await saved(), null); assert.deepEqual(await lists(), preservedLists);
    report.cases.push(`${width}: set+remove unavailable: immediate UI clear, visible truthful notice, recovery action persists clear after storage returns`);
    // Existing unspecified-engine sentinel still scopes YMM without sending ID 0.
    await open(year); await open(make); await open(model); await click(a);
    const sentinel = { ...await saved(), engineId: 0, engineName: 'Engine unspecified' };
    await run(() => page.evaluate(({ k, v }) => localStorage.setItem(k, JSON.stringify(v)), { k: key, v: sentinel }));
    await run(() => page.reload()); await run(() => banner.getByRole('button', { name: 'Engine unspecified', exact: true }).waitFor());
    const beforeSentinel = report.searches.length;
    await run(() => search.fill('brake')); await run(() => search.press('Enter')); await waitParts();
    assert.ok(report.searches.length > beforeSentinel);
    for (const request of report.searches.slice(beforeSentinel)) {
      assert.equal(request.engine_base_id, undefined); assert.equal(request.year, '2020'); assert.equal(request.model, 'Camry');
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.locator('main').evaluate(el => el.scrollWidth > el.clientWidth), false);
    assert.deepEqual(await lists(), preservedLists);
    report.cases.push(`${width}: engine 0 persists as unspecified; real text request sends YMM without engine ID, no horizontal overflow`);
    await run(() => context.close());
  }
  assert.deepEqual(report.pageErrors, []);
  report.result = 'passed';
} catch (error) {
  report.result = 'failed'; report.failure = error.stack; throw error;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close(); await server.close();
  console.log(`Active vehicle evidence: ${output}/report.json`);
}
