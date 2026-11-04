import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createCatalogHandler, previewEnabled, upstreamUrl } from '../server/catalog-proxy.ts';
import { changeQuery, priceLabel, readCart, searchParams } from '../src/features/catalog/model.ts';
import type { Part } from '../src/features/catalog/model.ts';
import { mapErpPart, decodeCart, vehicleApi } from '../src/lib/erp-api.ts';

test('upstream is fixed, bounded, read-only and explicitly independent of Shopify sellability', () => {
  const url = upstreamUrl('/api/catalog?resource=search&q=ALD1212M');
  assert.equal(url.origin, 'https://staging.autopartserp.com');
  assert.equal(url.pathname, '/api/v1/search');
  assert.equal(url.searchParams.get('limit'), '24');
  assert.equal(url.searchParams.get('in_stock_only'), 'all');
  assert.equal(upstreamUrl('/?resource=years').searchParams.get('vehicleType'), 'light-duty');
  for (const query of ['resource=orders', 'resource=__proto__', 'resource=search', 'resource=search&q=x',
    'resource=search&q=pad&url=https://example.com', 'resource=category&slug=../../auth',
    'resource=search&q=pad&limit=100', 'resource=search&q=pad&page=101',
    'resource=search&q=pad&engine_base_id=1', 'resource=makes&year=2020&year=2021',
    'resource=search&q=pad&in_stock_only=purchasable']) assert.throws(() => upstreamUrl(`/?${query}`));
});

test('deployment access fails closed outside an explicitly enabled Vercel preview', () => {
  assert.equal(previewEnabled({ VERCEL: '1', VERCEL_ENV: 'production', ROYS_CATALOG_PREVIEW_ENABLED: 'true' }), false);
  assert.equal(previewEnabled({ VERCEL: '1', VERCEL_ENV: 'preview' }), false);
  assert.equal(previewEnabled({ VERCEL: '1', VERCEL_ENV: 'preview', ROYS_CATALOG_PREVIEW_ENABLED: 'true' }), true);
  assert.equal(previewEnabled({}), false);
});

test('a default deployed handler never calls ERP without activation, including missing platform variables', async () => {
  let called = false;
  const server = createServer(createCatalogHandler(async () => { called = true; return Response.json({}); }, {})).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/?resource=years`);
    assert.equal(response.status, 503);
    assert.equal(called, false);
  } finally { server.close(); server.closeAllConnections(); }
});

test('vehicle changes clear dependent fitment; category changes reset pagination and facets', () => {
  const original = { year: '2020', make: 'Toyota', model: 'Camry', engine_base_id: '17637', sub_model_id: '269', category: 'brakes', brand: 'DVNJ', page: '3' };
  assert.deepEqual(changeQuery(original, 'year', '2021'), { year: '2021', category: 'brakes' });
  assert.deepEqual(changeQuery(original, 'make', ''), { year: '2020', category: 'brakes' });
  assert.equal(changeQuery(original, 'category', 'steering').brand, undefined);
  assert.equal(changeQuery(original, 'category', 'steering').page, undefined);
  assert.equal(searchParams({ year: '2020' }), null);
  assert.equal(searchParams({ year: '2020', q: 'pad' })?.has('year'), false);
  assert.equal(searchParams(original)?.get('engine_base_id'), '17637');
});

test('saved cart rejects malformed, duplicate and unsafe quantities; missing CAD prices are never zero', () => {
  const valid = { sku: 'DVNJ_ALD1212M', part_number: 'ALD1212M', name: 'Pad', quantity: 2 };
  assert.deepEqual(readCart(JSON.stringify([valid, valid, { ...valid, sku: 'other', quantity: -1 }, null])), [valid]);
  assert.deepEqual(readCart('{broken'), []);
  assert.deepEqual(readCart('{"quantity":1}'), []);
  for (const pricing of [null, { price: null, currency: 'CAD' }, { price: 12, currency: 'USD' }]) assert.equal(priceLabel({ pricing } as Part), 'Price unavailable');
  assert.match(priceLabel({ pricing: { price: 28, currency: 'CAD' } } as Part), /28\.00/);
});

test('original UI adapter preserves ERP identity, application notes and missing-price semantics', () => {
  const raw = { sku: 'BRAND_A_NUMBER_1', name: 'Brake pad', brand_name: 'Brand A', part_number: 'NUMBER_1', pricing: { price: null, currency: 'CAD' }, core_charge: { amount: 12 }, sellablePackQuantity: 2, fitment_qualifiers: [{ name: 'Position', value: 'Rear' }], applications: [{ submodel: 'LE', position: 'Rear', notes: ['Manual parking brake only'] }] } as Part;
  const part = mapErpPart(raw);
  assert.equal(part.id, raw.sku); assert.equal(part.price, null); assert.equal(part.tier, undefined);
  assert.equal(part.coreCharge, 12); assert.equal(part.packQuantity, 2);
  assert.match(part.applicationNotes![0], /LE.*Rear.*Manual parking brake/);
  assert.notEqual(mapErpPart({ ...raw, sku: 'BRAND_B_NUMBER_1' }).id, part.id);
  const item = { id: part.id, partId: part.id, quantity: 2, part };
  assert.deepEqual(decodeCart(JSON.stringify({ items: [item, item, { ...item, quantity: -1 }] })).items, JSON.parse(JSON.stringify([item])));
  assert.deepEqual(decodeCart('{broken').items, []);
});

test('engine requests carry the exact year, make and model through the original API interface', async () => {
  const originalFetch = globalThis.fetch;
  const requests: URL[] = [];
  globalThis.fetch = async input => {
    const url = new URL(String(input), 'http://catalog.local'); requests.push(url);
    switch (url.searchParams.get('resource')) {
      case 'makes': return Response.json({ makes: [{ id: 76, name: 'Toyota' }] });
      case 'models': return Response.json({ models: [{ id: 1011, name: 'Camry' }] });
      case 'engines': return Response.json({ engines: [{ id: 17637, description: '2.5L 4-Cyl L' }] });
      default: throw new Error('Unexpected resource');
    }
  };
  try {
    assert.deepEqual(await vehicleApi.getEngines(1011, 2020, 76), [{ id: 17637, name: '2.5L 4-Cyl L', modelId: 1011 }]);
    const engine = requests.find(url => url.searchParams.get('resource') === 'engines')!;
    assert.equal(engine.searchParams.get('year'), '2020');
    assert.equal(engine.searchParams.get('make'), 'Toyota');
    assert.equal(engine.searchParams.get('model'), 'Camry');
    await assert.rejects(vehicleApi.getEngines(1011, 2020, 99));
  } finally { globalThis.fetch = originalFetch; }
});

test('HTTP boundary blocks writes, preserves Cloudflare reference, never forwards caller credentials', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fakeFetch: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('blocked')) return new Response('private upstream error', { status: 403, headers: { 'cf-ray': 'test-ray' } });
    return Response.json({ years: [2020] });
  };
  const server = createServer(createCatalogHandler(fakeFetch, {}, true)).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(`${base}/?resource=years`, { method: 'POST' })).status, 405);
    assert.equal((await fetch(`${base}/?resource=years&url=anything`)).status, 400);
    assert.equal(calls.length, 0);
    const ok = await fetch(`${base}/?resource=years`, { headers: { Authorization: 'Bearer must-not-forward', Cookie: 'staff=must-not-forward' } });
    assert.deepEqual(await ok.json(), { years: [2020] });
    assert.equal(ok.headers.get('cache-control'), 'no-store');
    const forwarded = new Headers(calls[0].init?.headers);
    assert.equal(forwarded.get('authorization'), null); assert.equal(forwarded.get('cookie'), null);
    assert.match(forwarded.get('user-agent')!, /^RoysAuto-Catalog-Preview/);
    assert.equal(calls[0].init?.redirect, 'error');
    const blocked = await fetch(`${base}/?resource=search&q=blocked`);
    assert.equal(blocked.status, 502);
    const body = await blocked.json();
    assert.equal(body.reference, 'test-ray');
    assert.doesNotMatch(JSON.stringify(body), /private upstream/);
  } finally { server.close(); server.closeAllConnections(); }
});
