// WP-ROYS-MOBILE-CART-LAYOUT1 aa064791. Bounded integrated Firefox check on VM511.
// Real fixed staging gateway; shared stop-on-first-refusal monitor; local lists only.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { firefox, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createProductSmokeMonitor } from './product-links-monitor.mjs';

const mode = process.argv[2];
assert.ok(['baseline', 'candidate'].includes(mode), 'Use baseline or candidate');
// Bounded continuations reuse successful groups recorded with this task's evidence.
const resume = process.env.ROYS_ACTIONS_RESUME;
assert.ok(!resume || (mode === 'candidate' && ['390-final-row', '900-layouts'].includes(resume)));
assert.ok(!process.env.ROYS_ACTIONS_SKIP_PASSED_390 || process.env.ROYS_ACTIONS_SKIP_PASSED_390 === '0',
  'Legacy skip flag is unsupported; hosted acceptance must run all groups');
assert.equal(process.env.ROYS_ONPREM, '1');
assert.equal(process.env.ROYS_CATALOG_PREVIEW_ENABLED, 'true');
assert.notEqual(process.env.VERCEL, '1', 'On-prem checks must not use Vercel');
const suppliedBase = process.env.ROYS_ACTIONS_BASE_URL;
assert.ok(!suppliedBase || !resume, 'Hosted/base URL acceptance must use default full candidate mode');
let hostedBase;
if (suppliedBase) {
  const url = new URL(suppliedBase);
  const staging = ['http://192.168.88.250', 'https://roys-staging.autrex.ca'].includes(url.origin);
  const local = url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
  assert.ok(staging || local, 'Base URL must be the known staging origin or HTTP localhost');
  assert.ok(!url.username && !url.password && url.pathname === '/' && !url.search && !url.hash,
    'Base URL must contain only an allowed origin');
  hostedBase = url.origin;
}
const output = process.env.ROYS_ACTIONS_OUTPUT || `/tmp/roys-mobile-actions-aa064791/${mode}`;
await mkdir(output, { recursive: true });
const report = { task: 'WP-ROYS-MOBILE-CART-LAYOUT1 aa064791', mode,
  runtime: { mode: hostedBase ? 'hosted-base-url' : 'vite-source-fixed-lan' },
  continuation: resume || null,
  recordedEastern: new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', timeZoneName: 'short' }),
  cases: [], layouts: [], apiResponses: [], pageErrors: [], screenshots: [] };
const monitor = createProductSmokeMonitor(report);
const run = action => monitor.run(action);
const server = hostedBase ? null : await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server?.listen();
const origin = hostedBase || new URL(server.resolvedUrls.local[0]).origin;
report.runtime.origin = origin;
const browser = await firefox.launch();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  monitor.observe(page); page.setDefaultTimeout(30_000);
  await run(() => page.goto(origin));
  assert.equal(new URL(page.url()).origin, origin, 'No redirect to another origin');
  const shot = async name => {
    await run(() => page.screenshot({ path: `${output}/${name}.png` })); report.screenshots.push(`${name}.png`);
  };
  const cartTrigger = page.getByRole('button', { name: 'Open Quick Cart', exact: true });
  const checkCart = async empty => {
    await run(() => expect(cartTrigger).toHaveCount(1));
    await run(() => expect(cartTrigger).toContainText(empty ? '0 saved' : '1 saved'));
    await run(() => cartTrigger.tap());
    const dialog = page.getByRole('dialog');
    await run(() => expect(dialog).toBeVisible());
    await run(() => expect(dialog).toHaveAccessibleName('Quick Cart'));
    if (empty) await run(() => expect(dialog.getByText('Your cart is empty', { exact: true })).toBeVisible());
    else await run(() => expect(dialog.getByRole('button', { name: 'Checkout disabled for testing', exact: true })).toBeDisabled());
    await shot(`390-cart-${empty ? 'empty' : 'populated'}`);
    await run(() => page.keyboard.press('Escape'));
    await run(() => expect(dialog).toHaveCount(0));
    await run(() => expect(cartTrigger).toBeFocused());
    report.cases.push(`390: ${empty ? 'empty' : 'populated'} Quick Cart reachable, Escape returns focus to its trigger`);
  };
  if (mode === 'candidate' && !resume) await checkCart(true);
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
  const measure = async (targetRow, position) => {
    // Existing success toasts can briefly cover results independently of the cart.
    // Let them expire normally; do not hide them or change their pointer behavior.
    await run(() => expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 10_000 }));
    await run(() => targetRow.scrollIntoViewIfNeeded());
    if (mode === 'candidate') await run(() => targetRow.evaluate((element, position) => {
      const main = element.closest('main');
      const actions = [...element.querySelectorAll('button,a')].filter(e => e.matches('button') || e.textContent.trim() === 'Details');
      const bottom = Math.max(...actions.map(e => e.getBoundingClientRect().bottom));
      // Move real content through its own scroller; never reposition controls or force clicks.
      // The results end before the rest of the vehicle tree; align the row,
      // not the end of the entire main scroller.
      main.scrollTop += bottom - (main.getBoundingClientRect().bottom - 8);
      return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, position));
    return run(() => targetRow.evaluate((element, position) => {
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
      const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
      const main = element.closest('main');
      const strip = document.querySelector('[data-testid="mobile-cart-strip"]');
      return { width: innerWidth, position, sku: element.dataset.partId, actions, overlaps,
        main: rect(main), strip: strip && getComputedStyle(strip).display !== 'none' ? rect(strip) : null,
        scrollTop: main.scrollTop,
        overflow: [...document.querySelectorAll('html,body,[data-testid="parts-table"], [data-testid="parts-table"] div')]
          .filter(e => e.scrollWidth > e.clientWidth + 1).map(e => ({ tag: e.tagName, class: e.className, client: e.clientWidth, scroll: e.scrollWidth })) };
    }, position));
  };
  const assertLayout = layout => {
    const { width } = layout;
    assert.deepEqual(layout.overlaps, [], `${width}: actions overlap`);
    assert.deepEqual(layout.overflow, [], `${width}: horizontal overflow`);
    assert.ok(layout.main.height > 0, `${width}: main viewport collapsed`);
    if (width < 1024) {
      assert.ok(layout.strip, `${width}: cart strip visible`);
      assert.ok(layout.main.bottom <= layout.strip.y, `${width}: cart strip intersects main viewport`);
      assert.ok(layout.strip.bottom <= page.viewportSize().height, `${width}: strip fits viewport`);
    } else assert.equal(layout.strip, null, 'Desktop has no mobile strip');
    for (const action of layout.actions) {
      assert.ok(action.receivesPointer, `${width} ${layout.position}: ${action.label} center intercepted`);
      assert.ok(action.x >= 0 && action.x + action.width <= width, 'Action must fit viewport');
      assert.ok(action.y >= layout.main.y && action.y + action.height <= layout.main.bottom,
        `${width} ${layout.position}: ${action.label} fits actual main viewport`);
    }
  };
  const measureOtherRows = async width => {
    const rows = page.locator('[data-testid="parts-table"] [data-part-id]');
    const count = await rows.count();
    assert.ok(count > 2, 'Real mid-list and final rows are available');
    for (const [position, targetRow] of [['mid-list-at-bottom', rows.nth(Math.floor(count / 2))], ['final-row', rows.last()]]) {
      const layout = await measure(targetRow, position); report.layouts.push(layout);
      await shot(`${width}-${position}`); assertLayout(layout);
    }
  };
  const widths = mode === 'baseline' ? [390] : resume === '900-layouts' ? [900, 1023, 1440] : [390, 320, 600, 900, 1023, 1440];
  for (const width of widths) {
    await run(() => page.setViewportSize({ width, height: width < 768 ? 844 : 900 }));
    await run(() => expect(page.getByTestId('selected-context')).toContainText('Current vehicle'));
    if (resume === '390-final-row' && width === 390) {
      const layout = await measure(page.locator('[data-testid="parts-table"] [data-part-id]').last(), 'final-row');
      report.layouts.push(layout); await shot('390-final-row'); assertLayout(layout);
      report.cases.push('390: remaining final-row geometry passed; prior successful groups reused');
      continue;
    }
    if (resume === '900-layouts' && width === 900) {
      await measureOtherRows(width);
      report.cases.push('900: remaining mid-list/final-row geometry passed; prior successful action group reused');
      continue;
    }
    const layout = await measure(row, 'sku-at-bottom'); report.layouts.push(layout);
    await shot(`${width}-actions`);
    if (mode === 'baseline') {
      assert.ok(layout.overlaps.length > 0, 'Baseline must demonstrate overlap');
      assert.equal(layout.actions[0].receivesPointer, false);
      assert.equal(layout.actions[0].hit, 'Details');
      report.cases.push('390: Add center hits Details; measured overlap reproduces original failure without forced clicks');
      continue;
    }
    assertLayout(layout);
    await run(() => expect(add).toBeEnabled());
    const before = await lists();
    const previousQuantity = JSON.parse(before[0] || '{"items":[]}').items.find(item => item.partId === 'FLPW_BCD2076')?.quantity || 0;
    await run(() => width < 768 ? add.tap() : add.click());
    await run(() => page.waitForFunction(({ key, quantity }) => JSON.parse(localStorage.getItem(key))?.items?.some(item =>
      item.partId === 'FLPW_BCD2076' && item.quantity === quantity), { key: listKeys[0], quantity: previousQuantity + 1 }));
    const afterAdd = await lists();
    const addedItems = JSON.parse(afterAdd[0]).items;
    assert.equal(addedItems.find(item => item.partId === 'FLPW_BCD2076').quantity, previousQuantity + 1);
    assert.deepEqual(addedItems.filter(item => item.partId !== 'FLPW_BCD2076'),
      JSON.parse(before[0] || '{"items":[]}').items.filter(item => item.partId !== 'FLPW_BCD2076'), 'Other cart lines unchanged');
    assert.equal(afterAdd[1], before[1], 'Add leaves wishlist unchanged');
    assert.equal(new URL(page.url()).pathname, '/', 'Add must not open Details');
    if (width === 390) {
      await checkCart(false);
      assert.deepEqual(await lists(), afterAdd, 'Opening/closing cart leaves lists unchanged');
    }
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
    await measureOtherRows(width);
    report.cases.push(`${width}: separate hit targets; unforced ${width < 768 ? 'tap' : 'click'} adds exactly one, wishlist independent, Details same SKU/href, no other action/overflow`);
  }
  assert.deepEqual(report.pageErrors, []);
  report.result = 'passed';
  await context.close();
} catch (error) {
  report.result = 'failed'; report.failure = String(error.stack || error); throw error;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close(); await server?.close();
}
