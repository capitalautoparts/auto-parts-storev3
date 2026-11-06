// WP-ROYS-SEARCH-DISMISS1 aa064791. VM511 Firefox only.
// fixture: isolated controlled component promises, no catalog/visual claims.
// integrated: built page, real fixed staging gateway, shared refusal latch.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { firefox, expect } from '@playwright/test';
import { createServer, preview } from 'vite';
import { createProductSmokeMonitor } from './product-links-monitor.mjs';

const mode = process.argv[2];
assert.ok(['fixture', 'integrated'].includes(mode), 'Use fixture or integrated');
const output = process.env.ROYS_DISMISS_OUTPUT || '/tmp/roys-aa064791-search-dismissal';
await mkdir(output, { recursive: true });
const report = { task: 'WP-ROYS-SEARCH-DISMISS1 aa064791', mode,
  recordedEastern: new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', timeZoneName: 'short' }),
  cases: [], apiResponses: [], pageErrors: [], screenshots: [], searches: [] };
const fixtureEntry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VehicleSearchBar } from '/src/components/VehicleSearchBar.tsx';
import { vehicleApi } from '/src/lib/api.ts';
const root = createRoot(document.getElementById('root'));
let generation = 0;
const state = window.fixture = { pending: [], callbacks: [], reset(scoped = false) {
  state.pending = []; state.callbacks = [];
  root.render(React.createElement(VehicleSearchBar, {
    key: ++generation,
    vehicleContext: scoped ? { year: 2020, makeId: 1, makeName: 'Toyota', modelId: 2, modelName: 'Camry', engineId: 17637 } : null,
    onVehicleSelect: result => state.callbacks.push(['vehicle', result]),
    onPartSelect: result => state.callbacks.push(['part', result]),
    onCategorySelect: result => state.callbacks.push(['category', result]),
    onTextSearch: query => state.callbacks.push(['text', query]),
  }));
} };
for (const method of ['search', 'searchCategories']) vehicleApi[method] = (query, context) =>
  new Promise((resolve, reject) => state.pending.push({ method, query, context, resolve, reject }));
state.reset();
`;
const fixturePlugin = {
  name: 'isolated-search-dismissal-fixture',
  resolveId(id) { if (id === '/search-dismissal-fixture.js') return '\0search-dismissal-fixture'; },
  load(id) { if (id === '\0search-dismissal-fixture') return fixtureEntry; },
  configureServer(server) {
    server.middlewares.use('/__search-dismissal-fixture', async (_req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(await server.transformIndexHtml('/__search-dismissal-fixture',
        '<html><body><button id="before">Before</button><div id="root"></div><button id="after">After</button><script type="module" src="/search-dismissal-fixture.js"></script></body></html>'));
    });
  },
};
const server = mode === 'fixture'
  ? await createServer({ plugins: [fixturePlugin], server: { host: '127.0.0.1', port: 0 } })
  : await preview({ preview: { host: '127.0.0.1', port: 0 } });
if (mode === 'fixture') await server.listen();
const origin = server.resolvedUrls.local[0];
const browser = await firefox.launch();

async function observeAria(page) {
  await page.addInitScript(() => {
    window.missingActiveOptions = [];
    new MutationObserver(() => {
      const input = document.getElementById('catalog-search');
      const id = input?.getAttribute('aria-activedescendant');
      if (id && !document.getElementById(id)) window.missingActiveOptions.push(id);
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-activedescendant'] });
  });
}

async function fixtureChecks() {
  const context = await browser.newContext({ hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on('pageerror', error => report.pageErrors.push(error.message));
  await context.route('**/api/**', route => { report.apiResponses.push(route.request().url()); return route.abort(); });
  await observeAria(page);
  await page.goto(`${origin}__search-dismissal-fixture`);
  const input = page.getByRole('combobox');
  const list = page.getByRole('listbox');
  const option = label => ({ type: 'vehicle', label, year: 2020, makeId: 1, makeName: 'Toyota' });
  const reset = async (scoped = false) => {
    await page.mouse.move(1000, 700);
    await page.evaluate(value => window.fixture.reset(value), scoped);
    await expect(input).toHaveValue('');
  };
  const pending = query => page.waitForFunction(q => window.fixture.pending.some(item => item.query === q), query);
  const start = async query => { await input.fill(query); await pending(query); };
  const settle = async (query, results, error) => {
    await page.evaluate(({ query, results, error }) => {
      const item = window.fixture.pending.find(item => item.query === query);
      if (error) item.reject(new Error(error)); else item.resolve(results);
    }, { query, results, error });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const closed = async () => {
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(input).not.toHaveAttribute('aria-activedescendant');
    await expect(list).toHaveCount(0);
    await expect(page.getByText('Searching...', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  };
  for (const dismissal of ['Escape before debounce', 'Escape pending', 'outside mouse', 'outside touch', 'Tab', 'Shift+Tab', 'focus departure']) {
    await reset();
    const query = `delayed ${dismissal}`;
    await input.fill(query);
    if (dismissal !== 'Escape before debounce') await pending(query);
    if (dismissal.startsWith('Escape')) await input.press('Escape');
    else if (dismissal === 'outside mouse') await page.locator('#after').click();
    else if (dismissal === 'outside touch') await page.locator('#after').tap();
    else if (dismissal === 'focus departure') await page.locator('#after').focus();
    else await input.press(dismissal);
    if (dismissal === 'Tab') await expect(page.getByRole('button', { name: 'Search catalog', exact: true })).toBeFocused();
    if (dismissal === 'Shift+Tab') await expect(page.locator('#before')).toBeFocused();
    await pending(query);
    await settle(query, [option('Late vehicle')]);
    await closed();
    // A changed query is the explicit new intent; dismissal has not disabled search.
    await start(`new ${dismissal}`);
    await settle(`new ${dismissal}`, [option('Fresh vehicle')]);
    await expect(page.getByRole('option', { name: /Fresh vehicle/ })).toBeVisible();
    report.cases.push(`${dismissal}: delayed response stays closed, new typing reopens`);
  }

  await reset(); await start('cached');
  await settle('cached', [option('First'), option('Second')]);
  await input.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-activedescendant', 'catalog-result-0');
  await input.press('Escape'); await closed();
  await input.press('ArrowUp');
  await expect(input).toHaveAttribute('aria-activedescendant', 'catalog-result-1');
  await expect(input).toBeFocused();
  await input.press('ArrowUp'); await input.press('ArrowDown'); await input.press('Enter');
  assert.deepEqual(await page.evaluate(() => window.fixture.callbacks), [['vehicle', option('Second')]]);
  await closed();
  report.cases.push('Mounted-only active id; Escape resets highlight; closed ArrowUp/Down reopen and input-focused Enter selects exact option');

  await reset(); await start('focus reopen'); await settle('focus reopen', [option('Focus vehicle')]);
  await page.locator('#after').focus(); await closed();
  await input.focus(); await expect(list).toBeVisible();
  await input.press('Tab'); await expect(list).toHaveCount(0);
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Clear search' })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('#after')).toBeFocused();
  assert.deepEqual(await page.getByRole('option').evaluateAll(options => options.map(item => item.tabIndex)), []);
  report.cases.push('Deliberate focus reopens cached results; Tab leaves naturally via existing controls without option stops');

  await reset(); await start('old'); await start('new');
  await settle('old', [option('Obsolete')]);
  await expect(page.getByText('Searching...', { exact: true })).toBeVisible();
  await expect(list).toHaveCount(0);
  await settle('new', [option('Current')]); await expect(page.getByRole('option', { name: /Current/ })).toBeVisible();
  await start('older error'); await start('newest');
  await settle('newest', [option('Newest')]); await settle('older error', [], 'Obsolete failure');
  await expect(page.getByRole('option', { name: /Newest/ })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await start('current error'); await settle('current error', [], 'Current failure');
  await expect(page.getByRole('alert')).toHaveText('Current failure');
  await input.press('Escape'); await closed();
  await start('dismiss error'); await input.press('Escape'); await settle('dismiss error', [], 'Dismissed failure'); await closed();
  report.cases.push('Old result/error cannot clobber new query or loading; current error settles, dismissal clears it and suppresses late error');

  for (const type of ['vehicle', 'part', 'category']) {
    for (const pointer of ['click', 'tap']) {
      await reset(); await start(`${type} ${pointer}`);
      const result = { type, label: `${type} selection`, partNumber: 'TEST-ONLY', categoryId: 7 };
      await settle(`${type} ${pointer}`, [result]);
      const suggestion = page.getByRole('option');
      await expect(suggestion).toHaveAttribute('tabindex', '-1');
      await suggestion[pointer]();
      assert.deepEqual(await page.evaluate(() => window.fixture.callbacks), [[type, result]]);
      await expect(input).toBeFocused(); await closed();
    }
  }
  report.cases.push('Mouse and touch select exact vehicle/part/category callback once while keeping input focus');

  for (const submit of ['Enter', 'button']) {
    await reset(); await start(`explicit ${submit}`);
    if (submit === 'Enter') await input.press('Enter');
    else await page.getByRole('button', { name: 'Search catalog', exact: true }).click();
    await settle(`explicit ${submit}`, [option('Submitted late')]); await closed();
    assert.deepEqual(await page.evaluate(() => window.fixture.callbacks), [['text', `explicit ${submit}`]]);
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(input).toHaveValue(''); await expect(input).toBeFocused(); await closed();
    assert.deepEqual(await page.evaluate(() => window.fixture.callbacks), [['text', `explicit ${submit}`], ['text', '']]);
  }
  await reset(); await start('clear pending'); await page.getByRole('button', { name: 'Clear search' }).click();
  await settle('clear pending', [option('Cleared late')]); await closed();
  report.cases.push('Explicit Enter/button submit and clear preserve text callbacks and suppress their pending responses');

  await reset(); await start('composition'); await settle('composition', [option('IME candidate')]);
  await input.dispatchEvent('compositionstart');
  await input.press('ArrowDown'); await input.press('Escape'); await input.press('Enter');
  await expect(list).toBeVisible();
  assert.deepEqual(await page.evaluate(() => window.fixture.callbacks), []);
  await input.dispatchEvent('compositionend'); await input.press('Escape'); await closed();
  report.cases.push('Existing Input composition guard prevents candidate navigation/confirmation from selecting, submitting or dismissing');

  await reset(true); await start('brake');
  assert.equal(await page.evaluate(() => window.fixture.pending[0].method), 'searchCategories');
  assert.equal(await page.evaluate(() => window.fixture.pending[0].context.engineId), 17637);
  await start('2020 Toyota');
  assert.equal(await page.evaluate(() => window.fixture.pending.at(-1).method), 'search');
  await start('2020');
  assert.equal(await page.evaluate(() => window.fixture.pending.at(-1).method), 'search');
  report.cases.push('Selected vehicle text uses existing scoped category method; year prefix and bare year retain existing vehicle routing');
  assert.deepEqual(await page.evaluate(() => window.missingActiveOptions), []);
  assert.deepEqual(report.apiResponses, [], 'Fixture must never access ERP');
  await context.close();
}

async function integratedChecks() {
  assert.equal(process.env.ROYS_ONPREM, '1', 'Use existing fixed LAN staging gateway');
  assert.equal(process.env.ROYS_CATALOG_PREVIEW_ENABLED, 'true');
  const monitor = createProductSmokeMonitor(report);
  const run = action => monitor.run(action);
  for (const width of [1440, 390]) {
    const context = await run(() => browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, hasTouch: width === 390 }));
    const page = await run(() => context.newPage());
    monitor.observe(page); await observeAria(page); page.setDefaultTimeout(30_000);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/api/catalog' && url.searchParams.get('resource') === 'search') report.searches.push({ width, ...Object.fromEntries(url.searchParams) });
    });
    const input = page.getByRole('combobox', { name: 'Search by vehicle or part number' });
    const shot = async name => {
      const file = `${width}-${name}.png`;
      await run(() => page.screenshot({ path: `${output}/${file}` })); report.screenshots.push(file);
    };
    await run(() => page.goto(origin));
    await run(() => expect(page.locator('#vehicle-year-2020')).toBeVisible());
    if (width === 390) {
      await run(() => page.getByRole('button', { name: 'Open menu', exact: true }).tap());
      await run(() => page.getByRole('dialog', { name: 'Menu', exact: true }).getByRole('button', { name: 'Search catalog', exact: true }).tap());
      await run(() => expect(input).toBeFocused());
    }
    await run(() => input.fill('2020 Toyota Cam'));
    const camry = page.getByRole('option', { name: /2020 Toyota Camry/ });
    await run(() => expect(camry).toBeVisible());
    await run(() => input.press('ArrowDown'));
    await run(() => expect(input).toHaveAttribute('aria-activedescendant', 'catalog-result-0'));
    await shot('suggestions-open');
    await run(() => input.press('Escape'));
    await run(() => expect(page.getByRole('listbox')).toHaveCount(0));
    await run(() => expect(input).not.toHaveAttribute('aria-activedescendant'));
    await shot('escape-dismissed');
    await run(() => input.press('ArrowDown'));
    await run(() => input.press('Enter'));
    const engine = page.locator('button[id^="vehicle-engine-"]').filter({ hasText: '2.5L 4-Cyl L' });
    await run(() => expect(engine).toHaveCount(1));
    await shot('keyboard-vehicle-selection');
    await run(() => engine.click());
    const banner = page.getByTestId('selected-context');
    await run(() => expect(banner).toContainText('Camry'));
    await run(() => input.fill('brake'));
    const brakes = page.getByRole('option', { name: /^Brakes/ });
    await run(() => expect(brakes).toBeVisible());
    await shot('scoped-suggestions-open');
    await run(() => input.press('Tab'));
    await run(() => expect(page.getByRole('listbox')).toHaveCount(0));
    await shot('tab-dismissed');
    await run(() => input.focus());
    await run(() => expect(brakes).toBeVisible());
    // Native touch on mobile, mouse on desktop. No synthetic data or API routes.
    await run(() => width === 390 ? brakes.tap() : brakes.click());
    await run(() => expect(page.getByTestId('inline-parts')).toHaveAttribute('aria-busy', 'false'));
    await run(() => expect(banner).toContainText('Brakes'));
    await shot('pointer-category-selection');
    await run(() => input.fill('brake'));
    await run(() => expect(brakes).toBeVisible());
    await run(() => width === 390 ? page.locator('header [role="img"]').tap() : page.locator('header [role="img"]').click());
    await run(() => expect(page.getByRole('listbox')).toHaveCount(0));
    await shot('outside-dismissed');
    const before = report.searches.length;
    await run(() => input.focus()); await run(() => input.press('Enter'));
    await run(() => expect(page.getByTestId('inline-parts')).toHaveAttribute('aria-busy', 'false'));
    const scoped = report.searches.slice(before).filter(item => item.q === 'brake');
    assert.ok(scoped.length, 'Explicit text submission must reach staging');
    for (const request of scoped) {
      assert.equal(request.year, '2020'); assert.equal(request.make, 'Toyota'); assert.equal(request.model, 'Camry');
      assert.equal(request.engine_base_id, '17637'); assert.equal(request.category, undefined);
    }
    await run(() => page.getByRole('button', { name: 'Clear search' }).click());
    await run(() => expect(input).toHaveValue(''));
    await run(() => expect(input).toBeFocused());
    await run(() => expect(banner).toContainText('Camry'));
    await run(() => expect(page.getByRole('listbox')).toHaveCount(0));
    assert.deepEqual(await run(() => page.evaluate(() => window.missingActiveOptions)), []);
    assert.equal(await run(() => page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), false);
    assert.equal(await run(() => page.getByRole('alert').count()), 0);
    report.cases.push(`${width}px real staging: open/Escape/arrow+Enter vehicle; scoped categories/Tab/focus/pointer selection/outside ${width === 390 ? 'touch' : 'mouse'}; explicit text retains engine 17637; clear retains context; mounted active ids; no overflow${width === 390 ? '; Header17 Menu > Search focus preserved' : ''}`);
    await run(() => context.close());
  }
}

try {
  if (mode === 'fixture') await fixtureChecks(); else await integratedChecks();
  assert.deepEqual(report.pageErrors, []);
  report.result = 'passed';
} catch (error) {
  report.failure = error.message;
  throw error;
} finally {
  await writeFile(`${output}/${mode}-report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  if (mode === 'fixture') await server.close();
  else await new Promise(resolve => server.httpServer.close(resolve));
}
