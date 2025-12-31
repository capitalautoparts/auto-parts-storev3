import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/components/ProductImage";
import { useWishlist } from "@/contexts/WishlistContext";
import type { Part } from "@/lib/api";

interface WishlistPanelProps {
  onAddToCart?: (part: Part) => void;
}

export function WishlistPanel({ onAddToCart }: WishlistPanelProps) {
  const { items, removeFromWishlist, itemCount } = useWishlist();

  const handleAddToCart = (part: Part) => {
    if (onAddToCart) {
      onAddToCart(part);
      removeFromWishlist(part.id);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-brand-cream hover:bg-white/10"
        >
          <Heart className="h-5 w-5" />
          {itemCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-brand-gold text-brand-ink">
              {itemCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-96">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            My Wishlist ({itemCount})
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4 overflow-y-auto max-h-[calc(100vh-120px)]">
          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Heart className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Your wishlist is empty</p>
              <p className="text-sm mt-1">Save parts you're interested in for later</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 p-3 border rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <ProductImage
                  src={item.part?.imageUrl}
                  alt={item.part?.partNumber || "Part"}
                  className="w-16 h-16 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {item.part?.brand} {item.part?.partNumber}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {item.part?.description}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-sm">
                      ${item.part?.price?.toFixed(2)}
                    </span>
                    <div className="flex gap-1">
                      {item.part && onAddToCart && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handleAddToCart(item.part!)}
                        >
                          <ShoppingCart className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                        onClick={() => removeFromWishlist(item.partId)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
