import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readCatalog, upstreamUrl } from '../server/catalog-proxy.ts';
import { mapProduct, mapProductFitments, productMeta, productPath, productSku } from '../server/product-data.ts';
import { createProductPageHandler } from '../server/product-page.ts';
import { closeProduct, followProduct } from '../src/features/catalog/product-navigation.ts';
import type { MouseEvent } from 'react';

const sku = 'DVNJ_ALD1212M';
const product = (pricing: unknown = { msrp: 28, sale_price: null, currency: 'CAD' }) => ({ product: {
  sku, id: sku, name: 'Disc Brake Pad Set', brand_name: 'AGNA Brakes', part_number: 'ALD1212M',
  pricing, availability: { quantity: 1, status: 'low_stock' }, fitment_notes: ['Check position'],
  media: { images: ['javascript:alert(1)'] },
} });

test('permanent SKU paths round-trip punctuation without allowing path or query injection', () => {
  for (const id of [sku, 'ABCD_AB+12 (R).5-2', '1234_A_B']) assert.equal(productSku(productPath(id)), id);
  for (const id of ['ALD1212M', '1234', '../search', `${sku}/fitments`, `${sku}?q=x`, `${sku}%2fetc`, `${sku}#x`, `${sku}\u0000`, `ABCD_${'a'.repeat(160)}`]) {
    assert.throws(() => productPath(id));
    assert.throws(() => upstreamUrl(`/api/catalog?${new URLSearchParams({ resource: 'product', sku: id })}`));
  }
  for (const path of ['/products/%ZZ', '/products/ABCD_A%2f..', '/products/ABCD_A/fitments', '/products/ALD1212M']) assert.equal(productSku(path), null);
  const detail = upstreamUrl(`/api/catalog?resource=product&sku=${sku}`);
  assert.equal(detail.pathname, `/api/erp/api/v1/products/${sku}`);
  assert.equal(detail.search, '');
  const fits = upstreamUrl(`/api/catalog?resource=product-fitments&sku=${sku}&page=2&limit=24`);
  assert.equal(fits.pathname, `/api/erp/api/v1/products/${sku}/fitments`);
  assert.equal(fits.searchParams.get('page'), '2');
  for (const query of [`resource=product&sku=${sku}&q=x`, `resource=product&sku=${sku}&sku=${sku}`, `resource=product-fitments&sku=${sku}&page=101`, `resource=product-fitments&sku=${sku}&limit=100`]) assert.throws(() => upstreamUrl(`/api/catalog?${query}`));
});

test('product mapper uses the ERP retail contract and fails safe for unknown prices and identity', () => {
  assert.equal(mapProduct(product(), sku).price, 28);
  assert.equal(mapProduct(product({ msrp: 40, sale_price: 25, currency: 'CAD' }), sku).price, 25);
  assert.equal(mapProduct(product({ msrp: 40, sale_price: 0, currency: 'CAD' }), sku).price, 0);
  for (const pricing of [null, { msrp: '28', currency: 'CAD' }, { msrp: 28, currency: 'USD' }, { msrp: 28, sale_price: -1, currency: 'CAD' }, { msrp: 28, currency: 'CAD', basis: 'none' }, { msrp: 28, currency: 'CAD', basis: 'last_known' }]) assert.equal(mapProduct(product(pricing), sku).price, null);
  const mapped = mapProduct(product(), sku);
  assert.deepEqual(mapped.fitments, []);
  assert.equal(mapped.imageUrl, undefined);
  assert.deepEqual(mapped.applicationNotes, ['Check position']);
  assert.throws(() => mapProduct(product(), 'ABCD_OTHER'));
  assert.throws(() => mapProduct({ product: { ...product().product, id: 'ABCD_OTHER' } }, sku));
  assert.throws(() => mapProduct({ product: {} }, sku));
  assert.equal(productMeta(mapped).canonical, `/products/${sku}`);
});

test('fitment mapping preserves ranges and pagination without inventing an engine or full coverage', () => {
  const mapped = mapProductFitments({ sku, fitments: [
    { year_from: 2007, year_to: 2009, make: 'Toyota', model: 'Camry', submodel: 'LE', position: 'Rear' },
    { year_from: null, year_to: null, make: null, model: null },
  ], pagination: { total: 57, page: 2, has_more: true } }, sku);
  assert.equal(mapped.fitments.length, 1);
  assert.deepEqual(mapped.fitments[0], { year: 2007, yearEnd: 2009, make: 'Toyota', model: 'Camry', notes: 'LE · Rear' });
  assert.equal(mapped.hasMore, true);
  assert.equal(mapped.total, 57);
  assert.throws(() => mapProductFitments({ sku: 'ABCD_OTHER' }, sku));
});

test('product history intercepts ordinary clicks, preserves native modified links, and closes direct entries safely', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalPopState = Object.getOwnPropertyDescriptor(globalThis, 'PopStateEvent');
  let prevented = 0, pushes = 0, backs = 0, replacements = 0, events = 0;
  const location = { pathname: '/' };
  const history = {
    state: null as { roysProductOverlay?: boolean } | null,
    pushState(state: { roysProductOverlay: boolean }, _unused: string, path: string) { this.state = state; location.pathname = path; pushes++; },
    replaceState(state: null, _unused: string, path: string) { this.state = state; location.pathname = path; replacements++; },
    back() { backs++; },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location, history, dispatchEvent: () => { events++; } } });
  Object.defineProperty(globalThis, 'PopStateEvent', { configurable: true, value: Event });
  const click = (extra = {}) => ({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
    preventDefault: () => { prevented++; }, ...extra }) as MouseEvent<HTMLAnchorElement>;
  try {
    for (const extra of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) followProduct(click(extra), sku);
    assert.equal(prevented, 0); assert.equal(pushes, 0);
    followProduct(click(), '../hostile'); assert.equal(pushes, 0);
    followProduct(click(), sku);
    assert.equal(location.pathname, `/products/${sku}`); assert.equal(pushes, 1); assert.equal(events, 1);
    followProduct(click(), sku); assert.equal(pushes, 1, 'No duplicate entry for the open product');
    closeProduct(); assert.equal(backs, 1); assert.equal(replacements, 0);
    history.state = null;
    closeProduct(); assert.equal(replacements, 1); assert.equal(location.pathname, '/'); assert.equal(events, 2);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (originalPopState) Object.defineProperty(globalThis, 'PopStateEvent', originalPopState); else Reflect.deleteProperty(globalThis, 'PopStateEvent');
  }
});

test('product proxy preserves missing products, rejects stubs, and does no upstream reads with gate closed', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return Response.json({ error: 'internal detail' }, { status: 404 }); };
  const input = `/api/catalog?resource=product&sku=${sku}`;
  assert.equal((await readCatalog(input, fetcher, {})).status, 503);
  assert.equal(calls, 0);
  assert.deepEqual(await readCatalog(input, fetcher, {}, true), { status: 404, body: { error: 'Product not found.' } });
  assert.equal((await readCatalog(input, async () => Response.json(product(), { headers: { 'x-erp-stub': '1' } }), {}, true)).status, 502);
});

const shell = '<html><head><title>Catalog</title><meta name="description" content="Catalog"><meta name="robots" content="noindex, nofollow"></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>';
async function withPage(fetcher: typeof fetch, run: (origin: string) => Promise<void>, env: NodeJS.ProcessEnv = {}, local = true) {
  const server = createServer(createProductPageHandler(async () => shell, fetcher, env, local)).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { server.close(); server.closeAllConnections(); }
}

test('product HTML is crawlable without JavaScript, escaped, noindex and omits unverified price metadata', async () => {
  const hostile = '</title><script>alert("x")</script>& $&';
  await withPage(async () => Response.json({ product: { ...product().product, name: hostile,
    description_long: hostile, seo: { canonical_url: 'https://evil.test/', meta_title: hostile } } }), async origin => {
    const response = await fetch(`${origin}/products/${sku}?q=ignored`), html = await response.text();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.match(html, /<h1>&lt;\/title&gt;&lt;script&gt;/);
    assert.match(html, /ERP SKU: DVNJ_ALD1212M/);
    assert.match(html, /rel="canonical" href="\/products\/DVNJ_ALD1212M"/);
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    assert.match(html, /src="\/assets\/app.js"/);
    assert.doesNotMatch(html, /<script>alert|evil\.test|"offers"|"price"/);
    const schema = html.match(/id="product-schema">([^]*?)<\/script>/)?.[1]; assert.ok(schema);
    assert.equal(JSON.parse(schema).name, hostile);
  });
});

test('HTML status distinguishes malformed, missing, blocked and unavailable products and rejects writes', async () => {
  let calls = 0;
  await withPage(async () => { calls++; return Response.json({}, { status: 404 }); }, async origin => {
    assert.equal((await fetch(`${origin}/products/ABCD_A%2fetc`)).status, 400);
    assert.equal(calls, 0);
    const missing = await fetch(`${origin}/products/${sku}`);
    assert.equal(missing.status, 404); assert.match(await missing.text(), /Product not found/);
    assert.equal((await fetch(`${origin}/products/${sku}`, { method: 'POST' })).status, 405);
    assert.equal(calls, 1);
  });
  await withPage(async () => { throw new Error('must not call'); }, async origin => {
    assert.equal((await fetch(`${origin}/products/${sku}`)).status, 503);
  }, {}, false);
  await withPage(async () => Response.json({}, { status: 403, headers: { 'cf-ray': 'test-ray' } }), async origin => {
    const response = await fetch(`${origin}/products/${sku}`);
    assert.equal(response.status, 502); assert.match(await response.text(), /test-ray/);
  });
  await withPage(async () => Response.json({ product: { ...product().product, sku: 'ABCD_OTHER' } }), async origin => {
    const response = await fetch(`${origin}/products/${sku}`);
    assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /product-schema|rel="canonical"/);
  });
});
