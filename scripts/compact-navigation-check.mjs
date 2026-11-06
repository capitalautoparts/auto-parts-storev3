// WP-ROYS-COMPACT-NAV1 aa064791. VM511 Firefox, real staging, no mocks.
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { firefox, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createProductSmokeMonitor } from './product-links-monitor.mjs';

const mode = process.argv[2];
assert.ok(['baseline', 'candidate', 'desktop-wrap'].includes(mode));
const resume = process.argv[3];
assert.ok(!resume || (mode === 'candidate' && ['1440-root', '1440-root-v2'].includes(resume)));
assert.equal(process.env.ROYS_ONPREM, '1');
assert.equal(process.env.ROYS_CATALOG_PREVIEW_ENABLED, 'true');
assert.notEqual(process.env.VERCEL, '1');
const suppliedBase = process.env.ROYS_COMPACT_BASE_URL;
let hostedBase;
if (suppliedBase) {
  assert.ok(mode === 'candidate' && !resume, 'Hosted acceptance must use fresh full candidate mode without local continuations or desktop-wrap');
  const url = new URL(suppliedBase);
  const staging = ['http://192.168.88.250', 'https://roys-staging.autrex.ca'].includes(url.origin);
  const local = url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
  assert.ok(staging || local, 'Base URL must be the known staging origin or HTTP localhost');
  assert.ok(!url.username && !url.password && url.pathname === '/' && !url.search && !url.hash,
    'Base URL must contain only an allowed origin');
  hostedBase = url.origin;
}
const output = `/tmp/roys-compact-nav-aa064791/${mode}${resume ? `-${resume}` : ''}`;
// A fresh hosted run must not mix in screenshots left by earlier source runs in the same folder.
if (hostedBase) await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const report = { task: 'WP-ROYS-COMPACT-NAV1 aa064791', mode,
  runtime: { mode: hostedBase ? 'hosted-base-url' : 'vite-source-fixed-lan' },
  continuation: resume || null,
  recordedEastern: new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', timeZoneName: 'short' }),
  cases: [], layouts: [], screenshots: [], apiResponses: [], pageErrors: [], searches: [] };
const monitor = createProductSmokeMonitor(report);
const run = action => monitor.run(action);
// Real-upstream waits: a cold catalog search through the ERP staging gateway can exceed expect's 5 s default.
const upstreamWait = { timeout: 30_000 };
const server = hostedBase ? null : await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server?.listen();
const origin = hostedBase || new URL(server.resolvedUrls.local[0]).origin;
report.runtime.origin = origin;
const browser = await firefox.launch();
try {
  for (const width of mode === 'desktop-wrap' ? [900] : [1440, 390, 900]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, hasTouch: width === 390 });
    const page = await context.newPage();
    monitor.observe(page); page.setDefaultTimeout(30_000);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/api/catalog' && url.searchParams.get('resource') === 'search') report.searches.push(Object.fromEntries(url.searchParams));
    });
    const click = control => run(() => control.click());
    const open = async control => {
      await run(() => expect(control).toBeVisible());
      if (await control.getAttribute('aria-expanded') !== 'true') await click(control);
    };
    const layout = async (state, viewportWidth = width) => {
      const geometry = await run(() => page.evaluate(() => {
        const rect = selector => {
          const el = document.querySelector(selector), r = el?.getBoundingClientRect();
          return r && { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
        };
        const main = document.querySelector('main');
        return { header: rect('header'), context: rect('[data-testid="selected-context"]'),
          main: rect('main'), strip: rect('[data-testid="mobile-cart-strip"]'), search: rect('#catalog-search'),
          documentOverflow: document.documentElement.scrollWidth > innerWidth,
          mainOverflow: main.scrollWidth > main.clientWidth };
      }));
      assert.equal(geometry.documentOverflow, false); assert.equal(geometry.mainOverflow, false);
      if (viewportWidth < 1024) assert.ok(geometry.main.bottom <= geometry.strip.y, 'Reserved cart strip is outside scrolling main');
      report.layouts.push({ width: viewportWidth, state, topChrome: geometry.main.y, ...geometry });
      const file = `${viewportWidth}-${state}.png`;
      await run(() => page.screenshot({ path: `${output}/${file}` })); report.screenshots.push(file);
    };
    await run(() => page.goto(origin));
    assert.equal(new URL(page.url()).origin, origin, 'No redirect to another origin');
    await run(() => expect(page.locator('#vehicle-year-2020')).toBeVisible(upstreamWait));
    if (mode !== 'desktop-wrap' && !(resume === '1440-root-v2' && width === 1440)) await layout('empty');
    const year = page.locator('#vehicle-year-2020'); await open(year);
    const make = year.locator('..').getByRole('button', { name: 'Toyota', exact: true }); await open(make);
    const model = make.locator('..').getByRole('button', { name: 'Camry', exact: true }); await open(model);
    const engine = model.locator('..').locator('button[id^="vehicle-engine-"]').filter({ hasText: '2.5L 4-Cyl L' });
    await click(engine);
    const engineId = await engine.getAttribute('id');
    const categories = page.locator(`#${engineId.replace('vehicle-engine-', 'vehicle-categories-')}`);
    const brakes = categories.getByRole('button', { name: 'Brakes', exact: true }); await open(brakes);
    await click(categories.getByRole('button', { name: 'Brake Pad', exact: true }));
    const results = page.getByTestId('inline-parts');
    await run(() => expect(results).toHaveAttribute('aria-busy', 'false', upstreamWait));
    await run(() => expect(results.locator('[data-part-id]').first()).toBeVisible(upstreamWait));
    if (mode !== 'desktop-wrap' && !(resume === '1440-root-v2' && width === 1440)) {
      await layout('selected-pad');
      report.cases.push(`${width}: matching empty/2020 Toyota Camry 2.5L Brake Pad states, real results, no horizontal overflow, reserved cart geometry`);
    }
    if (mode === 'candidate') {
      const banner = page.getByTestId('selected-context');
      const search = page.getByRole('combobox', { name: 'Search by vehicle or part number' });
      const makeId = await make.getAttribute('id'), modelId = await model.getAttribute('id');
      const categoryId = await categories.getByRole('button', { name: 'Brake Pad', exact: true }).getAttribute('id');
      const toggle = page.locator(`#${engineId.replace('vehicle-engine-', 'vehicle-categories-toggle-')}`);
      const state = () => run(() => page.evaluate(() => ({
        saved: localStorage.getItem('roysauto.original-vehicle.v1'),
        cart: localStorage.getItem('roysauto.original-cart.v1'),
        wishlist: localStorage.getItem('roysauto.original-wishlist.v1'),
      })));
      const initial = await state();
      const activeName = await engine.textContent();
      const waitParts = () => run(() => expect(results).toHaveAttribute('aria-busy', 'false', upstreamWait));
      const focusIs = id => run(() => expect(page.locator(`#${id}`)).toBeFocused());
      const collapse = async () => {
        // Close every level deepest-first so each reveal must reconstruct its
        // own ancestor chain, rather than relying on an earlier test's state.
        for (const control of [brakes, toggle, model, make, year]) {
          if (await control.isVisible() && await control.getAttribute('aria-expanded') === 'true') await click(control);
        }
      };
      const ancestors = [
        ['2020', 'vehicle-year-2020', makeId],
        ['Toyota', makeId, modelId],
        ['Camry', modelId, engineId],
        ['2.5L 4-Cyl L', await toggle.getAttribute('id'), await brakes.getAttribute('id')],
        ['Brake Pad', categoryId, null],
      ];
      const browse = async items => {
        const count = report.searches.length;
        for (const [label, focus, child] of items) {
          await collapse();
          await click(banner.getByRole('button', { name: label, exact: true }));
          await focusIs(focus);
          if (child) {
            await run(() => expect(page.locator(`#${focus}`)).toHaveAttribute('aria-expanded', 'true'));
            await run(() => expect(page.locator(`#${child}`)).toBeVisible());
          }
          await run(() => expect(banner).toContainText('Current vehicle:'));
          assert.deepEqual(await state(), initial, `${label} browsing preserves storage/saved lists`);
        }
        // Allow the unchanged search debounce window to elapse; reveals must
        // not submit any request, including one with an old category/filter.
        await run(() => page.waitForTimeout(300));
        assert.equal(report.searches.length, count, 'Ancestor reveals issue no parts search');
      };
      const stock = results.getByRole('checkbox', { name: 'In stock only', exact: true });
      if (!(resume && width === 1440)) {
        await run(() => stock.check()); await waitParts();
        await browse(ancestors);
        await run(() => expect(stock).toBeChecked());
        await run(() => expect(engine).toHaveAttribute('aria-current', 'true'));
        await run(() => expect(engine).toHaveAccessibleName(activeName.replace('Current vehicle', '')));
        report.cases.push(`${width}: all five path controls reveal/focus correct choices from fully collapsed state; current engine, stock filter and saved state/lists unchanged, zero parts requests`);

        const options = page.getByTestId('vehicle-options'), summary = options.locator('summary');
        await run(() => summary.focus()); await run(() => summary.press('Enter'));
        await run(() => expect(options.getByRole('button', { name: 'Change engine', exact: true })).toBeVisible());
        await run(() => summary.press('Tab'));
        await run(() => expect(options.getByRole('button', { name: 'Categories', exact: true })).toBeFocused());
        await layout('vehicle-options-open');
        await run(() => summary.focus()); await run(() => summary.press('Space'));
      }

      if (width !== 900) {
        await run(() => search.fill('brake')); await run(() => search.press('Enter')); await waitParts();
        const brand = results.getByRole('combobox', { name: 'Brand', exact: true });
        const brandId = await brand.locator('option').nth(1).getAttribute('value'); assert.ok(brandId);
        await run(() => brand.selectOption(brandId)); await waitParts();
        const next = results.getByRole('button', { name: 'Next', exact: true });
        let requestedPage = '1';
        if (await next.isEnabled()) { await click(next); await waitParts(); requestedPage = '2'; }
        await run(() => page.waitForTimeout(300));
        if (!(resume && width === 1440)) await browse(ancestors.slice(0, 4));
        else { await collapse(); await click(banner.getByRole('button', { name: '2.5L 4-Cyl L', exact: true })); }
        await run(() => expect(brand).toHaveValue(brandId));
        await run(() => expect(search).toHaveValue('brake'));
        await run(() => expect(results).toContainText(`Page ${requestedPage}`));
        if (!(resume && width === 1440)) report.cases.push(`${width}: year/make/model/engine browsing preserves committed text search, brand and page ${requestedPage}; no stale requests`);

        const rootCount = report.searches.length;
        await run(() => Promise.all([
          page.waitForResponse(response => {
            const url = new URL(response.url());
            return url.pathname === '/api/catalog' && url.searchParams.get('resource') === 'search' && !url.searchParams.has('q');
          }),
          banner.getByRole('button', { name: 'Part Catalog', exact: true }).click(),
        ]));
        await focusIs('vehicle-picker');
        await run(() => expect(search).toHaveValue(''));
        for (const request of report.searches.slice(rootCount)) {
          assert.equal(request.q, undefined); assert.equal(request.brand, undefined);
          assert.equal(request.page, '1'); assert.equal(request.engine_base_id, engineId.split('-').at(-1));
        }
        assert.deepEqual(await state(), initial);
        await run(() => page.waitForTimeout(300)); await focusIs('vehicle-picker');
        await run(() => expect(page.locator('#vehicle-picker')).toBeInViewport());
        await layout('catalog-root');
        // Root preserves tree disclosure state: inline results may be unmounted
        // under collapsed Brakes. Reveal the selected leaf to inspect reset UI.
        await click(banner.getByRole('button', { name: 'Brake Pad', exact: true }));
        await focusIs(categoryId); await waitParts();
        await run(() => expect(brand).toHaveValue(''));
        await run(() => expect(results).toContainText('Page 1'));

        const header = page.locator('header');
        if (width === 390) {
          const trigger = header.getByRole('button', { name: 'Open menu', exact: true });
          await run(() => trigger.tap());
          let menu = page.getByRole('dialog', { name: 'Menu', exact: true });
          await run(() => expect(menu.getByRole('button', { name: 'Account', exact: true })).toHaveAccessibleDescription('Accounts are not enabled during catalog testing.'));
          await run(() => expect(menu.getByRole('button', { name: 'Account', exact: true })).toBeDisabled());
          await click(menu.getByRole('button', { name: 'Search catalog', exact: true }));
          await run(() => expect(search).toBeFocused());
          await run(() => trigger.focus()); await run(() => trigger.press('Enter'));
          await run(() => page.keyboard.press('Escape')); await run(() => expect(trigger).toBeFocused());
          await run(() => trigger.tap());
          await click(menu.getByRole('button', { name: 'Part Catalog', exact: true }));
          await run(() => expect(menu).toHaveCount(0)); await focusIs('vehicle-picker');
          await run(() => page.waitForTimeout(300)); await focusIs('vehicle-picker');
          const cart = page.getByRole('button', { name: 'Open Quick Cart', exact: true });
          await run(() => cart.tap()); await run(() => expect(page.getByRole('dialog', { name: 'Quick Cart', exact: true })).toBeVisible());
          await run(() => page.keyboard.press('Escape')); await run(() => expect(cart).toBeFocused());
        } else {
          await run(() => expect(header.getByRole('button', { name: 'Account', exact: true })).toBeDisabled());
          await run(() => expect(header.getByRole('button', { name: 'Account', exact: true })).toHaveAccessibleDescription('Accounts are not enabled during catalog testing.'));
          await click(header.getByRole('button', { name: 'Search catalog', exact: true }).filter({ hasText: 'Search catalog' })); await run(() => expect(search).toBeFocused());
          await click(header.getByRole('button', { name: 'Part Catalog', exact: true })); await focusIs('vehicle-picker');
        }
        await run(() => search.fill('brake'));
        await run(() => expect(search).toHaveAttribute('aria-expanded', 'true'));
        await run(() => search.press('ArrowDown'));
        const activeOption = await search.getAttribute('aria-activedescendant'); assert.ok(activeOption);
        await run(() => expect(page.locator(`[id="${activeOption}"]`)).toBeVisible());
        await run(() => search.press('Escape')); await run(() => expect(search).toBeFocused());
        await run(() => expect(search).toHaveAttribute('aria-expanded', 'false'));
        await run(() => search.fill(''));
        assert.deepEqual(await state(), initial);
        report.cases.push(`${width}: breadcrumb/Header Catalog reset exception and settled root focus; disabled Account explanation; search combobox open/arrow/Escape focus${width === 390 ? '; menu tap/search, Escape focus, Catalog close/root focus, native cart Escape focus' : ''}`);
      }
    }
    if (mode === 'desktop-wrap' || (mode === 'candidate' && width === 900)) {
      // Same loaded vehicle and reference cache: only resize across lg. No new
      // vehicle/search journey to test the tight single-row desktop layout.
      for (const desktopWidth of [1024, 1100]) {
        await run(() => page.setViewportSize({ width: desktopWidth, height: 900 }));
        const header = page.locator('header'), input = header.locator('#catalog-search');
        const account = header.getByRole('button', { name: 'Account', exact: true });
        await run(() => expect(account).toBeVisible()); await run(() => expect(account).toBeDisabled());
        await run(() => expect(account).toHaveAccessibleDescription('Accounts are not enabled during catalog testing.'));
        await run(() => expect(header.locator('#desktop-account-unavailable')).toBeVisible());
        const searchBox = await input.boundingBox(); assert.ok(searchBox.width >= 240, 'Main search remains usable just above lg');
        const boxes = await header.locator('button:visible, input:visible, #desktop-account-unavailable').evaluateAll(els => els.map(el => {
          const r = el.getBoundingClientRect(); return { tag: el.tagName, text: el.textContent || el.getAttribute('aria-label'), x: r.x, y: r.y, right: r.right, bottom: r.bottom, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
        }));
        for (const box of boxes) {
          assert.ok(box.x >= 0 && box.right <= desktopWidth && box.y >= 0);
          // Native input text/placeholder can scroll inside its field. Measure
          // the usable field bounds separately; labels/explanation must fit.
          if (box.tag !== 'INPUT') assert.ok(box.scrollWidth <= box.clientWidth, `${box.text} is not horizontally clipped`);
        }
        const options = page.getByTestId('vehicle-options'), summary = options.locator('summary');
        await run(() => summary.focus()); await run(() => summary.press('Enter'));
        await run(() => expect(options).toHaveAttribute('open', ''));
        await run(() => summary.press('Tab'));
        await run(() => expect(options.getByRole('button', { name: 'Categories', exact: true })).toBeFocused());
        for (const name of ['Categories', 'Change engine', 'Change vehicle']) await run(() => expect(options.getByRole('button', { name, exact: true })).toBeVisible());
        await layout('desktop-options-open', desktopWidth);
        await run(() => summary.focus()); await run(() => summary.press('Space'));
        await run(() => expect(options).not.toHaveAttribute('open', ''));
        await layout('desktop-wrap', desktopWidth);
        report.cases.push(`${desktopWidth}: search ${Math.round(searchBox.width)}px wide; header controls/text inside viewport without clipping; Account explanation visible and associated; native Vehicle options Enter/Tab/Space and actions discoverable`);
      }
    }
    await context.close();
  }
  assert.deepEqual(report.pageErrors, []);
  report.result = 'passed';
} catch (error) {
  report.result = 'failed'; report.error = error.stack; process.exitCode = 1;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ mode, result: report.result, layouts: report.layouts, cases: report.cases, error: report.error }));
  await browser.close(); await server?.close();
}
