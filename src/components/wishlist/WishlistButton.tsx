import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/contexts/WishlistContext";
import type { Part } from "@/lib/api";
import { cn } from "@/lib/utils";

interface WishlistButtonProps {
  partId: number;
  part?: Part;
  size?: "sm" | "default";
  className?: string;
}

export function WishlistButton({ partId, part, size = "default", className }: WishlistButtonProps) {
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const inWishlist = isInWishlist(partId);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inWishlist) {
      removeFromWishlist(partId);
    } else {
      addToWishlist(partId, part);
    }
  };

  return (
    <Button
      variant="ghost"
      size={size === "sm" ? "icon" : "default"}
      onClick={handleClick}
      className={cn(
        "transition-colors",
        inWishlist && "text-red-500 hover:text-red-600",
        !inWishlist && "text-muted-foreground hover:text-red-500",
        className
      )}
      title={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Heart
        className={cn(
          size === "sm" ? "h-4 w-4" : "h-5 w-5",
          inWishlist && "fill-current"
        )}
      />
      {size === "default" && (
        <span className="ml-1 sr-only">
          {inWishlist ? "Remove from wishlist" : "Add to wishlist"}
        </span>
      )}
    </Button>
  );
}
