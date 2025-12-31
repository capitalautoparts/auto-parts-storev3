import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Check, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/ProductImage";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import type { Part } from "@/lib/api";

interface PartsTableProps {
  parts: Part[];
  onAddToCart: (partId: number) => void;
}

const tierConfig = {
  economy: {
    label: "Economy",
    bgColor: "bg-sky-100",
    textColor: "text-sky-900",
  },
  daily_driver: {
    label: "Daily Driver",
    bgColor: "bg-emerald-100",
    textColor: "text-emerald-900",
  },
  premium: {
    label: "Premium",
    bgColor: "bg-amber-100",
    textColor: "text-amber-900",
  },
  performance: {
    label: "Performance",
    bgColor: "bg-rose-100",
    textColor: "text-rose-900",
  },
};

export function PartsTable({ parts, onAddToCart }: PartsTableProps) {
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handlePartClick = (part: Part) => {
    setSelectedPart(part);
    setModalOpen(true);
  };

  // Group parts by position
  const groupedParts = parts.reduce((acc, part) => {
    const position = part.position || "Other";
    if (!acc[position]) {
      acc[position] = [];
    }
    acc[position].push(part);
    return acc;
  }, {} as Record<string, Part[]>);

  const positions = Object.keys(groupedParts).sort();

  return (
    <div className="space-y-6 stagger-children">
      {positions.map((position) => (
        <div key={position} className="animate-rise">
          <div className="flex items-center justify-between bg-[#a00a0a] text-white px-4 py-2 text-xs uppercase tracking-[0.25em] font-display">
            <span>{position}</span>
            <span className="text-[10px] text-white/80">Price per item</span>
          </div>

          <div className="border border-border bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-[11px] uppercase tracking-[0.2em] text-brand-ink">
                <tr>
                  <th className="text-left px-3 py-2 w-16">Image</th>
                  <th className="text-left px-3 py-2 w-24">Tier</th>
                  <th className="text-left px-3 py-2 w-48">Part</th>
                  <th className="text-left px-3 py-2">Details</th>
                  <th className="text-right px-3 py-2 w-24">Price</th>
                  <th className="text-right px-3 py-2 w-32">Cart</th>
                </tr>
              </thead>
              <tbody>
                {groupedParts[position].map((part, index) => {
                  const tier = tierConfig[part.tier];
                  const isInStock = part.stock > 0;
                  const formattedPrice = part.price.toFixed(2);
                  const isEvenRow = index % 2 === 0;

                  return (
                    <tr
                      key={part.id}
                      className={cn(
                        "border-b last:border-b-0",
                        isEvenRow ? "bg-white" : "bg-secondary"
                      )}
                    >
                      <td className="p-3 w-16 align-top">
                        <button
                          onClick={() => handlePartClick(part)}
                          className="hover:opacity-80 transition-opacity"
                        >
                          <ProductImage
                            src={part.imageUrl}
                            alt={`${part.brand} ${part.partNumber}`}
                            className="w-12 h-12"
                          />
                        </button>
                      </td>

                      <td className="p-3 w-24 align-top">
                        <Badge
                          className={cn(
                            "text-xs font-semibold px-2 py-1 rounded-sm",
                            tier.bgColor,
                            tier.textColor
                          )}
                        >
                          {tier.label}
                        </Badge>
                      </td>

                      <td className="p-3 w-48 align-top">
                        <button
                          onClick={() => handlePartClick(part)}
                          className="text-left hover:text-brand-navy transition-colors"
                        >
                          <div className="font-semibold text-sm">{part.brand}</div>
                          <div className="text-xs text-muted-foreground">{part.partNumber}</div>
                        </button>
                      </td>

                      <td className="p-3 align-top">
                        <div className="text-sm mb-2">{part.description}</div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {part.warranty && <span>Warranty: {part.warranty}</span>}
                          {part.position && <span>Position: {part.position}</span>}
                          {isInStock ? (
                            <span className="flex items-center gap-1 text-emerald-700">
                              <Check className="h-3 w-3" />
                              In Stock
                            </span>
                          ) : (
                            <span className="text-rose-700">Out of Stock</span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 w-24 text-right align-top">
                        <div className="text-lg font-bold text-brand-ink">${formattedPrice}</div>
                      </td>

                      <td className="p-3 w-32 align-top">
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-1">
                            <Button
                              onClick={() => onAddToCart(part.id)}
                              disabled={!isInStock}
                              size="sm"
                              className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                              <ShoppingCart className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                            <WishlistButton partId={part.id} part={part} size="sm" />
                          </div>
                          <Button
                            onClick={() => handlePartClick(part)}
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            <Info className="h-4 w-4 mr-1" />
                            Details
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <ProductDetailModal
        part={selectedPart}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onAddToCart={onAddToCart}
      />
    </div>
  );
}
