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

export interface Part {
  id: string | number;
  brand: string;
  partNumber: string;
  description: string;
  price: number | null;
  tier?: 'economy' | 'daily_driver' | 'premium' | 'performance';
  warranty: string;
  currency?: string;
  coreCharge?: number | null;
  packQuantity?: number;
  availability?: string;
  leadTimeDays?: number;
  applicationNotes?: string[];
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
