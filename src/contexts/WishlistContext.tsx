import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Part } from "@/lib/api";

interface WishlistItem {
  id: number;
  partId: number;
  addedAt: string;
  part?: Part;
}

interface WishlistContextValue {
  items: WishlistItem[];
  addToWishlist: (partId: number, part?: Part) => void;
  removeFromWishlist: (partId: number) => void;
  isInWishlist: (partId: number) => boolean;
  itemCount: number;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

const WISHLIST_STORAGE_KEY = "cap-wishlist";

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);

  // Load wishlist from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (stored) {
      try {
        setItems(JSON.parse(stored));
      } catch {
        localStorage.removeItem(WISHLIST_STORAGE_KEY);
      }
    }
  }, []);

  // Save wishlist to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addToWishlist = (partId: number, part?: Part) => {
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

  const removeFromWishlist = (partId: number) => {
    setItems((prev) => prev.filter((item) => item.partId !== partId));
  };

  const isInWishlist = (partId: number) => {
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
