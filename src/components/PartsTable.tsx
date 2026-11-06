import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Check, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/ProductImage";
import { productPath, validSku } from "../../server/product-data.ts";
import { followProduct } from "@/features/catalog/product-navigation";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import type { Part } from "@/lib/api";
import { availabilitySummary } from "@/lib/availability";

interface PartsTableProps {
  parts: Part[];
  onAddToCart: (partId: string | number) => void;
}

const tierConfig = {
  economy: {
    label: "Economy",
    bgColor: "bg-white border border-brand-sand",
    textColor: "text-brand-ink",
  },
  daily_driver: {
    label: "Daily Driver",
    bgColor: "bg-brand-sand",
    textColor: "text-brand-ink",
  },
  premium: {
    label: "Premium",
    bgColor: "bg-brand-accent/15 border border-brand-accent/40",
    textColor: "text-brand-accent",
  },
  performance: {
    label: "Performance",
    bgColor: "bg-brand-ink",
    textColor: "text-white",
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
    <div className="space-y-4" data-testid="parts-table">
      {positions.map((position) => (
        <div key={position}>
          <div className="flex items-center justify-between bg-brand-charcoal text-white px-3 py-2 text-xs uppercase tracking-[0.25em] font-display">
            <span>{position}</span>
            <span className="text-[10px] text-white/80">CAD / sellable unit</span>
          </div>

          <div className="border border-border bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="hidden md:table-header-group bg-secondary text-[11px] uppercase tracking-[0.2em] text-brand-ink">
                <tr>
                  <th className="text-left px-3 py-2 w-16">Image</th>
                  <th className="text-left px-3 py-2 w-48">Part</th>
                  <th className="text-left px-3 py-2">Details</th>
                  <th className="text-right px-3 py-2 w-24">Price</th>
                  <th className="text-right px-3 py-2 w-32">Cart</th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group">
                {groupedParts[position].map((part, index) => {
                  const tier = (part.tier ? tierConfig[part.tier] : { label: "—", bgColor: "bg-secondary", textColor: "text-muted-foreground" });
                  const availability = availabilitySummary(part);
                  const formattedPrice = part.price === null ? "Price unavailable" : `$${part.price.toFixed(2)}`;
                  const isEvenRow = index % 2 === 0;
                  const href = validSku(part.id) ? productPath(part.id) : undefined;

                  return (
                    <tr
                      data-part-id={part.id}
                      key={part.id}
                      className={cn(
                        "grid grid-cols-[3rem_minmax(0,1fr)_auto] md:table-row border-b last:border-b-0",
                        isEvenRow ? "bg-white" : "bg-secondary"
                      )}
                    >
                      <td className="p-2 md:p-3 md:w-16 align-top">
                        <a
                          href={href}
                          onClick={event => followProduct(event, String(part.id))}
                          aria-label={`View ${part.brand} ${part.partNumber}`}
                          className="hover:opacity-80 transition-opacity"
                        >
                          <ProductImage
                            src={part.imageUrl}
                            alt={`${part.brand} ${part.partNumber}`}
                            className="w-9 h-9 md:w-12 md:h-12"
                          />
                        </a>
                      </td>

                      <td className="p-2 md:p-3 md:w-40 min-w-0 align-top">
                        <a
                          href={href}
                          onClick={event => followProduct(event, String(part.id))}
                          className="text-left hover:text-brand-navy transition-colors"
                        >
                          <div className="font-semibold text-sm">{part.brand}</div>
                          <div className="text-xs text-muted-foreground">{part.partNumber}</div>
                        </a>
                        {part.tier && <Badge className={cn("mt-1 text-xs", tier.bgColor, tier.textColor)}>{tier.label}</Badge>}
                      </td>

                      <td className="col-span-3 row-start-2 p-2 md:p-3 min-w-0 align-top">
                        <div className="text-sm mb-1">{part.description}</div>
                        {part.packQuantity && part.packQuantity > 1 && <p className="text-xs">Pack of {part.packQuantity}</p>}
                        {part.applicationNotes?.length ? <p className="text-xs mb-1 text-muted-foreground">{part.applicationNotes.length} application {part.applicationNotes.length === 1 ? 'note' : 'notes'} — review engine, submodel and position in Details.</p> : null}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {part.warranty && <span>Warranty: {part.warranty}</span>}
                          {part.position && <span>Position: {part.position}</span>}
                          <span data-testid="part-availability" className={cn("flex items-center gap-1",
                            availability.tone === 'positive' ? "text-emerald-700" : availability.tone === 'negative' ? "text-rose-700" : "text-muted-foreground") }>
                            {availability.confirmedStock && <Check className="h-3 w-3" />}
                            {availability.label}
                          </span>
                        </div>
                      </td>

                      <td className="col-start-3 row-start-1 p-2 md:p-3 md:w-24 text-right align-top">
                        <div className="text-base font-bold text-brand-ink tabular-nums">{formattedPrice}</div>
                        {part.coreCharge != null && <p className="text-xs">+ ${part.coreCharge.toFixed(2)} core</p>}
                      </td>

                      <td className="col-span-3 row-start-3 p-2 md:p-3 md:w-32 align-top">
                        <div className="flex md:flex-col gap-2 md:gap-1">
                          <div className="flex flex-1 gap-1">
                            <Button
                              onClick={() => onAddToCart(part.id)}
                              disabled={part.price === null}
                              size="sm"
                              className="flex-1 bg-brand-accent text-white hover:bg-brand-accent/90"
                            >
                              <ShoppingCart className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                            <WishlistButton partId={part.id} part={part} size="sm" />
                          </div>
                          <Button asChild
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            <a href={href} aria-disabled={!href} onClick={event => followProduct(event, String(part.id))}><Info className="h-4 w-4 mr-1" />
                            Details</a>
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


    </div>
  );
}
