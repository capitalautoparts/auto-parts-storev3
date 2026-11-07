import type { Part } from '../src/lib/api.ts';
import { productSku } from './product-data.ts';

export const PRODUCT_BOOTSTRAP_ID = 'product-bootstrap';
export const PRODUCT_BOOTSTRAP_LIMIT = 2_000_000;
export interface PublicProduct {
  sku: string; brand: string; partNumber: string; name: string;
  descriptions: { text: string; language?: string }[];
  specifications: { name: string; value: string; unit?: string }[];
  conditions: string[];
  price: number | null; coreCharge: number | null; packQuantity: number;
  availability: string;
  stock: number; purchasable: boolean; imageUrl?: string;
}
export type ProductDocument = { version: 1; path: string; status: 200; product: PublicProduct }
  | { version: 1; path: string; status: 400 | 404 | 429 | 502 | 503; title: string; message: string };

export function publicProduct(part: Part): PublicProduct {
  return { sku: String(part.id), brand: part.brand, partNumber: part.partNumber, name: part.description,
    descriptions: (part.productFacts?.descriptions ?? []).map(row => ({ text: row.text, ...(row.language ? { language: row.language } : {}) })),
    specifications: part.productFacts?.specsList ?? [], conditions: part.applicationNotes ?? [],
    price: part.price, coreCharge: part.coreCharge ?? null, packQuantity: part.packQuantity ?? 1,
    availability: part.availability ?? 'unconfirmed', stock: part.stock, purchasable: part.purchasable !== false,
    ...(part.imageUrl ? { imageUrl: part.imageUrl } : {}) };
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
const text = (value: unknown, max = PRODUCT_BOOTSTRAP_LIMIT): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const amount = (value: unknown) => value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0;
const safeImage = (value: unknown) => {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value) || value.length > 2000 || /[\x00-\x20\x7f\\]/.test(value)) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
};
const rows = (value: unknown, check: (value: unknown) => boolean) => Array.isArray(value) && value.length <= 20_000 && value.every(check);

/** Reject malformed, mismatched, oversized or unexpected bootstrap fields before hydration. */
export function parseProductDocument(json: string, pathname: string): ProductDocument | null {
  if (new TextEncoder().encode(json).length > PRODUCT_BOOTSTRAP_LIMIT) return null;
  try {
    const value: unknown = JSON.parse(json);
    if (!record(value) || value.version !== 1 || value.path !== pathname || !pathname.startsWith('/products/')) return null;
    if (value.status !== 200) {
      return keys(value, ['version', 'path', 'status', 'title', 'message']) && typeof value.status === 'number' && [400, 404, 429, 502, 503].includes(value.status)
        && text(value.title, 100) && text(value.message, 1000) ? value as ProductDocument : null;
    }
    const p = value.product;
    if (!keys(value, ['version', 'path', 'status', 'product']) || !record(p)
      || !keys(p, ['sku', 'brand', 'partNumber', 'name', 'descriptions', 'specifications', 'conditions', 'price', 'coreCharge', 'packQuantity', 'availability', 'stock', 'purchasable', 'imageUrl'])
      || productSku(pathname) !== p.sku || !text(p.sku, 160)
      || !text(p.brand, 1000) || !text(p.partNumber, 1000) || !text(p.name, 1000)
      || !text(p.availability, 1000) || !amount(p.price) || !amount(p.coreCharge)
      || !Number.isSafeInteger(p.packQuantity) || Number(p.packQuantity) < 1
      || typeof p.stock !== 'number' || !amount(p.stock) || typeof p.purchasable !== 'boolean'
      || p.imageUrl !== undefined && !safeImage(p.imageUrl)
      || !rows(p.conditions, value => text(value))
      || !rows(p.descriptions, value => record(value) && keys(value, ['text', 'language']) && text(value.text)
        && (value.language === undefined || text(value.language, 35) && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(value.language)))
      || !rows(p.specifications, value => record(value) && keys(value, ['name', 'value', 'unit']) && text(value.name) && text(value.value)
        && (value.unit === undefined || text(value.unit)))) return null;
    return value as ProductDocument;
  } catch { return null; }
}

export function serializeProductDocument(document: ProductDocument): string {
  const json = JSON.stringify(document);
  if (!parseProductDocument(json, document.path)) throw new Error('Invalid product document.');
  const escaped = json.replace(/[<>&\u2028\u2029]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
  if (new TextEncoder().encode(escaped).length > PRODUCT_BOOTSTRAP_LIMIT) throw new Error('Product document exceeds the bootstrap budget.');
  return escaped;
}
