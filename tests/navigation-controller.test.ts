import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MouseEvent } from 'react';
import { CatalogNavigationController } from '../src/features/catalog/navigation-controller.ts';
import { commitCategorySelection, listingQuery, parseNavigationUrl, serializeNavigation } from '../src/features/catalog/navigation-state.ts';
import type { CatalogBackground, ListingNavigationState, VehicleSelection } from '../src/features/catalog/navigation-state.ts';
import { resolveListing } from '../src/features/catalog/navigation-resolver.ts';
import type { NavigationReferences } from '../src/features/catalog/navigation-resolver.ts';
import { searchParams } from '../src/features/catalog/model.ts';
import { captureCatalogPresentation, restoreCatalogPresentation } from '../src/features/catalog/navigation-presentation.ts';
import { closeProduct, followProduct } from '../src/features/catalog/product-navigation.ts';
import { categoryApi, partsApi } from '../src/lib/erp-api.ts';

// Synthetic reference membership only; these numbers make no real fitment claim.
const remembered: VehicleSelection = { year: 2015, make: 'Fixture Make', model: 'Fixture Model', dimensions: { engine_base_id: '10' } };
const vehicleUrl = '/?year=2015&make=Fixture+Make&model=Fixture+Model&engine_base_id=10';
const category = { id: 500, slug: 'fixture-pads', name: 'Fixture Pads', parentId: 400 };
const refs: NavigationReferences = {
  getYears: async () => [{ year: 2015 }, { year: 2016 }],
  getMakes: async () => [{ id: 1, name: 'Fixture Make' }],
  getModels: async () => [{ id: 2, name: 'Fixture Model', makeId: 1 }],
  getEngines: async () => [{ id: 10, name: 'Fixture Engine', modelId: 2 }],
  getCategories: async () => [{ id: 400, slug: 'fixture-brakes', name: 'Fixture Brakes', parentId: null }],
  getChildren: async () => [category],
};
function listing(href: string): ListingNavigationState {
  const parsed = parseNavigationUrl(href);
  assert.equal(parsed.status, 'parsed');
  if (parsed.status !== 'parsed' || parsed.state.kind === 'product') throw new Error('Expected listing');
  return parsed.state;
}
function harness(href = '/', references = refs) {
  let entries = [{ href, state: {} as Record<string, unknown> }], index = 0;
  let memory: VehicleSelection | null = remembered;
  const writes: unknown[] = [], pushes: string[] = [];
  const controller = new CatalogNavigationController({
    href: () => entries[index].href, historyState: () => entries[index].state,
    push: (href, state) => { entries = [...entries.slice(0, index + 1), { href, state }]; index++; pushes.push(href); },
    replace: (state, href) => { entries[index] = { href: href ?? entries[index].href, state }; },
    capture: () => ({ version: 1, href: entries[index].href, scroll: { x: 0, y: 740 }, focusKey: 'catalog-next',
      disclosure: { years: [2015], makes: ['2015-1'], models: ['2015-1-2'], engines: ['2015-1-2-10'], categories: [] } }),
    remembered: () => memory,
    resolve: state => resolveListing(state, references),
    remember: vehicle => { memory = vehicle; writes.push(vehicle); },
    forget: () => { memory = null; writes.push(null); },
  });
  return { controller, writes, pushes, memory: () => memory, href: () => entries[index].href,
    async back() { assert.ok(index > 0); index--; await controller.load('pop'); },
    async forward() { assert.ok(index < entries.length - 1); index++; await controller.load('pop'); } };
}

test('active controller hydrates explicit all and invalid URLs without memory writes or pushes', async () => {
  for (const href of ['/?scope=all', '/?year=2015', '/?q=a', '/?unknown_filter=1', '/catalog/2015/example']) {
    const h = harness(href);
    await h.controller.load();
    assert.equal(h.controller.getSnapshot().status, href === '/?scope=all' ? 'ready' : 'recovery');
    assert.equal(h.controller.getSnapshot().listing?.vehicle ?? null, null);
    assert.deepEqual(h.writes, []); assert.deepEqual(h.pushes, []); assert.equal(h.href(), href);
  }
});

test('bare homepage resolves memory and replaces its URL once, then Back is independent of later Clear', async () => {
  const h = harness();
  await h.controller.load();
  assert.equal(h.href(), vehicleUrl); assert.deepEqual(h.writes, []); assert.deepEqual(h.pushes, []);
  await h.controller.transition({ type: 'change-query', key: 'q', value: 'fixture pads' });
  const scoped = h.href();
  await h.controller.transition({ type: 'catalog-root' });
  assert.equal(h.href(), '/?scope=all'); assert.deepEqual(h.memory(), remembered);
  await h.controller.transition({ type: 'clear-vehicle' });
  assert.equal(h.memory(), null); assert.deepEqual(h.pushes, [scoped, '/?scope=all'], 'Clear on root creates no duplicate entry');
  await h.back(); assert.equal(h.href(), scoped); assert.equal(h.controller.getSnapshot().listing?.vehicle?.engineId, 10);
  await h.back(); assert.equal(h.href(), vehicleUrl); assert.equal(h.controller.getSnapshot().listing?.vehicle?.year, 2015);
  await h.forward(); assert.equal(h.href(), scoped); assert.deepEqual(h.writes, [null], 'Popstate never rewrites memory');
});

test('A to B to Back/Forward restores full accepted request, page and presentation without pushing', async () => {
  const href = `${vehicleUrl}&sub_model_id=2&drive_type_id=3&body_style_config_id=4&transmission_id=5&region_id=6&q=pads&original_q=full+fixture+phrase&category=fixture-pads&category_parent=fixture-brakes&part_type=700&brand=A&in_stock_only=true&sort=price&sort_order=desc&page=2`;
  const h = harness(href);
  await h.controller.load();
  const before = h.controller.getSnapshot().listing;
  assert.ok(before); assert.equal(before.status, 'ready');
  assert.deepEqual(before.unverified, ['sub_model_id', 'drive_type_id', 'body_style_config_id', 'transmission_id', 'region_id', 'part_type']);
  const request = searchParams(listingQuery(before.state)); assert.ok(request);
  for (const [key, value] of Object.entries({ engine_base_id: '10', sub_model_id: '2', drive_type_id: '3', body_style_config_id: '4', transmission_id: '5', region_id: '6', part_type: '700', category: 'fixture-pads', page: '2', in_stock_only: 'true' })) assert.equal(request.get(key), value);
  assert.equal(request.has('original_q'), false); assert.equal(request.has('scope'), false);
  await h.controller.transition({ type: 'replace-vehicle', vehicle: { ...remembered, year: 2016 } });
  const b = h.href();
  assert.equal(h.controller.getSnapshot().listing?.state.category, undefined);
  await h.back();
  assert.deepEqual(h.controller.getSnapshot().listing, before);
  assert.equal(h.controller.getSnapshot().presentation?.scroll.y, 740);
  assert.equal(h.controller.getSnapshot().presentation?.focusKey, 'catalog-next');
  assert.deepEqual(h.controller.getSnapshot().presentation?.disclosure?.categories, [], 'Collapsed branch is preserved');
  await h.forward(); assert.equal(h.href(), b); assert.equal(h.pushes.length, 1); assert.equal(h.writes.length, 1);
});

test('unknown references block activation, outages differ from unknown, child-only category payload is a gap', async () => {
  for (const [url, reason, references] of [
    [vehicleUrl.replace('2015', '2014'), 'unknown', refs],
    [vehicleUrl.replace('Fixture+Make', 'Other'), 'unknown', refs],
    [vehicleUrl.replace('Fixture+Model', 'Other'), 'unknown', refs],
    [vehicleUrl.replace('=10', '=999'), 'unknown', refs],
    [`${vehicleUrl}&category=fixture-pads&category_parent=fixture-brakes`, 'unknown', { ...refs, getChildren: async () => [{ ...category, slug: 'wrong' }] }],
    [`${vehicleUrl}&category=fixture-pads`, 'contract-gap', refs],
    [`${vehicleUrl}&category=fixture-pads&category_parent=wrong`, 'unknown', refs],
    [vehicleUrl, 'unavailable', { ...refs, getMakes: async () => { throw new Error('offline'); } }],
  ] as const) {
    const h = harness(url, references); await h.controller.load();
    assert.equal(h.controller.getSnapshot().recovery?.reason, reason, url);
    assert.equal(h.controller.getSnapshot().listing, undefined);
    assert.equal(h.href(), url); assert.deepEqual(h.pushes, []); assert.deepEqual(h.writes, []);
  }
});

test('slow superseded resolution cannot save or push an obsolete vehicle', async () => {
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const h = harness('/?scope=all', { ...refs, getYears: async () => { await barrier; return refs.getYears(); } });
  await h.controller.load();
  const pending = h.controller.transition({ type: 'replace-vehicle', vehicle: remembered });
  await h.controller.transition({ type: 'catalog-root' });
  release(); await pending;
  assert.equal(h.href(), '/?scope=all'); assert.equal(h.controller.getSnapshot().listing?.vehicle, null);
  assert.deepEqual(h.writes, []); assert.deepEqual(h.pushes, []);
});

test('stale remembered membership is recoverable and is never replaced with another vehicle', async () => {
  const h = harness('/', { ...refs, getEngines: async () => [] });
  await h.controller.load();
  assert.equal(h.controller.getSnapshot().recovery?.reason, 'unknown');
  assert.equal(h.controller.getSnapshot().listing, undefined);
  assert.deepEqual(h.writes, []); assert.deepEqual(h.pushes, []); assert.equal(h.href(), '/');
});

test('active ERP transport carries all six constraints separately from category and PCDB identity', async () => {
  const previous = globalThis.fetch;
  let request: URL | undefined;
  globalThis.fetch = async input => {
    request = new URL(String(input), 'http://fixture.test');
    return Response.json({ results: [], pagination: { total: 0, page: 2, has_more: false } });
  };
  try {
    const state = listing(`${vehicleUrl}&sub_model_id=2&drive_type_id=3&body_style_config_id=4&transmission_id=5&region_id=6&q=pads&original_q=full+phrase&category=fixture-pads&category_parent=fixture-brakes&part_type=700&page=2`);
    const resolved = await resolveListing(state, refs); assert.equal(resolved.status, 'ready');
    if (resolved.status !== 'ready') throw new Error('Expected accepted search');
    const query = listingQuery(state);
    const filters = Object.fromEntries(Object.entries(query).filter(([key]) => !['year', 'make', 'model', 'q', 'category', 'page'].includes(key)));
    await partsApi.search({ q: state.text.residual, category: resolved.category, vehicle: resolved.vehicle, page: state.filters.page, filters });
    assert.ok(request);
    for (const [key, value] of Object.entries({ resource: 'search', engine_base_id: '10', sub_model_id: '2', drive_type_id: '3', body_style_config_id: '4', transmission_id: '5', region_id: '6', category: 'fixture-pads', part_type: '700', page: '2', in_stock_only: 'all' })) assert.equal(request.searchParams.get(key), value);
    for (const key of ['original_q', 'scope', 'market', 'category_parent']) assert.equal(request.searchParams.has(key), false);
    assert.ok(![...request.searchParams.values()].includes('500'), 'Taxonomy id is never PCDB part_type');
  } finally { globalThis.fetch = previous; }
});

test('native product links preserve identity and exact background URL; direct close uses explicit all', () => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const popDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'PopStateEvent');
  const href = `${vehicleUrl}&q=pads&page=2`;
  const background: CatalogBackground = { version: 1, href, scroll: { x: 0, y: 900 }, focusKey: 'product-fixture',
    disclosure: { years: [2015], makes: [], models: [], engines: [], categories: [] } };
  let pushes = 0, backs = 0, captures = 0, prevented = 0;
  const location = { pathname: '/', search: href.slice(1) };
  const history = { state: {} as Record<string, unknown> | null,
    pushState(state: Record<string, unknown>, _unused: string, href: string) { pushes++; this.state = state; location.pathname = href; },
    replaceState(state: Record<string, unknown> | null, _unused: string, href: string) { this.state = state; location.pathname = href; },
    back() { backs++; } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location, history, dispatchEvent(event: Event) {
    if (event.type === 'roys:catalog-capture') { captures++; history.state = { roysCatalog: background }; }
  } } });
  Object.defineProperty(globalThis, 'PopStateEvent', { configurable: true, value: Event });
  const click = (extra = {}) => ({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
    preventDefault() { prevented++; }, ...extra }) as MouseEvent<HTMLAnchorElement>;
  try {
    for (const extra of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) followProduct(click(extra), 'ABCD_FIXTURE');
    assert.equal(prevented, 0); assert.equal(captures, 0); assert.equal(pushes, 0);
    followProduct(click(), 'ABCD_FIXTURE');
    assert.equal(location.pathname, '/products/ABCD_FIXTURE');
    assert.deepEqual(history.state?.roysProductBackground, background);
    assert.equal(pushes, 1); assert.equal(captures, 1);
    followProduct(click(), 'ABCD_FIXTURE'); assert.equal(pushes, 1);
    closeProduct(); assert.equal(backs, 1);
    history.state = { roysProductOverlay: true, roysProductBackground: { href: '//hostile' } };
    closeProduct(); assert.equal(backs, 1, 'Malformed overlay background never authorizes Back');
    history.state = null; closeProduct(); assert.equal(location.pathname, '/?scope=all');
  } finally {
    if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor); else Reflect.deleteProperty(globalThis, 'window');
    if (popDescriptor) Object.defineProperty(globalThis, 'PopStateEvent', popDescriptor); else Reflect.deleteProperty(globalThis, 'PopStateEvent');
  }
});

test('product entry never restores remembered vehicle or writes memory', async () => {
  const h = harness('/products/ABCD_FIXTURE'); await h.controller.load();
  assert.equal(h.controller.getSnapshot().status, 'product');
  assert.equal(h.controller.getSnapshot().listing, undefined); assert.deepEqual(h.pushes, []); assert.deepEqual(h.writes, []);
  assert.equal(serializeNavigation(listing('/?scope=all')), '/?scope=all');
});

test('verified parent URL selects and cold-resolves a leaf through roots plus exactly one children resource', async () => {
  const previous = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async input => {
    const url = new URL(String(input), 'http://fixture.test');
    const resource = url.searchParams.get('resource'); requests.push(`${resource}:${url.searchParams.get('slug') ?? ''}`);
    if (resource === 'categories') return Response.json({ data: [{ id: 400, slug: 'fixture-parent-contract', display_name: 'Fixture Brakes' }] });
    assert.equal(resource, 'category'); assert.equal(url.searchParams.get('slug'), 'fixture-parent-contract', 'Never fetch the leaf slug or crawl other roots');
    return Response.json({ data: { id: 400, slug: 'fixture-parent-contract', display_name: 'Fixture Brakes',
      subcategories: [{ id: 500, slug: 'fixture-child-contract', display_name: 'Fixture Pads', mapped_part_type_count: 1 }] } });
  };
  try {
    const references = { ...refs, getCategories: categoryApi.getAll, getChildren: categoryApi.getChildren };
    const h = harness(vehicleUrl, references); await h.controller.load();
    const selected = commitCategorySelection(h.controller.getSnapshot().listing!.state, remembered,
      { kind: 'category-slug', slug: 'fixture-child-contract', parentSlug: 'fixture-parent-contract' });
    await h.controller.navigate(selected, 'remember');
    assert.match(h.href(), /category_parent=fixture-parent-contract/);
    const fresh = harness(h.href(), references); await fresh.controller.load();
    assert.equal(fresh.controller.getSnapshot().listing?.category?.id, 500);
    assert.equal(fresh.controller.getSnapshot().listing?.category?.parentId, 400);
    assert.deepEqual(fresh.writes, []); assert.deepEqual(fresh.pushes, []);
    const wrong = await resolveListing({ ...selected, category: { ...selected.category!, slug: 'other-child' } }, references);
    assert.equal(wrong.status, 'recovery'); if (wrong.status === 'recovery') assert.equal(wrong.reason, 'unknown');
    const missing = await resolveListing({ ...selected, category: { kind: 'category-slug', slug: 'fixture-child-contract' } }, references);
    assert.equal(missing.status, 'recovery'); if (missing.status === 'recovery') assert.equal(missing.reason, 'contract-gap');
    assert.deepEqual(requests, ['categories:', 'category:fixture-parent-contract'], 'Existing reference cache reuses verified parent children on ordinary selection');
  } finally { globalThis.fetch = previous; }
});

test('rapid brand, stock and page edits compose pending intent while only the newest resolution pushes', async () => {
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  let delayed = false;
  const h = harness(`${vehicleUrl}&category=fixture-pads&category_parent=fixture-brakes`, {
    ...refs, getCategories: async () => { if (delayed) await barrier; return refs.getCategories(); },
  });
  await h.controller.load(); delayed = true;
  const brand = h.controller.transition({ type: 'change-query', key: 'brand', value: 'Fixture Brand' });
  const stock = h.controller.transition({ type: 'change-query', key: 'in_stock_only', value: 'true' });
  const page = h.controller.transition({ type: 'change-query', key: 'page', value: '2' });
  release(); await Promise.all([brand, stock, page]);
  assert.equal(h.pushes.length, 1); assert.deepEqual(h.writes, []);
  const current = h.controller.getSnapshot().listing!.state;
  assert.equal(current.filters.brand, 'Fixture Brand'); assert.equal(current.availability, 'true'); assert.equal(current.filters.page, 2);
  assert.equal(current.category?.parentSlug, 'fixture-brakes');
});

test('vehicle replacement and popstate supersede cumulative pending edits without stale saves or pushes', async () => {
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  let delayed = false;
  const h = harness(vehicleUrl, { ...refs, getYears: async () => { if (delayed) await barrier; return refs.getYears(); } });
  await h.controller.load();
  await h.controller.transition({ type: 'change-query', key: 'q', value: 'first intent' });
  delayed = true;
  const replacement = h.controller.transition({ type: 'replace-vehicle', vehicle: { ...remembered, year: 2016 } });
  const stock = h.controller.transition({ type: 'change-query', key: 'in_stock_only', value: 'true' });
  const back = h.back();
  release(); await Promise.all([replacement, stock, back]);
  assert.equal(h.href(), vehicleUrl); assert.equal(h.controller.getSnapshot().listing?.vehicle?.year, 2015);
  assert.equal(h.controller.getSnapshot().listing?.state.availability, 'all');
  assert.equal(h.pushes.length, 1); assert.deepEqual(h.writes, []);
});

test('same-engine category commit retains six configuration constraints; replacement clears old intent', () => {
  const state = listing(`${vehicleUrl}&sub_model_id=2&drive_type_id=3&body_style_config_id=4&transmission_id=5&region_id=6&q=pads&original_q=old+phrase&part_type=700&brand=A&in_stock_only=true&sort=price&page=2`);
  const same = commitCategorySelection(state, remembered, { kind: 'category-slug', slug: 'fixture-pads', parentSlug: 'fixture-brakes' });
  assert.deepEqual(same.scope, state.scope); assert.equal(same.availability, 'true'); assert.equal(same.filters.sort, 'price');
  assert.equal(same.filters.brand, undefined); assert.equal(same.partType, undefined); assert.equal(same.filters.page, 1);
  assert.deepEqual(same.text, { original: '', residual: '' });
  const changed = commitCategorySelection(state, { ...remembered, year: 2016 }, same.category!);
  assert.deepEqual(changed.scope, { kind: 'vehicle', vehicle: { ...remembered, year: 2016 } });
  assert.equal(changed.availability, 'all'); assert.deepEqual(changed.filters, { sort: 'relevance', sortOrder: 'asc', page: 1 });
});

test('PCDB-only global input is recoverable without issuing a search or manufacturing a type reference', async () => {
  const h = harness('/?scope=all&part_type=700'); await h.controller.load();
  assert.equal(h.controller.getSnapshot().recovery?.reason, 'contract-gap'); assert.equal(h.controller.getSnapshot().listing, undefined);
  assert.equal(h.href(), '/?scope=all&part_type=700'); assert.deepEqual(h.writes, []); assert.deepEqual(h.pushes, []);
  for (const href of ['/?q=pads&part_type=700', `${vehicleUrl}&part_type=700`]) {
    const accepted = await resolveListing(listing(href), refs); assert.equal(accepted.status, 'ready');
    if (accepted.status === 'ready') assert.deepEqual(accepted.unverified, ['part_type']);
  }
});

test('deferred branch/results restoration waits even for an existing target and restores Details among same-SKU links', () => {
  const actions: string[] = [];
  let pending = true;
  const anchor = (control: string) => ({ dataset: { catalogFocus: control }, getAttribute: () => '/products/ABCD_FIXTURE',
    closest: () => null, focus: () => actions.push(control) });
  const image = anchor('image'), title = anchor('title'), details = anchor('details');
  const main = { querySelector: () => pending ? {} : null, querySelectorAll: () => [image, title, details],
    ownerDocument: { getElementById: () => title }, contains: () => true,
    focus: () => actions.push('main'), scrollTo: (x: number, y: number) => actions.push(`scroll:${x},${y}`) } as unknown as HTMLElement;
  const presentation: CatalogBackground = { version: 1, href: vehicleUrl, scroll: { x: 0, y: 900 },
    focusKey: 'link:/products/ABCD_FIXTURE', focusControl: 'details', focusIndex: 0 };
  assert.equal(restoreCatalogPresentation(main, presentation, false), false); assert.deepEqual(actions, []);
  pending = false;
  assert.equal(restoreCatalogPresentation(main, presentation, true), false); assert.deepEqual(actions, []);
  assert.equal(restoreCatalogPresentation(main, presentation, false), true); assert.deepEqual(actions, ['details', 'scroll:0,900']);
  actions.length = 0;
  assert.equal(restoreCatalogPresentation(main, { ...presentation, focusKey: 'link:/products/ABCD_REMOVED' }, false), true);
  assert.deepEqual(actions, ['main', 'scroll:0,900'], 'Collapsed/removed control uses safe main ancestor');
  actions.length = 0;
  const target = { focus: () => actions.push('results'), scrollIntoView: () => actions.push('reveal') } as unknown as HTMLElement;
  assert.equal(restoreCatalogPresentation(main, undefined, false, target), true); assert.deepEqual(actions, ['results', 'reveal'], 'Clean URL reveals mounted results');
});


test('header-focused Catalog capture preserves main scroll and omits focus metadata outside main', () => {
  const header = { id: '', tagName: 'A', dataset: {}, getAttribute: () => '/?scope=all' } as unknown as HTMLElement;
  const main = { scrollLeft: 3, scrollTop: 740, contains: () => false,
    querySelectorAll: () => { throw new Error('Outside anchor must never be indexed among main controls'); } } as unknown as HTMLElement;
  const capture = captureCatalogPresentation(main, vehicleUrl, { years: [], makes: [], models: [], engines: [], categories: [] }, header);
  assert.ok(capture); assert.deepEqual(capture.scroll, { x: 3, y: 740 });
  assert.equal(capture.focusKey, undefined); assert.equal(capture.focusControl, undefined); assert.equal(capture.focusIndex, undefined);
});

test('pending configuration survives a same-engine category commit', async () => {
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  let delayed = false;
  const h = harness(vehicleUrl, { ...refs, getYears: async () => { if (delayed) await barrier; return refs.getYears(); } });
  await h.controller.load(); delayed = true;
  const config = h.controller.transition({ type: 'change-query', key: 'sub_model_id', value: '22' });
  const category = h.controller.selectCategory(remembered, { kind: 'category-slug', slug: 'fixture-pads', parentSlug: 'fixture-brakes' });
  release(); await Promise.all([config, category]);
  const state = h.controller.getSnapshot().listing!.state;
  assert.equal(state.scope.kind, 'vehicle');
  if (state.scope.kind === 'vehicle') assert.equal(state.scope.vehicle.dimensions.sub_model_id, '22');
  assert.equal(state.category?.slug, 'fixture-pads'); assert.equal(h.pushes.length, 1); assert.equal(h.writes.length, 1);
});

test('clear filters composes pending vehicle and query edits without restoring the prior committed scope', async () => {
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  let delayed = false;
  const h = harness(`${vehicleUrl}&q=old+query&brand=Old`, { ...refs, getYears: async () => { if (delayed) await barrier; return refs.getYears(); } });
  await h.controller.load(); delayed = true;
  const vehicle = h.controller.transition({ type: 'replace-vehicle', vehicle: { ...remembered, year: 2016 } });
  const query = h.controller.transition({ type: 'change-query', key: 'q', value: 'new query' });
  const stock = h.controller.transition({ type: 'change-query', key: 'in_stock_only', value: 'true' });
  const clear = h.controller.clearFilters();
  release(); await Promise.all([vehicle, query, stock, clear]);
  const accepted = h.controller.getSnapshot().listing!;
  assert.equal(accepted.vehicle?.year, 2016); assert.equal(accepted.state.text.residual, 'new query');
  assert.equal(accepted.state.availability, 'all'); assert.equal(accepted.state.filters.brand, undefined);
  assert.equal(h.pushes.length, 1); assert.equal(h.writes.length, 1);
  assert.equal(h.memory()?.year, 2016, 'Pending deliberate vehicle is saved only by accepted final intent');
});
