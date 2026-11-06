import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { catalogEnabled, catalogGateway, createCatalogHandler, upstreamUrl } from '../server/catalog-proxy.ts';
import { catalogFetch, changeQuery, priceLabel, readCart, searchParams } from '../src/features/catalog/model.ts';
import type { Part } from '../src/features/catalog/model.ts';
import { mapErpPart, decodeCart, vehicleApi, cartApi } from '../src/lib/erp-api.ts';
import { availabilitySummary } from '../src/lib/availability.ts';

async function withCatalogResponse<T>(response: Response, run: () => Promise<T>) {
  const originalFetch = globalThis.fetch;
  let request: RequestInfo | URL | undefined;
  let init: RequestInit | undefined;
  globalThis.fetch = async (input, options) => {
    request = input;
    init = options;
    return response;
  };
  try { return { result: await run(), request, init }; }
  finally { globalThis.fetch = originalFetch; }
}

test('catalog fetch turns a plain-text platform 500 into a retryable message without exposing its body', async () => {
  await withCatalogResponse(
    new Response('A server error occurred. Internal detail: private-token', { status: 500, headers: { 'content-type': 'text/plain' } }),
    async () => assert.rejects(catalogFetch('years', new URLSearchParams()), error => {
      assert.match((error as Error).message, /temporarily unavailable.*try again shortly/i);
      assert.doesNotMatch((error as Error).message, /private-token|A server error/);
      return true;
    }),
  );
});

test('catalog fetch handles invalid JSON without leaking the parser exception', async () => {
  await withCatalogResponse(
    new Response('{not json', { status: 500, headers: { 'content-type': 'application/json' } }),
    async () => assert.rejects(catalogFetch('years', new URLSearchParams()), error => {
      assert.match((error as Error).message, /temporarily unavailable.*try again shortly/i);
      assert.doesNotMatch((error as Error).message, /JSON|Unexpected token|not json/i);
      return true;
    }),
  );
});

test('catalog fetch treats a non-JSON HTML redirect as a retryable failure even on 200', async () => {
  await withCatalogResponse(
    new Response('<html>Sign in to Vercel</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    async () => assert.rejects(catalogFetch('years', new URLSearchParams()), error => {
      assert.match((error as Error).message, /temporarily unavailable.*try again shortly/i);
      assert.doesNotMatch((error as Error).message, /Sign in|<html>/);
      return true;
    }),
  );
});

test('catalog fetch preserves JSON gate errors and diagnostic Cloudflare references', async () => {
  const { request, init } = await withCatalogResponse(
    Response.json({ error: 'Catalog preview is not enabled.', reference: 'diagnostic-ray' }, { status: 503 }),
    () => assert.rejects(catalogFetch('years', new URLSearchParams()), error => {
      assert.equal((error as Error).message, 'Catalog preview is not enabled. Reference: diagnostic-ray');
      assert.doesNotMatch((error as Error).message, /staff|token/i);
      return true;
    }),
  );
  assert.equal(new Headers(init?.headers).get('authorization'), null);
  assert.match(String(request), /^\/api\/catalog\?/);
});

test('catalog fetch returns successful JSON data', async () => {
  const { result: data } = await withCatalogResponse(
    Response.json({ years: [2020, 2021] }),
    async () => catalogFetch<{ years: number[] }>('years', new URLSearchParams()),
  );
  assert.deepEqual(data, { years: [2020, 2021] });
});

test('catalog fetch accepts valid JSON larger than 64 KiB', async () => {
  const payload = 'x'.repeat(70_000);
  const { result } = await withCatalogResponse(
    Response.json({ payload }),
    () => catalogFetch<{ payload: string }>('search', new URLSearchParams()),
  );
  assert.equal(result.payload.length, 70_000);
});

test('catalog fetch rejects JSON responses larger than the proxy limit', async () => {
  await withCatalogResponse(
    Response.json({ payload: 'x'.repeat(2_000_001) }),
    () => assert.rejects(catalogFetch('search', new URLSearchParams()), error => {
      assert.match((error as Error).message, /temporarily unavailable.*try again shortly/i);
      assert.doesNotMatch((error as Error).message, /x{20}/);
      return true;
    }),
  );
});

test('catalog fetch rejects JSON primitives as malformed endpoint responses', async () => {
  for (const value of [null, 42, 'unexpected']) {
    await withCatalogResponse(
      Response.json(value),
      () => assert.rejects(catalogFetch('years', new URLSearchParams()), error => {
        assert.match((error as Error).message, /temporarily unavailable.*try again shortly/i);
        return true;
      }),
    );
  }
});

test('upstream uses the fixed ERP gateway and preserves the complete allowlisted catalog path', () => {
  const url = upstreamUrl('/api/catalog?resource=search&q=ALD1212M');
  assert.equal(url.origin, 'https://staging.autrex.ca');
  assert.equal(url.pathname, '/api/erp/api/v1/search');
  assert.equal(upstreamUrl('/?resource=category&slug=brakes').pathname, '/api/erp/api/v1/taxonomy/categories/brakes');
  assert.equal(url.searchParams.get('limit'), '24');
  assert.equal(url.searchParams.get('in_stock_only'), 'all');
  assert.equal(upstreamUrl('/?resource=years').searchParams.get('vehicleType'), 'light-duty');
  for (const input of [
    'http://catalog.local/?resource=years',
    'https://attacker.example/?resource=years',
    '//attacker.example/?resource=years',
    '/admin?resource=years',
    '/?resource=years#fragment',
  ]) assert.throws(() => upstreamUrl(input));
  for (const query of ['resource=orders', 'resource=__proto__', 'resource=search', 'resource=search&q=x',
    'resource=search&q=pad&url=https://example.com', 'resource=category&slug=../../auth',
    'resource=search&q=pad&limit=100', 'resource=search&q=pad&page=101',
    'resource=search&q=pad&engine_base_id=1', 'resource=makes&year=2020&year=2021',
    'resource=search&q=pad&in_stock_only=purchasable']) assert.throws(() => upstreamUrl(`/?${query}`));
});

test('catalog activation allows enabled previews and only the designated production project main branch', () => {
  const enabledFlag = { ROYS_CATALOG_PREVIEW_ENABLED: 'true' };
  assert.equal(catalogEnabled({ VERCEL: '1', VERCEL_ENV: 'preview', ...enabledFlag }), true);
  assert.equal(catalogEnabled({
    VERCEL: '1', VERCEL_ENV: 'production', ...enabledFlag,
    VERCEL_PROJECT_ID: 'prj_MDoqEvUIZHzv65GCFYxLE03xVt2p', VERCEL_GIT_COMMIT_REF: 'main',
  }), true);

  const deniedDeployments: NodeJS.ProcessEnv[] = [
    {},
    { VERCEL: '1', VERCEL_ENV: 'preview' },
    { VERCEL: '1', VERCEL_ENV: 'production', ...enabledFlag },
    { VERCEL: '1', VERCEL_ENV: 'production', ...enabledFlag, VERCEL_PROJECT_ID: 'another-project', VERCEL_GIT_COMMIT_REF: 'main' },
    { VERCEL: '1', VERCEL_ENV: 'production', ...enabledFlag, VERCEL_PROJECT_ID: 'prj_MDoqEvUIZHzv65GCFYxLE03xVt2p', VERCEL_GIT_COMMIT_REF: 'staging' },
    { VERCEL: '1', VERCEL_ENV: 'production', ...enabledFlag, VERCEL_GIT_COMMIT_REF: 'main' },
    { VERCEL: '1', VERCEL_ENV: 'production', ...enabledFlag, VERCEL_PROJECT_ID: 'prj_MDoqEvUIZHzv65GCFYxLE03xVt2p' },
    { VERCEL_ENV: 'production', ...enabledFlag, VERCEL_PROJECT_ID: 'prj_MDoqEvUIZHzv65GCFYxLE03xVt2p', VERCEL_GIT_COMMIT_REF: 'main' },
    { VERCEL: '1', VERCEL_ENV: 'preview', ROYS_CATALOG_PREVIEW_ENABLED: 'TRUE' },
  ];
  for (const env of deniedDeployments) assert.equal(catalogEnabled(env), false);
});

test('a denied deployment returns a stable error and never calls ERP', async () => {
  const envs: NodeJS.ProcessEnv[] = [
    {},
    { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_PROJECT_ID: 'prj_MDoqEvUIZHzv65GCFYxLE03xVt2p', VERCEL_GIT_COMMIT_REF: 'main' },
    { VERCEL: '1', VERCEL_ENV: 'production', ROYS_CATALOG_PREVIEW_ENABLED: 'true', VERCEL_PROJECT_ID: 'other-project', VERCEL_GIT_COMMIT_REF: 'main' },
  ];
  for (const env of envs) {
    let called = false;
    const server = createServer(createCatalogHandler(async () => { called = true; return Response.json({}); }, env)).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/?resource=years`);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        error: 'ERP staging catalog access has not been enabled for this deployment.',
        code: env.ROYS_CATALOG_PREVIEW_ENABLED === 'true' ? 'CATALOG_DEPLOYMENT_NOT_ALLOWED' : 'CATALOG_FLAG_DISABLED',
      });
      assert.equal(called, false);
    } finally { server.close(); server.closeAllConnections(); }
  }
});

test('the eligible production deployment can only make GET requests to the fixed ERP gateway', async () => {
  const calls: { url: URL; init?: RequestInit }[] = [];
  const productionEnv = {
    VERCEL: '1', VERCEL_ENV: 'production', ROYS_CATALOG_PREVIEW_ENABLED: 'true',
    VERCEL_PROJECT_ID: 'prj_MDoqEvUIZHzv65GCFYxLE03xVt2p', VERCEL_GIT_COMMIT_REF: 'main',
  };
  const server = createServer(createCatalogHandler(async (input, init) => {
    calls.push({ url: new URL(String(input)), init });
    return Response.json({ years: [2020] });
  }, productionEnv)).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/?resource=years`, { method: 'GET' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { years: [2020] });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url.origin, 'https://staging.autrex.ca');
    assert.equal(calls[0].url.pathname, '/api/erp/api/v1/vehicles/years');
    assert.equal(calls[0].init?.method ?? 'GET', 'GET');
    assert.equal(calls[0].init?.redirect, 'error');
  } finally { server.close(); server.closeAllConnections(); }
});

test('upstream is selected only by the ROYS_ONPREM deploy target', () => {
  assert.equal(catalogGateway({}).origin, 'https://staging.autrex.ca');
  assert.equal(catalogGateway({ ROYS_ONPREM: 'true' }).origin, 'https://staging.autrex.ca');
  assert.equal(catalogGateway({ ROYS_ONPREM: '1' }).origin, 'http://192.168.88.233');
  const url = upstreamUrl('/?resource=years', catalogGateway({ ROYS_ONPREM: '1' }));
  assert.equal(url.href, 'http://192.168.88.233/api/erp/api/v1/vehicles/years?vehicleType=light-duty');
  assert.equal(upstreamUrl('/?resource=years').origin, 'https://staging.autrex.ca');
});

test('on-prem activation requires the flag and is never allowed on Vercel', () => {
  const flag = { ROYS_CATALOG_PREVIEW_ENABLED: 'true' };
  assert.equal(catalogEnabled({ ROYS_ONPREM: '1', ...flag }), true);
  assert.equal(catalogEnabled({ ROYS_ONPREM: '1' }), false);
  assert.equal(catalogEnabled({ ROYS_ONPREM: '1', ROYS_CATALOG_PREVIEW_ENABLED: 'TRUE' }), false);
  assert.equal(catalogEnabled({ ROYS_ONPREM: 'true', ...flag }), false);
  assert.equal(catalogEnabled({ ROYS_ONPREM: '1', VERCEL: '1', VERCEL_ENV: 'preview', ...flag }), false);
  assert.equal(catalogEnabled({
    ROYS_ONPREM: '1', VERCEL: '1', VERCEL_ENV: 'production', ...flag,
    VERCEL_PROJECT_ID: 'prj_MDoqEvUIZHzv65GCFYxLE03xVt2p', VERCEL_GIT_COMMIT_REF: 'main',
  }), false);
});

test('on-prem handler fetches only the LAN upstream and Vercel+on-prem is denied without calling it', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => { calls.push({ url: String(input), init }); return Response.json({ years: [2020] }); }) as typeof fetch;
  const run = async (env: NodeJS.ProcessEnv) => {
    const server = createServer(createCatalogHandler(fetcher, env)).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    try { return await fetch(`http://127.0.0.1:${address.port}/?resource=years`); }
    finally { server.close(); server.closeAllConnections(); }
  };
  const ok = await run({ ROYS_ONPREM: '1', ROYS_CATALOG_PREVIEW_ENABLED: 'true' });
  assert.equal(ok.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://192.168.88.233/api/erp/api/v1/vehicles/years?vehicleType=light-duty');
  assert.equal(calls[0].init?.redirect, 'error');
  const denied = await run({ ROYS_ONPREM: '1', VERCEL: '1', VERCEL_ENV: 'preview', ROYS_CATALOG_PREVIEW_ENABLED: 'true' });
  assert.equal(denied.status, 503);
  assert.equal((await denied.json() as { code: string }).code, 'CATALOG_DEPLOYMENT_NOT_ALLOWED');
  const missing = await run({ ROYS_ONPREM: '1' });
  assert.equal((await missing.json() as { code: string }).code, 'CATALOG_FLAG_DISABLED');
  assert.equal(calls.length, 1);
});

test('Vercel plus on-prem is denied even in local-development mode and never fetches', async () => {
  assert.throws(() => catalogGateway({ ROYS_ONPREM: '1', VERCEL: '1' }));
  let called = false;
  const server = createServer(createCatalogHandler(async () => { called = true; return Response.json({}); },
    { ROYS_ONPREM: '1', VERCEL: '1', ROYS_CATALOG_PREVIEW_ENABLED: 'true' }, true)).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/?resource=years`);
    assert.equal(response.status, 503);
    assert.equal((await response.json() as { code: string }).code, 'CATALOG_DEPLOYMENT_NOT_ALLOWED');
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

test('ERP adapter preserves application qualifiers and summary without inventing confirmed fitments', () => {
  const raw = { sku: 'BRAND_A_NUMBER_1', name: 'Brake pad', brand_name: 'Brand A', part_number: 'NUMBER_1', pricing: { price: null, currency: 'CAD' }, core_charge: { amount: 12 }, sellablePackQuantity: 2, fitment_summary: 'Fits 2020 Toyota Camry', fitment_qualifiers: [{ name: 'Position', value: 'Rear' }], applications: [{ submodel: 'LE', engine: null, position: 'Rear', notes: ['Verify rotor diameter'], qualifiers: ['For models with electronic parking brake'] }] } as Part;
  const part = mapErpPart(raw);
  assert.equal(part.id, raw.sku); assert.equal(part.price, null); assert.equal(part.tier, undefined);
  assert.equal(part.coreCharge, 12); assert.equal(part.packQuantity, 2);
  assert.match(part.applicationNotes![0], /LE.*Rear.*Verify rotor diameter.*electronic parking brake/);
  assert.equal(part.fitmentSummary, raw.fitment_summary);
  assert.deepEqual(part.fitments, []);
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

test('stock labels respect ERP status, including unknown counts and non-stock lead times', () => {
  const raw = { sku: 'BRAND_PAD', name: 'Pad', brand_name: 'Brand', part_number: 'PAD' } as Part;
  const cases = [
    ['in_stock', null, 0, 'In Stock'],
    ['low_stock', 2, 3, 'Low Stock'],
    ['out_of_stock', 0, 3, 'Out of Stock'],
    ['out_of_stock', 20, 3, 'Out of Stock'],
    ['available', null, 3, 'Available to order'],
    ['available', null, undefined, 'Available to order'],
    ['available', null, 0, 'Available to order'],
    ['special_order', 0, 1, 'Special order · estimated lead time 1 day'],
    ['special_order', 0, -1, 'Special order'],
    ['backorder', null, 5, 'Backorder · estimated lead time 5 days'],
    ['unknown', 0, 3, 'Availability unconfirmed'],
    ['unknown', 20, 3, 'Availability unconfirmed'],
    ['future_status', 20, 3, 'Availability unconfirmed'],
  ] as const;
  for (const [status, quantity, lead_time_days, label] of cases) {
    const part = mapErpPart({ ...raw, availability: { status, quantity, lead_time_days } });
    assert.equal(availabilitySummary(part).label, label);
  }
  assert.equal(availabilitySummary(mapErpPart(raw)).label, 'Availability unconfirmed');
});

test('adding to an existing cart cannot persist negative, fractional or non-finite quantities', async () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
  } });
  const part = mapErpPart({ sku: 'BRAND_PAD', name: 'Pad', brand_name: 'Brand', part_number: 'PAD' } as Part);
  try {
    assert.equal((await cartApi.addItem('test', part.id, -5, part)).items[0].quantity, 1);
    assert.equal((await cartApi.addItem('test', part.id, -5, part)).items[0].quantity, 2);
    assert.equal((await cartApi.addItem('test', part.id, 2.8, part)).items[0].quantity, 4);
    for (const invalid of [NaN, Infinity, -Infinity]) await assert.rejects(cartApi.addItem('test', part.id, invalid, part));
    assert.equal((await cartApi.get('test')).items[0].quantity, 4);
    assert.equal((await cartApi.addItem('test', part.id, 1000, part)).items[0].quantity, 99);
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('HTTP boundary blocks writes, preserves Cloudflare reference, never forwards caller credentials', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fakeFetch: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('blocked')) return new Response('private upstream error', { status: 403, headers: { 'cf-ray': 'test-ray' } });
    if (String(url).includes('q=stub')) return new Response('private stub data', { status: 200, headers: { 'content-type': 'application/json', 'X-ERP-Stub': '1' } });
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
    const stub = await fetch(`${base}/?resource=search&q=stub`);
    assert.equal(stub.status, 502);
    const stubBody = await stub.json();
    assert.deepEqual(stubBody, { error: 'The staging catalog is temporarily unavailable.' });
    assert.doesNotMatch(JSON.stringify(stubBody), /private stub data/);
  } finally { server.close(); server.closeAllConnections(); }
});
