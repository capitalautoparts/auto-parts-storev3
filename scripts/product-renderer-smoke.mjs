// VM511 only, after npm run build. Real direct-product rendering is checked
// separately from deliberate document/asset faults. No cart/list writes.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { firefox } from '@playwright/test';
import { createProductSmokeMonitor } from './product-links-monitor.mjs';

assert.equal(process.env.ROYS_ONPREM, '1', 'Use the fixed on-prem staging target');
assert.equal(process.env.ROYS_CATALOG_PREVIEW_ENABLED, 'true', 'Explicit staging preview flag required');
assert.notEqual(process.env.VERCEL, '1', 'On-prem checks cannot run as Vercel');
const output = process.env.ROYS_RENDERER_OUTPUT || `/tmp/roys-product-renderer-${Date.now()}`;
const sku = process.env.ROYS_RENDERER_SKU || 'DVNJ_ALD1212M';
const path = `/products/${encodeURIComponent(sku)}`;
const entryOnly = process.env.ROYS_RENDERER_SCOPE === 'entry-navigation';
const report = { sku, scope: entryOnly ? 'entry-navigation' : 'full', apiResponses: [], pageErrors: [], phaseErrors: [], requestFailures: [], cases: [], screenshots: [] };
const monitor = createProductSmokeMonitor(report);
let phase = 'setup';
const observe = page => {
  monitor.observe(page);
  page.on('pageerror', error => report.phaseErrors.push({ phase, message: error.message }));
  page.on('requestfailed', request => report.requestFailures.push({ phase, path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
};
await mkdir(output, { recursive: true });
const reservation = createServer().listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const { preview } = await import('vite');
const server = await preview({ preview: { host: '127.0.0.1', port, strictPort: true } });
const origin = `http://127.0.0.1:${port}`;
let browser, activePage;
try {
  browser = await firefox.launch({ headless: true });
  let serverHeading;
  if (!entryOnly) {
  phase = 'no-js';
  const crawler = await browser.newContext({ javaScriptEnabled: false });
  const nojs = await crawler.newPage(); observe(nojs);
  const response = await monitor.run(() => nojs.goto(origin + path));
  assert.equal(response.status(), 200);
  serverHeading = await nojs.locator('#product-document h1').innerText();
  assert.ok(serverHeading.length > 0);
  assert.match(await nojs.locator('#product-document').innerText(), new RegExp(sku));
  assert.equal(await nojs.locator('#product-schema').count(), 1);
  report.cases.push('Useful no-JS product document and one identity schema');
  await crawler.close();
  }

  for (const width of [1440, 390]) {
    phase = `entry-${width}`;
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } });
    const page = await context.newPage(); activePage = page; observe(page);
    const errors = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const requests = [];
    page.on('request', request => { const url = new URL(request.url()); if (url.pathname === '/api/catalog') requests.push(url.searchParams.get('resource')); });
    const direct = await monitor.run(() => page.goto(origin + path));
    assert.equal(direct.status(), 200);
    const details = page.getByRole('button', { name: 'Additional product details', exact: true });
    await monitor.run(() => details.waitFor());
    serverHeading ??= await page.locator('#product-document h1').innerText();
    assert.equal(await page.locator('#product-document h1').innerText(), serverHeading);
    assert.equal(requests.filter(resource => resource === 'product').length, 0, 'Hydration must not refetch the verified product');
    assert.equal(await page.locator('#product-schema').count(), 1);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), path);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Direct document must fit the viewport');
    if (await page.locator('#product-document img').count()) {
      await page.waitForFunction(() => { const image = document.querySelector('#product-document img'); return image?.complete && image.naturalWidth > 0; });
      const image = await page.locator('#product-document img').evaluate(node => ({ width: node.naturalWidth, src: node.currentSrc }));
      assert.ok(image.width > 0 && image.src.startsWith('https://'));
    }
    const screenshot = `${output}/product-${width}.png`;
    await page.screenshot({ path: screenshot, fullPage: true }); report.screenshots.push(screenshot);
    if (!entryOnly) {
    phase = `details-${width}`;
    await monitor.run(() => details.click());
    await monitor.run(() => page.getByRole('dialog').waitFor());
    assert.equal(requests.filter(resource => resource === 'product').length, 1, 'Only explicit details action loads additional product data');
    await page.getByRole('tab', { name: /Fitments/ }).click();
    await monitor.run(() => page.getByText(/supplied applications · Page 1/).waitFor());
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement?.textContent === 'Additional product details');
    assert.equal(new URL(page.url()).pathname, path);
    assert.equal(await page.locator('#product-schema').count(), 1);
    assert.equal(await page.locator('#product-document h1').innerText(), serverHeading);
    }
    assert.deepEqual(errors, [], 'No hydration/React errors');
    report.cases.push(`${width}: verified client identity, no initial refetch, fits viewport${entryOnly ? '' : ', optional detail modal and Escape/focus restoration'}`);
    if (width === 1440) {
      phase = 'native-modified-browse';
      const popupPromise = context.waitForEvent('page');
      await page.getByRole('link', { name: 'Browse the catalog', exact: true }).click({ modifiers: ['Control'] });
      const popup = await popupPromise; observe(popup);
      await monitor.run(() => popup.locator('#root header').waitFor()); assert.equal(new URL(popup.url()).pathname, '/'); await popup.close();
      phase = 'native-browse-back-forward';
      await monitor.run(() => page.getByRole('link', { name: 'Browse the catalog', exact: true }).click());
      await page.waitForURL(origin + '/');
      await monitor.run(() => page.locator('#root header').waitFor());
      await monitor.run(() => page.goBack()); await monitor.run(() => page.locator('#product-document h1').waitFor());
      assert.equal(await page.locator('#product-document h1').innerText(), serverHeading);
      await monitor.run(() => page.goForward()); await page.waitForURL(origin + '/');
      await monitor.run(() => page.locator('#root header').waitFor());
      report.cases.push('Native modified Browse link and document Back/Forward preserve the actual destination');
      phase = 'fast-navigation-close';
      const fast = await context.newPage(); observe(fast);
      await monitor.run(() => fast.goto(origin + path));
      await monitor.run(() => fast.getByRole('button', { name: 'Additional product details', exact: true }).waitFor());
      await monitor.run(() => fast.goto(origin + '/', { waitUntil: 'commit' }));
      await monitor.run(() => fast.goBack());
      await monitor.run(() => fast.locator('#product-document h1').waitFor());
      assert.equal(await fast.locator('#product-document h1').innerText(), serverHeading);
      await monitor.run(() => fast.goto(origin + '/', { waitUntil: 'commit' }));
      await fast.close();
      report.cases.push('Fast root navigation/Back and close after commit retain identity without uncaught entry errors; request failures recorded by phase');
    }
    await context.close();
  }

  if (!entryOnly) {
  phase = 'disposable-lists';
  const lists = await browser.newContext();
  const listPage = await lists.newPage(); activePage = listPage; observe(listPage);
  await monitor.run(() => listPage.goto(origin + path));
  const add = listPage.getByRole('button', { name: 'Add to test cart', exact: true });
  await add.waitFor(); assert.equal(await add.isEnabled(), true, 'Sample must have current price and be purchasable');
  await add.click();
  await listPage.getByRole('status').filter({ hasText: 'Added to test cart.' }).waitFor();
  const cart = await listPage.evaluate(() => JSON.parse(localStorage.getItem('roysauto.original-cart.v1')));
  assert.equal(cart.items.length, 1); assert.equal(cart.items[0].partId, sku); assert.equal(cart.items[0].quantity, 1);
  await listPage.getByRole('button', { name: 'Add to wishlist', exact: true }).click();
  await listPage.getByRole('button', { name: 'Remove from wishlist', exact: true }).waitFor();
  await listPage.waitForFunction(() => JSON.parse(localStorage.getItem('roysauto.original-wishlist.v1'))?.length === 1);
  const saved = await listPage.evaluate(() => ({ cart: JSON.parse(localStorage.getItem('roysauto.original-cart.v1')), wishlist: JSON.parse(localStorage.getItem('roysauto.original-wishlist.v1')) }));
  assert.equal(saved.wishlist[0].partId, sku); assert.equal(saved.cart.items[0].quantity, 1);
  report.cases.push('Disposable context: direct Add exactly +1 and independent wishlist preserve existing list schemas');
  await lists.close();

  // Fault-only contexts do not supply visual proof or replace the real journey.
  for (const fault of ['malformed', 'missing', 'mismatched', 'script-error']) {
    phase = `fault-${fault}`;
    const context = await browser.newContext();
    const page = await context.newPage(); activePage = page;
    // Intentional asset abort may log a console error; document refusal monitoring
    // still applies to every context, including this isolated fault case.
    observe(page);
    if (fault === 'script-error') await page.route('**/assets/*.js', route => route.abort());
    else await page.route(`**${path}`, async route => {
      const response = await route.fetch();
      let html = await response.text();
      if (fault === 'missing') html = html.replace(/<script id="product-bootstrap"[^]*?<\/script>/, '');
      else html = html.replace(/(<script id="product-bootstrap" type="application\/json">)[^]*?(<\/script>)/,
        (_, start, end) => start + (fault === 'malformed' ? '{bad json' : '{"version":1,"path":"/products/ABCD_OTHER","status":404,"title":"No","message":"No"}') + end);
      await route.fulfill({ response, body: html });
    });
    await monitor.run(() => page.goto(origin + path));
    assert.equal(await page.locator('#product-document h1').innerText(), serverHeading);
    if (fault !== 'script-error') await page.getByText('Interactive product controls are unavailable.', { exact: false }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Browse the catalog', exact: true }).count(), 1);
    report.cases.push(`${fault}: verified article/native recovery retained`);
    await context.close();
  }
  }
  assert.deepEqual(report.pageErrors, []);
} catch (error) {
  report.failure = error.stack || String(error);
  if (activePage && !activePage.isClosed()) {
    const screenshot = `${output}/failure.png`;
    await activePage.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
    report.screenshots.push(screenshot);
  }
  throw error;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
