// Types
export interface VehicleYear {
  year: number;
}

export interface VehicleMake {
  id: number;
  name: string;
  country?: string;
}

export interface VehicleModel {
  id: number;
  name: string;
  makeId: number;
}

export interface VehicleEngine {
  id: number;
  name: string;
  modelId: number;
  /** Validated exact-YMM reference fields; null means supplied details malformed.
   * Missing fields remain unknown, never inferred from vehicle or products. */
  details?: { liter?: number; cylinders?: number; block_type?: string; cc?: number; cid?: number } | null;
}

export interface Category {
  id: number;
  name: string;
  parentId: number | null;
  slug?: string;
}

export interface PartInterchange {
  partNumber: string;
  brand: string;
  notes?: string;
}

export interface PartFitment {
  year: number;
  yearEnd?: number;
  make: string;
  model: string;
  engine?: string;
  notes?: string;
}

export interface PartAsset {
  type: 'pdf' | 'image' | 'video';
  title: string;
  url: string;
}

/** Detail-only facts. Listing snapshots need not contain these sections. */
export type ProductSectionState = 'absent' | 'empty' | 'available' | 'partial' | 'malformed';
export interface ProductSpec { name: string; value: string; unit?: string }
export interface ProductDescription {
  kind: 'short' | 'long' | 'other';
  text: string;
  language?: string;
  type?: string;
  code?: string;
}
export interface ProductReference extends PartInterchange {
  /** Empty string means the source supplied no brand label; never inferred. */
  brand: string;
  brandId?: string;
  type?: string;
  typeName?: string;
}
export interface ProductFacts {
  specsList: ProductSpec[];
  descriptions: ProductDescription[];
  /** Only the website-filtered public media response; no raw asset access. */
  media: { images: string[]; videos: string[]; documents: string[] };
  /** Supplied cross-references, never a replacement/fitment guarantee. */
  interchanges: ProductReference[];
  /** Supplied total before display filtering; null when absent or invalid. */
  interchangeCount: number | null;
  applicationQualifiers: { name: string; value: string }[];
  /** Per-source health, independent of fallback: absent includes null/missing;
   * empty requires an explicit empty container; partial records policy omission,
   * invalid rows among usable rows, or count mismatch; malformed means no usable
   * structurally valid rows/container. Policy-only omissions are partial. */
  sections: Record<'specsList' | 'specifications' | 'descriptions' | 'images' | 'videos' | 'documents' | 'interchanges' | 'applicationQualifiers', ProductSectionState>;
}

export interface Part {
  id: string | number;
  brand: string;
  partNumber: string;
  description: string;
  descriptionText?: string;
  productFacts?: ProductFacts;
  purchasable?: boolean;
  price: number | null;
  tier?: 'economy' | 'daily_driver' | 'premium' | 'performance';
  warranty: string;
  currency?: string;
  coreCharge?: number | null;
  packQuantity?: number;
  availability?: string;
  leadTimeDays?: number;
  applicationNotes?: string[];
  /** ERP's vehicle-scoped summary; it deliberately omits unverified engine claims. */
  fitmentSummary?: string;
  stock: number;
  position?: string;
  imageUrl?: string;
  specs?: Record<string, string>;
  interchanges?: PartInterchange[];
  fitments?: PartFitment[];
  assets?: PartAsset[];
}

export interface CartItem {
  id: string | number;
  partId: string | number;
  quantity: number;
  part?: Part;
}

export interface Cart {
  id: number;
  sessionId: string;
  items: CartItem[];
}

export interface VehicleSearchResult {
  type: 'vehicle' | 'part' | 'category';
  label: string;
  year?: number;
  makeId?: number;
  makeName?: string;
  modelId?: number;
  modelName?: string;
  engineId?: number;
  engineName?: string;
  partNumber?: string;
  partId?: string | number;
  categoryId?: number;
  categoryName?: string;
  categorySlug?: string;
  categoryParentId?: number | null;
}

export interface VehicleContext {
  year: number;
  makeId: number;
  makeName: string;
  modelId: number;
  modelName: string;
  engineId?: number;
  engineName?: string;
}


export { vehicleApi, categoryApi, partsApi, cartApi } from "./erp-api";
