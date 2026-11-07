import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapProduct } from '../server/product-data.ts';
import { parseProductDocument, publicProduct, serializeProductDocument, type ProductDocument } from '../server/product-document.ts';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createProductPageHandler, type ProductRenderer } from '../server/product-page.ts';
import { fixtureRenderer } from './product-page-fixture.ts';

const path = '/products/ABCD_TEST';
const seed = (): ProductDocument => ({ version: 1, path, status: 200, product: publicProduct(mapProduct({ product: {
  sku: 'ABCD_TEST', name: 'Brake <pad>', brand: 'Brand', part_number: 'TEST', description_long: '</script><script>alert(1)</script>&\u2028\u2029',
  pricing: { currency: 'CAD', msrp: 0 }, specs_list: [{ name: 'Length', value: '4', unit: 'mm' }],
} }, 'ABCD_TEST')) });

test('bootstrap preserves verified facts while escaping script delimiters and Unicode separators', () => {
  const document = seed(), json = serializeProductDocument(document);
  assert.doesNotMatch(json, /[<>&\u2028\u2029]/);
  assert.deepEqual(parseProductDocument(json, path), document);
  assert.equal(parseProductDocument(json, '/products/ABCD_OTHER'), null);
});

test('bootstrap rejects tampered nested fields, mismatched identity, unexpected fields and invalid status', () => {
  const document = seed(); assert.equal(document.status, 200); if (document.status !== 200) return;
  for (const patch of [ { sku: 'ABCD_OTHER' }, { price: -1 }, { price: '20' }, { stock: null }, { stock: -1 },
    { purchasable: 'yes' }, { imageUrl: 'javascript:alert(1)' }, { imageUrl: 'https:example.test/img' }, { imageUrl: 'https:/example.test/img' }, { imageUrl: 'https://secret:pwd@example.test/img' },
    { descriptions: [{ text: 'test', language: 'en" onclick="x' }] }, { specifications: [{ name: 'x', value: false }] },
    { conditions: [null] }, { packQuantity: 1.5 }, { offers: {} }, { descriptions: new Array(20_001).fill({ text: 'x' }) },
  ]) assert.equal(parseProductDocument(JSON.stringify({ ...document, product: { ...document.product, ...patch } }), path), null);
  for (const json of ['not json', 'null', JSON.stringify({ ...document, version: 2 }), JSON.stringify({ version: 1, path, status: '404', title: 'x', message: 'x' }), ' '.repeat(2_000_001)]) {
    assert.equal(parseProductDocument(json, path), null);
  }
  assert.throws(() => serializeProductDocument({ ...document, product: { ...document.product, conditions: ['<'.repeat(400_000)] } }));
});

test('error documents carry a real recoverable status without product identity', () => {
  for (const status of [400, 404, 429, 502, 503] as const) {
    const document: ProductDocument = { version: 1, path, status, title: 'Unavailable', message: 'Browse the catalog.' };
    assert.deepEqual(parseProductDocument(serializeProductDocument(document), path), document);
  }
});

test('handler preserves GET-only policy and fails closed for renderer/template errors', async () => {
  const shell = '<html><head><title>Catalog</title><meta name="description" content="Catalog"></head><body><div id="root"></div></body></html>';
  const fetcher: typeof fetch = async () => Response.json({ product: { sku: 'ABCD_TEST', name: 'Pad', brand: 'Brand', part_number: 'TEST' } });
  for (const [template, render, expected] of [
    [async () => shell, fixtureRenderer, 200],
    [async () => shell, () => { throw new Error('missing artifact'); }, 503],
    [async () => 'invalid shell', fixtureRenderer, 503],
  ] as [() => Promise<string>, ProductRenderer, number][]) {
    const server = createServer(createProductPageHandler(template, fetcher, {}, true, render)).listen(0, '127.0.0.1');
    await once(server, 'listening'); const address = server.address(); assert.ok(address && typeof address !== 'string');
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
      assert.equal(response.status, expected);
      assert.equal((await fetch(`http://127.0.0.1:${address.port}${path}`, { method: 'HEAD' })).status, 405);
    } finally { server.close(); server.closeAllConnections(); }
  }
});
