// WP-ROYS-SCROLL-NAV1: bounded real-data Firefox navigation, VM511 only.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { firefox, expect } from '@playwright/test';
import { nativeReload } from './rp1-browser-history.mjs';
import { createProductSmokeMonitor } from './product-links-monitor.mjs';
assert.equal(process.env.ROYS_ONPREM, '1');
assert.equal(process.env.ROYS_CATALOG_PREVIEW_ENABLED, 'true');
assert.notEqual(process.env.VERCEL, '1');
assert.equal(process.argv.length, 2, 'No positional arguments are supported');
assert.ok(!process.env.ROYS_SCROLL_CONTINUE_DESKTOP, 'Fresh complete candidate journeys only');
assert.ok(!process.env.ROYS_SCROLL_OBSERVE || process.env.ROYS_SCROLL_OBSERVE === '1');
const observing = process.env.ROYS_SCROLL_OBSERVE === '1';
const supplied = process.env.ROYS_SCROLL_BASE_URL;
assert.ok(!observing || supplied, 'Observation mode requires a hosted staging origin');
const expectedRevision = process.env.ROYS_SCROLL_EXPECTED_REVISION;
if (supplied) assert.match(expectedRevision || '', /^[a-f0-9]{12}$/, 'Hosted runs require the expected deployed 12-character revision');
if (supplied) assert.ok(['http://192.168.88.250', 'https://roys-staging.autrex.ca'].includes(supplied));
const output = process.env.ROYS_SCROLL_OUTPUT || await mkdtemp('/tmp/roys-scroll-navigation-');
if (process.env.ROYS_SCROLL_OUTPUT) await mkdir(output); // Preserve evidence: no reuse.
const report = { task: 'WP-ROYS-SCROLL-NAV1', mode: supplied ? observing ? 'hosted-observation' : 'hosted-candidate' : 'source-integrated',
  recordedEastern: new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', timeZoneName: 'short' }),
  snapshots: [], events: [], requests: [], apiResponses: [], pageErrors: [] };
const monitor = createProductSmokeMonitor(report), run = action => monitor.run(action);
const server = supplied ? null : await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server?.listen();
const origin = supplied || new URL(server.resolvedUrls.local[0]).origin;
const revision = async () => supplied ? (await (await fetch(`${origin}/__revision`)).text()).trim() : 'source-worktree';
report.revisionBefore = await revision();
if (supplied) assert.equal(report.revisionBefore, expectedRevision, 'Hosted revision must match the approved expected revision before browser navigation');
const browser = await firefox.launch({ headless: true });
let currentPage;
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, hasTouch: width === 390 });
    await context.addInitScript(() => {
      let count = 0;
      const emit = (event, element) => {
        if (count++ > 250) return;
        console.log('__SCROLL__' + JSON.stringify({ event, href: location.pathname + location.search,
          target: element?.id || element?.getAttribute('data-catalog-focus') || element?.tagName,
          main: document.querySelector('main')?.scrollTop, document: document.scrollingElement?.scrollTop,
          stack: new Error().stack?.split('\n').slice(2, 6) }));
      };
      addEventListener('DOMContentLoaded', () => {
        let previous;
        new MutationObserver(() => {
          const main = document.querySelector('main'), results = document.querySelector('#catalog-results');
          const value = { href: location.pathname + location.search, mainScroll: main?.scrollTop,
            mainHeight: main?.scrollHeight, resultsMounted: !!results, rows: results?.querySelectorAll('[data-part-id]').length,
            resultsY: results?.getBoundingClientRect().y, dialog: !!document.querySelector('[role=dialog]') };
          const key = JSON.stringify(value);
          if (key !== previous && count++ < 250) { previous = key; console.log('__SCROLL__' + JSON.stringify({ event: 'mount-change', ...value })); }
        }).observe(document.body, { childList: true, subtree: true });
      });
      for (const method of ['focus', 'scrollIntoView']) {
        const original = HTMLElement.prototype[method];
        HTMLElement.prototype[method] = function(...args) { emit(method, this); return original.apply(this, args); };
      }
    });
    const page = currentPage = await context.newPage(); page.setDefaultTimeout(30_000); monitor.observe(page);
    page.on('console', message => { if (message.text().startsWith('__SCROLL__')) report.events.push({ width, ...JSON.parse(message.text().slice(10)) }); });
    page.on('request', request => {
      const url = new URL(request.url());
      if (!url.pathname.startsWith('/api/')) return;
      assert.equal(request.method(), 'GET'); assert.equal(url.pathname, '/api/catalog');
      report.requests.push({ width, ...Object.fromEntries(url.searchParams) });
    });
    const results = page.getByTestId('inline-parts');
    const settled = async () => {
      await run(() => expect(results).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 }));
      await run(() => expect(results.locator('[data-part-id]').first()).toBeVisible({ timeout: 30_000 }));
      await run(() => expect(page.locator('[data-tree-loading]')).toHaveCount(0, { timeout: 30_000 }));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    const snapshot = async label => {
      const state = await page.evaluate(() => {
        const main = document.querySelector('main'), results = document.querySelector('#catalog-results'), active = document.activeElement;
        const rect = target => target ? { y: target.getBoundingClientRect().y, bottom: target.getBoundingClientRect().bottom, height: target.getBoundingClientRect().height } : null;
        return { href: location.pathname + location.search, historyLength: history.length, state: history.state,
          main: { scroll: main.scrollTop, height: main.scrollHeight, bounds: rect(main) }, documentScroll: document.scrollingElement.scrollTop,
          results: { bounds: rect(results), busy: results?.getAttribute('aria-busy'), rows: results?.querySelectorAll('[data-part-id]').length },
          active: { tag: active?.tagName, id: active?.id, href: active?.getAttribute('href'), control: active?.getAttribute('data-catalog-focus'), bounds: rect(active) },
          dialog: rect(document.querySelector('[role=dialog]')), overflow: document.documentElement.scrollWidth > innerWidth };
      });
      report.snapshots.push({ width, label, requestCount: report.requests.length, ...state });
      await page.screenshot({ path: `${output}/${width}-${label}.png` }); return state;
    };
    const scoped = '/?year=2020&make=Toyota&model=Camry&engine_base_id=17637&category=brakes-brake-pads&category_parent=brakes';
    await run(() => page.goto(origin + scoped + (observing ? '' : '&page=2&in_stock_only=true'))); await settled();
    const initial = await snapshot('initial-results');
    if (!observing) assert.equal(Math.round(initial.results.bounds.y), Math.round(initial.main.bounds.y), 'New listing reveals result start');
    if (observing) {
      const category = page.getByTestId('vehicle-tree').getByRole('button', { name: 'Brake Pad', exact: true });
      await run(() => category.scrollIntoViewIfNeeded()); await snapshot('category-before');
      await run(() => category.click()); await settled(); await snapshot('category-after');
      const next = results.getByRole('link', { name: 'Next', exact: true });
      await run(() => next.scrollIntoViewIfNeeded()); await snapshot('pagination-before');
      await run(() => next.click()); await run(() => expect(results).toContainText('Page 2')); await settled(); await snapshot('pagination-after');
      await run(() => page.locator('#catalog-in-stock').scrollIntoViewIfNeeded()); await snapshot('filter-before');
      await run(() => page.locator('#catalog-in-stock').check()); await run(() => expect(results).toContainText('Page 1')); await settled(); await snapshot('filter-after');
    }
    // All native product controls use the same real row. Pointer clicks never
    // pre-focus a link; the trace checks intermediate frames as well as return.
    for (const control of ['details', 'title', 'image']) {
      const link = results.locator(`[data-part-id] a[data-catalog-focus="${control}"]`).last();
      await run(() => link.scrollIntoViewIfNeeded()); const before = await snapshot(`${control}-before`);
      const searchesBefore = report.requests.filter(request => request.resource === 'search').length;
      await page.evaluate(() => {
        const main = document.querySelector('main'), results = document.querySelector('#catalog-results');
        const row = results.querySelector('[data-part-id]');
        const samples = []; let previous, frames = 0, frame;
        const sample = () => {
          const current = document.querySelector('#catalog-results');
          const value = { scroll: main.scrollTop, documentScroll: document.scrollingElement.scrollTop,
            sameMain: main === document.querySelector('main'), sameResults: results === current,
            sameRow: row === current?.querySelector('[data-part-id]'), rows: current?.querySelectorAll('[data-part-id]').length ?? 0,
            resultsY: current?.getBoundingClientRect().y, href: location.pathname + location.search };
          const key = JSON.stringify(value);
          if (key !== previous && samples.length < 1800) { previous = key; samples.push(value); }
        };
        const observer = new MutationObserver(sample);
        observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'aria-busy'] });
        const tick = () => { sample(); if (++frames < 1800) frame = requestAnimationFrame(tick); };
        tick();
        window.__scrollNavigationStop = () => { sample(); observer.disconnect(); cancelAnimationFrame(frame); return { frames, samples }; };
      });
      await run(() => link.click());
      await run(() => expect(page.getByRole('dialog').getByText('Review all application conditions;', { exact: false })).toBeVisible({ timeout: 30_000 }));
      await snapshot(`${control}-open`);
      await run(() => page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click());
      await run(() => expect(page.getByRole('dialog')).toHaveCount(0)); await settled(); const closed = await snapshot(`${control}-close`);
      if (control === 'details') {
        await run(() => page.goForward());
        await run(() => expect(page.getByRole('dialog').getByText('Review all application conditions;', { exact: false })).toBeVisible({ timeout: 30_000 }));
        await snapshot('product-forward');
        await run(() => page.goBack()); await run(() => expect(page.getByRole('dialog')).toHaveCount(0)); await settled(); await snapshot('product-back');
      }
      const trace = await page.evaluate(() => window.__scrollNavigationStop());
      (report.continuity ??= []).push({ width, control, ...trace });
      const searchesAfter = report.requests.filter(request => request.resource === 'search').length;
      report.events.push({ width, control, event: 'return-comparison', expectedScroll: before.main.scroll, actualScroll: closed.main.scroll,
        expectedHref: before.href, actualHref: closed.href, searchesBefore, searchesAfter });
      if (!observing) {
        assert.equal(closed.href, before.href); assert.equal(closed.main.scroll, before.main.scroll);
        assert.equal(closed.active.control, control, 'Return restores the clicked native control');
        assert.equal(searchesAfter, searchesBefore, 'An unchanged overlay background must not search again');
        assert.ok(trace.samples.every(sample => sample.sameMain && sample.sameResults && sample.sameRow && sample.rows === before.results.rows), 'Keep accepted results mounted through every observed mutation/frame');
        assert.ok(trace.samples.every(sample => sample.scroll === before.main.scroll && sample.documentScroll === 0), 'No intermediate background jump');
      }
    }
    const beforeReload = await snapshot('reload-before');
    await nativeReload(page, run, report, `${width}-listing`); await settled(); const reloaded = await snapshot('listing-reload');
    assert.equal(reloaded.href, beforeReload.href); assert.equal(reloaded.main.scroll, beforeReload.main.scroll);
    await context.close(); currentPage = null;
  }
  assert.deepEqual(report.pageErrors, []);
  report.result = observing ? 'completed-observation' : 'passed';
} catch (error) {
  report.result = 'failed'; report.error = error.stack;
  if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  throw error;
} finally {
  report.revisionAfter = await revision();
  if (supplied && report.revisionAfter !== expectedRevision) report.result = 'failed-revision-changed';
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close(); await server?.close();
  console.log(`Scroll navigation evidence: ${output}/report.json`);
  if (supplied) assert.equal(report.revisionAfter, expectedRevision, 'Hosted revision must remain unchanged throughout the journey');
}
