export const MARKETS = {
  CA: { country: 'CA', currency: 'CAD', locale: 'en-CA', enabled: true },
  US: { country: 'US', currency: 'USD', locale: 'en-US', enabled: false },
} as const;
export const MARKET = MARKETS.CA;
export const DIMENSIONS = ['engine_base_id', 'sub_model_id', 'drive_type_id', 'body_style_config_id', 'transmission_id', 'region_id'] as const;
export const QUERY_KEYS = ['year', 'make', 'model', ...DIMENSIONS, 'q', 'category', 'part_type', 'brand', 'in_stock_only', 'sort', 'sort_order', 'page'] as const;
export type Query = Partial<Record<typeof QUERY_KEYS[number], string>>;
export interface Option { id: number; name?: string; description?: string; label?: string; count?: number }
export interface Category { id: number; display_name: string; slug: string; mapped_part_type_count?: number }
export interface Application {
  submodel?: string | null; engine?: string | null; position?: string | null; drive_type?: string | null;
  notes?: string[]; qualifiers?: { name?: string; value?: string; text?: string }[];
}
export interface Part {
  sku: string; slug?: string; part_number: string; name: string; brand_name: string;
  pricing?: { price: number | null; currency: string } | null;
  core_charge?: number | { amount?: number } | null;
  availability?: { status: string; quantity: number; lead_time_days?: number } | null;
  sellablePackQuantity?: number; image_url?: string | null;
  fitment_summary?: string; applications?: Application[];
  fitment_qualifiers?: { name: string; value: string }[];
}
export interface SearchResult {
  results: Part[];
  pagination: { total: number; page: number; has_more: boolean; total_is_exact?: boolean; sort_complete?: boolean };
  facets?: { brands?: { brand_id: string; name: string; count: number }[]; part_types?: { id: string; name: string; count: number }[] };
  vehicle_dimensions?: { dimension: string; label: string; options: Option[] }[];
}
export interface CartLine { sku: string; name: string; part_number: string; quantity: number }

export function readQuery(search: string): Query {
  const params = new URLSearchParams(search);
  return Object.fromEntries(QUERY_KEYS.flatMap(key => {
    const value = params.get(key);
    return value && value.length <= 120 ? [[key, value]] : [];
  }));
}

export function changeQuery(current: Query, key: keyof Query, value: string): Query {
  const next = { ...current, [key]: value };
  const chain = ['year', 'make', 'model', ...DIMENSIONS];
  const position = chain.indexOf(key);
  if (position >= 0 && position < 3) {
    for (const dependent of chain.slice(position + 1)) delete next[dependent as keyof Query];
    delete next.brand; delete next.part_type;
  }
  if (key === 'category') { delete next.part_type; delete next.brand; }
  if (key === 'q') { delete next.brand; delete next.part_type; }
  if (key !== 'page') delete next.page;
  return Object.fromEntries(Object.entries(next).filter(([, entry]) => entry));
}

export function searchParams(query: Query): URLSearchParams | null {
  const completeVehicle = !!(query.year && query.make && query.model);
  if (!(query.q && query.q.trim().length >= 2) && !query.category && !completeVehicle) return null;
  const params = new URLSearchParams();
  for (const key of QUERY_KEYS) {
    if (!completeVehicle && ['year', 'make', 'model', ...DIMENSIONS].includes(key)) continue;
    if (query[key]) params.set(key, query[key]!);
  }
  params.set('limit', '24'); params.set('include_facets', '1');
  if (completeVehicle) params.set('include_vehicle_dimensions', '1');
  return params;
}

export function priceLabel(part: Part): string {
  const price = part.pricing?.price;
  if (part.pricing?.currency !== MARKET.currency || typeof price !== 'number' || !Number.isFinite(price) || price < 0) return 'Price unavailable';
  return new Intl.NumberFormat(MARKET.locale, { style: 'currency', currency: MARKET.currency }).format(price);
}

export function readCart(raw: string | null): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.filter((line): line is CartLine => {
      if (!line || typeof line !== 'object') return false;
      const item = line as CartLine;
      if (typeof item.sku !== 'string' || !item.sku || item.sku.length > 160 || seen.has(item.sku)
        || typeof item.name !== 'string' || item.name.length > 300
        || typeof item.part_number !== 'string' || item.part_number.length > 160
        || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) return false;
      seen.add(item.sku); return true;
    }).slice(0, 100);
  } catch { return []; }
}

export function safeStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function saveStorage(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

export async function catalogFetch<T>(resource: string, params: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const query = new URLSearchParams(params);
  query.set('resource', resource);
  const response = await fetch(`/api/catalog?${query}`, { signal });
  const result = await response.json();
  if (!response.ok) throw new Error(`${result.error ?? 'The catalog is unavailable.'}${result.reference ? ` Reference: ${result.reference}` : ''}`);
  return result as T;
}
