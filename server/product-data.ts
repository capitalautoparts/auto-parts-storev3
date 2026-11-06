// Pure product contract shared by the browser and the small Node HTML adapter.
// No upstream URLs, environment access, React or browser storage here.
import type { Part, ProductFacts, ProductSpec, ProductDescription, ProductReference, ProductSectionState } from '../src/lib/api.ts';

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

// Public display filtering does not interpret fitment, warranty or trade codes.
const internalNames = new Set(['research required', 'size lookup', 'other included wheel hardware',
  'manufacturer construction description', 'manufacturer finish description', 'unknown',
  // Extended-info codes: unresolved lifecycle/warranty and trade/origin facts are
  // not mechanical attributes. ERP4e3ed42e evidence is recorded in the WP.
  'lif', 'ws1', 'hts', 'cto', 'msr', 'wt1', 'wd1', 'hac', 'wd2', 'wt2', 'constructor', 'prototype']);
function publicSpecName(name: string): boolean {
  return !!name && /\p{L}/u.test(name) && !/[_<>\x00-\x1f]/.test(name)
    && !/^\d+$/.test(name) && !/\bsource$/i.test(name)
    && !internalNames.has(name.toLowerCase());
}
const clean = (value: unknown, max = 2_000_000) => text(value, max).trim();
const scalar = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? String(value) : clean(value);
const optional = (value: unknown, max = 1000): string | undefined => clean(value, max) || undefined;
const language = (value: unknown): string | undefined => {
  const valueText = clean(value, 35);
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(valueText) ? valueText : undefined;
};

function safeAsset(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value) || value.length > 2000 || value !== value.trim()
    || /[\x00-\x20\x7f\\]/.test(value)) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

// null/undefined mean absent; other wrong shapes are malformed. Parsers return
// null for intentionally withheld display rows and undefined for malformed rows.
function section<T>(value: unknown, parse: (value: unknown) => T | null | undefined): { rows: T[]; state: ProductSectionState } {
  if (value == null) return { rows: [], state: 'absent' };
  if (!Array.isArray(value)) return { rows: [], state: 'malformed' };
  const rows: T[] = [];
  let invalid = false, omitted = false;
  for (const item of value) {
    const row = parse(item);
    if (row === undefined) invalid = true;
    else if (row === null) omitted = true;
    else rows.push(row);
  }
  return { rows, state: invalid ? rows.length || omitted ? 'partial' : 'malformed' : omitted ? 'partial' : rows.length ? 'available' : 'empty' };
}
const unique = <T,>(rows: T[]): T[] => [...new Map(rows.map(row => [JSON.stringify(row), row])).values()];

function mapFacts(raw: Row): ProductFacts {
  const ordered = section<ProductSpec>(raw.specs_list, value => {
    const row = object(value), name = clean(row.name), val = scalar(row.value);
    if (!name || !val || (row.unit != null && typeof row.unit !== 'string')) return undefined;
    return publicSpecName(name) ? { name, value: val, ...(optional(row.unit) ? { unit: optional(row.unit) } : {}) } : null;
  });
  const fallbackValue = raw.specifications;
  const fallback = section<ProductSpec>(fallbackValue == null ? undefined
    : fallbackValue && typeof fallbackValue === 'object' && !Array.isArray(fallbackValue)
      ? Object.entries(fallbackValue).map(([name, value]) => ({ name, value })) : false, value => {
    const row = object(value), name = clean(row.name), val = scalar(row.value);
    if (!val) return row.value == null ? null : undefined;
    return publicSpecName(name) ? { name, value: val } : null;
  });
  const names = new Set(ordered.rows.map(row => row.name.toLowerCase()));
  const specsList = unique([...ordered.rows, ...fallback.rows.filter(row => !names.has(row.name.toLowerCase()))]);
  const suppliedDescriptions = section<ProductDescription>(raw.descriptions, value => {
    const row = object(value), val = clean(row.text, 2_000_000);
    if (!val || ['code', 'type'].some(key => row[key] !== undefined && (typeof row[key] !== 'string' || !row[key].trim()))
      || (row.language !== undefined && !language(row.language))) return undefined;
    return { kind: 'other', text: val, ...(language(row.language) ? { language: language(row.language) } : {}),
      ...(optional(row.type) ? { type: optional(row.type) } : {}), ...(optional(row.code) ? { code: optional(row.code) } : {}) };
  });
  const descriptions: ProductDescription[] = [];
  for (const [key, kind, lang] of [['description_short', 'short', 'description_language'],
    ['description_long', 'long', 'description_long_language']] as const) {
    const val = clean(raw[key], 2_000_000);
    if (val) descriptions.push({ kind, text: val, ...(language(raw[lang]) ? { language: language(raw[lang]) } : {}) });
  }
  // Primary summaries and coded descriptions have different provenance. Only
  // exact supplied rows dedupe; language/type/code differences survive.
  descriptions.push(...unique(suppliedDescriptions.rows));
  const media = object(raw.media);
  const mediaValue = (key: string) => raw.media == null ? undefined
    : !raw.media || typeof raw.media !== 'object' || Array.isArray(raw.media) ? false : media[key];
  const images = section(mediaValue('images'), safeAsset), videos = section(mediaValue('videos'), safeAsset), documents = section(mediaValue('documents'), safeAsset);
  const references = object(raw.interchanges);
  const interchanges = section<ProductReference>(raw.interchanges == null ? undefined : references.items ?? false, value => {
    const row = object(value), partNumber = typeof row.part_number === 'string' ? row.part_number : '', brand = clean(row.brand);
    if (!partNumber || partNumber !== partNumber.trim() || /[\x00-\x1f\x7f]/.test(partNumber)
      || (row.brand != null && typeof row.brand !== 'string') || (row.brand_id != null && typeof row.brand_id !== 'string')
      || ['type', 'type_name', 'notes'].some(key => row[key] != null && typeof row[key] !== 'string')) return undefined;
    return { partNumber, brand, ...(optional(row.brand_id) ? { brandId: optional(row.brand_id) } : {}), ...(optional(row.type) ? { type: optional(row.type) } : {}),
      ...(optional(row.type_name) ? { typeName: optional(row.type_name) } : {}), ...(typeof row.notes === 'string' && row.notes.trim() ? { notes: row.notes.trim() } : {}) };
  });
  if (raw.interchanges != null && (!Number.isInteger(references.count) || Number(references.count) < 0
    || (Array.isArray(references.items) && references.count !== references.items.length))) {
    interchanges.state = interchanges.rows.length ? 'partial' : 'malformed';
  }
  const qualifiers = section(raw.fitment_qualifiers, value => {
    const row = object(value), name = clean(row.name), val = scalar(row.value);
    return name && val ? { name, value: val } : undefined;
  });
  return { specsList, descriptions, media: { images: unique(images.rows), videos: unique(videos.rows), documents: unique(documents.rows) },
    interchanges: interchanges.rows,
    interchangeCount: Number.isInteger(references.count) && Number(references.count) >= 0 ? Number(references.count) : null, applicationQualifiers: qualifiers.rows,
    sections: { specsList: ordered.state, specifications: fallback.state, descriptions: suppliedDescriptions.state,
      images: images.state, videos: videos.state, documents: documents.state, interchanges: interchanges.state, applicationQualifiers: qualifiers.state } };
}

// Legacy consumers accept a map: group repeated rows rather than overwrite them.
function legacySpecs(rows: ProductSpec[]): Record<string, string> {
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const values = grouped.get(row.name) ?? [];
    values.push([row.value, row.unit].filter(Boolean).join(' '));
    grouped.set(row.name, values);
  }
  return Object.fromEntries([...grouped].map(([name, values]) => [name, values.join('; ')]));
}

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
  const productFacts = mapFacts(raw);
  return {
    id: sku, brand: text(raw.brand_name ?? raw.brand), partNumber: text(raw.part_number), description: text(raw.name),
    descriptionText: (productFacts.descriptions.find(row => row.kind === 'short')
      ?? productFacts.descriptions.find(row => row.kind === 'long'))?.text.slice(0, 5000),
    productFacts,
    price, currency: 'CAD', warranty: '', stock: amount(availability.quantity) ?? 0,
    purchasable: raw.purchasable !== false,
    availability: text(availability.status) || 'unconfirmed',
    imageUrl: productFacts.media.images[0],
    coreCharge: amount(typeof raw.core_charge === 'number' ? raw.core_charge : object(raw.core_charge).amount),
    packQuantity: Number.isInteger(raw.sellablePackQuantity) && Number(raw.sellablePackQuantity) > 0 ? Number(raw.sellablePackQuantity) : 1,
    position: text(qualifiers.find(item => item.name === 'Position')?.value) || undefined,
    specs: legacySpecs(productFacts.specsList),
    interchanges: productFacts.interchanges.map(row => ({ partNumber: row.partNumber, brand: row.brand,
      // Current modal renders this Notes cell. Never activate unqualified NR/type rows.
      notes: [row.type, row.type?.toUpperCase() === 'NR' ? 'Not Recommended' : undefined, row.typeName, row.notes]
        .filter((value, index, values) => !!value && values.indexOf(value) === index).join(' · ') || undefined })),
    applicationNotes: [
      ...list(raw.fitment_notes ?? object(raw.fitment).fitment_notes).map(value => text(value)),
      ...qualifiers.map(item => [text(item.name), text(item.value)].filter(Boolean).join(': ')),
    ].filter(Boolean),
    // The product's summary is sampled; only the separate paginated fitments
    // resource supplies the vehicle rows. Never infer them from the open tree.
    fitments: [],
  };
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
