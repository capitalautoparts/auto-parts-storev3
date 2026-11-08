// WP-ROYS-LISTING-SCROLL1: bounded real staging Firefox checks, VM511 only.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { firefox, expect as browserExpect } from '@playwright/test';
import { createProductSmokeMonitor } from './product-links-monitor.mjs';
import { nativeReload } from './rp1-browser-history.mjs';
assert.equal(process.env.ROYS_ONPREM, '1');
assert.equal(process.env.ROYS_CATALOG_PREVIEW_ENABLED, 'true');
assert.notEqual(process.env.VERCEL, '1');
assert.equal(process.argv.length, 2);
assert.ok(!process.env.ROYS_LISTING_SCROLL_FAULT_ONLY || process.env.ROYS_LISTING_SCROLL_FAULT_ONLY === '1');
const faultOnly = process.env.ROYS_LISTING_SCROLL_FAULT_ONLY === '1';
assert.ok(!process.env.ROYS_LISTING_SCROLL_CONTINUE_DESKTOP, 'Continuation journeys are unsupported');
const suppliedBase = process.env.ROYS_LISTING_SCROLL_BASE_URL;
const expectedRevision = process.env.ROYS_LISTING_SCROLL_EXPECTED_REVISION;
if (suppliedBase) {
  assert.ok(['http://192.168.88.250', 'https://roys-staging.autrex.ca'].includes(suppliedBase), 'Known staging origin only');
  assert.match(expectedRevision || '', /^[a-f0-9]{12}$/, 'Hosted candidates require an expected deployed revision');
  assert.equal(faultOnly, false, 'Hosted candidates require the full real-data journey');
} else assert.ok(!expectedRevision, 'Expected revision requires a hosted staging origin');
const output = process.env.ROYS_LISTING_SCROLL_OUTPUT || await mkdtemp('/tmp/roys-listing-scroll-');
if (process.env.ROYS_LISTING_SCROLL_OUTPUT) await mkdir(output);
const report = { task: 'WP-ROYS-LISTING-SCROLL1',
  mode: suppliedBase ? 'hosted-candidate' : faultOnly ? 'isolated-fault-only' : 'real-journeys-then-isolated-fault',
  recordedEastern: new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', timeZoneName: 'short' }),
  snapshots: [], transitions: [], requests: [], apiResponses: [], pageErrors: [] };
const monitor = createProductSmokeMonitor(report), run = action => monitor.run(action);
const expect = browserExpect.configure({ timeout: 30_000 });
const server = suppliedBase ? null : await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server?.listen();
const origin = suppliedBase || new URL(server.resolvedUrls.local[0]).origin;
report.origin = origin;
const revision = async () => {
  if (!suppliedBase) return 'source-worktree';
  const response = await fetch(`${origin}/__revision`);
  assert.equal(response.ok, true, 'Staging revision endpoint must succeed');
  return (await response.text()).trim();
};
report.revisionBefore = await revision();
if (suppliedBase) assert.equal(report.revisionBefore, expectedRevision, 'Hosted revision must match before browser navigation');
const browser = await firefox.launch({ headless: true });
let currentPage;
const scoped = '/?year=2020&make=Toyota&model=Camry&engine_base_id=17637&category=brakes-brake-pads&category_parent=brakes';
try {
  for (const width of faultOnly ? [] : [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } });
    const page = currentPage = await context.newPage(); page.setDefaultTimeout(30_000); monitor.observe(page);
    page.on('request', request => {
      const url = new URL(request.url());
      if (!url.pathname.startsWith('/api/')) return;
      assert.equal(request.method(), 'GET'); assert.equal(url.pathname, '/api/catalog');
      report.requests.push({ width, ...Object.fromEntries(url.searchParams) });
    });
    const results = page.getByTestId('inline-parts');
    const settled = async (rows = true) => {
      await run(() => expect(results).toHaveAttribute('aria-busy', 'false'));
      await run(() => expect(page.locator('[data-tree-loading]')).toHaveCount(0));
      if (rows) await run(() => expect(results.locator('[data-part-id]').first()).toBeVisible());
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    const snapshot = async label => {
      const value = await page.evaluate(() => {
        const main = document.querySelector('main'), results = document.querySelector('#catalog-results');
        const selected = document.querySelector('button[id^="vehicle-category-"][aria-current="true"]');
        const rect = node => node ? { y: node.getBoundingClientRect().y, bottom: node.getBoundingClientRect().bottom } : null;
        return { href: location.pathname + location.search, scroll: main.scrollTop, height: main.scrollHeight,
          main: rect(main), selected: rect(selected), firstRow: rect(results.querySelector('[data-part-id]')),
          rows: results.querySelectorAll('[data-part-id]').length, minHeight: results.style.minHeight,
          focus: document.activeElement?.id, documentScroll: document.scrollingElement.scrollTop,
          overflow: document.documentElement.scrollWidth > innerWidth || main.scrollWidth > main.clientWidth };
      });
      report.snapshots.push({ width, label, ...value });
      await page.screenshot({ path: `${output}/${width}-${label}.png` });
      assert.equal(value.overflow, false); assert.equal(value.documentScroll, 0);
      return value;
    };
    const visibleContext = async () => {
      const value = await page.evaluate(() => {
        const main = document.querySelector('main'), selected = document.querySelector('button[id^="vehicle-category-"][aria-current="true"]');
        const rows = document.querySelector('#catalog-results [data-part-id]');
        return { main: main.getBoundingClientRect(), selected: selected?.getBoundingClientRect(), row: rows?.getBoundingClientRect() };
      });
      assert.ok(value.selected && Math.abs(value.selected.y - value.main.y) <= 2, 'Selected category stays above the new products');
      assert.ok(value.row && value.row.y < value.main.bottom, 'First new product is visible');
    };
    const transition = async (label, action, rows = true) => {
      await page.evaluate(() => {
        const main = document.querySelector('main'); let frames = 0, frame, previous;
        const samples = [], calls = [], original = main.scrollTo;
        main.scrollTo = function(...args) { calls.push(args); return original.apply(this, args); };
        const sample = () => {
          const results = document.querySelector('#catalog-results');
          const value = { href: location.pathname + location.search, scroll: main.scrollTop, height: main.scrollHeight,
            busy: results?.getAttribute('aria-busy'), rows: results?.querySelectorAll('[data-part-id]').length ?? 0,
            minHeight: results?.style.minHeight, focus: document.activeElement?.id };
          const key = JSON.stringify(value); if (key !== previous && samples.length < 1200) { samples.push(value); previous = key; }
        };
        const observer = new MutationObserver(sample); observer.observe(main, { subtree: true, childList: true, attributes: true });
        const tick = () => { sample(); if (++frames < 1200) frame = requestAnimationFrame(tick); }; tick();
        window.__listingScrollStop = () => { sample(); observer.disconnect(); cancelAnimationFrame(frame); main.scrollTo = original; return { calls, samples }; };
      });
      await run(action); await settled(rows);
      const trace = await page.evaluate(() => window.__listingScrollStop());
      report.transitions.push({ width, label, ...trace });
      assert.equal(trace.calls.length, 1, `${label}: one intentional main movement`);
      assert.ok(trace.samples.filter(sample => sample.busy === 'true').every(sample => sample.rows === 0), 'No stale rows presented while loading');
      const after = await snapshot(label);
      assert.equal(after.minHeight, '', 'Measured loading placeholder is released');
      if (rows) await visibleContext();
      return after;
    };
    await run(() => page.goto(origin + scoped)); await settled(); await visibleContext(); await snapshot('initial');
    const next = results.getByRole('link', { name: 'Next', exact: true });
    await run(() => next.scrollIntoViewIfNeeded()); await snapshot('next-before');
    await transition('next-after', () => next.click()); assert.equal(new URL(page.url()).searchParams.get('page'), '2');
    const previous = results.getByRole('link', { name: 'Previous', exact: true });
    await run(() => previous.scrollIntoViewIfNeeded()); await snapshot('previous-before');
    await transition('previous-after', () => previous.click()); assert.equal(new URL(page.url()).searchParams.get('page'), null);
    await transition('filter-after', () => page.locator('#catalog-in-stock').check());
    const rotor = page.getByTestId('vehicle-tree').getByRole('button', { name: 'Brake Rotors', exact: true });
    assert.equal(await rotor.count(), 1, 'Use one verified real loaded rotor leaf');
    report.rotor = await rotor.innerText();
    await run(() => rotor.scrollIntoViewIfNeeded()); const beforeCategory = await snapshot('category-before');
    await transition('category-after', () => rotor.click());
    assert.notEqual(new URL(page.url()).searchParams.get('category'), 'brakes-brake-pads');
    await run(() => page.goBack()); await settled();
    const back = await snapshot('category-back'); assert.equal(back.href, beforeCategory.href); assert.equal(back.scroll, beforeCategory.scroll);
    await nativeReload(page, run, report, `${width}-listing`); await settled();
    const reload = await snapshot('reload'); assert.equal(reload.href, back.href); assert.equal(reload.scroll, back.scroll);
    // Bounded global search has a results-section fallback.
    await run(() => page.goto(origin + '/?scope=all&q=ALD1212M')); await settled();
    await run(() => expect(results).toBeFocused());
    await snapshot('global-search');
    if (width === 1440) {
    await run(() => page.getByRole('combobox', { name: 'Search by vehicle or part number' }).fill('aa064791listingnomatch'));
    await run(() => page.getByRole('combobox', { name: 'Search by vehicle or part number' }).press('Enter'));
    await settled(false); await run(() => expect(results).toContainText('No parts match'));
    const empty = await snapshot('empty'); assert.equal(empty.minHeight, '');
    }
    await context.close(); currentPage = null;
  }
  report.realJourneys = faultOnly ? 'not-run' : 'passed';
  if (!suppliedBase) {
  // Isolated fault injection follows both genuine staging journeys. Abort one
  // historical search, then let Retry use the real upstream without a new reveal.
  const faultContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const fault = currentPage = await faultContext.newPage(); monitor.observe(fault); fault.setDefaultTimeout(30_000);
  const faultResults = fault.getByTestId('inline-parts');
  let initialSearch;
  report.faultRequests = [];
  fault.on('request', request => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) return;
    assert.equal(request.method(), 'GET'); assert.equal(url.pathname, '/api/catalog');
    report.faultRequests.push(Object.fromEntries(url.searchParams));
    if (!initialSearch && url.searchParams.get('resource') === 'search') initialSearch = url.href;
  });
  await run(() => fault.goto(origin + scoped + '&page=2&sort_order=desc'));
  await run(() => expect(faultResults.locator('[data-part-id]').first()).toBeVisible());
  await run(() => fault.locator('#catalog-in-stock').check());
  await run(() => expect.poll(() => new URL(fault.url()).searchParams.get('in_stock_only')).toBe('true'));
  await run(() => expect(faultResults).toHaveAttribute('aria-busy', 'false'));
  await run(() => expect(faultResults.locator('[data-part-id]').first()).toBeVisible());
  assert.ok(initialSearch);
  let aborted = false;
  await fault.route('**/api/catalog?**', async route => {
    const url = new URL(route.request().url());
    if (!aborted && url.href === initialSearch) {
      aborted = true; await route.abort();
    } else await route.continue();
  });
  await run(() => fault.goBack()); await run(() => expect.poll(() => aborted).toBe(true));
  await run(() => expect(faultResults.getByRole('alert')).toBeVisible());
  assert.equal(aborted, true);
  await fault.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const retry = faultResults.getByRole('button', { name: 'Retry', exact: true });
  await run(() => retry.scrollIntoViewIfNeeded());
  await fault.evaluate(() => { document.querySelector('main').scrollTop -= 80; });
  const retryBefore = await fault.evaluate(() => ({ scroll: document.querySelector('main').scrollTop, href: location.href }));
  await run(() => retry.click()); await run(() => expect(faultResults.locator('[data-part-id]').first()).toBeVisible());
  await fault.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const retryAfter = await fault.evaluate(() => ({ scroll: document.querySelector('main').scrollTop, href: location.href,
    minHeight: document.querySelector('#catalog-results').style.minHeight }));
  report.retry = { before: retryBefore, after: retryAfter };
  assert.equal(retryAfter.href, retryBefore.href); assert.equal(retryAfter.scroll, retryBefore.scroll);
  assert.equal(retryAfter.minHeight, '');
  await fault.screenshot({ path: `${output}/1440-historical-retry.png` });
  await faultContext.close(); currentPage = null;
  }
  assert.deepEqual(report.pageErrors, []); report.result = 'passed';
} catch (error) {
  report.result = 'failed'; report.error = error.stack;
  if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  throw error;
} finally {
  try { report.revisionAfter = await revision(); }
  catch (error) { report.revisionError = error.message; report.result = 'failed-revision-check'; }
  if (suppliedBase && report.revisionAfter !== expectedRevision) report.result = 'failed-revision-changed';
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close(); await server?.close(); console.log(`Listing scroll evidence: ${output}/report.json`);
  if (suppliedBase) assert.equal(report.revisionAfter, expectedRevision, 'Hosted revision must stay unchanged throughout the full journey');
}
