import axios from "axios";
import {
  vehicleYears,
  vehicleMakes,
  vehicleModels,
  vehicleEngines,
  categories,
  partCatalog,
  yearToMakeIds,
  modelsByMakeYear,
} from "./mock-data";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true" || !API_BASE_URL;

const apiClient = axios.create({
  baseURL: API_BASE_URL || "http://localhost:4000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

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
}

export interface Part {
  id: number;
  brand: string;
  partNumber: string;
  description: string;
  price: number;
  tier: 'economy' | 'daily_driver' | 'premium' | 'performance';
  warranty: string;
  stock: number;
  position?: string;
}

export interface CartItem {
  id: number;
  partId: number;
  quantity: number;
  part?: Part;
}

export interface Cart {
  id: number;
  sessionId: string;
  items: CartItem[];
}

// Vehicle API
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const mockResponse = async <T,>(data: T): Promise<T> => {
  await delay(120);
  return data;
};

const getPartById = (partId: number): Part | null => {
  const part = partCatalog.find((item) => item.id === partId);
  return part ? { ...part } : null;
};

const cartKey = (sessionId: string) => `cap-cart:${sessionId}`;

const readCart = (sessionId: string): Cart => {
  if (typeof window === "undefined") {
    return { id: 1, sessionId, items: [] };
  }
  const raw = window.localStorage.getItem(cartKey(sessionId));
  if (!raw) {
    const emptyCart = { id: 1, sessionId, items: [] };
    window.localStorage.setItem(cartKey(sessionId), JSON.stringify(emptyCart));
    return emptyCart;
  }
  try {
    return JSON.parse(raw) as Cart;
  } catch {
    const fallback = { id: 1, sessionId, items: [] };
    window.localStorage.setItem(cartKey(sessionId), JSON.stringify(fallback));
    return fallback;
  }
};

const writeCart = (cart: Cart) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(cartKey(cart.sessionId), JSON.stringify(cart));
};

const hydrateCart = (cart: Cart): Cart => ({
  ...cart,
  items: cart.items.map((item) => ({
    ...item,
    part: getPartById(item.partId),
  })),
});

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
  partId?: number;
  categoryId?: number;
  categoryName?: string;
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

export const vehicleApi = {
  // Search for categories/part types within a selected vehicle
  searchCategories: async (query: string, context?: VehicleContext): Promise<VehicleSearchResult[]> => {
    if (USE_MOCKS) {
      const q = query.toLowerCase().trim();
      if (!q) return mockResponse([]);

      const results: VehicleSearchResult[] = [];

      // Search categories by name
      for (const cat of categories) {
        const catLower = cat.name.toLowerCase();
        if (catLower.includes(q)) {
          // Find parent category name if exists
          const parent = cat.parentId ? categories.find(c => c.id === cat.parentId) : null;
          const label = parent ? `${parent.name} > ${cat.name}` : cat.name;

          results.push({
            type: 'category',
            label,
            categoryId: cat.id,
            categoryName: cat.name,
            // Include vehicle context if provided
            ...(context && {
              year: context.year,
              makeId: context.makeId,
              makeName: context.makeName,
              modelId: context.modelId,
              modelName: context.modelName,
              engineId: context.engineId,
              engineName: context.engineName,
            }),
          });
        }
      }

      return mockResponse(results.slice(0, 10));
    }
    const { data } = await apiClient.get("/categories/search", { params: { q: query } });
    return data;
  },

  search: async (query: string): Promise<VehicleSearchResult[]> => {
    if (USE_MOCKS) {
      const q = query.toLowerCase().trim();
      if (!q) return mockResponse([]);

      const results: VehicleSearchResult[] = [];
      const queryParts = q.split(/\s+/);

      // Parse potential year from query
      const yearMatch = queryParts.find(p => /^\d{4}$/.test(p));
      const parsedYear = yearMatch ? parseInt(yearMatch, 10) : null;
      const nonYearParts = queryParts.filter(p => !/^\d{4}$/.test(p));

      // Search for vehicles
      for (const yearData of vehicleYears) {
        const year = yearData.year;
        // If user typed a year, only include that year
        if (parsedYear && year !== parsedYear) continue;

        const makeIds = yearToMakeIds[year] || [];
        for (const makeId of makeIds) {
          const make = vehicleMakes.find(m => m.id === makeId);
          if (!make) continue;

          const makeLower = make.name.toLowerCase();

          // Check if make matches any non-year query parts
          const makeMatches = nonYearParts.length === 0 ||
            nonYearParts.some(p => makeLower.includes(p) || makeLower.startsWith(p));

          // Skip if no year and make doesn't match
          if (!makeMatches && !parsedYear) continue;

          // If we have a year, suggest the make if it matches (or no filter yet)
          if (parsedYear) {
            const shouldShowMake = nonYearParts.length === 0 ||
              nonYearParts.some(p => makeLower.startsWith(p) || makeLower.includes(p));

            if (shouldShowMake) {
              results.push({
                type: 'vehicle',
                label: `${year} ${make.name}`,
                year,
                makeId: make.id,
                makeName: make.name,
              });
            }
          }

          // Search models if make matches
          if (makeMatches || parsedYear) {
            const modelIds = modelsByMakeYear[year]?.[makeId] || [];
            for (const modelId of modelIds) {
              const model = vehicleModels.find(m => m.id === modelId);
              if (!model) continue;

              const modelLower = model.name.toLowerCase();
              // Check if model matches remaining query parts after removing make matches
              const remainingParts = nonYearParts.filter(p => !makeLower.includes(p));
              const modelMatches = remainingParts.length === 0 ||
                remainingParts.some(p => modelLower.includes(p) || modelLower.startsWith(p));

              if (modelMatches) {
                results.push({
                  type: 'vehicle',
                  label: `${year} ${make.name} ${model.name}`,
                  year,
                  makeId: make.id,
                  makeName: make.name,
                  modelId: model.id,
                  modelName: model.name,
                });

                // Also add engine options
                const engines = vehicleEngines.filter(e => e.modelId === modelId);
                for (const engine of engines) {
                  results.push({
                    type: 'vehicle',
                    label: `${year} ${make.name} ${model.name} ${engine.name}`,
                    year,
                    makeId: make.id,
                    makeName: make.name,
                    modelId: model.id,
                    modelName: model.name,
                    engineId: engine.id,
                    engineName: engine.name,
                  });
                }
              }
            }
          }
        }
      }

      // Search for parts by part number
      for (const part of partCatalog) {
        if (part.partNumber.toLowerCase().includes(q) || part.brand.toLowerCase().includes(q)) {
          results.push({
            type: 'part',
            label: `${part.brand} ${part.partNumber}`,
            partNumber: part.partNumber,
            partId: part.id,
          });
        }
      }

      // Dedupe and limit results
      const seen = new Set<string>();
      const deduped = results.filter(r => {
        if (seen.has(r.label)) return false;
        seen.add(r.label);
        return true;
      });

      return mockResponse(deduped.slice(0, 10));
    }
    const { data } = await apiClient.get("/vehicles/search", { params: { q: query } });
    return data;
  },

  getYears: async (): Promise<VehicleYear[]> => {
    if (USE_MOCKS) {
      return mockResponse(vehicleYears);
    }
    const { data } = await apiClient.get("/vehicles/years");
    return data;
  },

  getMakes: async (year?: number): Promise<VehicleMake[]> => {
    if (USE_MOCKS) {
      if (!year || !yearToMakeIds[year]) {
        return mockResponse(vehicleMakes);
      }
      const makeIds = yearToMakeIds[year];
      return mockResponse(vehicleMakes.filter((make) => makeIds.includes(make.id)));
    }
    const { data } = await apiClient.get("/vehicles/makes", {
      params: { year },
    });
    return data;
  },

  getModels: async (makeId: number, year: number): Promise<VehicleModel[]> => {
    if (USE_MOCKS) {
      const modelIds = modelsByMakeYear[year]?.[makeId];
      const scopedModels = modelIds
        ? vehicleModels.filter((model) => modelIds.includes(model.id))
        : vehicleModels.filter((model) => model.makeId === makeId);
      return mockResponse(scopedModels);
    }
    const { data } = await apiClient.get("/vehicles/models", {
      params: { makeId, year },
    });
    return data;
  },

  getEngines: async (modelId: number): Promise<VehicleEngine[]> => {
    if (USE_MOCKS) {
      return mockResponse(vehicleEngines.filter((engine) => engine.modelId === modelId));
    }
    const { data } = await apiClient.get("/vehicles/engines", {
      params: { modelId },
    });
    return data;
  },
};

// Category API
export const categoryApi = {
  getAll: async (): Promise<Category[]> => {
    if (USE_MOCKS) {
      return mockResponse(categories);
    }
    const { data } = await apiClient.get("/categories");
    return data;
  },
};

// Parts API
export const partsApi = {
  getByCategory: async (categoryId: number, vehicleEngineId?: number): Promise<Part[]> => {
    if (USE_MOCKS) {
      const filtered = partCatalog.filter((part) => {
        const matchesCategory = part.categoryId === categoryId;
        const matchesEngine = vehicleEngineId ? part.engineId === vehicleEngineId : true;
        return matchesCategory && matchesEngine;
      });
      return mockResponse(filtered);
    }
    const { data } = await apiClient.get("/parts", {
      params: { categoryId, vehicleEngineId },
    });
    return data;
  },
};

// Cart API
export const cartApi = {
  get: async (sessionId: string): Promise<Cart> => {
    if (USE_MOCKS) {
      return mockResponse(hydrateCart(readCart(sessionId)));
    }
    const { data } = await apiClient.get("/cart", {
      params: { sessionId },
    });
    return data;
  },

  addItem: async (sessionId: string, partId: number, quantity: number): Promise<Cart> => {
    if (USE_MOCKS) {
      const cart = readCart(sessionId);
      const existing = cart.items.find((item) => item.partId === partId);
      if (existing) {
        existing.quantity += quantity;
      } else {
        const nextId = cart.items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
        cart.items.push({ id: nextId, partId, quantity });
      }
      writeCart(cart);
      return mockResponse(hydrateCart(cart));
    }
    const { data } = await apiClient.post("/cart/items", {
      sessionId,
      partId,
      quantity,
    });
    return data;
  },

  updateQuantity: async (itemId: number, quantity: number): Promise<Cart> => {
    if (USE_MOCKS) {
      if (typeof window === "undefined") {
        return mockResponse({ id: 1, sessionId: "", items: [] });
      }
      const carts = Array.from({ length: window.localStorage.length })
        .map((_, index) => window.localStorage.key(index))
        .filter((key): key is string => !!key && key.startsWith("cap-cart:"));

      for (const key of carts) {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        try {
          const cart = JSON.parse(raw) as Cart;
          const item = cart.items.find((entry) => entry.id === itemId);
          if (item) {
            item.quantity = quantity;
            writeCart(cart);
            return mockResponse(hydrateCart(cart));
          }
        } catch {
          continue;
        }
      }
      return mockResponse({ id: 1, sessionId: "", items: [] });
    }
    const { data } = await apiClient.put(`/cart/items/${itemId}`, {
      quantity,
    });
    return data;
  },

  removeItem: async (itemId: number): Promise<void> => {
    if (USE_MOCKS) {
      if (typeof window === "undefined") {
        return;
      }
      const keys = Array.from({ length: window.localStorage.length })
        .map((_, index) => window.localStorage.key(index))
        .filter((key): key is string => !!key && key.startsWith("cap-cart:"));

      for (const key of keys) {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        try {
          const cart = JSON.parse(raw) as Cart;
          const nextItems = cart.items.filter((item) => item.id !== itemId);
          if (nextItems.length !== cart.items.length) {
            cart.items = nextItems;
            writeCart(cart);
            return;
          }
        } catch {
          continue;
        }
      }
      return;
    }
    await apiClient.delete(`/cart/items/${itemId}`);
  },
};

export default apiClient;
