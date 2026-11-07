import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readCatalog, upstreamUrl } from '../server/catalog-proxy.ts';
import { mapProduct, mapProductFitments, productMeta, productPath, productSchema, productSku } from '../server/product-data.ts';
import { createProductPageHandler } from '../server/product-page.ts';
import { closeProduct, followProduct } from '../src/features/catalog/product-navigation.ts';
import type { MouseEvent } from 'react';
import { fixtureRenderer } from './product-page-fixture.ts';

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

// ERP4e3ed42e public products.ts response shapes; synthetic values exercise
// preservation/safety, not product fitment or live-stock assertions.
const factsProduct = (fields: Record<string, unknown>) => ({ product: { ...product().product, ...fields } });

test('ordered public specs keep meaningful repeats/units and suppress unresolved and pipeline attributes', () => {
  const mapped = mapProduct(factsProduct({ specs_list: [
    { name: 'Length', value: '10', unit: 'mm' },
    { name: 'Length', value: '12', unit: 'mm' },
    { name: 'Length', value: '10', unit: 'in' },
    { name: 'Length', value: '10', unit: 'mm' },
    { name: 'Material', value: 'NA' }, { name: 'ABS', value: 'No' }, { name: 'SAE', value: 0 },
    ...['12345', 'LIF', 'WS1', 'HTS', 'CTO', 'MSR', 'WT1', 'WD1', 'HAC', 'WD2', 'WT2', 'raw_key', 'Research Required', 'Size Lookup',
      'Offset Source', 'Manufacturer Finish Description', 'Unknown'].map(name => ({ name, value: 'private' })),
  ], specifications: { Length: '99', Color: 'Black', 'Mounting Hardware Included': 'None',
    raw_key: 'private', '123': 'private', MSR: 'private', WT1: 'private', WD1: 'private', HAC: 'private', WD2: 'private', WT2: 'private', LIF: '2', WS1: '1 Year Warranty', 'Build Type Source': 'private' },
  }), sku);
  assert.deepEqual(mapped.productFacts?.specsList, [
    { name: 'Length', value: '10', unit: 'mm' }, { name: 'Length', value: '12', unit: 'mm' },
    { name: 'Length', value: '10', unit: 'in' }, { name: 'Material', value: 'NA' }, { name: 'ABS', value: 'No' }, { name: 'SAE', value: '0' },
    { name: 'Color', value: 'Black' }, { name: 'Mounting Hardware Included', value: 'None' },
  ]);
  assert.deepEqual(mapped.specs, { Length: '10 mm; 12 mm; 10 in', Material: 'NA', ABS: 'No', SAE: '0', Color: 'Black', 'Mounting Hardware Included': 'None' });
  assert.equal(mapped.warranty, '');
  assert.doesNotMatch(productSchema(mapped), /LIF|WS1|private|Warranty/);
});

test('supplied short/long descriptions and languages survive without treating text as markup', () => {
  const mapped = mapProduct(factsProduct({ description_short: 'Résumé court', description_language: 'fr',
    description_long: '<script>Long supplier text</script>', description_long_language: 'en',
    descriptions: [{ code: 'EXT', type: 'Extended', text: '<script>Long supplier text</script>', language: 'en' },
      { code: 'MKT', type: 'Marketing', text: 'Texte fourni', language: 'fr' }],
  }), sku);
  assert.equal(mapped.descriptionText, 'Résumé court');
  assert.deepEqual(mapped.productFacts?.descriptions, [
    { kind: 'short', text: 'Résumé court', language: 'fr' },
    { kind: 'long', text: '<script>Long supplier text</script>', language: 'en' },
    { kind: 'other', type: 'Extended', code: 'EXT', text: '<script>Long supplier text</script>', language: 'en' },
    { kind: 'other', type: 'Marketing', code: 'MKT', text: 'Texte fourni', language: 'fr' },
  ]);
  assert.doesNotMatch(productSchema(mapped), /<script>/);
  assert.equal(mapProduct(factsProduct({ description_short: ' ', description_long: 'Useful long' }), sku).descriptionText, 'Useful long');
});

test('only safe supplied public media URLs survive, with no invented document MIME or image caption', () => {
  const mapped = mapProduct(factsProduct({ media: {
    images: ['javascript:alert(1)', 'https://cdn.example.test/one.jpg', 'https://cdn.example.test/two.jpg',
      'https://user:secret@cdn.example.test/private', '//cdn.example.test/relative', 'http://cdn.example.test/plain',
      'https://cdn.example.test/one.jpg', {}, 'https://cdn.example.test/a\n.jpg'],
    videos: ['https://cdn.example.test/supplied-video'], documents: ['https://cdn.example.test/supplied-document'],
  } }), sku);
  assert.equal(mapped.imageUrl, 'https://cdn.example.test/one.jpg');
  assert.deepEqual(mapped.productFacts?.media, { images: ['https://cdn.example.test/one.jpg', 'https://cdn.example.test/two.jpg'],
    videos: ['https://cdn.example.test/supplied-video'], documents: ['https://cdn.example.test/supplied-document'] });
  assert.equal(mapped.assets, undefined, 'An untyped supplied document must not become a PDF claim');
  assert.equal(mapped.productFacts?.sections.images, 'partial');
});

test('inline references preserve NR/type/source notes in both typed facts and the legacy visible Notes cell', () => {
  const mapped = mapProduct(factsProduct({ interchanges: { count: 3, items: [
    { brand: 'Supplier A', part_number: 'AB+12', type: 'NR', type_name: 'Not Recommended', notes: 'Different connector' },
    { brand: 'Supplier B', part_number: 'OE-1', type: 'OE', type_name: 'Original Equipment', notes: null },
    { brand: 'Supplier C', part_number: 'X', type: null, type_name: null, notes: 'Reference only' },
  ] }, fitment_qualifiers: [{ name: 'Position', value: 'Rear' }, { name: 'Engine VIN', value: 'J only' }] }), sku);
  assert.deepEqual(mapped.productFacts?.interchanges[0], { brand: 'Supplier A', partNumber: 'AB+12', type: 'NR', typeName: 'Not Recommended', notes: 'Different connector' });
  assert.equal(mapped.interchanges?.[0].notes, 'NR · Not Recommended · Different connector');
  assert.equal(mapped.interchanges?.[1].notes, 'OE · Original Equipment');
  assert.equal(mapped.interchanges?.[2].notes, 'Reference only');
  assert.deepEqual(mapped.productFacts?.applicationQualifiers, [{ name: 'Position', value: 'Rear' }, { name: 'Engine VIN', value: 'J only' }]);
  assert.deepEqual(mapped.applicationNotes, ['Check position', 'Position: Rear', 'Engine VIN: J only']);
  assert.deepEqual(mapped.specs, {});
  assert.deepEqual(mapped.fitments, []);
});

test('secondary states distinguish absent, genuine empty, malformed and partially usable data', () => {
  const absent = mapProduct(factsProduct({ media: undefined }), sku).productFacts!;
  assert.equal(absent.sections.interchanges, 'absent');
  assert.equal(absent.sections.specsList, 'absent');
  assert.equal(absent.sections.images, 'absent');
  const empty = mapProduct(factsProduct({ specs_list: [], specifications: {}, descriptions: [],
    media: { images: [], documents: [], videos: [] }, interchanges: { count: 0, items: [] }, fitment_qualifiers: [] }), sku).productFacts!;
  for (const state of Object.values(empty.sections)) assert.equal(state, 'empty');
  const malformed = mapProduct(factsProduct({ specs_list: {}, specifications: [], descriptions: 'oops',
    media: false, interchanges: { count: 2, items: [] }, fitment_qualifiers: 'oops' }), sku).productFacts!;
  for (const key of ['specsList', 'specifications', 'descriptions', 'images', 'interchanges', 'applicationQualifiers'] as const) assert.equal(malformed.sections[key], 'malformed');
  const partial = mapProduct(factsProduct({ specs_list: [{ name: 'Length', value: '2' }, { name: 'Width', value: {} }],
    interchanges: { count: 2, items: [{ brand: 'A', part_number: '1', type: 'NR', notes: 'Do not substitute' }, null] } }), sku).productFacts!;
  assert.equal(partial.sections.specsList, 'partial');
  assert.equal(partial.sections.interchanges, 'partial');
  assert.equal(partial.interchanges[0].notes, 'Do not substitute');
});

test('policy omissions stay partial, null is absent, fallback cannot conceal malformed ordered specs', () => {
  const policy = mapProduct(factsProduct({ specs_list: [{ name: 'LIF', value: '2' }],
    specifications: JSON.parse('{"__proto__":"private","constructor":"private","Color":"Black"}') }), sku);
  assert.equal(policy.productFacts?.sections.specsList, 'partial');
  assert.equal(policy.productFacts?.sections.specifications, 'partial');
  assert.deepEqual(policy.specs, { Color: 'Black' });
  assert.equal(Object.getPrototypeOf(policy.specs), Object.prototype);
  const bad = mapProduct(factsProduct({ specs_list: false, specifications: { Color: 'Black' } }), sku);
  assert.equal(bad.productFacts?.sections.specsList, 'malformed');
  assert.deepEqual(bad.specs, { Color: 'Black' });
  const absent = mapProduct(factsProduct({ specs_list: null, specifications: null, descriptions: null,
    media: null, interchanges: null, fitment_qualifiers: null }), sku).productFacts!;
  for (const state of Object.values(absent.sections)) assert.equal(state, 'absent');
});

test('NR cannot be cancelled by missing/conflicting type names, and reference identifiers are exact', () => {
  const exact = 'AB+12 (R).5-2_' + 'x'.repeat(1100);
  const mapped = mapProduct(factsProduct({ interchanges: { count: 4, items: [
    { brand: 'A', part_number: exact, type: 'NR', notes: 'Do not substitute' },
    { brand: 'B', part_number: 'X', type: 'NR', type_name: 'Recommended', notes: 'Different mounting' },
    { brand: 'C', part_number: ' space padded ', type: 'OE' },
    { brand: 'D', part_number: 'Y', notes: { unsafe: true } },
  ] } }), sku);
  assert.equal(mapped.productFacts?.interchangeCount, 4);
  assert.equal(mapped.productFacts?.sections.interchanges, 'partial');
  assert.equal(mapped.productFacts?.interchanges.length, 2);
  assert.equal(mapped.interchanges?.[0].partNumber, exact);
  assert.equal(mapped.interchanges?.[0].notes, 'NR · Not Recommended · Do not substitute');
  assert.equal(mapped.productFacts?.interchanges[1].typeName, 'Recommended');
  assert.equal(mapped.interchanges?.[1].notes, 'NR · Not Recommended · Recommended · Different mounting');
});

test('coded descriptions with identical text keep differing language/type provenance', () => {
  const row = { code: 'EXT', type: 'Extended', text: 'Identical text', language: 'en' };
  const mapped = mapProduct(factsProduct({ description_short: 'Identical text', description_language: 'fr',
    description_long: 'Identical text', description_long_language: 'en',
    descriptions: [row, row, { ...row, language: 'fr' }, { ...row, code: 'MKT', type: 'Marketing' }],
  }), sku).productFacts!;
  assert.equal(mapped.descriptions.length, 5);
  assert.deepEqual(mapped.descriptions.map(row => [row.kind, row.language, row.type, row.code]), [
    ['short', 'fr', undefined, undefined], ['long', 'en', undefined, undefined],
    ['other', 'en', 'Extended', 'EXT'], ['other', 'fr', 'Extended', 'EXT'], ['other', 'en', 'Marketing', 'MKT'],
  ]);
});

test('overlong asset URLs are rejected whole instead of projecting a truncated address', () => {
  const mapped = mapProduct(factsProduct({ media: { images: ['https://cdn.example.test/' + 'x'.repeat(2100)],
    videos: ['data:video/mp4;base64,eA==', 'https:cdn.example.test/movie', 'https:/cdn.example.test/movie'], documents: ['https://user:pass@cdn.example.test/doc'] } }), sku);
  assert.equal(mapped.imageUrl, undefined);
  assert.deepEqual(mapped.productFacts?.media, { images: [], videos: [], documents: [] });
  assert.equal(mapped.productFacts?.sections.images, 'malformed');
});

test('malformed coded description metadata stays visible in section health despite good primary text', () => {
  const primary = { description_short: 'Good summary', description_language: 'en' };
  const badRows = [{ text: 'Bad code', code: {} }, { text: 'Bad type', type: 7 },
    { text: 'Bad language', language: 'fr_?' }, { text: 'Bad null type', type: null }, { text: 'Blank code', code: ' ' }];
  const malformed = mapProduct(factsProduct({ ...primary, descriptions: badRows }), sku);
  assert.equal(malformed.descriptionText, 'Good summary');
  assert.equal(malformed.productFacts?.sections.descriptions, 'malformed');
  assert.deepEqual(malformed.productFacts?.descriptions, [{ kind: 'short', text: 'Good summary', language: 'en' }]);
  const mixed = mapProduct(factsProduct({ ...primary, descriptions: [...badRows,
    { code: 'EXT', type: 'Extended', text: 'Good extended text', language: 'fr-CA' }] }), sku);
  assert.equal(mixed.productFacts?.sections.descriptions, 'partial');
  assert.deepEqual(mixed.productFacts?.descriptions[1], { kind: 'other', text: 'Good extended text', code: 'EXT', type: 'Extended', language: 'fr-CA' });
});

test('missing reference brands do not erase exact identifiers or NR warnings; malformed brands remain partial', () => {
  const mapped = mapProduct(factsProduct({ interchanges: { count: 3, items: [
    { part_number: 'AB+12 (R)', brand: null, brand_id: null, type: 'NR', notes: 'Do not substitute' },
    { part_number: 'OE-1', brand_id: 'B001', type: 'OE' },
    { part_number: 'INVALID', brand: { name: 'Unsafe' }, type: 'NR' },
  ] } }), sku);
  assert.equal(mapped.productFacts?.sections.interchanges, 'partial');
  assert.equal(mapped.productFacts?.interchangeCount, 3);
  assert.deepEqual(mapped.productFacts?.interchanges, [
    { partNumber: 'AB+12 (R)', brand: '', type: 'NR', notes: 'Do not substitute' },
    { partNumber: 'OE-1', brand: '', brandId: 'B001', type: 'OE' },
  ]);
  assert.deepEqual(mapped.interchanges?.[0], { partNumber: 'AB+12 (R)', brand: '', notes: 'NR · Not Recommended · Do not substitute' });
});

test('richer facts cannot alter verified identity/current CAD price or pack/core/availability semantics', () => {
  const base = { ...product().product, pricing: { sale_price: 25.12, msrp: 40, currency: 'CAD', basis: 'current' },
    sellablePackQuantity: 2, core_charge: { amount: 9.5 }, purchasable: false };
  const mapped = mapProduct({ product: { ...base, specs_list: [{ name: 'Price', value: 'Free' }],
    specifications: { Stock: '10000' }, interchanges: { count: 0, items: [] } } }, sku);
  assert.deepEqual([mapped.id, mapped.brand, mapped.partNumber, mapped.price, mapped.currency, mapped.packQuantity,
    mapped.coreCharge, mapped.stock, mapped.availability, mapped.purchasable, mapped.warranty],
  [sku, 'AGNA Brakes', 'ALD1212M', 25.12, 'CAD', 2, 9.5, 1, 'low_stock', false, '']);
  assert.throws(() => mapProduct({ product: { ...base, sku: 'ABCD_OTHER' } }, sku));
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
    state: { roysCatalog: { version: 1, href: '/?scope=all', scroll: { x: 0, y: 0 } } } as Record<string, unknown> | null,
    pushState(state: Record<string, unknown>, _unused: string, path: string) { this.state = state; location.pathname = path; pushes++; },
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
    assert.equal(location.pathname, `/products/${sku}`); assert.equal(pushes, 1); assert.equal(events, 2);
    assert.deepEqual(history.state?.roysProductBackground, { version: 1, href: '/?scope=all', scroll: { x: 0, y: 0 } });
    followProduct(click(), sku); assert.equal(pushes, 1, 'No duplicate entry for the open product');
    closeProduct(); assert.equal(backs, 1); assert.equal(replacements, 0);
    history.state = null;
    closeProduct(); assert.equal(replacements, 1); assert.equal(location.pathname, '/?scope=all'); assert.equal(events, 3);
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
  const server = createServer(createProductPageHandler(async () => shell, fetcher, env, local, fixtureRenderer)).listen(0, '127.0.0.1');
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
    assert.doesNotMatch(html, /<script>alert|evil\.test/);
    const schema = html.match(/id="product-schema">([^]*?)<\/script>/)?.[1]; assert.ok(schema);
    assert.doesNotMatch(schema, /"offers"|"price"/);
    assert.equal(JSON.parse(schema).name, hostile);
    assert.equal(schema, productSchema(mapProduct({ product: { ...product().product, name: hostile, description_long: hostile } }, sku)));
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
    assert.equal(response.headers.get('x-roys-catalog-refused'), '1');
    assert.equal(response.headers.get('x-roys-catalog-reference'), 'test-ray');
  });
  await withPage(async () => Response.json({}, { status: 403 }), async origin => {
    const response = await fetch(`${origin}/products/${sku}`);
    assert.equal(response.status, 502);
    assert.equal(response.headers.get('x-roys-catalog-refused'), '1');
    assert.equal(response.headers.get('x-roys-catalog-reference'), null);
  });
  await withPage(async () => new Response('Challenge', { headers: { 'cf-mitigated': 'challenge', 'cf-ray': 'challenge-ray' } }), async origin => {
    const response = await fetch(`${origin}/products/${sku}`);
    assert.equal(response.status, 502);
    assert.equal(response.headers.get('x-roys-catalog-refused'), '1');
    assert.equal(response.headers.get('x-roys-catalog-reference'), 'challenge-ray');
  });
  await withPage(async () => Response.json({ product: { ...product().product, sku: 'ABCD_OTHER' } }), async origin => {
    const response = await fetch(`${origin}/products/${sku}`);
    assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /product-schema|rel="canonical"/);
  });
});
