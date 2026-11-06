import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DIMENSIONS, MARKET } from '../src/features/catalog/model.ts';
import {
  initialNavigation, parseCatalogBackground, parseNavigationUrl, safeCatalogReturnPath,
  serializeNavigation, transitionNavigation,
} from '../src/features/catalog/navigation-state.ts';
import type { ListingNavigationState, ParsedNavigationState, VehicleSelection } from '../src/features/catalog/navigation-state.ts';

// Synthetic shape fixtures only. These IDs do not assert real engine/vehicle/PCDB membership.
const vehicleQuery = 'year=2015&make=Chevrolet&model=Silverado+1500';
const remembered: VehicleSelection = { year: 2015, make: 'Chevrolet', model: 'Silverado 1500', dimensions: { engine_base_id: '123' } };
function parsed(url: string): ParsedNavigationState {
  const result = parseNavigationUrl(url);
  assert.equal(result.status, 'parsed', url);
  if (result.status !== 'parsed') throw new Error('Expected parsed state.');
  return result.state;
}
function listing(url: string): ListingNavigationState {
  const result = parsed(url);
  assert.notEqual(result.kind, 'product');
  if (result.kind === 'product') throw new Error('Expected listing state.');
  return result;
}
function invalid(url: string, code?: string) {
  const result = parseNavigationUrl(url);
  assert.equal(result.status, 'invalid', url);
  if (result.status === 'invalid') {
    assert.equal(result.explicit, true);
    if (code) assert.equal(result.issues[0].code, code, url);
  }
}

test('round trips all six dimensions, category, unresolved PCDB, text, market, availability and filters', () => {
  const params = new URLSearchParams({ year: '2015', make: 'Chevrolet', model: 'Silverado 1500',
    ...Object.fromEntries(DIMENSIONS.map((key, i) => [key, String(i + 1)])), q: 'ball j',
    original_q: '2015 Chevrolet Silverado 1500 5.3L V8 ball j', category: 'suspension',
    part_type: '12', brand: 'Brand + A&B', in_stock_only: 'true', sort: 'price', sort_order: 'desc', page: '2', market: 'CA' });
  const state = listing(`/?${params}`);
  assert.equal(state.kind, 'search');
  assert.deepEqual(state.market, MARKET);
  assert.deepEqual(state.text, { original: params.get('original_q'), residual: 'ball j' });
  assert.deepEqual(state.partType, { kind: 'unresolved-pcdb', id: '12' });
  assert.deepEqual(state.category, { kind: 'category-slug', slug: 'suspension' });
  assert.equal(state.scope.kind, 'vehicle');
  if (state.scope.kind === 'vehicle') assert.equal(Object.keys(state.scope.vehicle.dimensions).length, 6);
  const href = serializeNavigation(state);
  assert.deepEqual(parsed(href), state);
  assert.equal(serializeNavigation(parsed(href)), href);
  assert.ok(href.includes('brand=Brand+%2B+A%26B'));
  assert.ok(!href.includes('market='));
});

test('serialization fixes order, omits equivalent defaults, and preserves explicit all-vehicle scope', () => {
  const unordered = listing('/?page=1&sort_order=asc&market=CA&q=brake+pad&sort=relevance&in_stock_only=all&scope=all');
  assert.equal(serializeNavigation(unordered), '/?scope=all&q=brake+pad');
  assert.equal(unordered.availability, 'all', 'Roys default is all, not purchasable');
  assert.equal(serializeNavigation(listing(`/?region_id=6&make=Chevrolet&year=2015&engine_base_id=1&model=Silverado+1500`)),
    `/?${vehicleQuery}&engine_base_id=1&region_id=6`);
  assert.equal(serializeNavigation(listing('/?market=CA')), '/?scope=all');
  assert.equal(serializeNavigation(listing('/?scope=all')), '/?scope=all');
  assert.equal(serializeNavigation(listing('/?category=brakes&part_type=2')), '/?scope=all&category=brakes&part_type=2');
});

test('text and Unicode/punctuation encoding remain exact; fully consumed original text is retained', () => {
  const q = 'Étrier + A&B / . (R)';
  const state = listing(`/?${new URLSearchParams({ q, original_q: `2015 ${q}` })}`);
  assert.equal(state.text.residual, q);
  assert.deepEqual(parsed(serializeNavigation(state)), state);
  const consumed = listing(`/?${vehicleQuery}&original_q=2015+Chevrolet+Silverado+1500`);
  assert.equal(consumed.kind, 'catalog');
  assert.equal(consumed.text.residual, '');
  assert.deepEqual(parsed(serializeNavigation(consumed)), consumed);
});

test('bare homepage can restore one vehicle; every explicit URL, including invalid input, wins', () => {
  assert.deepEqual(parseNavigationUrl('/'), { status: 'absent' });
  assert.deepEqual(initialNavigation(parseNavigationUrl('/'), remembered), { source: 'remembered', vehicle: remembered });
  assert.deepEqual(initialNavigation(parseNavigationUrl('/'), null), { source: 'empty' });
  assert.deepEqual(initialNavigation(parseNavigationUrl('/'), { ...remembered, year: 1800 }), { source: 'empty' });
  for (const url of ['/?scope=all', '/?q=ALD1212M', '/?category=brakes', '/products/DVNJ_ALD1212M']) {
    assert.equal(initialNavigation(parseNavigationUrl(url), remembered).source, 'url');
  }
  for (const url of ['/?year=2015', '/?q=a', '/?', '/?utm_source=mail', '/unknown']) {
    assert.equal(initialNavigation(parseNavigationUrl(url), remembered).source, 'recovery');
  }
  const global = listing('/?q=ALD1212M');
  assert.deepEqual(global.scope, { kind: 'all' });
  const explicit = initialNavigation(parseNavigationUrl(`/?${vehicleQuery}&engine_base_id=456`), remembered);
  assert.equal(explicit.source, 'url');
  if (explicit.source === 'url' && explicit.state.kind !== 'product' && explicit.state.scope.kind === 'vehicle') {
    assert.equal(explicit.state.scope.vehicle.dimensions.engine_base_id, '456');
  }
});

test('partial/contradictory vehicles are recoverable and engine zero is never a real ID', () => {
  for (const suffix of ['year=2015', 'make=Chevrolet', 'model=Silverado', 'engine_base_id=1',
    'scope=vehicle', 'scope=vehicle&q=brakes', `${vehicleQuery.replace('&model=Silverado+1500', '')}&q=brakes`]) invalid(`/?${suffix}`, 'partial-vehicle');
  invalid(`/?scope=all&${vehicleQuery}`, 'scope');
  invalid('/?scope=garage', 'scope');
  const zero = listing(`/?${vehicleQuery}&engine_base_id=0`);
  if (zero.scope.kind === 'vehicle') assert.deepEqual(zero.scope.vehicle.dimensions, {});
  assert.equal(serializeNavigation(zero), `/?${vehicleQuery}`);
  invalid('/?scope=all&engine_base_id=0', 'partial-vehicle');
});

test('bounded IDs/year/page and all six dimensions reject malformed numeric aliases', () => {
  for (const key of [...DIMENSIONS, 'part_type']) {
    for (const value of ['-1', '01', '1.0', '1e2', '1000000000', 'NaN', ' 1', '1 ']) invalid(`/?${vehicleQuery}&${key}=${encodeURIComponent(value)}`, 'value');
    if (key !== 'engine_base_id') invalid(`/?${vehicleQuery}&${key}=0`, 'value');
    for (const value of ['1', '999999999']) assert.equal(listing(`/?${vehicleQuery}&${key}=${value}`).scope.kind, 'vehicle');
  }
  for (const year of [1900, 2100]) assert.equal(listing(`/?year=${year}&make=A&model=B`).scope.kind, 'vehicle');
  for (const year of [1899, 2101]) invalid(`/?year=${year}&make=A&model=B`, 'value');
  assert.equal(listing('/?page=100').filters.page, 100);
  for (const page of ['0', '01', '101']) invalid(`/?page=${page}`, 'value');
});

test('duplicate, malformed, unknown and ordinary tracking keys require explicit recovery', () => {
  for (const url of ['/?q=brakes&q=brakes', '/?q=&q=brakes', '/?q=brakes&%71=pads',
    '/?scope=all&scope=all', `/?${vehicleQuery}&engine_base_id=0&engine_base_id=1`]) invalid(url, 'duplicate');
  for (const url of ['/?q=%ZZ', '/?q=%', '/?q=%C0%AF', '/products/ABCD_%ZZ']) invalid(url, 'encoding');
  for (const key of ['utm_source', 'utm_campaign', 'gclid', 'return_to', 'limit', 'include_facets', 'unexpected_filter']) invalid(`/?q=brakes&${key}=x`, 'unsupported-key');
  for (const suffix of ['q=', 'q=+', 'q=x', 'q=%00brakes', 'q=brakes%7F', `q=${'a'.repeat(121)}`,
    'category=Brake-Pads', 'category=a/b', 'market=US', 'market=ca', 'in_stock_only=purchasable', 'sort=random', 'sort_order=up']) invalid(`/?${suffix}`, 'value');
  for (const url of ['https://example.test/?q=brakes', '//evil.test/?q=brakes', '/#q=brakes', '/?q=brakes#', '/\\evil.test', '/catalog/2015/a/b', '/?q=brakes\n']) invalid(url, 'path');
});

test('supported SKU paths preserve identity/encoding; bare MPN, synthetic IDs and injected paths stay unsupported', () => {
  for (const sku of ['DVNJ_ALD1212M', 'ABCD_AB+12 (R).5-2', '1234_A_B']) {
    const href = `/products/${encodeURIComponent(sku)}`;
    const state = parsed(href);
    assert.equal(state.kind, 'product');
    if (state.kind === 'product') assert.equal(state.product.sku, sku);
    assert.equal(serializeNavigation(state), href);
  }
  for (const path of ['/products/ALD1212M', '/products/1234', '/products/pp-123', '/products/abcd_A',
    '/products/ABCD_A%2Fetc', '/products/ABCD_A%5Cetc', '/products/ABCD_A%252fetc',
    '/products/ABCD_A/fitments', '/products/ABCD_A?q=brakes', '/products/ABCD_A/']) invalid(path);
  for (const q of ['ALD1212M', 'DVNJ_ALD1212M', '1234']) {
    const state = listing(`/?q=${q}`);
    assert.equal(state.kind, 'search', 'A text query never guesses a product or vehicle identity');
  }
});

test('typed-state serialization rejects invalid values instead of manufacturing valid URLs', () => {
  const state = listing('/?q=brakes');
  assert.throws(() => serializeNavigation({ ...state, filters: { ...state.filters, page: 101 } }));
  assert.throws(() => serializeNavigation({ ...state, text: { original: 'brakes', residual: '' } }));
  assert.throws(() => serializeNavigation({ ...state, text: { original: '', residual: 'brakes' } }));
  assert.throws(() => serializeNavigation({ ...state, market: { ...MARKET, currency: 'USD' } } as unknown as ParsedNavigationState));
});

test('vehicle and engine replacement clear stale intent/facets; ordinary config edits preserve other dimensions', () => {
  const state = listing(`/?${vehicleQuery}&engine_base_id=1&sub_model_id=2&region_id=3&category=brakes&part_type=4&brand=A&page=2&q=pads&original_q=full+phrase`);
  for (const action of [
    { type: 'replace-vehicle', vehicle: { ...remembered, year: 2016 } },
    { type: 'replace-engine', engineId: '9' },
  ] as const) {
    const result = transitionNavigation(state, action);
    assert.equal(result.memory, 'unchanged');
    assert.equal(result.navigation.status, 'parsed');
    if (result.navigation.status === 'parsed' && result.navigation.state.kind !== 'product') {
      const next = result.navigation.state;
      assert.equal(next.kind, 'catalog'); assert.equal(next.category, undefined);
      assert.deepEqual(next.text, { original: '', residual: '' }); assert.equal(next.availability, 'all');
      assert.equal(next.filters.brand, undefined); assert.equal(next.partType, undefined); assert.equal(next.filters.page, 1);
      assert.equal(next.filters.sort, 'relevance'); assert.equal(next.filters.sortOrder, 'asc');
      if (next.scope.kind === 'vehicle') assert.deepEqual(next.scope.vehicle.dimensions, {
        engine_base_id: action.type === 'replace-engine' ? '9' : '123',
      });
    }
  }
  assert.equal(transitionNavigation(listing('/?scope=all'), { type: 'replace-engine', engineId: '9' }).navigation.status, 'invalid');
  const unspecified = transitionNavigation(state, { type: 'replace-engine', engineId: '0' });
  if (unspecified.navigation.status === 'parsed') assert.equal(serializeNavigation(unspecified.navigation.state), `/?${vehicleQuery}`);
  else assert.fail('Expected unspecified-engine transition');
  for (const key of DIMENSIONS.filter((key): key is Exclude<typeof key, 'engine_base_id'> => key !== 'engine_base_id')) {
    const result = transitionNavigation(state, { type: 'change-query', key, value: '9' });
    assert.equal(result.navigation.status, 'parsed');
    if (result.navigation.status === 'parsed' && result.navigation.state.kind !== 'product') {
      const next = result.navigation.state;
      assert.equal(next.partType?.id, '4'); assert.equal(next.filters.brand, 'A'); assert.equal(next.filters.page, 1);
      if (next.scope.kind === 'vehicle') assert.deepEqual(next.scope.vehicle.dimensions, { engine_base_id: '1', sub_model_id: '2', region_id: '3', [key]: '9' });
      assert.equal(next.text.original, 'full phrase');
    }
  }
  for (const key of ['category', 'q'] as const) {
    const result = transitionNavigation(state, { type: 'change-query', key, value: key === 'q' ? 'rotors' : 'steering' });
    if (result.navigation.status === 'parsed' && result.navigation.state.kind !== 'product') {
      assert.equal(result.navigation.state.filters.brand, undefined);
      assert.equal(result.navigation.state.partType, undefined);
      assert.equal(result.navigation.state.filters.page, 1);
    } else assert.fail('Expected parsed transition');
  }
  const page = transitionNavigation(state, { type: 'change-query', key: 'page', value: '3' });
  if (page.navigation.status === 'parsed' && page.navigation.state.kind !== 'product') {
    assert.equal(page.navigation.state.text.original, 'full phrase');
    assert.equal(page.navigation.state.filters.page, 3);
    assert.equal(page.navigation.state.partType?.id, '4');
  } else assert.fail('Expected page transition');
});

test('explicit Clear requests remembered-vehicle removal and produces explicit all-vehicle state', () => {
  const state = listing(`/?${vehicleQuery}&engine_base_id=1&category=brakes&part_type=4&brand=A&page=2&q=pads&original_q=old+vehicle+pads&in_stock_only=true&sort=price&sort_order=desc`);
  const clear = transitionNavigation(state, { type: 'clear-vehicle' });
  assert.equal(clear.memory, 'remove');
  assert.equal(clear.navigation.status, 'parsed');
  if (clear.navigation.status === 'parsed') {
    assert.equal(serializeNavigation(clear.navigation.state), '/?scope=all');
    assert.deepEqual(clear.navigation.state, listing('/?scope=all'));
    assert.equal(initialNavigation(clear.navigation, remembered).source, 'url');
  }
});

test('safe returns reject redirect tricks and preserve complete local listing state', () => {
  assert.equal(safeCatalogReturnPath('/'), '/');
  assert.equal(safeCatalogReturnPath(`/?${vehicleQuery}&page=2&q=ball+joint`), `/?${vehicleQuery}&q=ball+joint&page=2`);
  assert.equal(safeCatalogReturnPath('/?q=A%2BB+%26+Caf%C3%A9'), '/?scope=all&q=A%2BB+%26+Caf%C3%A9');
  for (const value of [null, 42, {}, 'https://evil.test', '//evil.test', '\\evil.test', '/\\evil.test',
    '%2F%2Fevil.test', '/%2F%2Fevil.test', '/%252F%252Fevil.test', '/?q=%5C%5Cevil.test',
    '/?q=brakes%0A', '/?q=%ZZ', '/?q=brakes#//evil.test', '/products/DVNJ_ALD1212M',
    '/?return_to=https://evil.test', '/?year=2015']) assert.equal(safeCatalogReturnPath(value), null, String(value));
});

test('versioned overlay background preserves URL/filter/page/focus/scroll without altering product identity', () => {
  const href = `/?${vehicleQuery}&engine_base_id=1&q=pads&brand=A&page=2`;
  const background = { version: 1, href, scroll: { x: 0, y: 930 }, focusKey: 'product-DVNJ_ALD1212M' };
  assert.deepEqual(parseCatalogBackground(background), background);
  assert.equal(serializeNavigation(parsed('/products/DVNJ_ALD1212M')), '/products/DVNJ_ALD1212M');
  for (const value of [null, {}, { ...background, version: 2 }, { ...background, href: '//evil.test' },
    { ...background, scroll: { x: -1, y: 1 } }, { ...background, scroll: { x: 0, y: Infinity } },
    { ...background, focusKey: 'bad\nkey' }]) assert.equal(parseCatalogBackground(value), null);
});
