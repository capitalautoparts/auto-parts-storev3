// VM511 only: isolated fixtures/faults, no ERP requests or visual acceptance.
// Run: node --experimental-strip-types scripts/product-links-faults.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { firefox } from '@playwright/test';
import { mapProduct, productSchema } from '../server/product-data.ts';
import { createProductSmokeMonitor } from './product-links-monitor.mjs';

const sku = 'DVNJ_ALD1212M', otherSku = 'ABCD_OTHER';
const raw = id => ({ sku: id, id, name: `Fixture </script>& ${id}`, brand_name: 'Fixture Brand',
  part_number: id.split('_')[1], pricing: { msrp: null, sale_price: null, currency: 'CAD' } });
const vite = await createServer({ configFile: 'vite.config.ts', server: { host: '127.0.0.1', port: 0 } });
await vite.listen();
const origin = vite.resolvedUrls.local[0].replace(/\/+$/, '');
const shell = await vite.transformIndexHtml('/', await readFile('index.html', 'utf8'));
const browser = await firefox.launch();
const cases = [];
try {
  const context = await browser.newContext();
  const requests = [];
  await context.route('**/api/catalog?*', route => {
    const query = new URL(route.request().url()).searchParams, resource = query.get('resource');
    requests.push(resource);
    const productSku = query.get('sku');
    let payload = {}, status = 200;
    if (resource === 'years') payload = { years: [] };
    if (resource === 'categories') payload = { data: [] };
    if (resource === 'search') payload = { results: [raw(sku), raw(otherSku)], pagination: { total: 2, page: 1, has_more: false } };
    if (resource === 'product') {
      status = productSku === 'ZZZZ_MISSING' ? 404 : 200;
      payload = status === 404 ? { error: 'Product not found.' } : { product: raw(productSku) };
    }
    if (resource === 'product-fitments') payload = { sku: productSku, fitments: [], pagination: { total: 0, page: 1, has_more: false } };
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  await context.route('**/products/**', route => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop());
    const schema = id === 'ZZZZ_MISSING' ? '' : `<script id="product-schema" data-fixture-ssr="true" type="application/ld+json">${productSchema(mapProduct({ product: raw(id) }, id))}</script>`;
    return route.fulfill({ status: id === 'ZZZZ_MISSING' ? 404 : 200, contentType: 'text/html', body: shell.replace('</head>', `${schema}</head>`) });
  });
  const page = await context.newPage(); page.setDefaultTimeout(15_000);
  const schemaState = async expected => {
    await page.waitForFunction(id => {
      const nodes = document.querySelectorAll('#product-schema');
      if (!id) return nodes.length === 0;
      try { return nodes.length === 1 && JSON.parse(nodes[0].textContent).sku === id; } catch { return false; }
    }, expected);
    if (expected) {
      assert.equal(await page.locator('#product-schema').getAttribute('type'), 'application/ld+json');
      const schema = await page.locator('#product-schema').textContent();
      assert.equal(JSON.parse(schema).name, raw(expected).name);
      assert.doesNotMatch(schema, /"offers"|"price"|<\/script>/);
    }
  };
  await page.goto(`${origin}/products/${sku}`);
  await page.getByRole('dialog').getByText(`Fixture Brand ALD1212M`, { exact: true }).waitFor();
  await schemaState(sku);
  assert.equal(await page.locator('#product-schema').getAttribute('data-fixture-ssr'), 'true', 'JS reuses the server schema node');
  assert.ok(requests.includes('product'));
  cases.push('JS direct entry retains one safe shared identity schema after verified product load');
  await page.keyboard.press('Escape'); await page.waitForURL(`${origin}/`); await schemaState(null);
  const search = page.getByRole('combobox', { name: 'Search by vehicle or part number' });
  await search.fill('fixture'); await search.press('Enter');
  const open = async id => {
    await page.locator(`[data-part-id="${id}"]`).getByRole('link', { name: 'Details', exact: true }).click();
    await page.getByRole('dialog').getByText(`Fixture Brand ${id.split('_')[1]}`, { exact: true }).waitFor();
    await schemaState(id);
  };
  await open(sku);
  await page.goBack(); await schemaState(null);
  await open(otherSku);
  await page.goBack(); await schemaState(null);
  await page.goForward(); await schemaState(otherSku);
  cases.push('In-page SKU changes, Back and Forward update identity; catalog removes stale schema');
  await page.evaluate(() => {
    history.pushState(null, '', '/products/ZZZZ_MISSING');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.getByRole('alert').getByText('Product not found.', { exact: true }).waitFor(); await schemaState(null);
  cases.push('In-page error removes previously verified product identity');
  await context.close();

  // Each fault has a separate monitor/run. No ERP, screenshots or retry.
  for (const fault of [
    { name: 'mobile document', width: 390, status: 502, headers: { 'x-roys-catalog-refused': '1', 'x-roys-catalog-reference': 'mobile-ray' }, reference: 'mobile-ray' },
    { name: 'crawler document', js: false, status: 403, headers: { 'cf-ray': 'crawler-ray' }, reference: 'crawler-ray' },
    { name: 'challenge document', status: 200, headers: { 'cf-mitigated': 'challenge', 'cf-ray': 'challenge-ray' }, reference: 'challenge-ray' },
    { name: 'document without Ray', status: 502, headers: { 'x-roys-catalog-refused': '1' }, reference: 'no Ray/reference supplied' },
    { name: 'API refusal', api: true, status: 502, body: { code: 'CATALOG_UPSTREAM_REFUSED', reference: 'api-ray' }, reference: 'api-ray' },
  ]) {
    const desktop = await browser.newContext(), sentinel = await desktop.newPage();
    const requester = await browser.newContext({ viewport: { width: fault.width || 1440, height: 844 }, javaScriptEnabled: fault.js !== false });
    let attempts = 0, followups = 0;
    await requester.route('**/*', route => {
      attempts++;
      return route.fulfill({ status: fault.status, headers: fault.headers, contentType: fault.api ? 'application/json' : 'text/html', body: fault.api ? JSON.stringify(fault.body) : '<h1>Fixture refusal</h1>' });
    });
    const refusedPage = await requester.newPage();
    const report = { apiResponses: [], pageErrors: [] }, monitor = createProductSmokeMonitor(report);
    monitor.observe(refusedPage);
    const closed = new Promise(resolve => requester.once('close', resolve));
    const path = fault.api ? '/api/catalog?resource=product&sku=DVNJ_ALD1212M' : `/products/${sku}`;
    await assert.rejects(monitor.run(() => refusedPage.goto(`${origin}${path}`)), /Staging route refused/);
    await closed;
    assert.equal(report.reference, fault.reference, fault.name);
    assert.equal(refusedPage.isClosed(), true);
    assert.equal(sentinel.isClosed(), false, 'Unrelated desktop context stays open');
    await assert.rejects(monitor.run(() => { followups++; return sentinel.goto(origin); }), /Staging route refused/);
    assert.equal(followups, 0, 'A failed run cannot start another journey or retry');
    assert.equal(attempts, 1, 'The refused route was requested once');
    assert.equal(report.refusal.status, fault.status);
    cases.push(`${fault.name}: reference retained, requester closed, no later journey/retry`);
    await desktop.close();
  }
  console.log(JSON.stringify({ fixtureOnly: true, hostedAcceptance: false, cases }, null, 2));
} finally { await browser.close(); await vite.close(); }
