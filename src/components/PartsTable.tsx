import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Part } from "@/lib/api";

interface PartsTableProps {
  parts: Part[];
  onAddToCart: (partId: number) => void;
}

const tierConfig = {
  economy: {
    label: "Economy",
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
  },
  daily_driver: {
    label: "Daily Driver",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
  },
  premium: {
    label: "Premium",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-800",
  },
  performance: {
    label: "Performance",
    bgColor: "bg-red-100",
    textColor: "text-red-800",
  },
};

export function PartsTable({ parts, onAddToCart }: PartsTableProps) {
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
    <div className="space-y-6">
      {positions.map((position) => (
        <div key={position}>
          {/* Position Header */}
          <div className="bg-muted px-4 py-2 font-semibold text-sm uppercase mb-2">
            {position}
          </div>

          {/* Parts Table */}
          <div className="border rounded-md overflow-hidden">
            <table className="w-full">
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
                        isEvenRow ? "bg-white" : "bg-purple-50/30"
                      )}
                    >
                      {/* Tier Badge */}
                      <td className="p-3 w-24">
                        <Badge
                          className={cn(
                            "text-xs font-semibold px-2 py-1",
                            tier.bgColor,
                            tier.textColor
                          )}
                        >
                          {tier.label}
                        </Badge>
                      </td>

                      {/* Brand & Part Number */}
                      <td className="p-3 w-48">
                        <div className="font-semibold text-sm">{part.brand}</div>
                        <div className="text-xs text-muted-foreground">{part.partNumber}</div>
                      </td>

                      {/* Description & Details */}
                      <td className="p-3 flex-1">
                        <div className="text-sm mb-1">{part.description}</div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {part.warranty && <span>Warranty: {part.warranty}</span>}
                          {isInStock ? (
                            <span className="flex items-center gap-1 text-green-700">
                              <Check className="h-3 w-3" />
                              In Stock
                            </span>
                          ) : (
                            <span className="text-red-700">Out of Stock</span>
                          )}
                        </div>
                      </td>

                      {/* Price */}
                      <td className="p-3 w-32 text-right">
                        <div className="text-lg font-bold text-primary">${formattedPrice}</div>
                      </td>

                      {/* Add to Cart */}
                      <td className="p-3 w-40">
                        <Button
                          onClick={() => onAddToCart(part.id)}
                          disabled={!isInStock}
                          size="sm"
                          className="w-full"
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Add to Cart
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
