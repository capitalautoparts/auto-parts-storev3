// Inactive URL contract. No browser, storage, network or history access.
import { changeQuery, DIMENSIONS, MARKET, QUERY_KEYS } from './model.ts';
import type { Query } from './model.ts';
import { productPath, productSku } from '../../../server/product-data.ts';

export type Dimension = typeof DIMENSIONS[number];
export interface VehicleSelection {
  year: number;
  make: string;
  model: string;
  dimensions: Partial<Record<Dimension, string>>;
}
export type NavigationScope = { kind: 'all' } | { kind: 'vehicle'; vehicle: VehicleSelection };
export interface ParsedPcdbPartType { kind: 'unresolved-pcdb'; id: string }
export interface VerifiedPcdbPartType {
  kind: 'verified-pcdb'; id: string; label: string; source: string;
}
interface ListingState {
  scope: NavigationScope;
  market: typeof MARKET;
  availability: 'all' | 'true';
  text: { original: string; residual: string };
  category?: { kind: 'category-slug'; slug: string };
  partType?: ParsedPcdbPartType;
  filters: { brand?: string; sort: 'relevance' | 'price' | 'availability'; sortOrder: 'asc' | 'desc'; page: number };
}
export interface CatalogNavigationState extends ListingState { kind: 'catalog' }
export interface SearchNavigationState extends ListingState { kind: 'search' }
export interface ProductNavigationState {
  kind: 'product'; market: typeof MARKET; product: { kind: 'sku'; sku: string };
}
// Every parsed reference is unresolved, including well-formed SKU and dimension IDs.
export type ParsedNavigationState = CatalogNavigationState | SearchNavigationState | ProductNavigationState;
export type ListingNavigationState = CatalogNavigationState | SearchNavigationState;

// Supplied ONLY by a future authoritative resolver, never by this module's parser.
// source identifies the reference evidence, not a user-supplied label or URL.
export type ResolvedNavigationState =
  | { kind: 'listing'; parsed: ListingNavigationState;
      scope: { kind: 'all' } | { kind: 'vehicle'; selection: VehicleSelection; source: string; checked: 'vehicle-and-dimension-membership' };
      category?: { slug: string; source: string };
      partType?: VerifiedPcdbPartType }
  | { kind: 'product'; parsed: ProductNavigationState; product: { sku: string; source: string } };

export interface NavigationIssue {
  code: 'path' | 'encoding' | 'duplicate' | 'unsupported-key' | 'value' | 'partial-vehicle' | 'scope';
  key?: string;
}
export type NavigationParseResult =
  | { status: 'absent' }
  | { status: 'invalid'; explicit: true; issues: NavigationIssue[] }
  | { status: 'parsed'; state: ParsedNavigationState };

const EXTRA_KEYS = ['scope', 'original_q', 'market'] as const;
const ALLOWED_KEYS = new Set<string>([...QUERY_KEYS, ...EXTRA_KEYS]);
const CONTROL = /[\u0000-\u001f\u007f]/;
const ID = /^[1-9]\d{0,8}$/;
const invalid = (code: NavigationIssue['code'], key?: string): NavigationParseResult =>
  ({ status: 'invalid', explicit: true, issues: [{ code, ...(key ? { key } : {}) }] });

/** Accept only root query URLs and the existing product path cohort. No origin inference. */
export function parseNavigationUrl(input: string): NavigationParseResult {
  if (!input.startsWith('/') || input.startsWith('//') || input.includes('\\') || input.includes('#') || CONTROL.test(input)) return invalid('path');
  if (input === '/') return { status: 'absent' };
  try { decodeURIComponent(input.replace(/\+/g, ' ')); } catch { return invalid('encoding'); }
  const question = input.indexOf('?');
  const path = question < 0 ? input : input.slice(0, question);
  if (path !== '/') {
    const sku = productSku(path);
    if (!sku || question >= 0) return invalid('path');
    return { status: 'parsed', state: { kind: 'product', market: MARKET, product: { kind: 'sku', sku } } };
  }
  const params = new URLSearchParams(input.slice(question + 1));
  if (!params.size) return invalid('value'); // '/?' is explicit, not an absent URL.
  for (const [key, value] of params) {
    if (params.getAll(key).length !== 1) return invalid('duplicate', key);
    // Tracking keys are recoverable unsupported input too; never drop unknown filters.
    if (!ALLOWED_KEYS.has(key)) return invalid('unsupported-key', key);
    if (!value.trim() || value.length > 120 || CONTROL.test(value)) return invalid('value', key);
  }
  const get = (key: string) => params.get(key) ?? undefined;
  for (const key of ['year', 'part_type', 'page', ...DIMENSIONS]) {
    const value = get(key);
    if (value !== undefined && !(key === 'engine_base_id' && value === '0') && !ID.test(value)) return invalid('value', key);
  }
  const year = get('year');
  if (year && (+year < 1900 || +year > 2100)) return invalid('value', 'year');
  if (get('page') && +get('page')! > 100) return invalid('value', 'page');
  if (get('market') && get('market') !== MARKET.country) return invalid('value', 'market');
  if (get('scope') && !['all', 'vehicle'].includes(get('scope')!)) return invalid('scope', 'scope');
  if (get('in_stock_only') && !['all', 'true'].includes(get('in_stock_only')!)) return invalid('value', 'in_stock_only');
  if (get('sort') && !['price', 'availability', 'relevance'].includes(get('sort')!)) return invalid('value', 'sort');
  if (get('sort_order') && !['asc', 'desc'].includes(get('sort_order')!)) return invalid('value', 'sort_order');
  if (get('category') && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(get('category')!)) return invalid('value', 'category');
  if (get('q') && get('q')!.trim().length < 2) return invalid('value', 'q');
  for (const key of ['make', 'model']) {
    if (get(key) && get(key) !== get(key)!.trim()) return invalid('value', key);
  }
  const complete = !!(year && get('make') && get('model'));
  const hasVehicleInput = ['year', 'make', 'model', ...DIMENSIONS].some(key => params.has(key));
  if ((hasVehicleInput || get('scope') === 'vehicle') && !complete) return invalid('partial-vehicle');
  if (get('scope') === 'all' && hasVehicleInput) return invalid('scope', 'scope');
  const scope: NavigationScope = complete ? { kind: 'vehicle', vehicle: {
    year: +year!, make: get('make')!, model: get('model')!,
    dimensions: Object.fromEntries(DIMENSIONS.flatMap(key => {
      const value = get(key);
      return value && value !== '0' ? [[key, value]] : [];
    })),
  } } : { kind: 'all' };
  const residual = get('q') ?? '';
  return { status: 'parsed', state: {
    kind: residual ? 'search' : 'catalog', scope, market: MARKET,
    availability: (get('in_stock_only') ?? 'all') as ListingState['availability'],
    text: { original: get('original_q') ?? residual, residual },
    ...(get('category') ? { category: { kind: 'category-slug', slug: get('category')! } as const } : {}),
    ...(get('part_type') ? { partType: { kind: 'unresolved-pcdb', id: get('part_type')! } as const } : {}),
    filters: { ...(get('brand') ? { brand: get('brand')! } : {}),
      sort: (get('sort') ?? 'relevance') as ListingState['filters']['sort'],
      sortOrder: (get('sort_order') ?? 'asc') as ListingState['filters']['sortOrder'], page: +(get('page') ?? 1) },
  } };
}

function listingQuery(state: ListingNavigationState): Query {
  const query: Query = {};
  if (state.scope.kind === 'vehicle') {
    const vehicle = state.scope.vehicle;
    query.year = String(vehicle.year); query.make = vehicle.make; query.model = vehicle.model;
    for (const key of DIMENSIONS) if (vehicle.dimensions[key] !== undefined) query[key] = vehicle.dimensions[key];
  }
  if (state.text.residual) query.q = state.text.residual;
  if (state.category) query.category = state.category.slug;
  if (state.partType) query.part_type = state.partType.id;
  if (state.filters.brand) query.brand = state.filters.brand;
  query.in_stock_only = state.availability;
  query.sort = state.filters.sort; query.sort_order = state.filters.sortOrder;
  query.page = String(state.filters.page);
  return query;
}

/** Fixed key order and equivalent-default omission, not an SEO canonical/redirect decision. */
export function serializeNavigation(state: ParsedNavigationState): string {
  if (state.market.country !== MARKET.country || state.market.currency !== MARKET.currency || state.market.locale !== MARKET.locale) throw new Error('Unsupported market.');
  if (state.kind === 'product') return productPath(state.product.sku);
  if ((state.kind === 'search') !== !!state.text.residual || (!state.text.original && state.text.residual)) throw new Error('Invalid search text.');
  const params = new URLSearchParams();
  if (state.scope.kind === 'all') params.set('scope', 'all'); // Essential: prevents restoring memory.
  const query = listingQuery(state);
  for (const key of QUERY_KEYS) {
    const value = query[key];
    if (value === undefined || (key === 'engine_base_id' && value === '0')
      || (key === 'page' && value === '1') || (key === 'in_stock_only' && value === 'all')
      || (key === 'sort' && value === 'relevance') || (key === 'sort_order' && value === 'asc')) continue;
    params.set(key, value);
  }
  if (state.text.original !== state.text.residual) params.set('original_q', state.text.original);
  const result = `/?${params}`;
  if (parseNavigationUrl(result).status !== 'parsed') throw new Error('Invalid navigation state.');
  return result;
}

export type InitialNavigation =
  | { source: 'url'; state: ParsedNavigationState }
  | { source: 'recovery'; issues: NavigationIssue[] }
  | { source: 'remembered'; vehicle: VehicleSelection }
  | { source: 'empty' };

/** The adapter supplies at most one remembered, previously validated vehicle. Never reads storage. */
export function initialNavigation(parsed: NavigationParseResult, remembered: VehicleSelection | null): InitialNavigation {
  if (parsed.status === 'invalid') return { source: 'recovery', issues: parsed.issues };
  if (parsed.status === 'parsed') return { source: 'url', state: parsed.state };
  if (remembered) {
    // Recheck structure; stale reference membership still requires external resolution.
    const params = new URLSearchParams({ year: String(remembered.year), make: remembered.make, model: remembered.model, ...remembered.dimensions });
    const result = parseNavigationUrl(`/?${params}`);
    if (result.status === 'parsed' && result.state.kind !== 'product' && result.state.scope.kind === 'vehicle') {
      return { source: 'remembered', vehicle: result.state.scope.vehicle };
    }
  }
  return { source: 'empty' };
}

export type NavigationTransition =
  | { type: 'change-query'; key: Exclude<keyof Query, 'year' | 'make' | 'model' | 'engine_base_id'>; value: string }
  | { type: 'replace-vehicle'; vehicle: VehicleSelection }
  | { type: 'replace-engine'; engineId: string }
  | { type: 'clear-vehicle' };
export interface TransitionResult { navigation: NavigationParseResult; memory: 'unchanged' | 'remove' }

/** Clear stale dependencies before an adapter resolves/reissues a request. No UI wiring. */
export function transitionNavigation(state: ListingNavigationState, action: NavigationTransition): TransitionResult {
  if (action.type === 'clear-vehicle') {
    return { navigation: parseNavigationUrl('/?scope=all'), memory: 'remove' };
  }
  if (action.type === 'replace-vehicle' || action.type === 'replace-engine') {
    if (action.type === 'replace-engine' && state.scope.kind !== 'vehicle') {
      return { navigation: invalid('partial-vehicle'), memory: 'unchanged' };
    }
    const vehicle = action.type === 'replace-vehicle' ? action.vehicle : {
      ...(state.scope as Extract<NavigationScope, { kind: 'vehicle' }>).vehicle,
      dimensions: { engine_base_id: action.engineId },
    };
    // Replacement resets the result intent and facets; never reuse a stale full phrase.
    const params = new URLSearchParams({ year: String(vehicle.year), make: vehicle.make, model: vehicle.model, ...vehicle.dimensions });
    return { navigation: parseNavigationUrl(`/?${params}`), memory: 'unchanged' };
  }
  const query = changeQuery(listingQuery(state), action.key, action.value);
  if (action.key === 'part_type') delete query.brand;
  const params = new URLSearchParams(query as Record<string, string>);
  if (state.scope.kind === 'all') params.set('scope', 'all');
  // Config filter edits retain all other selections for external revalidation.
  if (!['q', 'category', 'part_type'].includes(action.key) && state.text.original !== state.text.residual) {
    params.set('original_q', state.text.original);
  }
  return { navigation: parseNavigationUrl(`/?${params}`), memory: 'unchanged' };
}

/** Only catalog/search returns; no absolute URLs, encoded paths, products, hashes or backslashes. */
export function safeCatalogReturnPath(input: unknown): string | null {
  if (typeof input !== 'string' || (input !== '/' && !input.startsWith('/?'))) return null;
  try { if (decodeURIComponent(input).includes('\\')) return null; } catch { return null; }
  const parsed = parseNavigationUrl(input);
  if (parsed.status === 'absent') return '/';
  return parsed.status === 'parsed' && parsed.state.kind !== 'product' ? serializeNavigation(parsed.state) : null;
}

export interface CatalogBackground {
  version: 1;
  href: string;
  scroll: { x: number; y: number };
  focusKey?: string;
}

/** Future history payload, kept outside product identity/canonical URL. Not wired to history. */
export function parseCatalogBackground(input: unknown): CatalogBackground | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Partial<CatalogBackground>;
  const href = safeCatalogReturnPath(value.href);
  if (value.version !== 1 || !href || !value.scroll
    || ![value.scroll.x, value.scroll.y].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0)
    || (value.focusKey !== undefined && (typeof value.focusKey !== 'string' || !value.focusKey || value.focusKey.length > 120 || CONTROL.test(value.focusKey)))) return null;
  return { version: 1, href, scroll: { x: value.scroll.x, y: value.scroll.y },
    ...(value.focusKey !== undefined ? { focusKey: value.focusKey } : {}) };
}
