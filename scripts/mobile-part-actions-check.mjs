// WP-ROYS-MOBILE-ACTIONS1 aa064791. Bounded integrated Firefox check on VM511.
// Real fixed staging gateway; shared stop-on-first-refusal monitor; local lists only.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { firefox, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createProductSmokeMonitor } from './product-links-monitor.mjs';

const mode = process.argv[2];
assert.ok(['baseline', 'candidate'].includes(mode), 'Use baseline or candidate');
assert.equal(process.env.ROYS_ONPREM, '1');
assert.equal(process.env.ROYS_CATALOG_PREVIEW_ENABLED, 'true');
const output = process.env.ROYS_ACTIONS_OUTPUT || `/tmp/roys-mobile-actions-aa064791/${mode}`;
await mkdir(output, { recursive: true });
const report = { task: 'WP-ROYS-MOBILE-ACTIONS1 aa064791', mode,
  recordedEastern: new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', timeZoneName: 'short' }),
  cases: [], layouts: [], apiResponses: [], pageErrors: [], screenshots: [] };
const monitor = createProductSmokeMonitor(report);
const run = action => monitor.run(action);
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const browser = await firefox.launch();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  monitor.observe(page); page.setDefaultTimeout(30_000);
  await run(() => page.goto(server.resolvedUrls.local[0]));
  const open = async control => {
    await run(() => control.waitFor());
    if (await control.getAttribute('aria-expanded') !== 'true') await run(() => control.click());
  };
  const year = page.locator('#vehicle-year-2020'); await open(year);
  const make = year.locator('..').getByRole('button', { name: 'Toyota', exact: true }); await open(make);
  const model = make.locator('..').getByRole('button', { name: 'Camry', exact: true }); await open(model);
  const engine = model.locator('..').locator('button[id^="vehicle-engine-"]').filter({ hasText: '2.5L 4-Cyl L' });
  await run(() => engine.click());
  const engineId = await engine.getAttribute('id');
  const branch = page.locator(`#${engineId.replace('vehicle-engine-', 'vehicle-categories-')}`);
  await open(branch.getByRole('button', { name: 'Brakes', exact: true }));
  await run(() => branch.getByRole('button', { name: 'Brake Pad', exact: true }).click());
  const row = page.locator('[data-part-id="FLPW_BCD2076"]');
  await run(() => expect(row).toBeVisible());
  const add = row.getByRole('button', { name: 'Add', exact: true });
  const wish = row.getByTitle('Add to wishlist', { exact: true });
  const details = row.getByRole('link', { name: 'Details', exact: true });
  const listKeys = ['roysauto.original-cart.v1', 'roysauto.original-wishlist.v1'];
  const lists = () => run(() => page.evaluate(keys => keys.map(k => localStorage.getItem(k)), listKeys));
  const shot = async name => {
    await run(() => page.screenshot({ path: `${output}/${name}.png` })); report.screenshots.push(`${name}.png`);
  };
  const measure = async width => {
    await run(() => page.setViewportSize({ width, height: width < 768 ? 844 : 900 }));
    await run(() => row.scrollIntoViewIfNeeded());
    return run(() => row.evaluate(element => {
      const targets = [element.querySelector('button'), element.querySelector('button[title]'),
        [...element.querySelectorAll('a')].find(a => a.textContent.trim() === 'Details')];
      const actions = targets.map(target => {
        const r = target.getBoundingClientRect();
        const x = r.x + r.width / 2, y = r.y + r.height / 2;
        const hit = document.elementFromPoint(x, y)?.closest('button,a');
        return { label: target.textContent.trim() || target.title, x: r.x, y: r.y, width: r.width, height: r.height,
          hit: hit?.textContent.trim() || hit?.title, receivesPointer: hit === target,
          cssWidth: getComputedStyle(target).width, flexShrink: getComputedStyle(target).flexShrink };
      });
      const overlaps = actions.flatMap((a, i) => actions.slice(i + 1).flatMap(b =>
        Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x)
        && Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y) ? [[a.label, b.label]] : []));
      return { width: innerWidth, actions, overlaps,
        overflow: [...document.querySelectorAll('html,body,[data-testid="parts-table"], [data-testid="parts-table"] div')]
          .filter(e => e.scrollWidth > e.clientWidth + 1).map(e => ({ tag: e.tagName, class: e.className, client: e.clientWidth, scroll: e.scrollWidth })) };
    }));
  };
  for (const width of mode === 'baseline' ? [390] : [390, 320, 600, 1440]) {
    const layout = await measure(width); report.layouts.push(layout);
    await shot(`${width}-actions`);
    if (mode === 'baseline') {
      assert.ok(layout.overlaps.length > 0, 'Baseline must demonstrate overlap');
      assert.equal(layout.actions[0].receivesPointer, false);
      assert.equal(layout.actions[0].hit, 'Details');
      report.cases.push('390: Add center hits Details; measured overlap reproduces original failure without forced clicks');
      continue;
    }
    assert.deepEqual(layout.overlaps, [], `${width}: actions overlap`);
    assert.deepEqual(layout.overflow, [], `${width}: horizontal overflow`);
    for (const action of layout.actions) {
      assert.ok(action.receivesPointer, `${width}: ${action.label} center intercepted`);
      assert.ok(action.x >= 0 && action.x + action.width <= width, 'Action must fit viewport');
    }
    await run(() => expect(add).toBeEnabled());
    const before = await lists();
    const previousQuantity = JSON.parse(before[0] || '{"items":[]}').items.find(item => item.partId === 'FLPW_BCD2076')?.quantity || 0;
    await run(() => width < 768 ? add.tap() : add.click());
    await run(() => page.waitForFunction(({ key, quantity }) => JSON.parse(localStorage.getItem(key))?.items?.some(item =>
      item.partId === 'FLPW_BCD2076' && item.quantity === quantity), { key: listKeys[0], quantity: previousQuantity + 1 }));
    const afterAdd = await lists();
    assert.equal(afterAdd[1], before[1], 'Add leaves wishlist unchanged');
    assert.equal(new URL(page.url()).pathname, '/', 'Add must not open Details');
    await run(() => width < 768 ? wish.tap() : wish.click());
    await run(() => expect(row.getByTitle('Remove from wishlist', { exact: true })).toBeVisible());
    const afterWish = await lists();
    assert.equal(afterWish[0], afterAdd[0], 'Wishlist leaves cart unchanged');
    assert.equal(JSON.parse(afterWish[1]).filter(item => item.partId === 'FLPW_BCD2076').length, 1);
    assert.equal(new URL(page.url()).pathname, '/', 'Wishlist must not open Details');
    await run(() => expect(details).toHaveAttribute('href', '/products/FLPW_BCD2076'));
    await run(() => width < 768 ? details.tap() : details.click());
    const dialog = page.getByRole('dialog');
    await run(() => expect(dialog.getByRole('heading', { name: 'Bremsen BCD2076', exact: true })).toBeVisible());
    assert.equal(new URL(page.url()).pathname, '/products/FLPW_BCD2076');
    assert.deepEqual(await lists(), afterWish, 'Details leaves both lists unchanged');
    await shot(`${width}-details`);
    await run(() => dialog.getByRole('button', { name: 'Close', exact: true }).click());
    await run(() => expect(dialog).toHaveCount(0));
    await run(() => row.getByTitle('Remove from wishlist', { exact: true }).click());
    await run(() => expect(wish).toBeVisible());
    report.cases.push(`${width}: separate hit targets; unforced ${width < 768 ? 'tap' : 'click'} adds exactly one, wishlist independent, Details same SKU/href, no other action/overflow`);
  }
  assert.deepEqual(report.pageErrors, []);
  report.result = 'passed';
  await context.close();
} catch (error) {
  report.result = 'failed'; report.failure = String(error.stack || error); throw error;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close(); await server.close();
}
