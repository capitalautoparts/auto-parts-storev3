import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MARKET, DIMENSIONS } from '../src/features/catalog/model.ts';
import type { ListingNavigationState } from '../src/features/catalog/navigation-state.ts';
import type { SearchIntentReferences } from '../src/features/catalog/search-intent.ts';
import { chooseIntentEngine, interpretSearch, loadIntentEngines, searchIntentContextKey } from '../src/features/catalog/search-intent.ts';
import { searchIntentApi } from '../src/features/catalog/search-intent-api.ts';

// Synthetic authoritative reference fixtures, not live VCdb/PCDB or fitment claims.
const makes = [{ id: 10, name: 'Chevrolet' }, { id: 20, name: 'Ford' }];
const models = [{ id: 101, makeId: 10, name: 'Silverado 1500' }, { id: 102, makeId: 10, name: 'Silverado 2500 HD' },
  { id: 103, makeId: 10, name: 'Spark' }, { id: 201, makeId: 20, name: 'F-150' }];
const engines = [{ id: 501, modelId: 101, name: '5.3L V8' }, { id: 502, modelId: 101, name: '4.3L V6' },
  { id: 0, modelId: 101, name: 'Engine unspecified' }];
const references: SearchIntentReferences = {
  async getYears() { return [{ year: 2015 }, { year: 2018 }]; },
  async getMakes() { return makes; },
  async getModels(makeId) { return models.filter(model => model.makeId === makeId); },
  async getEngines(modelId) { return engines.filter(engine => engine.modelId === modelId); },
};
const context = (): ListingNavigationState => ({ kind: 'catalog', market: MARKET, scope: { kind: 'all' },
  availability: 'all', text: { original: '', residual: '' }, filters: { sort: 'relevance', sortOrder: 'asc', page: 1 } });

const interpret = (original: string, refs = references) => interpretSearch({ original, context: context() }, refs);
function first(draft: Awaited<ReturnType<typeof interpretSearch>>) {
  assert.equal(draft.status, 'candidates');
  assert.equal(draft.vehicles.length, 1);
  return draft.vehicles[0];
}

test('catalog-backed aliases, Unicode and compact/split model punctuation share identity', async () => {
  for (const make of ['Chevy', 'Chev', 'Chevrolet', 'Chévy']) {
    const draft = await interpret(`2015 ${make} Silverado1500 brake pad`), candidate = first(draft);
    assert.deepEqual([candidate.make.id, candidate.model.id], [10, 101]);
    assert.equal(candidate.residual.text, 'brake pad');
    assert.equal(draft.literal.query, `2015 ${make} Silverado1500 brake pad`);
  }
  for (const model of ['F150', 'F-150', 'F 150', 'F\u2011150']) {
    assert.equal(first(await interpret(`2018 Ford ${model} brake pads`)).model.id, 201);
  }
  const phrases = ['2015 Chevrolet Silverado 2500 HD brake pads', 'spark plugs for 2015 Chevy Silverado 1500'];
  assert.equal(first(await interpret(phrases[0])).model.id, 102);
  assert.equal(first(await interpret(phrases[1])).model.id, 101, 'nearby model wins over Spark part word');
});

test('reordered phrase retains connective words and original UTF-16 source spans', async () => {
  const original = 'brake + pads for 2015 Chévy Silverado 1500 with LT';
  const draft = await interpret(original), candidate = first(draft);
  assert.equal(draft.original, original);
  assert.equal(candidate.residual.text, 'brake + pads for with LT');
  for (const span of [...candidate.consumed, ...candidate.residual.spans]) assert.equal(original.slice(span.start, span.end), span.text);
  assert.equal(candidate.consumed.filter(span => span.kind === 'model').map(span => span.text).join(' '), 'Silverado 1500');
  assert.ok(candidate.residual.text.includes('LT'), 'unverified trim must not disappear');
});

test('bare Silverado returns explicit model choices without engine lookup or 1500 default', async () => {
  let engineCalls = 0;
  const draft = await interpret('2015 Chevy Silverado brake pad', { ...references,
    async getEngines() { engineCalls++; return engines; } });
  assert.deepEqual(draft.vehicles.map(vehicle => vehicle.model.id), [101, 102]);
  assert.equal(engineCalls, 0);
  assert.ok(draft.vehicles.every(vehicle => vehicle.engine.status === 'pending'));
  const selected = await loadIntentEngines(draft.vehicles[0], references);
  assert.deepEqual(selected.engine.options.map(engine => engine.id), [501, 502]);
});

test('engine match is exact-YMM evidence and consumes text only after explicit selection', async () => {
  const original = '2015 Chevy Silverado 1500 5.3L V8 brake pads';
  const candidate = first(await interpret(original));
  assert.equal(candidate.engine.status, 'matched');
  assert.deepEqual(candidate.engine.matchedIds, [501]);
  assert.equal(candidate.engine.selectedId, undefined);
  assert.equal(candidate.residual.text, '5.3L V8 brake pads');
  const chosen = chooseIntentEngine(candidate, 501);
  assert.equal(chosen.residual.text, 'brake pads');
  assert.equal(chosen.engine.selectedId, 501);
  assert.equal(chooseIntentEngine(chosen, 502).residual.text, '5.3L V8 brake pads', 'changing to an unmatched engine restores typed text');
  assert.throws(() => chooseIntentEngine(candidate, 0));
  assert.throws(() => chooseIntentEngine(candidate, 999));
});

test('duplicate engine labels keep different IDs; semantic aliases are unresolved', async () => {
  const original = '2015 Chevy Silverado 1500 5.3L V8 brake pad';
  const duplicate = first(await interpret(original, { ...references, async getEngines() {
    return [...engines, { id: 503, modelId: 101, name: '5.3L V8' }, { id: 999, modelId: 102, name: '5.3L V8' }];
  } }));
  assert.equal(duplicate.engine.status, 'ambiguous');
  assert.deepEqual(duplicate.engine.matchedIds, [501, 503]);
  assert.equal(chooseIntentEngine(duplicate, 503).residual.text, 'brake pad');
  const semantic = first(await interpret(original, { ...references, async getEngines() {
    return [{ id: 504, modelId: 101, name: '5.3L 8-Cyl V' }];
  } }));
  assert.equal(semantic.engine.status, 'unresolved', 'no sourced V8 -> 8-Cyl V mapping');
  assert.equal(chooseIntentEngine(semantic, 504).residual.text, '5.3L V8 brake pad');
  const alternatives = first(await interpret('2015 Chevy Silverado 1500 5.3L V8 or 4.3L V6 brake pad'));
  assert.equal(alternatives.engine.status, 'ambiguous');
  assert.equal(chooseIntentEngine(alternatives, 502).residual.text, '5.3L V8 or brake pad');
  const plus = first(await interpret('2015 Chevy + Silverado 1500 5.3L + V8 brake pad'));
  assert.equal(plus.engine.status, 'unresolved');
  assert.equal(plus.residual.text, '+ 5.3L + V8 brake pad');
  for (const separator of ['/', ',', ';']) {
    const punctuated = first(await interpret(`2015 Chevy Silverado 1500 5.3L ${separator} V8 brake pad`));
    assert.equal(punctuated.engine.status, 'unresolved');
    assert.equal(punctuated.residual.text, `5.3L ${separator} V8 brake pad`);
    assert.equal(chooseIntentEngine(punctuated, 501).residual.text, `5.3L ${separator} V8 brake pad`);
  }
  const invalid = first(await interpret('2018 Ford F150 5.3L V8 brake pad'));
  assert.equal(invalid.engine.status, 'unresolved');
  assert.deepEqual(invalid.engine.options, []);
  assert.equal(invalid.residual.text, '5.3L V8 brake pad');
});

test('plain identifiers, year-like MPN, plus and two years remain literal with no lookup', async () => {
  let calls = 0;
  const refs = { ...references, async getYears() { calls++; throw new Error('must not call'); } };
  for (const original of ['ALD1212M', 'DVNJ_ALD1212M', 'ald-1212m', 'OE+123', 'AB\u00c912', '2015', '2015+ Chevy', '2015 2018 Chevy Silverado']) {
    const draft = await interpret(original, refs);
    assert.equal(draft.status, 'literal', original);
    assert.equal(draft.literal.query, original);
    assert.equal(draft.identifierLookup, 'not-requested');
  }
  assert.equal(calls, 0);
});

test('exact MPN/SKU/interchange evidence preserves ranking and is bound to original/context', async () => {
  const state = context();
  for (const source of ['erp-exact-mpn', 'erp-exact-sku', 'erp-exact-interchange'] as const) {
    const original = source === 'erp-exact-mpn' ? '2015' : source === 'erp-exact-sku' ? 'DVNJ_ALD1212M' : 'OE+123';
    const exact = { source, original, contextKey: searchIntentContextKey(state),
      products: [{ sku: 'DVNJ_ALD1212M', matchedIdentifier: original }, { sku: 'BRND_ALD1212M', matchedIdentifier: original }] };
    const draft = await interpretSearch({ original, context: state, exact }, { ...references, async getYears() { throw new Error('must not call'); } });
    assert.equal(draft.status, 'exact');
    assert.deepEqual(draft.exact, exact);
    assert.equal(draft.literal.query, original);
    assert.deepEqual(draft.vehicles, []);
    const stale = await interpretSearch({ original: 'different', context: state, exact }, references);
    assert.equal(stale.status, 'literal');
    assert.equal(stale.identifierLookup, 'not-requested');
    const changed = { ...state, availability: 'true' as const };
    assert.equal((await interpretSearch({ original, context: changed, exact }, references)).status, 'literal');
  }
});

test('explicit scope, six dimensions, market and result filters survive a conflicting draft unchanged', async () => {
  const state: ListingNavigationState = { ...context(), availability: 'true', scope: { kind: 'vehicle', vehicle: {
    year: 2018, make: 'Ford', model: 'F-150', dimensions: Object.fromEntries(DIMENSIONS.map((dimension, i) => [dimension, String(i + 1)])) } },
    filters: { brand: 'A+B', sort: 'price', sortOrder: 'desc', page: 2 } };
  const before = structuredClone(state), draft = await interpretSearch({ original: '2015 Chevy Silverado 1500 brake pad', context: state }, references);
  assert.equal(first(draft).conflictsWithContext, true);
  assert.deepEqual(state, before);
  assert.deepEqual(draft.context, before);
  assert.notEqual(draft.context, state);
  const key = searchIntentContextKey(state);
  for (const dimension of DIMENSIONS) {
    const changed = structuredClone(state);
    if (changed.scope.kind === 'vehicle') changed.scope.vehicle.dimensions[dimension] = '99';
    assert.notEqual(searchIntentContextKey(changed), key, dimension);
  }
  const matching = structuredClone(state);
  if (matching.scope.kind === 'vehicle') Object.assign(matching.scope.vehicle, { year: 2015, make: 'Chevrolet', model: 'Silverado 1500' });
  assert.equal(first(await interpretSearch({ original: '2015 Chevy Silverado 1500', context: matching }, references)).conflictsWithContext, false);
  const engineDraft = first(await interpretSearch({ original: '2015 Chevy Silverado 1500 5.3L V8', context: matching }, references));
  assert.equal(engineDraft.conflictsWithContext, false, 'explicitly a YMM-only comparison');
  assert.equal(engineDraft.engineConflict, 'different', 'typed engine conflicts with same-YMM committed engine 1');
  if (matching.scope.kind === 'vehicle') matching.scope.vehicle.dimensions.engine_base_id = '501';
  const sameEngine = first(await interpretSearch({ original: '2015 Chevy Silverado 1500 5.3L V8', context: matching }, references));
  assert.equal(sameEngine.engineConflict, 'same');
  assert.equal(chooseIntentEngine(sameEngine, 502).engineConflict, 'different');
  assert.equal(chooseIntentEngine(chooseIntentEngine(sameEngine, 502), 501).engineConflict, 'same');
});

test('PCDB prefixes disclose a deterministic gap independent of tree history; no listing or crawl', async () => {
  for (const original of ['brake pad', 'brake pads', 'ball j']) {
    const draft = await interpret(original);
    assert.deepEqual(draft.partTypes, { status: 'contract-gap', code: 'PCDB_PREFIX_UNAVAILABLE', query: original });
    assert.equal(draft.literal.query, original);
  }
});

test('no-match, reference refusal/failure, timeout and cancellation are distinct', async () => {
  assert.equal((await interpret('2015 Chevy Unknown brake pad')).reason, 'no-match');
  const failed = await interpret('2015 Chevy Silverado 1500', { ...references, async getMakes() { throw new Error('CATALOG_UPSTREAM_REFUSED'); } });
  assert.deepEqual([failed.status, failed.reason], ['unavailable', 'reference-failure']);
  const timeout = await interpretSearch({ original: '2015 Chevy Silverado 1500', context: context(), timeoutMs: 1 },
    { ...references, getYears: () => new Promise(() => {}) });
  assert.deepEqual([timeout.status, timeout.reason], ['unavailable', 'timeout']);
  const controller = new AbortController();
  let release!: (value: { year: number }[]) => void;
  const pending = interpretSearch({ original: '2015 Chevy Silverado 1500', context: context(), signal: controller.signal },
    { ...references, getYears: () => new Promise(resolve => { release = resolve; }) });
  await Promise.resolve();
  controller.abort();
  const cancelled = await pending;
  assert.equal(cancelled.status, 'cancelled');
  release([{ year: 2015 }]);
  assert.deepEqual(cancelled.vehicles, [], 'late reference completion cannot revive a cancelled draft');
});

test('same-origin opt-in adapter reuses reference cache and bounds one full interpretation to four GETs', async () => {
  const oldFetch = globalThis.fetch, requests: string[] = [];
  // Actual ERP response shape from vehicles.ts; identities remain synthetic.
  const apiEngines = [
    { id: 501, description: '5.3L 8-Cyl V', details: { liter: '5.3', cylinders: '8', block_type: 'V', cc: '5328', cid: '325' } },
    { id: 502, description: '4.3L 6-Cyl V', details: { liter: '4.3', cylinders: '6', block_type: 'V' } },
    { id: 503, description: '5.3L 8-Cyl V', details: { liter: 5.3, cylinders: 8, block_type: 'V' } },
    { id: 504, description: '5.3L V8', details: { liter: 'bad', cylinders: 8, block_type: 'V' } },
    { id: 505, description: '5.3L 8-Cyl V', details: { liter: 5.3, block_type: 'V' } },
    { id: 506, description: '5.3L V8', details: { liter: 4.3, cylinders: 6, block_type: 'V' } },
    { id: 507, description: '5.3L 8-Cyl V' },
    { id: 508, description: '5.3L V8', details: { liter: true, cylinders: 8, block_type: 'V' } },
    { id: 509, description: '5.3L V8', details: { liter: 5.3, cylinders: 8, block_type: 'V', cc: 'Infinity' } },
    { id: 0, description: 'Engine unspecified' },
  ];
  globalThis.fetch = async (input, init) => {
    assert.equal(init?.signal, undefined, 'shared reference work is not cancelled by one draft');
    const url = new URL(String(input), 'http://same-origin.test');
    assert.equal(url.pathname, '/api/catalog');
    requests.push(url.search);
    const resource = url.searchParams.get('resource');
    const body = resource === 'years' ? { years: [2015] } : resource === 'makes' ? { makes }
      : resource === 'models' ? { models: models.filter(model => model.makeId === 10) }
      : resource === 'engines' ? { engines: apiEngines } : null;
    assert.ok(body, 'no search/facets/category traversal');
    if (resource === 'engines') assert.deepEqual([...url.searchParams.entries()].filter(([key]) => key !== 'resource'),
      [['year', '2015'], ['make', 'Chevrolet'], ['model', 'Silverado 1500']]);
    return Response.json(body);
  };
  try {
    const draft = await searchIntentApi.interpret({ original: '2015 Chevy Silverado 1500 5.3L V8 brake pad', context: context() });
    const candidate = first(draft);
    assert.equal(candidate.engine.status, 'ambiguous');
    assert.deepEqual(candidate.engine.matchedIds, [501, 503], 'validated structured fields establish V8 / 8-Cyl V equivalence');
    assert.equal(chooseIntentEngine(candidate, 501).residual.text, 'brake pad');
    assert.deepEqual(candidate.engine.options.find(engine => engine.id === 501)?.details,
      { liter: 5.3, cylinders: 8, block_type: 'V', cc: 5328, cid: 325 });
    assert.equal(candidate.engine.options.find(engine => engine.id === 504)?.details, null);
    assert.equal(candidate.engine.options.find(engine => engine.id === 507)?.details, undefined);
    assert.ok(!candidate.engine.options.some(engine => engine.id === 0));
    assert.equal(requests.length, 4);
    await searchIntentApi.interpret({ original: '2015 Chevrolet Silverado 1500 ball j', context: context() });
    assert.equal(requests.length, 4, 'equivalent reference requests use existing cache');
  } finally { globalThis.fetch = oldFetch; }
});
