/**
 * WP-ROYS-RP2: additive draft interpretation; RP3 owns presentation and commit.
 * Adapted from Autrex src/lib/search/vehicleIntent.ts: foldKey, token windows,
 * nearest-anchor/longest-model ranking. No Next/auth imports or global rewriting.
 */
import type { VehicleEngine, VehicleMake, VehicleModel, VehicleYear } from '../../lib/api.ts';
import { DIMENSIONS } from './model.ts';
import type { ListingNavigationState } from './navigation-state.ts';
import { validSku } from '../../../server/product-data.ts';

export interface SearchIntentReferences {
  getYears(): Promise<VehicleYear[]>;
  getMakes(year: number): Promise<VehicleMake[]>;
  getModels(makeId: number, year: number): Promise<VehicleModel[]>;
  getEngines(modelId: number, year: number, makeId: number): Promise<VehicleEngine[]>;
}
export interface SourceSpan { start: number; end: number; text: string; kind: 'year' | 'make' | 'model' | 'engine' }
export interface ExactIdentifierEvidence {
  /** Evidence must come from an authoritative exact lane, never a generic result/boolean.
   * Association prevents applying a previous query/scope's evidence to this draft. */
  original: string;
  contextKey: string;
  source: 'erp-exact-sku' | 'erp-exact-mpn' | 'erp-exact-interchange';
  products: { sku: string; matchedIdentifier: string }[];
}
export interface EngineDraft {
  status: 'pending' | 'choose' | 'matched' | 'ambiguous' | 'unresolved';
  /** Positive engine IDs from THIS candidate's exact-YMM reference only. */
  options: VehicleEngine[];
  matchedIds: number[];
  matchedSpans: { id: number; spans: SourceSpan[] }[];
  requested: SourceSpan[];
  selectedId?: number;
}
export interface VehicleIntentCandidate {
  original: string;
  year: number;
  make: VehicleMake;
  model: VehicleModel;
  source: 'exact-year-make-model-references';
  /** YMM/all conflict only; engineConflict reports known configuration conflict.
   * A candidate is never a committed scope or a fitment/availability claim. */
  conflictsWithContext: boolean;
  contextEngineId?: string;
  engineConflict: 'not-applicable' | 'unverified' | 'same' | 'different';
  consumed: SourceSpan[];
  residual: { text: string; spans: { start: number; end: number; text: string }[] };
  engine: EngineDraft;
}
export interface SearchIntentDraft {
  status: 'literal' | 'candidates' | 'exact' | 'unavailable' | 'cancelled';
  reason?: 'no-vehicle' | 'year-or-identifier' | 'multiple-years' | 'no-match' | 'input-limit' | 'reference-failure' | 'timeout';
  original: string;
  /** Retain URL/active state, six dimensions, filters and availability without mutation. */
  context: ListingNavigationState;
  literal: { query: string; contextKey: string };
  vehicles: VehicleIntentCandidate[];
  exact?: ExactIdentifierEvidence;
  partTypes: { status: 'contract-gap'; code: 'PCDB_PREFIX_UNAVAILABLE'; query: string };
  identifierLookup: 'not-requested' | 'verified-exact-evidence';
}
export interface InterpretSearchInput {
  original: string;
  context: ListingNavigationState;
  exact?: ExactIdentifierEvidence;
  signal?: AbortSignal;
  /** Total wait budget, not a cancellation of shared cached reference work. */
  timeoutMs?: number;
  now?: Date;
}

/** Vehicle comparisons only: never apply this to an identifier or literal request. */
export function foldVehicleKey(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
// Autrex aliases reconciled with ERP vehicleSearchQuery.ts. Catalog names match
// directly; Range Rover is deliberately not a make alias (it is also a model).
const ALIASES: Readonly<Record<string, string>> = {
  chevy: 'chevrolet', chev: 'chevrolet', merc: 'mercedesbenz', mercedes: 'mercedesbenz', benz: 'mercedesbenz',
  vw: 'volkswagen', vdub: 'volkswagen', olds: 'oldsmobile', caddy: 'cadillac', cad: 'cadillac',
  beemer: 'bmw', bimmer: 'bmw', jag: 'jaguar', landrover: 'landrover', alfa: 'alfaromeo',
  aston: 'astonmartin', rolls: 'rollsroyce',
};
interface Token { start: number; end: number; text: string; key: string }
interface Hit<T> { value: T; index: number; width: number; length: number; distance: number }
function tokenize(original: string): Token[] {
  return [...original.matchAll(/[^\s,;]+/gu)].map(match => ({ start: match.index!, end: match.index! + match[0].length,
    text: match[0], key: match[0].includes('+') ? '' : foldVehicleKey(match[0]) }));
}
function spans(tokens: Token[], index: number, width: number, kind: SourceSpan['kind']): SourceSpan[] {
  return tokens.slice(index, index + width).map(token => ({ start: token.start, end: token.end, text: token.text, kind }));
}
function remaining(original: string, consumed: SourceSpan[]): VehicleIntentCandidate['residual'] {
  // Keep every unconsumed character, including connective words, punctuation and +.
  // Whitespace is trimmed only at span boundaries; original offsets remain UTF-16.
  const ranges: VehicleIntentCandidate['residual']['spans'] = [];
  let cursor = 0;
  for (const span of [...consumed, { start: original.length, end: original.length }].sort((a, b) => a.start - b.start)) {
    if (span.start > cursor) {
      const raw = original.slice(cursor, span.start), leading = raw.length - raw.trimStart().length;
      const text = raw.trim();
      if (text) ranges.push({ start: cursor + leading, end: cursor + leading + text.length, text });
    }
    cursor = Math.max(cursor, span.end);
  }
  return { text: ranges.map(span => span.text).join(' '), spans: ranges };
}
/** Stable association key, not an extra cache. Includes full query scope and market. */
export function searchIntentContextKey(context: ListingNavigationState): string {
  const vehicle = context.scope.kind === 'vehicle' ? context.scope.vehicle : undefined;
  return JSON.stringify([context.market.country, context.market.currency, context.market.locale, context.availability,
    context.kind, context.scope.kind, vehicle?.year, vehicle?.make, vehicle?.model,
    DIMENSIONS.map(key => vehicle?.dimensions[key] ?? null), context.category?.slug ?? null, context.category?.parentSlug ?? null,
    context.partType?.id ?? null, context.text.original, context.text.residual,
    context.filters.brand ?? null, context.filters.sort, context.filters.sortOrder, context.filters.page]);
}
function base(input: InterpretSearchInput): SearchIntentDraft {
  const context = structuredClone(input.context);
  return { status: 'literal', original: input.original, context,
    literal: { query: input.original, contextKey: searchIntentContextKey(context) }, vehicles: [],
    partTypes: { status: 'contract-gap', code: 'PCDB_PREFIX_UNAVAILABLE', query: input.original }, identifierLookup: 'not-requested' };
}
class IntentWaitError extends Error {
  reason: 'cancelled' | 'timeout';
  constructor(reason: 'cancelled' | 'timeout') { super(reason); this.reason = reason; }
}
/** At most four sequential reference calls per interpretation; no taxonomy traversal.
 * A local timeout/abort stops waiting but never aborts shared reference-cache work. */
function bounded(input: Pick<InterpretSearchInput, 'signal' | 'timeoutMs'>) {
  const deadline = Date.now() + Math.min(5000, Math.max(1, input.timeoutMs ?? 2000));
  let calls = 0;
  return async <T>(read: () => Promise<T>): Promise<T> => {
    if (input.signal?.aborted) throw new IntentWaitError('cancelled');
    if (Date.now() >= deadline) throw new IntentWaitError('timeout');
    if (++calls > 4) throw new Error('Reference budget exceeded.');
    return new Promise<T>((resolve, reject) => {
      const aborted = () => finish(undefined, new IntentWaitError('cancelled'));
      const timer = setTimeout(() => finish(undefined, new IntentWaitError('timeout')), deadline - Date.now());
      function finish(value?: T, error?: unknown) {
        clearTimeout(timer); input.signal?.removeEventListener('abort', aborted);
        if (error) reject(error); else resolve(value as T);
      }
      input.signal?.addEventListener('abort', aborted, { once: true });
      Promise.resolve().then(() => {
        if (input.signal?.aborted) throw new IntentWaitError('cancelled');
        return read();
      }).then(value => {
        if (Array.isArray(value) && value.length > 1000) return finish(undefined, new Error('Reference size budget exceeded.'));
        if (input.signal?.aborted) aborted(); else finish(value);
      }, error => finish(undefined, error));
    });
  };
}
function windows<T>(tokens: Token[], used: Set<number>, values: T[], name: (value: T) => string,
  anchor: { index: number; width: number }, aliases = false): Hit<T>[] {
  const found: Hit<T>[] = [];
  for (let width = 1; width <= 4; width++) for (let index = 0; index + width <= tokens.length; index++) {
    if (tokens.slice(index, index + width).some((_, offset) => used.has(index + offset))) continue;
    const selected = tokens.slice(index, index + width);
    if (selected.some(token => !token.key)) continue;
    const key = selected.map(token => token.key).join('');
    if (key.length < 2) continue;
    const target = aliases ? ALIASES[key] ?? key : key;
    for (const value of values) if (foldVehicleKey(name(value)) === target) found.push({ value, index, width, length: key.length,
      distance: Math.max(0, index - anchor.index - anchor.width, anchor.index - index - width) });
  }
  return found.sort((a, b) => a.distance - b.distance || b.length - a.length);
}
function engineKey(value: string): string {
  // Preserve decimal points. Structured fields, never this key, establish the
  // equivalence between 'V8' and the reference label '8-Cyl V'.
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9.]/g, '');
}
function typedEngine(value: string): { liter: number; cylinders: number; block_type: string } | undefined {
  const compact = value.match(/^(\d+(?:\.\d+)?)\s*L\s*([VLIHW])\s*(\d{1,2})$/i);
  const descriptive = value.match(/^(\d+(?:\.\d+)?)\s*L\s*(\d{1,2})-Cyl\s*([VLIHW])$/i);
  if (compact) return { liter: +compact[1], cylinders: +compact[3], block_type: compact[2].toUpperCase() };
  if (descriptive) return { liter: +descriptive[1], cylinders: +descriptive[2], block_type: descriptive[3].toUpperCase() };
  return undefined;
}
function engineConflict(candidate: VehicleIntentCandidate, engine: EngineDraft): VehicleIntentCandidate['engineConflict'] {
  if (!candidate.contextEngineId) return 'not-applicable';
  const ids = engine.selectedId ? [engine.selectedId] : engine.matchedIds;
  if (!ids.length || (ids.length > 1 && ids.some(id => String(id) === candidate.contextEngineId))) return 'unverified';
  return ids.every(id => String(id) === candidate.contextEngineId) ? 'same' : 'different';
}
function engineDraft(original: string, candidate: VehicleIntentCandidate, options: VehicleEngine[]): EngineDraft {
  const tokens = tokenize(original), used = new Set(candidate.consumed.map(span => span.start));
  const available = options.filter(option => Number.isSafeInteger(option.id) && option.id > 0 && option.modelId === candidate.model.id);
  const matches: { id: number; requested: SourceSpan[] }[] = [];
  for (let width = 1; width <= 8; width++) for (let index = 0; index + width <= tokens.length; index++) {
    const selected = tokens.slice(index, index + width);
    if (selected.some(token => used.has(token.start) || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/i.test(token.text))) continue;
    if (selected.some((token, offset) => offset > 0 && !/^\s+$/.test(original.slice(selected[offset - 1].end, token.start)))) continue;
    const text = selected.map(token => token.text).join(' '), key = engineKey(text), typed = typedEngine(text);
    for (const option of available) {
      if (option.details === null) continue;
      const details = option.details;
      // A supplied conflicting field defeats label-only fallback too.
      if (typed && details && (Object.keys(typed) as (keyof typeof typed)[]).some(field => details[field] !== undefined && details[field] !== typed[field])) continue;
      const structured = typed && details && details.liter === typed.liter && details.cylinders === typed.cylinders && details.block_type === typed.block_type;
      if (structured || key === engineKey(option.name)) matches.push({ id: option.id, requested: spans(tokens, index, width, 'engine') });
    }
  }
  const matchedIds = [...new Set(matches.map(match => match.id))];
  const hints = tokens.filter(token => !used.has(token.start) && /^(?:\d+(?:\.\d+)?l|[vliwh]\d{1,2}|\d{1,2}[-\u2011]?cyl(?:inder)?s?)$/i.test(token.text));
  return { status: matchedIds.length > 1 ? 'ambiguous' : matchedIds.length ? 'matched' : hints.length ? 'unresolved' : 'choose',
    options: available, matchedIds, matchedSpans: matches.map(match => ({ id: match.id, spans: match.requested })),
    requested: matches[0]?.requested ?? hints.map(token => ({ start: token.start, end: token.end, text: token.text, kind: 'engine' as const })) };
}
/** After explicit YMM selection, RP3 may request engines without reinterpreting the
 * original text. Original committed state remains outside this candidate. */
export async function loadIntentEngines(candidate: VehicleIntentCandidate, refs: SearchIntentReferences,
  options: Pick<InterpretSearchInput, 'signal' | 'timeoutMs'> = {}): Promise<VehicleIntentCandidate> {
  const read = bounded(options);
  const engines = await read(() => refs.getEngines(candidate.model.id, candidate.year, candidate.make.id));
  const engine = engineDraft(candidate.original, candidate, engines);
  return { ...candidate, engine, engineConflict: engineConflict(candidate, engine) };
}
/** Explicit selection validates membership; unmatched engine text stays residual.
 * This returns a draft, never a navigation commit or fitment assertion. */
export function chooseIntentEngine(candidate: VehicleIntentCandidate, id: number): VehicleIntentCandidate {
  if (!candidate.engine.options.some(engine => engine.id === id)) throw new Error('Engine is not in this exact-YMM reference.');
  const consumed = [...candidate.consumed.filter(span => span.kind !== 'engine'), ...(candidate.engine.matchedSpans.find(match => match.id === id)?.spans ?? [])];
  const engine = { ...candidate.engine, selectedId: id };
  return { ...candidate, consumed, residual: remaining(candidate.original, consumed), engine, engineConflict: engineConflict(candidate, engine) };
}

export async function interpretSearch(input: InterpretSearchInput, refs: SearchIntentReferences): Promise<SearchIntentDraft> {
  const draft = base(input), tokens = tokenize(input.original), read = bounded(input);
  try {
    if (input.signal?.aborted) return { ...draft, status: 'cancelled' };
    const exact = input.exact;
    if (exact && exact.original === input.original && exact.contextKey === draft.literal.contextKey && exact.products.length && exact.products.length <= 24
      && ['erp-exact-sku', 'erp-exact-mpn', 'erp-exact-interchange'].includes(exact.source)
      && exact.products.every(product => validSku(product.sku) && product.matchedIdentifier === input.original)) {
      return { ...draft, status: 'exact', exact: structuredClone(exact), identifierLookup: 'verified-exact-evidence' };
    }
    if (input.original.length > 120 || tokens.length > 30) return { ...draft, reason: 'input-limit' };
    const maxYear = (input.now ?? new Date()).getFullYear() + 1;
    const years = tokens.flatMap((token, index) => {
      const text = token.text.replace(/^[('"\u201c\u2018]+|[)'"\u201d\u2019.:!?]+$/gu, '');
      return /^\d{4}$/.test(text) && +text >= 1950 && +text <= maxYear ? [{ year: +text, index }] : [];
    });
    if (years.length !== 1) return { ...draft, reason: years.length ? 'multiple-years' : 'no-vehicle' };
    if (tokens.length === 1) return { ...draft, reason: 'year-or-identifier' };
    const { year, index: yearIndex } = years[0], used = new Set([yearIndex]);
    if (!(await read(() => refs.getYears())).some(item => item.year === year)) return { ...draft, reason: 'no-match' };
    const makes = await read(() => refs.getMakes(year));
    const makeHits = windows(tokens, used, makes, make => make.name, { index: yearIndex, width: 1 }, true);
    const makeIds = new Set(makeHits.map(hit => hit.value.id));
    // Multiple explicit makes need a literal choice; do not silently select one.
    if (makeIds.size !== 1) return { ...draft, reason: 'no-match' };
    const makeHit = makeHits[0];
    for (let i = 0; i < makeHit.width; i++) used.add(makeHit.index + i);
    const models = await read(() => refs.getModels(makeHit.value.id, year));
    let modelHits = windows(tokens, used, models, model => model.name, makeHit);
    if (modelHits.length) {
      const first = modelHits[0];
      modelHits = modelHits.filter(hit => hit.distance === first.distance && hit.length === first.length);
    } else {
      // Adapt Autrex prefix fallback, preserving ALL matching model identities.
      modelHits = tokens.flatMap((token, index) => used.has(index) || token.key.length < 4 || /^\d+$/.test(token.key) ? []
        : models.filter(model => foldVehicleKey(model.name).startsWith(token.key)).map(value => ({ value, index, width: 1, length: token.key.length,
          distance: Math.max(0, index - makeHit.index - makeHit.width, makeHit.index - index - 1) })));
    }
    if (!modelHits.length) return { ...draft, reason: 'no-match' };
    const unique = [...new Map(modelHits.map(hit => [hit.value.id, hit])).values()];
    // Never truncate reference identities into a false unique choice.
    if (unique.length > 10) return { ...draft, reason: 'input-limit' };
    const scope = draft.context.scope;
    const vehicles = unique.map(hit => {
      const consumed = [...spans(tokens, yearIndex, 1, 'year'), ...spans(tokens, makeHit.index, makeHit.width, 'make'), ...spans(tokens, hit.index, hit.width, 'model')];
      return { original: input.original, year, make: { ...makeHit.value }, model: { ...hit.value }, source: 'exact-year-make-model-references' as const,
        conflictsWithContext: scope.kind === 'all' || scope.vehicle.year !== year || scope.vehicle.make !== makeHit.value.name || scope.vehicle.model !== hit.value.name,
        contextEngineId: scope.kind === 'vehicle' && scope.vehicle.year === year && scope.vehicle.make === makeHit.value.name && scope.vehicle.model === hit.value.name
          ? scope.vehicle.dimensions.engine_base_id : undefined,
        engineConflict: 'unverified' as VehicleIntentCandidate['engineConflict'],
        consumed, residual: remaining(input.original, consumed), engine: { status: 'pending', options: [], matchedIds: [], matchedSpans: [], requested: [] } as EngineDraft };
    });
    if (vehicles.length === 1) {
      const engines = await read(() => refs.getEngines(vehicles[0].model.id, year, vehicles[0].make.id));
      vehicles[0].engine = engineDraft(input.original, vehicles[0], engines);
      vehicles[0].engineConflict = engineConflict(vehicles[0], vehicles[0].engine);
    }
    return { ...draft, status: 'candidates', vehicles };
  } catch (error) {
    if (error instanceof IntentWaitError) return { ...draft, status: error.reason === 'cancelled' ? 'cancelled' : 'unavailable',
      ...(error.reason === 'timeout' ? { reason: 'timeout' as const } : {}) };
    return { ...draft, status: 'unavailable', reason: 'reference-failure' };
  }
}
