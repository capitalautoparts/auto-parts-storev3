import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductImage } from "./ProductImage";
import { WishlistButton } from "./wishlist/WishlistButton";
import { ShoppingCart, Check, FileText, ExternalLink, Package, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Part } from "@/lib/api";

interface ProductDetailModalProps {
  part: Part | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: (partId: number) => void;
}

const tierConfig = {
  economy: {
    label: "Economy",
    bgColor: "bg-sky-500",
    textColor: "text-white",
  },
  daily_driver: {
    label: "Daily Driver",
    bgColor: "bg-emerald-500",
    textColor: "text-white",
  },
  premium: {
    label: "Premium",
    bgColor: "bg-amber-500",
    textColor: "text-white",
  },
  performance: {
    label: "Performance",
    bgColor: "bg-rose-500",
    textColor: "text-white",
  },
};

export function ProductDetailModal({
  part,
  open,
  onOpenChange,
  onAddToCart,
}: ProductDetailModalProps) {
  if (!part) return null;

  const tier = tierConfig[part.tier];
  const isInStock = part.stock > 0;

  const handleAddToCart = () => {
    onAddToCart(part.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white shadow-2xl border-0">
        {/* Header bar */}
        <div className="bg-[#a00a0a] text-white px-4 py-3">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-white">
              <Package className="h-5 w-5" />
              <span className="font-semibold">{part.brand} {part.partNumber}</span>
              <Badge
                className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded",
                  tier.bgColor,
                  tier.textColor
                )}
              >
                {tier.label}
              </Badge>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-4 bg-white">
          {/* Product info section */}
          <div className="flex gap-4 mb-4">
            {/* Image - smaller and to the left */}
            <div className="flex-shrink-0">
              <ProductImage
                src={part.imageUrl}
                alt={`${part.brand} ${part.partNumber}`}
                className="w-32 h-32 border rounded"
              />
            </div>

            {/* Product details */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground mb-2">{part.description}</p>

              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-2xl font-bold text-brand-ink">${part.price.toFixed(2)}</span>
                <span className="text-sm text-muted-foreground">each</span>
              </div>

              {/* Stock and warranty */}
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  {isInStock ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span className="text-emerald-600 font-medium">
                        In Stock ({part.stock} available)
                      </span>
                    </>
                  ) : (
                    <span className="text-rose-600 font-medium">Out of Stock</span>
                  )}
                </div>
                {part.warranty && (
                  <div className="text-muted-foreground">
                    <span className="font-medium">Warranty:</span> {part.warranty}
                  </div>
                )}
                {part.position && (
                  <div className="text-muted-foreground">
                    <span className="font-medium">Position:</span> {part.position}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleAddToCart}
                disabled={!isInStock}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add to Cart
              </Button>
              <WishlistButton partId={part.id} part={part} className="w-full justify-center" />
            </div>
          </div>

          {/* Tabbed content - more compact */}
          <Tabs defaultValue="specs" className="border rounded-lg overflow-hidden">
            <TabsList className="w-full justify-start rounded-none border-b bg-gray-100 p-0 h-auto">
              <TabsTrigger
                value="specs"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-brand-navy data-[state=active]:bg-white px-4 py-2 text-sm"
              >
                Specifications
              </TabsTrigger>
              <TabsTrigger
                value="interchanges"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-brand-navy data-[state=active]:bg-white px-4 py-2 text-sm"
              >
                Interchanges
              </TabsTrigger>
              <TabsTrigger
                value="fitments"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-brand-navy data-[state=active]:bg-white px-4 py-2 text-sm"
              >
                Fitments
              </TabsTrigger>
              <TabsTrigger
                value="assets"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-brand-navy data-[state=active]:bg-white px-4 py-2 text-sm"
              >
                Documents
              </TabsTrigger>
            </TabsList>

            <div className="max-h-48 overflow-y-auto bg-white">
              <TabsContent value="specs" className="m-0 p-0 bg-white">
                {part.specs && Object.keys(part.specs).length > 0 ? (
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(part.specs).map(([key, value], index) => (
                        <tr
                          key={key}
                          className={cn(
                            "border-b last:border-b-0",
                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          )}
                        >
                          <td className="px-3 py-2 font-medium text-muted-foreground w-1/3">
                            {key}
                          </td>
                          <td className="px-3 py-2">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground bg-white">
                    <Info className="h-4 w-4" />
                    <span className="text-sm">No specifications available</span>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="interchanges" className="m-0 p-0 bg-white">
                {part.interchanges && part.interchanges.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Brand</th>
                        <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Part Number</th>
                        <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {part.interchanges.map((interchange, index) => (
                        <tr
                          key={index}
                          className={cn(
                            "border-b last:border-b-0",
                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          )}
                        >
                          <td className="px-3 py-2">{interchange.brand}</td>
                          <td className="px-3 py-2 font-mono text-xs">{interchange.partNumber}</td>
                          <td className="px-3 py-2 text-muted-foreground text-xs">
                            {interchange.notes || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground bg-white">
                    <Info className="h-4 w-4" />
                    <span className="text-sm">No interchange information available</span>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="fitments" className="m-0 p-0 bg-white">
                {part.fitments && part.fitments.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Year</th>
                        <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Make</th>
                        <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Model</th>
                        <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wider">Engine</th>
                      </tr>
                    </thead>
                    <tbody>
                      {part.fitments.map((fitment, index) => (
                        <tr
                          key={index}
                          className={cn(
                            "border-b last:border-b-0",
                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          )}
                        >
                          <td className="px-3 py-2">{fitment.year}</td>
                          <td className="px-3 py-2">{fitment.make}</td>
                          <td className="px-3 py-2">{fitment.model}</td>
                          <td className="px-3 py-2 text-muted-foreground">{fitment.engine || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground bg-white">
                    <Info className="h-4 w-4" />
                    <span className="text-sm">No fitment information available</span>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="assets" className="m-0 p-2 bg-white">
                {part.assets && part.assets.length > 0 ? (
                  <div className="space-y-1">
                    {part.assets.map((asset, index) => (
                      <a
                        key={index}
                        href={asset.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 transition-colors"
                      >
                        <FileText className="h-4 w-4 text-brand-navy" />
                        <span className="flex-1 text-sm">{asset.title}</span>
                        <Badge variant="secondary" className="text-xs">{asset.type.toUpperCase()}</Badge>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground bg-white">
                    <Info className="h-4 w-4" />
                    <span className="text-sm">No documents available</span>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
