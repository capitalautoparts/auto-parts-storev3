// Run on VM511 after building. Visual journey uses real API responses; the final
// recovery case separately aborts two requests to exercise Retry.
// ROYS_SMOKE_FUNCTION_ENTRYPOINT selects packaged JS instead of Vite's source adapter.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { firefox } from '@playwright/test';

const output = process.env.ROYS_SMOKE_OUTPUT || '/tmp/roysauto-browser-smoke';
await mkdir(output, { recursive: true });
const reservation = createServer().listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
// ROYS_SMOKE_BASE_URL checks an already deployed host (e.g. roysauto-staging) instead of a local preview.
const deployedBase = process.env.ROYS_SMOKE_BASE_URL?.replace(/\/+$/, '');
const origin = deployedBase || `http://127.0.0.1:${port}`;
let previewLog = '';
let closePreview;
if (deployedBase) {
  closePreview = async () => {};
} else if (process.env.ROYS_SMOKE_FUNCTION_ENTRYPOINT) {
  const { default: handler } = await import(pathToFileURL(process.env.ROYS_SMOKE_FUNCTION_ENTRYPOINT).href);
  const { preview } = await import('vite');
  const server = await preview({
    configFile: false,
    preview: { host: '127.0.0.1', port, strictPort: true },
    plugins: [{
      name: 'packaged-catalog-smoke',
      configurePreviewServer(vite) {
        vite.middlewares.use((req, res, next) => {
          if (new URL(req.url ?? '/', origin).pathname === '/api/catalog') void handler(req, res);
          else next();
        });
      },
    }],
  });
  closePreview = () => new Promise(resolve => server.httpServer.close(resolve));
} else {
  const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
  preview.stdout.on('data', chunk => { previewLog += chunk; });
  preview.stderr.on('data', chunk => { previewLog += chunk; });
  closePreview = () => preview.kill('SIGTERM');
}
let browser;
let activePage;
const report = { functionMode: deployedBase ? `deployed ${deployedBase}` : process.env.ROYS_SMOKE_FUNCTION_ENTRYPOINT ? 'packaged-js' : 'vite-source', cases: [], apiRequests: 0, apiResponses: [], apiTimings: [], searchUrls: [], vehicleContexts: [], pageErrors: [], screenshots: [] };
const accountRequests = [];
const apiPayloads = new Map();
const apiWaiters = [];
let proxy403Reference = null;
let rejectProxy403;
const proxy403Failure = new Promise((_, reject) => { rejectProxy403 = reject; });
proxy403Failure.catch(() => {});
function matchesApiParams(actual, expected) {
  return Object.entries(expected).every(([key, value]) => actual.get(key) === String(value));
}
function guarded(promise) {
  if (proxy403Reference) throw new Error(`Staging Cloudflare refused an ERP request (cf-ray ${proxy403Reference}); stopped without retrying.`);
  return Promise.race([promise, proxy403Failure]);
}
function waitForApi(resource, expected = {}, afterSequence = 0) {
  const cached = [...apiPayloads.values()].find(item => item.sequence > afterSequence && item.resource === resource && matchesApiParams(item.params, expected));
  if (cached) return Promise.resolve(cached);
  return guarded(new Promise((resolve, reject) => {
    const detail = Object.entries(expected).map(([key, value]) => `${key}=${value}`).join('&');
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for staging ${resource} response${detail ? ` (${detail})` : ''}.`)), 20_000);
    apiWaiters.push({ resource, expected, afterSequence, timer, resolve: value => { clearTimeout(timer); resolve(value); } });
  }));
}
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
  const requestStarted = new WeakMap();
  const observePage = observedPage => {
  observedPage.on('pageerror', error => report.pageErrors.push(error.message));
  observedPage.on('request', request => {
    if (new URL(request.url()).pathname === '/api/catalog') requestStarted.set(request, performance.now());
    if (/\/api\/(auth|checkout|orders)(?:\/|\?|$)/.test(request.url())) accountRequests.push(request.url());
  });
  observedPage.on('response', async response => {
    const url = new URL(response.url());
    if (!url.pathname.endsWith('/api/catalog')) return;
    const params = url.searchParams;
    const resource = params.get('resource') ?? 'unknown';
    const payload = await response.json().catch(() => null);
    report.apiTimings.push({ resource, url: `${url.pathname}${url.search}`, status: response.status(), elapsedMs: Math.round(performance.now() - (requestStarted.get(response.request()) ?? performance.now())) });
    if (response.status() === 502 && typeof payload?.reference === 'string') {
      proxy403Reference = payload.reference;
      report.proxy403Reference = proxy403Reference;
      rejectProxy403(new Error(`Staging Cloudflare refused an ERP request (cf-ray ${proxy403Reference}); stopped without retrying.`));
      await observedPage.close().catch(() => {});
      return;
    }
    const actualParams = new URLSearchParams([...params.entries()].filter(([key]) => key !== 'resource'));
    const item = { resource, params: actualParams, status: response.status(), payload, url: `${url.pathname}${url.search}`, sequence: ++report.apiRequests };
    apiPayloads.set(`${resource}?${actualParams}`, item);
    if (report.apiResponses.length < 24) {
      const count = Array.isArray(payload?.results) ? payload.results.length
        : Array.isArray(payload?.makes) ? payload.makes.length
        : Array.isArray(payload?.models) ? payload.models.length
        : Array.isArray(payload?.engines) ? payload.engines.length
        : Array.isArray(payload?.years) ? payload.years.length
        : Array.isArray(payload?.data) ? payload.data.length : undefined;
      report.apiResponses.push({ resource, status: response.status(), ...(count === undefined ? {} : { count }), url: item.url });
    }
    if (resource === 'search' && report.searchUrls.length < 12) report.searchUrls.push(item.url);
    for (let index = apiWaiters.length - 1; index >= 0; index--) {
      const waiter = apiWaiters[index];
      if (item.sequence > waiter.afterSequence && waiter.resource === resource && matchesApiParams(actualParams, waiter.expected)) {
        apiWaiters.splice(index, 1);
        waiter.resolve(item);
      }
    }
  });
  };
  observePage(page);
  const screenshot = async name => {
    await page.screenshot({ path: `${output}/${name}.png` });
    report.screenshots.push(`${name}.png`);
  };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const waitParts = async (expectedSku = null) => {
    await guarded(page.locator('[data-testid="inline-parts"][aria-busy="false"] [data-part-id]').first().waitFor());
    assert.equal(await page.locator('[role="alert"]').count(), 0);
    if (expectedSku) {
      const matchingRow = page.locator(`[data-part-id="${expectedSku}"]`);
      assert.ok(await matchingRow.count(), `Expected sampled SKU ${expectedSku} in rendered ERP results; staging returned ${await page.locator('[data-part-id]').count()} part rows.`);
    }
  };
  const clickTree = async label => guarded(page.getByTestId('vehicle-tree').getByRole('button', { name: label, exact: true }).click());
  const clickButton = async button => guarded(button.click());
  const findSample = (items, predicate, description, detail) => {
    const item = items.find(predicate);
    assert.ok(item, `Staging sample missing ${description}${detail ? ` (${detail})` : ''}; returned ${items.length} records.`);
    return item;
  };
  const selectVehicle = async ({ year, makeName, modelName, engineId, engineDescription }) => {
    const yearNode = page.locator(`[data-vehicle-year="${year}"]`);
    const yearButton = yearNode.getByRole('button', { name: String(year), exact: true });
    await guarded(yearButton.waitFor());
    if (await yearNode.getByRole('button').count() === 1) await clickButton(yearButton);
    const makes = await waitForApi('makes', { year });
    const make = findSample(makes.payload?.makes ?? [], item => item.name === makeName, `${year} ${makeName} make`);
    const makeButton = yearNode.getByRole('button', { name: makeName, exact: true });
    await guarded(makeButton.waitFor());
    const makeNode = makeButton.locator('..');
    let modelButton = makeNode.getByRole('button', { name: modelName, exact: true });
    if (!(await modelButton.count())) await clickButton(makeButton);
    const models = await waitForApi('models', { year, make: makeName });
    const model = findSample(models.payload?.models ?? [], item => item.name === modelName, `${year} ${makeName} ${modelName} model`);
    modelButton = makeNode.getByRole('button', { name: modelName, exact: true });
    await guarded(modelButton.waitFor());
    const modelNode = modelButton.locator('..');
    if (await modelNode.getByRole('button').count() === 1) await clickButton(modelButton);
    const engines = await waitForApi('engines', { year, make: makeName, model: modelName });
    const engine = findSample(engines.payload?.engines ?? [], candidate => engineId !== undefined
      ? candidate.id === engineId : candidate.description === engineDescription,
    `${year} ${makeName} ${modelName} engine${engineId !== undefined ? ` ID ${engineId}` : ` ${engineDescription}`}`);
    assert.ok(engine.description, `Staging engine ${engineId ?? engineDescription} for ${year} ${makeName} ${modelName} has no selectable label.`);
    const engineButton = modelNode.getByRole('button', { name: engine.description, exact: true });
    await guarded(engineButton.waitFor());
    assert.equal(await engineButton.count(), 1, `Expected one selectable ${engine.description} button under ${year} ${makeName} ${modelName}.`);
    const engineNode = engineButton.locator('..');
    if (!(await engineNode.getByRole('button', { name: 'Brakes', exact: true }).count())) await clickButton(engineButton);
    return { year, makeName, modelName, make, model, engine, engineButton };
  };
  const chooseBrakeLeaf = async engineButton => {
    const engineNode = engineButton.locator('..');
    const roots = await waitForApi('categories');
    findSample(roots.payload?.data ?? [], category => category.display_name === 'Brakes', 'Brakes category');
    const brakesButton = engineNode.getByRole('button', { name: 'Brakes', exact: true });
    await guarded(brakesButton.waitFor());
    const brakesNode = brakesButton.locator('..');
    let leafButton = brakesNode.getByRole('button', { name: 'Brake Pad', exact: true });
    if (!(await leafButton.count())) await clickButton(brakesButton);
    const children = await waitForApi('category', { slug: 'brakes' });
    const category = findSample(children.payload?.data?.subcategories ?? [], item => item.display_name === 'Brake Pad' && (item.mapped_part_type_count ?? 0) > 0, 'mapped Brake Pad category', 'under Brakes');
    leafButton = brakesNode.getByRole('button', { name: 'Brake Pad', exact: true });
    const searchAfterSequence = report.apiRequests;
    await clickButton(leafButton);
    return { category, searchAfterSequence };
  };
  const assertSearchContext = async ({ year, makeName, modelName, make, model, engine, category, searchAfterSequence }) => {
    const response = await waitForApi('search', { year, make: makeName, model: modelName, engine_base_id: engine.id, category: category.slug }, searchAfterSequence);
    assert.equal(response.status, 200, `Staging search for ${year} ${makeName} ${modelName} (${engine.description}) returned HTTP ${response.status}.`);
    assert.equal(response.params.get('year'), String(year), 'Outgoing search retained selected year');
    assert.equal(response.params.get('make'), makeName, 'Outgoing search retained selected make');
    assert.equal(response.params.get('model'), modelName, 'Outgoing search retained selected model');
    assert.equal(response.params.get('engine_base_id'), String(engine.id), 'Outgoing search retained selected engine ID');
    assert.equal(response.params.get('category'), category.slug, 'Outgoing search retained selected category');
    report.vehicleContexts.push({
      year,
      make: makeName,
      makeId: make.id,
      model: modelName,
      modelId: model.id,
      engine: engine.description,
      engineId: engine.id,
      category: category.display_name,
      categoryId: category.id,
      searchUrl: response.url,
    });
    return response;
  };
  await guarded(page.goto(origin));
  await guarded(page.getByRole('img', { name: 'roy’s auto' }).first().waitFor());
  await guarded(page.getByTestId('vehicle-tree').getByRole('button', { name: '2020', exact: true }).waitFor());
  await page.getByRole('button', { name: 'Account', exact: true }).filter({ visible: true }).click();
  await page.getByText('Accounts are not enabled during catalog testing.', { exact: true }).waitFor();
  assert.equal(await page.locator('input[type="password"]').count(), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('cap-auth-user')), null);
  report.cases.push('Account action stays disabled; no login form, API call or mock user is created');
  await screenshot('desktop-original-home');
  const toyota = await selectVehicle({ year: 2020, makeName: 'Toyota', modelName: 'Camry', engineDescription: '2.5L 4-Cyl L' });
  const toyotaCategory = await chooseBrakeLeaf(toyota.engineButton);
  await waitParts('DVNJ_ALD1212M');
  const toyotaSearch = await assertSearchContext({ ...toyota, ...toyotaCategory });
  assert.match(await page.getByTestId('inline-parts').textContent(), /2020 Toyota Camry/);
  assert.equal(await page.getByTestId('inline-parts').count(), 1);
  await page.getByTestId('parts-table').scrollIntoViewIfNeeded();
  await screenshot('desktop-original-parts');
  report.cases.push('Original tree → year → make → model → engine → category → inline real ERP parts');
  const rawSku = (toyotaSearch.payload?.results ?? []).find(part => part.sku === 'DVNJ_ALD1212M');
  assert.ok(rawSku, `Staging Toyota category response did not include sampled SKU ALD1212M; returned ${(toyotaSearch.payload?.results ?? []).length} parts.`);
  const aldPrice = rawSku.pricing?.price;
  assert.equal(rawSku.pricing?.currency, 'CAD', 'Sampled SKU ALD1212M must have a CAD price in the staging search response');
  assert.ok(typeof aldPrice === 'number' && Number.isFinite(aldPrice) && aldPrice >= 0, 'Sampled SKU ALD1212M has no usable CAD price in the staging search response');
  report.ald1212mCadPrice = aldPrice;
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
  await guarded(page.reload());
  await quickCart.getByText('ALD1212M', { exact: true }).waitFor();
  const expectedSubtotal = `$${((Math.round(aldPrice * 100) * 2) / 100).toFixed(2)}`;
  const subtotalLine = await quickCart.getByText('Subtotal', { exact: true }).locator('..').textContent();
  assert.ok(subtotalLine.includes(expectedSubtotal), `Quantity 2 subtotal should be ${expectedSubtotal} from current ERP CAD price $${aldPrice.toFixed(2)}; cart showed "${subtotalLine}".`);
  assert.equal(await quickCart.getByRole('button', { name: 'Checkout disabled for testing' }).isDisabled(), true);
  assert.equal(await page.getByPlaceholder('1234 5678 9012 3456').count(), 0);
  report.cases.push('Original detail modal and persistent Quick Cart; quantity survives reload; no card/order flow');

  const search = page.getByRole('combobox', { name: 'Search by vehicle or part number' });
  await guarded(search.fill('ALD1212M')); await guarded(search.press('Enter'));
  await waitParts();
  assert.match(await page.getByTestId('parts-table').textContent(), /ALD1212M/);
  await guarded(page.getByLabel('In stock only', { exact: true }).check());
  await waitParts();
  report.cases.push('ERP part-number search and stock filter inside the same page');

  await guarded(search.fill('2021 Ford F-150'));
  const vehicleSuggestion = page.getByRole('option').filter({ hasText: '2021 Ford F-150' });
  await guarded(vehicleSuggestion.first().waitFor());
  assert.ok(await vehicleSuggestion.count(), 'Vehicle suggestions remain available with a selected Camry');
  await search.press('Escape');
  await search.fill('ALD1212M');
  const searchButton = page.getByRole('button', { name: 'Search catalog', exact: true });
  assert.notEqual(await searchButton.evaluate(element => getComputedStyle(element).color), 'rgb(255, 255, 255)', 'Search control must not inherit white text on the white input');
  await searchButton.click();
  await waitParts();
  // Cross the autocomplete debounce boundary after an immediate submission.
  await page.waitForTimeout(350);
  assert.equal(await search.getAttribute('aria-expanded'), 'false', 'Submitting closes stale autocomplete');
  assert.equal(await page.getByText('Searching...', { exact: true }).count(), 0, 'Submitting before the debounce must not leave a stuck spinner');
  report.cases.push('Selected-vehicle search still finds another vehicle; accessible Search button submits in-page');

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

  const assertVehicleRestores = async selected => {
    const expected = {
      year: selected.year,
      makeId: selected.make.id,
      makeName: selected.make.name,
      modelId: selected.model.id,
      modelName: selected.model.name,
      engineId: selected.engine.id,
      engineName: selected.engine.description,
    };
    const key = 'roysauto.original-vehicle.v1';
    assert.deepEqual(await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key), expected,
      `Selected ${expected.year} ${expected.makeName} ${expected.modelName} engine should be saved with its full IDs.`);
    await guarded(page.reload());
    const label = `${expected.year} ${expected.makeName} ${expected.modelName}`;
    await guarded(page.getByText(label, { exact: true }).waitFor());
    assert.deepEqual(await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key), expected,
      `Reload should restore the saved ${expected.year} ${expected.makeName} ${expected.modelName} vehicle IDs.`);
    const yearNode = page.locator(`[data-vehicle-year="${expected.year}"]`);
    const engineButton = yearNode.getByRole('button', { name: expected.engineName, exact: true });
    await guarded(engineButton.waitFor());
    assert.equal(await engineButton.count(), 1,
      `Reload should expand saved engine ${expected.engineName} for ${expected.year} ${expected.makeName} ${expected.modelName}.`);
    return engineButton;
  };
  for (const sample of [
    { year: 2021, makeName: 'Ford', modelName: 'F-150', engineId: 2146 },
    { year: 2019, makeName: 'Honda', modelName: 'Civic', engineId: 2118 },
  ]) {
    const selected = await selectVehicle(sample);
    const category = await chooseBrakeLeaf(selected.engineButton);
    await assertSearchContext({ ...selected, ...category });
    await waitParts();
    const restoredButton = await assertVehicleRestores(selected);
    const restoredCategory = await chooseBrakeLeaf(restoredButton);
    await assertSearchContext({ ...selected, ...restoredCategory });
    await waitParts();
    report.cases.push(`${sample.year} ${sample.makeName} ${sample.modelName} engine/category search retains full context and restores after reload`);
  }

  const mobileVehicle = await selectVehicle({ year: 2020, makeName: 'Toyota', modelName: 'Camry', engineDescription: '2.5L 4-Cyl L' });
  const mobileCategory = await chooseBrakeLeaf(mobileVehicle.engineButton);
  await waitParts('DVNJ_ALD1212M');
  await assertSearchContext({ ...mobileVehicle, ...mobileCategory });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('main').evaluate(element => { element.scrollTop = 0; });
  await screenshot('mobile-original-home');
  await page.getByTestId('parts-table').scrollIntoViewIfNeeded();
  const rowHeights = await page.locator('[data-part-id]').evaluateAll(rows => rows.map(row => row.getBoundingClientRect().height));
  assert.ok(Math.max(...rowHeights) < 280, 'Compact rows retain usable dimensions on mobile');
  const mobileRow = page.locator('[data-part-id]').first();
  const mobileAdd = await mobileRow.getByRole('button', { name: 'Add', exact: true }).boundingBox();
  assert.ok(mobileAdd && mobileAdd.x >= 0 && mobileAdd.x + mobileAdd.width <= 390, 'Add stays inside the mobile viewport without horizontal scrolling');
  const mobileOverflow = await mobileRow.evaluate(element => element.scrollWidth > element.clientWidth);
  assert.equal(mobileOverflow, false, 'Mobile product row fits the screen');
  await screenshot('mobile-original-parts');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No page overflow at 390px');
  await page.getByRole('button', { name: 'Open Quick Cart', exact: true }).filter({ visible: true }).click();
  await page.getByRole('dialog').getByText('ALD1212M', { exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(255, 255, 255)');
  await screenshot('mobile-original-cart');
  await page.keyboard.press('Escape');
  report.cases.push('Mobile product rows keep price and Add visible; Quick Cart remains an in-page sheet');
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(accountRequests, [], 'Catalog testing must not call account, checkout or order endpoints');
  // Fault injection is separate from the real-data visual journey above. Only
  // the first request is aborted; Retry must reach the real staging API.
  const recovery = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const recoveryPage = await recovery.newPage();
  activePage = recoveryPage;
  observePage(recoveryPage);
  const failedResources = new Set();
  await recoveryPage.route('**/api/catalog?*', route => {
    const resource = new URL(route.request().url()).searchParams.get('resource');
    if (['categories', 'makes'].includes(resource) && !failedResources.has(resource)) {
      failedResources.add(resource);
      return route.abort('failed');
    }
    return route.continue();
  });
  await recoveryPage.goto(origin);
  await recoveryPage.getByTestId('vehicle-tree').getByRole('button', { name: '2020', exact: true }).waitFor();
  for (const resource of ['categories', 'makes']) {
    if (resource === 'makes') await recoveryPage.getByTestId('vehicle-tree').getByRole('button', { name: '2020', exact: true }).click();
    const retry = recoveryPage.getByRole('alert').getByRole('button', { name: 'Retry', exact: true });
    await retry.waitFor();
    const response = recoveryPage.waitForResponse(r => new URL(r.url()).searchParams.get('resource') === resource && r.status() === 200);
    await retry.click();
    await guarded(response);
    await recoveryPage.getByRole('alert').waitFor({ state: 'detached' });
  }
  await recoveryPage.getByRole('button', { name: 'Toyota', exact: true }).waitFor();
  await recovery.close();
  report.cases.push('Failed root categories and branch makes recover through Retry using real staging responses');
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(accountRequests, [], 'Recovery must not call account, checkout or order endpoints');
  console.log(JSON.stringify({ cases: report.cases, apiRequests: report.apiRequests, pageErrors: report.pageErrors, screenshots: report.screenshots }, null, 2));
} catch (error) {
  report.failure = error.message;
  if (activePage) {
    await activePage.screenshot({ path: `${output}/failure.png` }).catch(() => {});
    report.visibleText = (await activePage.locator('body').innerText().catch(() => '')).slice(0, 3000);
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  for (const waiter of apiWaiters) clearTimeout(waiter.timer);
  await browser?.close();
  await closePreview();
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(`SMOKE_OUTPUT=${output}`);
}
