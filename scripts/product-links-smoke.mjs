// VM511 only, after a Vite build. Real ERP staging; no response interception.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { firefox } from '@playwright/test';
import { preview } from 'vite';

const output = process.env.ROYS_LINKS_OUTPUT || '/tmp/roys-product-links';
await mkdir(output, { recursive: true });
const server = process.env.ROYS_LINKS_BASE_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 }, configFile: 'vite.config.ts' });
const origin = process.env.ROYS_LINKS_BASE_URL?.replace(/\/+$/, '') || server.resolvedUrls.local[0].replace(/\/+$/, '');
const browser = await firefox.launch();
const report = { recordedEastern: new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', timeZoneName: 'short' }), origin, cases: [], apiResponses: [], pageErrors: [], screenshots: [] };
let blocked;
const stopIfBlocked = () => { if (blocked) throw new Error(`Staging route refused: ${blocked}. Stopped without retrying.`); };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: 'RoysAuto-Product-Links-Firefox-Smoke/1.0 (+Autrex; staging read-only)' });
  const observe = page => {
    page.on('pageerror', error => report.pageErrors.push(error.message));
    page.on('response', async response => {
      const url = new URL(response.url());
      if (!url.pathname.startsWith('/api/')) return;
      assert.equal(url.pathname, '/api/catalog', 'No checkout, account or order calls');
      const body = await response.json().catch(() => null);
      report.apiResponses.push({ resource: url.searchParams.get('resource'), status: response.status() });
      if (body?.reference || response.status() === 403) {
        blocked = body?.reference || response.headers()['cf-ray'] || '403 without a Ray/reference';
        await context.close();
      }
    });
  };
  const page = await context.newPage(); observe(page); page.setDefaultTimeout(45_000);
  const productUrl = `${origin}/products/DVNJ_ALD1212M`;
  const response = await page.goto(productUrl); stopIfBlocked();
  assert.equal(response.status(), 200);
  const dialog = page.getByRole('dialog');
  await dialog.getByText('AGNA Brakes ALD1212M', { exact: true }).waitFor();
  assert.match(await page.title(), /ALD1212M/);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), '/products/DVNJ_ALD1212M');
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
  assert.match(await dialog.textContent(), /\$28\.00/);
  const detailResponse = report.apiResponses.filter(row => row.resource === 'product');
  assert.ok(detailResponse.length > 0, 'Direct entry requests the product independently of search or cache');
  assert.equal(report.apiResponses.filter(row => row.resource === 'search').length, 0);
  await dialog.getByRole('tab', { name: 'Fitments', exact: true }).click();
  await dialog.getByText(/57 supplied applications · Page 1/).waitFor();
  assert.match(await dialog.textContent(), /Toyota/);
  await dialog.getByRole('button', { name: 'Next fitments', exact: true }).click();
  await dialog.getByText(/57 supplied applications · Page 2/).waitFor();
  await page.screenshot({ path: `${output}/desktop-product-1440.png` }); report.screenshots.push('desktop-product-1440.png');
  await page.reload(); stopIfBlocked();
  await page.getByRole('dialog').getByText('AGNA Brakes ALD1212M', { exact: true }).waitFor();
  report.cases.push('Direct URL in empty browser, independent SKU fetch, refresh and paginated real ERP fitments');
  await page.keyboard.press('Escape');
  await page.waitForURL(`${origin}/`);
  const search = page.getByRole('combobox', { name: 'Search by vehicle or part number' });
  await search.fill('ALD1212M'); await search.press('Enter');
  const row = page.locator('[data-part-id="DVNJ_ALD1212M"]');
  await row.waitFor();
  const link = row.getByRole('link', { name: 'Details', exact: true });
  assert.equal(await link.getAttribute('href'), '/products/DVNJ_ALD1212M');
  await link.click();
  await page.waitForURL(productUrl);
  await page.getByRole('dialog').getByText('AGNA Brakes ALD1212M', { exact: true }).waitFor();
  await page.goBack(); await page.waitForURL(`${origin}/`);
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await row.waitFor();
  assert.equal(await search.inputValue(), 'ALD1212M');
  await page.goForward(); await page.waitForURL(productUrl);
  await page.getByRole('dialog').getByText('AGNA Brakes ALD1212M', { exact: true }).waitFor();
  await page.keyboard.press('Escape'); await page.waitForURL(`${origin}/`); await row.waitFor();
  report.cases.push('Real anchor preserves in-page results across open, Back, Forward and close');
  // A separate context demonstrates that the href needs no source-tab state.
  const fresh = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'RoysAuto-Product-Links-Firefox-Smoke/1.0 (+Autrex; staging read-only)' });
  const mobile = await fresh.newPage(); observe(mobile); mobile.setDefaultTimeout(45_000);
  await mobile.goto(productUrl); stopIfBlocked();
  await mobile.getByRole('dialog').getByText('AGNA Brakes ALD1212M', { exact: true }).waitFor();
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await mobile.screenshot({ path: `${output}/mobile-product-390.png` }); report.screenshots.push('mobile-product-390.png');
  await mobile.reload(); await mobile.getByRole('dialog').getByText('AGNA Brakes ALD1212M', { exact: true }).waitFor();
  report.cases.push('Fresh mobile direct link and refresh at 390px without page overflow');
  const missing = await mobile.goto(`${origin}/products/ZZZZ_ROYS_MISSING_PRODUCT`); stopIfBlocked();
  assert.equal(missing.status(), 404);
  await mobile.getByRole('alert').getByText('Product not found.', { exact: true }).waitFor();
  report.cases.push('Missing product is an HTTP 404 and a recoverable in-page error');
  const hostile = await mobile.goto(`${origin}/products/DVNJ_ALD1212M%2fetc`); stopIfBlocked();
  assert.equal(hostile.status(), 400);
  await mobile.getByRole('dialog').getByText('Invalid product link', { exact: true }).waitFor();
  report.cases.push('Hostile path is rejected before an ERP product read');
  // Inspect response HTML with JS disabled rather than treating dynamic title as SEO.
  const crawler = await browser.newContext({ javaScriptEnabled: false, userAgent: 'RoysAuto-Product-HTML-Smoke/1.0 (+Autrex; staging read-only)' });
  const documentPage = await crawler.newPage(); observe(documentPage);
  await documentPage.goto(productUrl); stopIfBlocked();
  await documentPage.getByRole('heading', { level: 1, name: 'AGNA Brakes Disc Brake Pad Set', exact: true }).waitFor();
  assert.match(await documentPage.locator('#product-document').textContent(), /ERP SKU: DVNJ_ALD1212M/);
  assert.doesNotMatch(await documentPage.locator('#product-schema').textContent(), /"offers"|"price"/);
  report.cases.push('HTTP HTML contains real product identity, description, canonical and noindex without JavaScript; no price metadata');
  assert.deepEqual(report.pageErrors, []); stopIfBlocked();
  await fresh.close(); await crawler.close(); await context.close();
} catch (error) {
  report.failure = error.message;
  if (blocked) report.reference = blocked;
  throw error;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close(); if (server) await new Promise(resolve => server.httpServer.close(resolve));
  console.log(JSON.stringify(report, null, 2));
}
