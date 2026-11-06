// WP-ROYS-RP1-aa064791. VM511 only; source-integrated Firefox, real fixed staging upstream.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { firefox, expect } from '@playwright/test';
import { nativeReload } from './rp1-browser-history.mjs';
import { createProductSmokeMonitor } from './product-links-monitor.mjs';

assert.equal(process.env.ROYS_ONPREM, '1');
assert.equal(process.env.ROYS_CATALOG_PREVIEW_ENABLED, 'true');
assert.notEqual(process.env.VERCEL, '1');
const widths = (process.env.ROYS_RP1_WIDTHS || '1440,390').split(',').map(Number);
assert.ok(widths.every(width => [1440, 390].includes(width)));
const suppliedBase = process.env.ROYS_RP1_BASE_URL;
let hostedBase;
if (suppliedBase) {
  assert.ok(process.env.ROYS_RP1_CONTINUE_DESKTOP !== '1', 'Hosted runs require a fresh full journey');
  assert.ok(!process.env.ROYS_RP1_WIDTHS, 'Hosted runs require default 1440/390 widths');
  const url = new URL(suppliedBase);
  const staging = ['http://192.168.88.250', 'https://roys-staging.autrex.ca'].includes(url.origin);
  const local = url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
  assert.ok(staging || local, 'Only known staging origins or HTTP localhost are allowed');
  assert.ok(!url.username && !url.password && url.pathname === '/' && !url.search && !url.hash, 'Base URL must be an origin only');
  hostedBase = url.origin;
}
const output = process.env.ROYS_RP1_OUTPUT || (hostedBase ? await mkdtemp('/tmp/roys-rp1-aa064791-hosted-') : '/tmp/roys-rp1-aa064791');
if (hostedBase && process.env.ROYS_RP1_OUTPUT) await mkdir(output); // Refuse existing evidence directories.
else await mkdir(output, { recursive: true });
const report = { task: 'WP-ROYS-RP1-aa064791', continuationDesktop: process.env.ROYS_RP1_CONTINUE_DESKTOP === '1',
  runtime: { mode: hostedBase ? 'hosted-base-url' : 'vite-source-fixed-lan' },
  recordedEastern: new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', timeZoneName: 'short' }),
  cases: [], requests: [], apiResponses: [], pageErrors: [], screenshots: [], layouts: [] };
const monitor = createProductSmokeMonitor(report);
const run = action => monitor.run(action);
const server = hostedBase ? null : await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server?.listen();
const origin = hostedBase || new URL(server.resolvedUrls.local[0]).origin;
report.runtime.origin = origin;
const browser = await firefox.launch({ headless: true });
const upstreamWait = { timeout: 30_000 };
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, hasTouch: width === 390 });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000); monitor.observe(page);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/api/catalog') report.requests.push({ width, ...Object.fromEntries(url.searchParams) });
    });
    const click = locator => run(() => locator.click());
    const open = async locator => { if (await locator.getAttribute('aria-expanded') !== 'true') await click(locator); };
    const results = page.getByTestId('inline-parts');
    const settled = async () => {
      await run(() => expect(results).toHaveAttribute('aria-busy', 'false', upstreamWait));
      await run(() => expect(results.locator('[data-part-id]').first()).toBeVisible(upstreamWait));
    };
    const storage = () => run(() => page.evaluate(() => ({ vehicle: localStorage.getItem('roysauto.original-vehicle.v1'),
      cart: localStorage.getItem('roysauto.original-cart.v1'), wishlist: localStorage.getItem('roysauto.original-wishlist.v1') })));
    const presentation = () => run(() => page.evaluate(() => ({ href: location.pathname + location.search,
      historyLength: history.length, scroll: document.querySelector('main').scrollTop,
      focus: document.activeElement?.id || document.activeElement?.getAttribute('href'), state: history.state })));
    const screenshot = async name => {
      const geometry = await run(() => page.evaluate(() => {
        const main = document.querySelector('main').getBoundingClientRect();
        const strip = document.querySelector('[data-testid="mobile-cart-strip"]').getBoundingClientRect();
        return { main: { y: main.y, bottom: main.bottom, height: main.height }, strip: { y: strip.y },
          documentOverflow: document.documentElement.scrollWidth > innerWidth,
          mainOverflow: document.querySelector('main').scrollWidth > document.querySelector('main').clientWidth };
      }));
      assert.equal(geometry.documentOverflow, false); assert.equal(geometry.mainOverflow, false);
      if (width === 390) assert.ok(geometry.main.bottom <= geometry.strip.y, 'Reserved mobile strip remains outside scrolling main');
      report.layouts.push({ width, name, ...geometry });
      const file = `${width}-${name}.png`; await run(() => page.screenshot({ path: `${output}/${file}` })); report.screenshots.push(file);
    };
    const root = async () => {
      if (width === 390) {
        await click(page.getByRole('button', { name: 'Open menu', exact: true }));
        await click(page.getByRole('dialog', { name: 'Menu', exact: true }).getByRole('link', { name: 'Part Catalog', exact: true }));
      } else await click(page.locator('header').getByRole('link', { name: 'Part Catalog', exact: true }));
      await run(() => expect(page).toHaveURL(`${origin}/?scope=all`));
      await run(() => expect(page.locator('#vehicle-picker')).toBeFocused());
      await run(() => expect(results).toHaveCount(0));
    };
    let initialStorage, page2;
    if (!(width === 1440 && process.env.ROYS_RP1_CONTINUE_DESKTOP === '1')) {
    await run(() => page.goto(`${origin}/?scope=all`));
    const year = page.locator('#vehicle-year-2020'); await run(() => expect(year).toBeVisible(upstreamWait)); await open(year);
    const make = year.locator('..').getByRole('button', { name: 'Toyota', exact: true }); await open(make);
    const model = make.locator('..').getByRole('button', { name: 'Camry', exact: true }); await open(model);
    const engine = model.locator('..').locator('button[id^="vehicle-engine-"]').filter({ hasText: '2.5L 4-Cyl L' });
    await click(engine);
    const engineId = await engine.getAttribute('id');
    const categories = page.locator(`#${engineId.replace('vehicle-engine-', 'vehicle-categories-')}`);
    const brakes = categories.getByRole('button', { name: 'Brakes', exact: true }); await open(brakes);
    await click(categories.getByRole('button', { name: 'Brake Pad', exact: true }));
    await settled();
    const firstUrl = new URL(page.url());
    assert.equal(firstUrl.pathname, '/'); assert.ok(firstUrl.searchParams.get('category')); assert.ok(firstUrl.searchParams.get('category_parent'));
    initialStorage = await storage(); assert.ok(initialStorage.vehicle);
    const next = results.getByRole('link', { name: 'Next', exact: true });
    await run(() => expect(next).toBeVisible());
    const nextHref = await next.getAttribute('href'); assert.equal(new URL(nextHref, origin).searchParams.get('page'), '2');
    await click(next); await settled();
    await run(() => expect(results).toContainText('Page 2'));
    page2 = page.url();
    await screenshot('page2');
    const savedPage2 = await presentation();
    const identities = await results.locator('[data-part-id]').evaluateAll(rows => rows.map(row => row.getAttribute('data-part-id')));
    await root();
    assert.deepEqual(await storage(), initialStorage, 'Catalog retains memory and test lists');
    await screenshot('explicit-all');
    await run(() => page.goBack()); await settled();
    assert.equal(page.url(), page2); await run(() => expect(results).toContainText('Page 2'));
    assert.deepEqual(await results.locator('[data-part-id]').evaluateAll(rows => rows.map(row => row.getAttribute('data-part-id'))), identities);
    await run(() => expect.poll(async () => (await presentation()).scroll).toBeCloseTo(savedPage2.scroll, 0));
    await run(() => page.goForward()); await run(() => expect(results).toHaveCount(0));
    await nativeReload(page, run, report, `${width}-explicit-all`);
    await run(() => expect(page.getByTestId('catalog-context')).toContainText('All vehicles.', upstreamWait));
    await run(() => expect(page.getByTestId('selected-context')).toHaveCount(0));
    assert.equal(page.url(), `${origin}/?scope=all`);
    await run(() => page.goBack()); await settled();
    await nativeReload(page, run, report, `${width}-page2`); await settled(); assert.equal(page.url(), page2);
    assert.deepEqual(await storage(), initialStorage, 'Reload/popstate never persist');
    report.cases.push(`${width}: real Camry/engine/category page2 -> Catalog -> Back/Forward/reload, exact row identities, main scroll and inactive memory`);
    } else {
      page2 = `${origin}/?year=2020&make=Toyota&model=Camry&engine_base_id=17637&category=brakes-brake-pads&page=2&category_parent=brakes`;
      await run(() => page.goto(page2)); await settled();
      initialStorage = await storage();
      await nativeReload(page, run, report, '1440-outstanding-page2'); await settled();
      assert.equal(page.url(), page2);
      report.cases.push('1440 continuation: prior Catalog/Back groups retained from attempt1/native-reload1; direct page2 native reload passed without added entry');
    }

    // Incomplete autocomplete remains a draft and reveals engines without committing.
    const beforeDraft = await presentation(), beforeDraftStorage = await storage();
    const search = page.getByRole('combobox', { name: 'Search by vehicle or part number' });
    await run(() => search.fill('2020 Toyota Camry'));
    await click(page.getByRole('option').filter({ hasText: '2020 Toyota Camry' }).first());
    await run(() => expect(page.getByRole('button', { name: 'Cancel draft', exact: true })).toBeVisible());
    assert.equal(page.url(), page2); assert.deepEqual(await storage(), beforeDraftStorage);
    assert.equal((await presentation()).historyLength, beforeDraft.historyLength);
    await click(page.getByRole('button', { name: 'Cancel draft', exact: true }));
    report.cases.push(`${width}: incomplete autocomplete reveal/cancel preserves committed URL/page/storage and history length`);

    // One quick-view return checks navigation only, without repeating product/cart acceptance.
    const details = results.getByRole('link', { name: 'Details', exact: true }).last();
    await run(() => details.scrollIntoViewIfNeeded()); await run(() => details.focus());
    const beforeOverlay = await presentation(), productHref = await details.getAttribute('href');
    assert.ok(productHref.startsWith('/products/')); assert.equal(new URL(productHref, origin).search, '');
    await run(() => page.keyboard.press('Enter'));
    await run(() => expect(page.getByRole('dialog')).toBeVisible());
    assert.equal(new URL(page.url()).pathname, productHref);
    if (width === 1440) await run(() => page.goBack());
    else await run(() => page.keyboard.press('Escape'));
    await run(() => expect(page.getByRole('dialog')).toHaveCount(0)); await settled();
    assert.equal(page.url(), page2);
    await run(() => expect(details).toBeFocused());
    await run(() => expect.poll(async () => (await presentation()).scroll).toBeCloseTo(beforeOverlay.scroll, 0));
    await screenshot('overlay-return');
    report.cases.push(`${width}: existing SKU overlay returns exact page2 URL, main scroll and Details focus`);

    // Invalid explicit URL does not restore the remembered vehicle.
    await run(() => page.goto(`${origin}/?year=2020`));
    await run(() => expect(page.getByTestId('navigation-recovery')).toBeVisible());
    await run(() => expect(page.getByTestId('selected-context')).toHaveCount(0));
    assert.deepEqual(await storage(), initialStorage);
    await screenshot('invalid-url');
    await click(page.getByTestId('navigation-recovery').getByRole('link', { name: 'Part Catalog', exact: true }));
    await run(() => expect(page.locator('#vehicle-picker')).toBeFocused());
    await run(() => page.goto(page2)); await settled();
    await click(page.getByRole('button', { name: 'Clear vehicle', exact: true }));
    await run(() => expect(page).toHaveURL(`${origin}/?scope=all`));
    const cleared = await storage(); assert.equal(cleared.vehicle, 'null');
    assert.equal(cleared.cart, initialStorage.cart); assert.equal(cleared.wishlist, initialStorage.wishlist);
    await run(() => page.goBack()); await settled(); assert.equal(page.url(), page2);
    assert.equal((await storage()).vehicle, 'null', 'Historical explicit scope works after Clear without saving again');
    report.cases.push(`${width}: invalid URL blocks restore; Clear forgets memory, preserves lists; Back still restores explicit scope`);
    if (width === 1440) {
      const clean = await browser.newContext({ viewport: { width, height: 900 } });
      const copied = await clean.newPage(); monitor.observe(copied); copied.setDefaultTimeout(30_000);
      await run(() => copied.goto(page2));
      await run(() => expect(copied.getByTestId('inline-parts')).toContainText('Page 2', upstreamWait));
      await run(() => expect(copied.locator('[data-part-id]').first()).toBeVisible(upstreamWait));
      assert.equal(await copied.evaluate(() => localStorage.getItem('roysauto.original-vehicle.v1')), null);
      // A modified click uses the genuine product href and native document entry.
      clean.once('page', native => monitor.observe(native));
      const [native] = await run(() => Promise.all([clean.waitForEvent('page'), copied.getByRole('link', { name: 'Details', exact: true }).first().click({ modifiers: ['Control'] })]));
      await run(() => native.waitForLoadState());
      assert.ok(new URL(native.url()).pathname.startsWith('/products/'));
      assert.equal(await native.evaluate(() => history.state?.roysProductOverlay ?? false), false);
      await run(() => expect(native.getByRole('dialog')).toBeVisible(upstreamWait));
      await run(() => native.keyboard.press('Escape'));
      await run(() => expect(native).toHaveURL(`${origin}/?scope=all`));
      report.cases.push('1440: clean browser copied page2 restores without memory; Control-click opens native SKU entry and closes to explicit all');
      await clean.close();
    }
    await context.close();
  }
  assert.deepEqual(report.pageErrors, []);
  report.result = 'passed';
} catch (error) { report.result = 'failed'; report.error = error.stack; throw error; }
finally {
  await browser.close(); await server?.close();
  await writeFile(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`RP1 evidence: ${output}/report.json`);
}
