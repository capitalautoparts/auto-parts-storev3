// VM511 only, after a Vite build. Real ERP staging; no response interception.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { firefox } from '@playwright/test';
import { preview } from 'vite';
import { createProductSmokeMonitor } from './product-links-monitor.mjs';

const output = process.env.ROYS_LINKS_OUTPUT || '/tmp/roys-product-links';
await mkdir(output, { recursive: true });
const server = process.env.ROYS_LINKS_BASE_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 }, configFile: 'vite.config.ts' });
const origin = process.env.ROYS_LINKS_BASE_URL?.replace(/\/+$/, '') || server.resolvedUrls.local[0].replace(/\/+$/, '');
const browser = await firefox.launch();
const report = { recordedEastern: new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', timeZoneName: 'short' }), origin, cases: [], apiResponses: [], pageErrors: [], screenshots: [] };
const monitor = createProductSmokeMonitor(report);
const run = action => monitor.run(action);
const assertSchema = async (page, sku) => {
  await run(() => page.waitForFunction(expected => {
    const nodes = document.querySelectorAll('#product-schema');
    if (!expected) return nodes.length === 0;
    try { return nodes.length === 1 && JSON.parse(nodes[0].textContent).sku === expected; } catch { return false; }
  }, sku));
  if (sku) assert.doesNotMatch(await run(() => page.locator('#product-schema').textContent()), /"offers"|"price"/);
};
try {
  const context = await run(() => browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: 'RoysAuto-Product-Links-Firefox-Smoke/1.0 (+Autrex; staging read-only)' }));
  const page = await run(() => context.newPage()); monitor.observe(page); page.setDefaultTimeout(45_000);
  const productUrl = `${origin}/products/DVNJ_ALD1212M`;
  const response = await run(() => page.goto(productUrl));
  assert.equal(response.status(), 200);
  const dialog = page.getByRole('dialog');
  await run(() => dialog.getByText('AGNA Brakes ALD1212M', { exact: true }).waitFor());
  await assertSchema(page, 'DVNJ_ALD1212M');
  assert.match(await page.title(), /ALD1212M/);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), '/products/DVNJ_ALD1212M');
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
  assert.match(await dialog.textContent(), /\$28\.00/);
  const detailResponse = report.apiResponses.filter(row => row.resource === 'product');
  assert.ok(detailResponse.length > 0, 'Direct entry requests the product independently of search or cache');
  assert.equal(report.apiResponses.filter(row => row.resource === 'search').length, 0);
  await run(() => dialog.getByRole('tab', { name: 'Fitments', exact: true }).click());
  await run(() => dialog.getByText(/57 supplied applications · Page 1/).waitFor());
  assert.match(await dialog.textContent(), /Toyota/);
  await run(() => dialog.getByRole('button', { name: 'Next fitments', exact: true }).click());
  await run(() => dialog.getByText(/57 supplied applications · Page 2/).waitFor());
  await run(() => page.screenshot({ path: `${output}/desktop-product-1440.png` })); report.screenshots.push('desktop-product-1440.png');
  await run(() => page.reload());
  await run(() => page.getByRole('dialog').getByText('AGNA Brakes ALD1212M', { exact: true }).waitFor());
  await assertSchema(page, 'DVNJ_ALD1212M');
  report.cases.push('Direct URL in empty browser, independent SKU fetch, refresh and paginated real ERP fitments');
  await run(() => page.keyboard.press('Escape'));
  await run(() => page.waitForURL(`${origin}/`));
  const search = page.getByRole('combobox', { name: 'Search by vehicle or part number' });
  await run(() => search.fill('ALD1212M')); await run(() => search.press('Enter'));
  const row = page.locator('[data-part-id="DVNJ_ALD1212M"]');
  await run(() => row.waitFor());
  const link = row.getByRole('link', { name: 'Details', exact: true });
  assert.equal(await link.getAttribute('href'), '/products/DVNJ_ALD1212M');
  await run(() => link.click());
  await run(() => page.waitForURL(productUrl));
  await run(() => page.getByRole('dialog').getByText('AGNA Brakes ALD1212M', { exact: true }).waitFor());
  await assertSchema(page, 'DVNJ_ALD1212M');
  await run(() => page.goBack()); await run(() => page.waitForURL(`${origin}/`));
  await run(() => page.getByRole('dialog').waitFor({ state: 'detached' }));
  await assertSchema(page, null);
  await run(() => row.waitFor());
  assert.equal(await search.inputValue(), 'ALD1212M');
  await run(() => page.goForward()); await run(() => page.waitForURL(productUrl));
  await run(() => page.getByRole('dialog').getByText('AGNA Brakes ALD1212M', { exact: true }).waitFor());
  await assertSchema(page, 'DVNJ_ALD1212M');
  await run(() => page.keyboard.press('Escape')); await run(() => page.waitForURL(`${origin}/`)); await run(() => row.waitFor());
  report.cases.push('Real anchor preserves in-page results across open, Back, Forward and close');
  // A separate context demonstrates that the href needs no source-tab state.
  const fresh = await run(() => browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'RoysAuto-Product-Links-Firefox-Smoke/1.0 (+Autrex; staging read-only)' }));
  const mobile = await run(() => fresh.newPage()); monitor.observe(mobile); mobile.setDefaultTimeout(45_000);
  await run(() => mobile.goto(productUrl));
  await run(() => mobile.getByRole('dialog').getByText('AGNA Brakes ALD1212M', { exact: true }).waitFor());
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await run(() => mobile.screenshot({ path: `${output}/mobile-product-390.png` })); report.screenshots.push('mobile-product-390.png');
  await run(() => mobile.reload()); await run(() => mobile.getByRole('dialog').getByText('AGNA Brakes ALD1212M', { exact: true }).waitFor());
  report.cases.push('Fresh mobile direct link and refresh at 390px without page overflow');
  const missing = await run(() => mobile.goto(`${origin}/products/ZZZZ_ROYS_MISSING_PRODUCT`));
  assert.equal(missing.status(), 404);
  await run(() => mobile.getByRole('alert').getByText('Product not found.', { exact: true }).waitFor());
  await assertSchema(mobile, null);
  report.cases.push('Missing product is an HTTP 404 and a recoverable in-page error');
  const hostile = await run(() => mobile.goto(`${origin}/products/DVNJ_ALD1212M%2fetc`));
  assert.equal(hostile.status(), 400);
  await run(() => mobile.getByRole('dialog').getByText('Invalid product link', { exact: true }).waitFor());
  report.cases.push('Hostile path is rejected before an ERP product read');
  // Inspect response HTML with JS disabled rather than treating dynamic title as SEO.
  const crawler = await run(() => browser.newContext({ javaScriptEnabled: false, userAgent: 'RoysAuto-Product-HTML-Smoke/1.0 (+Autrex; staging read-only)' }));
  const documentPage = await run(() => crawler.newPage()); monitor.observe(documentPage);
  await run(() => documentPage.goto(productUrl));
  await run(() => documentPage.getByRole('heading', { level: 1, name: 'AGNA Brakes Disc Brake Pad Set', exact: true }).waitFor());
  assert.match(await documentPage.locator('#product-document').textContent(), /ERP SKU: DVNJ_ALD1212M/);
  assert.doesNotMatch(await documentPage.locator('#product-schema').textContent(), /"offers"|"price"/);
  report.cases.push('HTTP HTML contains real product identity, description, canonical and noindex without JavaScript; no price metadata');
  assert.deepEqual(report.pageErrors, []);
  await run(() => fresh.close()); await run(() => crawler.close()); await run(() => context.close());
} catch (error) {
  report.failure = error.message;
  throw error;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close(); if (server) await new Promise(resolve => server.httpServer.close(resolve));
  console.log(JSON.stringify(report, null, 2));
}
