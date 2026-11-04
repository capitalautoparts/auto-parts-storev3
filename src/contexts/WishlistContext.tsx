import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Part } from "@/lib/api";
import { safeStorage, saveStorage } from '@/features/catalog/model';

interface WishlistItem {
  id: number;
  partId: string | number;
  addedAt: string;
  part?: Part;
}

interface WishlistContextValue {
  items: WishlistItem[];
  addToWishlist: (partId: string | number, part?: Part) => void;
  removeFromWishlist: (partId: string | number) => void;
  isInWishlist: (partId: string | number) => boolean;
  itemCount: number;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

const WISHLIST_STORAGE_KEY = "roysauto.original-wishlist.v1";

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>(() => {
    try {
      const value = JSON.parse(safeStorage(WISHLIST_STORAGE_KEY) ?? '[]');
      return Array.isArray(value) ? value.filter(item => typeof item?.partId === 'string' && item.part?.id === item.partId && typeof item.part?.price === 'number' && typeof item.part?.brand === 'string' && typeof item.part?.partNumber === 'string').slice(0, 100) : [];
    } catch { return []; }
  });

  // Save wishlist to localStorage when it changes
  useEffect(() => {
    saveStorage(WISHLIST_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addToWishlist = (partId: string | number, part?: Part) => {
    setItems((prev) => {
      if (prev.some((item) => item.partId === partId)) {
        return prev;
      }
      const newItem: WishlistItem = {
        id: Date.now(),
        partId,
        addedAt: new Date().toISOString(),
        part,
      };
      return [...prev, newItem];
    });
  };

  const removeFromWishlist = (partId: string | number) => {
    setItems((prev) => prev.filter((item) => item.partId !== partId));
  };

  const isInWishlist = (partId: string | number) => {
    return items.some((item) => item.partId === partId);
  };

  return (
    <WishlistContext.Provider
      value={{
        items,
        addToWishlist,
        removeFromWishlist,
        isInWishlist,
        itemCount: items.length,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
