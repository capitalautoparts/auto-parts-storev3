import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
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
export const vehicleApi = {
  getYears: async (): Promise<VehicleYear[]> => {
    const { data } = await apiClient.get('/vehicles/years');
    return data;
  },

  getMakes: async (year?: number): Promise<VehicleMake[]> => {
    const { data } = await apiClient.get('/vehicles/makes', {
      params: { year },
    });
    return data;
  },

  getModels: async (makeId: number, year: number): Promise<VehicleModel[]> => {
    const { data } = await apiClient.get('/vehicles/models', {
      params: { makeId, year },
    });
    return data;
  },

  getEngines: async (modelId: number): Promise<VehicleEngine[]> => {
    const { data } = await apiClient.get('/vehicles/engines', {
      params: { modelId },
    });
    return data;
  },
};

// Category API
export const categoryApi = {
  getAll: async (): Promise<Category[]> => {
    const { data } = await apiClient.get('/categories');
    return data;
  },
};

// Parts API
export const partsApi = {
  getByCategory: async (categoryId: number, vehicleEngineId?: number): Promise<Part[]> => {
    const { data } = await apiClient.get('/parts', {
      params: { categoryId, vehicleEngineId },
    });
    return data;
  },
};

// Cart API
export const cartApi = {
  get: async (sessionId: string): Promise<Cart> => {
    const { data } = await apiClient.get('/cart', {
      params: { sessionId },
    });
    return data;
  },

  addItem: async (sessionId: string, partId: number, quantity: number): Promise<Cart> => {
    const { data } = await apiClient.post('/cart/items', {
      sessionId,
      partId,
      quantity,
    });
    return data;
  },

  updateQuantity: async (itemId: number, quantity: number): Promise<Cart> => {
    const { data } = await apiClient.put(`/cart/items/${itemId}`, {
      quantity,
    });
    return data;
  },

  removeItem: async (itemId: number): Promise<void> => {
    await apiClient.delete(`/cart/items/${itemId}`);
  },
};

export default apiClient;
