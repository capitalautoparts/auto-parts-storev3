import { catalogFetch, safeStorage, saveStorage } from '../features/catalog/model.ts';
import type { Part as ErpPart, SearchResult, Category as ErpCategory } from '../features/catalog/model.ts';
import type { VehicleYear, VehicleMake, VehicleModel, VehicleEngine, Category, Part, Cart, VehicleSearchResult, VehicleContext } from './api.ts';
import { mapProduct, mapProductFitments, validSku } from '../../server/product-data.ts';

const params = (values: Record<string, string | number | undefined>) => new URLSearchParams(
  Object.entries(values).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => [key, String(value)]),
);
const referenceCache = new Map<string, { expires: number; data: unknown }>();
const inFlight = new Map<string, Promise<unknown>>();
function engineDetails(raw: unknown): VehicleEngine['details'] {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const details: NonNullable<VehicleEngine['details']> = {};
  for (const key of ['liter', 'cylinders', 'cc', 'cid'] as const) {
    const field = value[key];
    if (field === undefined || field === null) continue;
    if (!(typeof field === 'number' || (typeof field === 'string' && /^\d+(?:\.\d+)?$/.test(field.trim())))) return null;
    const number = Number(field);
    if (!Number.isFinite(number) || number <= 0 || (key !== 'liter' && !Number.isSafeInteger(number))) return null;
    details[key] = number;
  }
  if (value.block_type !== undefined && value.block_type !== null) {
    if (typeof value.block_type !== 'string' || !/^[A-Za-z][A-Za-z -]{0,19}$/.test(value.block_type.trim())) return null;
    details.block_type = value.block_type.trim().toUpperCase();
  }
  return Object.keys(details).length ? details : undefined;
}
async function reference<T>(resource: string, values: Record<string, string | number | undefined> = {}): Promise<T> {
  const query = params(values), key = `${resource}?${query}`;
  const cached = referenceCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data as T;
  if (inFlight.has(key)) return inFlight.get(key) as Promise<T>;
  const pending = catalogFetch<T>(resource, query).then(data => {
    if (referenceCache.size >= 150) referenceCache.delete(referenceCache.keys().next().value!);
    referenceCache.set(key, { data, expires: Date.now() + 300_000 });
    return data;
  }).finally(() => inFlight.delete(key));
  inFlight.set(key, pending);
  return pending;
}

export const vehicleApi = {
  async getYears(): Promise<VehicleYear[]> {
    return (await reference<{ years: number[] }>('years')).years.map(year => ({ year }));
  },
  async getMakes(year?: number): Promise<VehicleMake[]> {
    if (!year) throw new Error('Select a year first.');
    return (await reference<{ makes: VehicleMake[] }>('makes', { year })).makes;
  },
  async getModels(makeId: number, year: number): Promise<VehicleModel[]> {
    const make = (await vehicleApi.getMakes(year)).find(item => item.id === makeId);
    if (!make) throw new Error('This make is unavailable for the selected year.');
    return (await reference<{ models: { id: number; name: string }[] }>('models', { year, make: make.name })).models.map(model => ({ ...model, makeId }));
  },
  async getEngines(modelId: number, year: number, makeId: number): Promise<VehicleEngine[]> {
    const make = (await vehicleApi.getMakes(year)).find(item => item.id === makeId);
    const model = (await vehicleApi.getModels(makeId, year)).find(item => item.id === modelId);
    if (!make || !model) throw new Error('Select a complete vehicle first.');
    const data = await reference<{ engines: { id: number; description: string; details?: unknown }[] }>('engines', { year, make: make.name, model: model.name });
    return data.engines.length ? data.engines.map(engine => {
      const details = engineDetails(engine.details);
      return { id: engine.id, name: engine.description, modelId, ...(details === undefined ? {} : { details }) };
    })
      : [{ id: 0, name: 'Engine unspecified — check application notes', modelId }];
  },
  async search(query: string): Promise<VehicleSearchResult[]> {
    const match = query.trim().match(/^(\d{4})(?:\s+(.*))?$/);
    if (match) {
      const year = +match[1], rest = (match[2] ?? '').toLowerCase();
      const makes = await vehicleApi.getMakes(year);
      const exact = makes.find(make => rest === make.name.toLowerCase() || rest.startsWith(`${make.name.toLowerCase()} `));
      if (!exact) return makes.filter(make => make.name.toLowerCase().includes(rest)).slice(0, 10).map(make => ({ type: 'vehicle', year, makeId: make.id, makeName: make.name, label: `${year} ${make.name}` }));
      const remaining = rest.slice(exact.name.length).trim();
      const models = await vehicleApi.getModels(exact.id, year);
      return models.filter(model => model.name.toLowerCase().includes(remaining)).slice(0, 10).map(model => ({ type: 'vehicle', year, makeId: exact.id, makeName: exact.name, modelId: model.id, modelName: model.name, label: `${year} ${exact.name} ${model.name}` }));
    }
    const result = await partsApi.search({ q: query.trim() });
    return result.parts.slice(0, 10).map(part => ({ type: 'part', label: `${part.brand} ${part.partNumber}`, partNumber: part.partNumber, partId: part.id }));
  },
  async searchCategories(query: string, context?: VehicleContext): Promise<VehicleSearchResult[]> {
    const categories = await categoryApi.getAll();
    const candidates = [...categories, ...loadedChildren.values()].flat();
    return candidates.filter(category => category.name.toLowerCase().includes(query.toLowerCase().trim())).slice(0, 10).map(category => ({
      ...context, type: 'category', label: category.name, categoryId: category.id, categoryName: category.name,
      categorySlug: category.slug, categoryParentId: category.parentId,
    }));
  },
};

const loadedChildren = new Map<number, Category[]>();
export const categoryApi = {
  async getAll(): Promise<Category[]> {
    return (await reference<{ data: ErpCategory[] }>('categories')).data.map(category => ({ id: category.id, name: category.display_name, parentId: null, slug: category.slug }));
  },
  async getChildren(category: Category): Promise<Category[]> {
    const result = await reference<{ data: { subcategories: ErpCategory[] } }>('category', { slug: category.slug });
    const children = result.data.subcategories.filter(item => (item.mapped_part_type_count ?? 0) > 0).map(item => ({ id: item.id, name: item.display_name, parentId: category.id, slug: item.slug }));
    loadedChildren.set(category.id, children);
    return children;
  },
};

export function mapErpPart(raw: ErpPart): Part {
  const price = raw.pricing?.price;
  const validPrice = raw.pricing?.currency === 'CAD' && typeof price === 'number' && Number.isFinite(price) && price >= 0;
  const core = typeof raw.core_charge === 'number' ? raw.core_charge : raw.core_charge?.amount;
  return {
    id: raw.sku, brand: raw.brand_name, partNumber: raw.part_number, description: raw.name,
    price: validPrice ? price : null, currency: 'CAD', warranty: '', stock: raw.availability?.quantity ?? 0,
    availability: raw.availability?.status ?? 'unconfirmed', imageUrl: raw.image_url ?? undefined,
    leadTimeDays: raw.availability?.lead_time_days,
    position: raw.fitment_qualifiers?.find(item => item.name.toLowerCase() === 'position')?.value,
    specs: Object.fromEntries((raw.fitment_qualifiers ?? []).map(item => [item.name, item.value])),
    coreCharge: typeof core === 'number' && Number.isFinite(core) ? core : null,
    packQuantity: raw.sellablePackQuantity ?? 1,
    applicationNotes: (raw.applications ?? []).map(item => [item.submodel, item.engine, item.drive_type, item.position, ...(item.notes ?? []), ...(item.qualifiers ?? [])].filter(Boolean).join(' · ')),
    fitmentSummary: raw.fitment_summary ?? undefined,
    // The search response does not include per-application year/make/model, so
    // do not turn the selected vehicle context into a confirmed fitment claim.
    fitments: [],
  };
}

const knownParts = new Map<string | number, Part>();
export const partsApi = {
  async getProduct(sku: string): Promise<Part> {
    if (!validSku(sku)) throw new Error('Invalid product SKU.');
    return mapProduct(await catalogFetch<unknown>('product', params({ sku })), sku);
  },
  async getFitments(sku: string, page = 1) {
    if (!validSku(sku)) throw new Error('Invalid product SKU.');
    return mapProductFitments(await catalogFetch<unknown>('product-fitments', params({ sku, page, limit: 24 })), sku);
  },
  async search({ q, category, vehicle, page = 1, filters = {} }: { q?: string; category?: Category; vehicle?: VehicleContext | null; page?: number; filters?: Record<string, string> }) {
    const query = params({ q, category: category?.slug, year: vehicle?.year, make: vehicle?.makeName,
      model: vehicle?.modelName, engine_base_id: vehicle?.engineId || undefined, page,
      limit: 24, include_facets: 1, include_vehicle_dimensions: vehicle ? 1 : undefined, ...filters });
    const result = await catalogFetch<SearchResult>('search', query);
    const parts = result.results.map(mapErpPart);
    for (const part of parts) knownParts.set(part.id, part);
    if (knownParts.size > 1000) for (const key of [...knownParts.keys()].slice(0, knownParts.size - 1000)) knownParts.delete(key);
    return { ...result, parts };
  },
};

const CART_KEY = 'roysauto.original-cart.v1';
export function decodeCart(raw: string | null, sessionId = 'catalog-test'): Cart {
  try {
    const parsed: unknown = JSON.parse(raw ?? 'null');
    if (!parsed || typeof parsed !== 'object' || !('items' in parsed) || !Array.isArray(parsed.items)) return { id: 1, sessionId, items: [] };
    const seen = new Set<string>();
    const items = parsed.items.filter(item => {
      const part = item?.part;
      if (!part || typeof item.partId !== 'string' || part.id !== item.partId || item.id !== item.partId
        || item.partId.length > 160 || seen.has(item.partId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99
        || !['brand', 'partNumber', 'description', 'warranty'].every(key => typeof part[key] === 'string' && part[key].length < 1000)
        || !(part.price === null || (typeof part.price === 'number' && Number.isFinite(part.price) && part.price >= 0))
        || typeof part.stock !== 'number' || typeof part.currency !== 'string') return false;
      seen.add(item.partId); return true;
    }).slice(0, 100);
    return { id: 1, sessionId, items };
  } catch { return { id: 1, sessionId, items: [] }; }
}
function storedCart(sessionId?: string) { return decodeCart(safeStorage(CART_KEY), sessionId); }
function writeCart(cart: Cart) {
  if (!saveStorage(CART_KEY, JSON.stringify(cart))) throw new Error('Browser storage is unavailable; the cart could not be saved.');
  return cart;
}
export const cartApi = {
  async get(sessionId: string) { return storedCart(sessionId); },
  async addItem(sessionId: string, partId: string | number, quantity: number, snapshot?: Part) {
    if (!Number.isFinite(quantity)) throw new Error('Quantity must be a finite number.');
    const amount = Math.max(1, Math.min(99, Math.floor(quantity)));
    const cart = storedCart(sessionId), part = snapshot ?? knownParts.get(partId);
    if (!part || typeof partId !== 'string' || part.id !== partId) throw new Error('Reload this part before adding it.');
    const existing = cart.items.find(item => item.partId === partId);
    if (existing) existing.quantity = Math.min(99, existing.quantity + amount);
    else {
      if (cart.items.length >= 100) throw new Error('The test cart has reached 100 different parts.');
      cart.items.push({ id: partId, partId, quantity: amount, part });
    }
    return writeCart(cart);
  },
  async updateQuantity(itemId: string | number, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('Quantity must be between 1 and 99.');
    const cart = storedCart(), item = cart.items.find(item => item.id === itemId);
    if (item) item.quantity = quantity;
    return writeCart(cart);
  },
  async removeItem(itemId: string | number) {
    const cart = storedCart(); cart.items = cart.items.filter(item => item.id !== itemId); writeCart(cart);
  },
};
