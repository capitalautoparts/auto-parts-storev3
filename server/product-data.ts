// Pure product contract shared by the browser and the small Node HTML adapter.
// No upstream URLs, environment access, React or browser storage here.
import type { Part } from '../src/lib/api.ts';

export function validSku(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 160 && value === value.trim()
    && /^[A-Z0-9]{4}_[A-Za-z0-9][A-Za-z0-9._()+ -]*$/.test(value);
}

export function productPath(sku: string): string {
  if (!validSku(sku)) throw new Error('Invalid product SKU.');
  return `/products/${encodeURIComponent(sku)}`;
}

export function productSku(pathname: string): string | null {
  const match = /^\/products\/([^/]+)$/.exec(pathname);
  if (!match) return null;
  try { const sku = decodeURIComponent(match[1]); return validSku(sku) ? sku : null; }
  catch { return null; }
}

type Row = Record<string, unknown>;
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown, max = 1000): string => typeof value === 'string' ? value.slice(0, max) : '';
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const amount = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

export function mapProduct(payload: unknown, sku: string): Part {
  const raw = object(object(payload).product);
  if (!validSku(sku) || raw.sku !== sku || (raw.id !== undefined && raw.id !== sku)
    || !text(raw.name) || !text(raw.part_number) || !text(raw.brand_name ?? raw.brand)) {
    throw new Error('The product details could not be verified.');
  }
  const pricing = object(raw.pricing);
  // ERP products.ts: OPEN sale -> sale_price; compare-at -> sale_price;
  // otherwise msrp contains the resolved retail salePrice. Last-known is not a quote.
  const price = pricing.currency === 'CAD' && (pricing.basis === undefined || pricing.basis === 'current')
    ? amount(pricing.sale_price ?? pricing.msrp) : null;
  const availability = object(raw.availability);
  const qualifiers = list(raw.fitment_qualifiers).map(object);
  const specs = Object.fromEntries(Object.entries(object(raw.specifications))
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
    .map(([key, value]) => [key.slice(0, 120), String(value).slice(0, 1000)]));
  return {
    id: sku, brand: text(raw.brand_name ?? raw.brand), partNumber: text(raw.part_number), description: text(raw.name),
    descriptionText: text(raw.description_short || raw.description_long, 5000),
    price, currency: 'CAD', warranty: '', stock: amount(availability.quantity) ?? 0,
    purchasable: raw.purchasable !== false,
    availability: text(availability.status) || 'unconfirmed',
    imageUrl: safeImage(list(object(raw.media).images)[0]),
    coreCharge: amount(typeof raw.core_charge === 'number' ? raw.core_charge : object(raw.core_charge).amount),
    packQuantity: Number.isInteger(raw.sellablePackQuantity) && Number(raw.sellablePackQuantity) > 0 ? Number(raw.sellablePackQuantity) : 1,
    position: text(qualifiers.find(item => item.name === 'Position')?.value) || undefined,
    specs,
    applicationNotes: [
      ...list(raw.fitment_notes ?? object(raw.fitment).fitment_notes).map(value => text(value)),
      ...qualifiers.map(item => [text(item.name), text(item.value)].filter(Boolean).join(': ')),
    ].filter(Boolean),
    // The product's summary is sampled; only the separate paginated fitments
    // resource supplies the vehicle rows. Never infer them from the open tree.
    fitments: [],
  };
}

function safeImage(value: unknown): string | undefined {
  try { const url = new URL(text(value, 2000)); return url.protocol === 'https:' ? url.href : undefined; }
  catch { return undefined; }
}

export interface ProductFitments {
  fitments: NonNullable<Part['fitments']>;
  page: number;
  total: number;
  hasMore: boolean;
}

export function mapProductFitments(payload: unknown, sku: string): ProductFitments {
  const raw = object(payload), pagination = object(raw.pagination);
  if (raw.sku !== sku || !Array.isArray(raw.fitments) || !Number.isInteger(pagination.total)
    || Number(pagination.total) < 0 || !Number.isInteger(pagination.page) || Number(pagination.page) < 1
    || typeof pagination.has_more !== 'boolean') throw new Error('The product fitments could not be verified.');
  return {
    fitments: raw.fitments.map(object).filter(row => Number.isInteger(row.year_from) && Number.isInteger(row.year_to)
      && Number(row.year_from) >= 1900 && Number(row.year_to) <= 2100 && Number(row.year_to) >= Number(row.year_from)
      && text(row.make) && text(row.model)).map(row => ({
      year: Number(row.year_from), yearEnd: Number(row.year_to), make: text(row.make), model: text(row.model),
      notes: [text(row.submodel), text(row.position)].filter(Boolean).join(' · '),
    })),
    page: Number(pagination.page), total: Number(pagination.total), hasMore: pagination.has_more,
  };
}

export function productMeta(part: Part) {
  return {
    title: `${part.brand} ${part.partNumber} — ${part.description} | Roy's Auto`,
    description: `${part.description}. ${part.brand} ${part.partNumber}. ${part.descriptionText || 'Review product details and supplied vehicle applications.'}`.slice(0, 320),
    canonical: productPath(String(part.id)),
  };
}

// The same identity-only payload is used in HTTP HTML and live browser state.
// Escaping keeps JSON safe inside a script element; no offers/prices are copied.
export function productSchema(part: Part): string {
  const meta = productMeta(part);
  return JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', sku: String(part.id),
    name: part.description, mpn: part.partNumber, brand: { '@type': 'Brand', name: part.brand }, description: meta.description,
  }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
