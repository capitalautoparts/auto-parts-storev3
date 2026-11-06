// Single bounded failing-sequence diagnostic. VM511 only, real fixed staging reads.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { firefox, expect } from '@playwright/test';
import { nativeReload } from './rp1-browser-history.mjs';
import { createProductSmokeMonitor } from './product-links-monitor.mjs';
assert.equal(process.env.ROYS_ONPREM, '1');
assert.equal(process.env.ROYS_CATALOG_PREVIEW_ENABLED, 'true');
assert.notEqual(process.env.VERCEL, '1');
const native = process.env.ROYS_RP1_NATIVE === '1';
const output = `/tmp/roys-rp1-aa064791/${native ? 'native-reload1' : 'history-diagnostic1'}`;
await mkdir(output, { recursive: true });
const report = { task: 'WP-ROYS-RP1-aa064791', mode: 'bounded history diagnostic',
  recordedEastern: new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', timeZoneName: 'short' }),
  snapshots: [], events: [], requests: [], apiResponses: [], pageErrors: [] };
const monitor = createProductSmokeMonitor(report), run = action => monitor.run(action);
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } }); await server.listen();
const origin = new URL(server.resolvedUrls.local[0]).origin;
const scoped = '/?year=2020&make=Toyota&model=Camry&engine_base_id=17637&category=brakes-brake-pads&page=2&category_parent=brakes';
const browser = await firefox.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => {
  const documentId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const capture = () => {
    const main = document.querySelector('main'), results = document.querySelector('[data-testid="inline-parts"]');
    return { documentId, stamp: performance.now(), href: location.pathname + location.search + location.hash,
      historyLength: history.length, historyState: history.state, readyState: document.readyState,
      navigation: performance.getEntriesByType('navigation').map(entry => ({ type: entry.type, name: entry.name })),
      vehicle: document.querySelector('[data-testid="selected-context"]')?.textContent ?? null,
      results: results ? { busy: results.getAttribute('aria-busy'), rows: results.querySelectorAll('[data-part-id]').length, text: results.textContent?.slice(-250) } : null,
      recovery: document.querySelector('[data-testid="navigation-recovery"]')?.textContent ?? null,
      mainScroll: main ? { x: main.scrollLeft, y: main.scrollTop, height: main.scrollHeight } : null,
      focus: { id: document.activeElement?.id, href: document.activeElement?.getAttribute('href'), control: document.activeElement?.getAttribute('data-catalog-focus') } };
  };
  window.rp1Capture = capture;
  let count = 0;
  const emit = (event, extra = {}) => { if (count++ < 400) console.log('__RP1_DIAG__' + JSON.stringify({ event, ...extra, ...capture() })); };
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function(...args) { emit(`${method}:before`, { requestedUrl: args[2] ?? null }); const result = original.apply(this, args); emit(`${method}:after`); return result; };
  }
  for (const event of ['popstate', 'pageshow', 'pagehide', 'DOMContentLoaded']) addEventListener(event, e => {
    emit(event, { persisted: e.persisted ?? null });
    requestAnimationFrame(() => emit(`${event}:frame`));
  });
  addEventListener('DOMContentLoaded', () => {
    let previous = '';
    const observer = new MutationObserver(() => {
      const value = capture(); const fingerprint = JSON.stringify([value.href, value.vehicle, value.results?.busy, value.results?.rows, value.recovery]);
      if (fingerprint !== previous) { previous = fingerprint; emit('ui-change'); }
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-busy'] });
  });
});
const page = await context.newPage(); page.setDefaultTimeout(30_000); monitor.observe(page);
page.on('console', message => { if (message.text().startsWith('__RP1_DIAG__')) report.events.push(JSON.parse(message.text().slice(12))); });
page.on('framenavigated', frame => { if (frame === page.mainFrame()) report.events.push({ event: 'frame-navigation', url: frame.url() }); });
page.on('request', request => { const url = new URL(request.url()); if (url.pathname === '/api/catalog') report.requests.push({ ...Object.fromEntries(url.searchParams), documentUrl: page.url() }); });
const snapshot = async label => report.snapshots.push({ label, ...await page.evaluate(() => window.rp1Capture()) });
const accepted = async vehicle => {
  if (vehicle) {
    await run(() => expect(page.getByTestId('selected-context')).toContainText('Camry', { timeout: 30_000 }));
    await run(() => expect(page.getByTestId('inline-parts')).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 }));
    await run(() => expect(page.locator('[data-part-id]').first()).toBeVisible({ timeout: 30_000 }));
  } else {
    await run(() => expect(page.getByTestId('selected-context')).toHaveCount(0));
    await run(() => expect(page.getByTestId('inline-parts')).toHaveCount(0));
    await run(() => expect(page.getByTestId('catalog-context')).toContainText('All vehicles.', { timeout: 30_000 }));
  }
};
const step = async (label, action, href, vehicle) => {
  await snapshot(`${label}:before`); await run(action);
  await run(() => expect(page).toHaveURL(origin + href, { timeout: 30_000 }));
  await snapshot(`${label}:url`); await accepted(vehicle); await snapshot(`${label}:accepted`);
};
try {
  await run(() => page.goto(origin + scoped)); await accepted(true); await snapshot('initial:accepted');
  await step('Catalog', () => page.locator('header').getByRole('link', { name: 'Part Catalog', exact: true }).click(), '/?scope=all', false);
  await step('Back1', () => page.goBack(), scoped, true);
  await step('Forward', () => page.goForward(), '/?scope=all', false);
  await step('ReloadAll', () => native ? nativeReload(page, run, report, 'explicit-all') : page.reload(), '/?scope=all', false);
  await step('BackAfterReload', () => page.goBack(), scoped, true);
  report.result = 'passed';
  await run(() => page.screenshot({ path: `${output}/final.png` }));
} catch (error) {
  report.result = 'failed'; report.error = error.message;
  if (!page.isClosed()) { await snapshot('failure'); await page.screenshot({ path: `${output}/failure.png` }); }
  throw error;
} finally {
  await writeFile(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  await browser.close(); await server.close(); console.log(`RP1 diagnostic: ${output}/report.json`);
}
