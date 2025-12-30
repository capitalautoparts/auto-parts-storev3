import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Minus, Plus, X } from "lucide-react";
import type { CartItem } from "@/lib/api";

interface RightCartPanelProps {
  items: CartItem[];
  onUpdateQuantity: (itemId: number, quantity: number) => void;
  onRemoveItem: (itemId: number) => void;
  onCheckout: () => void;
}

export function RightCartPanel({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}: RightCartPanelProps) {
  const subtotal = items.reduce((sum, item) => sum + (item.part?.price || 0) * item.quantity, 0);
  const formattedSubtotal = subtotal.toFixed(2);

  return (
    <div className="w-full lg:w-80 bg-card border-l border-border flex flex-col h-full">
      <div className="p-3 bg-brand-navy text-brand-cream text-xs uppercase tracking-[0.3em] font-display border-b border-border">
        Quick Cart
      </div>

      <div className="p-3 border-b border-border bg-secondary">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Shopping Cart
        </div>
        <div className="text-sm font-semibold text-brand-ink">
          {items.length} item{items.length === 1 ? "" : "s"} saved
        </div>
      </div>

      {/* Cart Items */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {items.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <p className="font-medium">Your cart is empty</p>
              <p className="text-sm mt-1">Select parts to build a quick quote.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.filter((item) => item.part).map((item) => (
              <Card key={item.id} className="p-3 border border-border shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-brand-ink">
                        {item.part!.brand}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.part!.partNumber}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {item.part!.description}
                      </div>
                      {item.part!.position && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Position: {item.part!.position}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 border border-border rounded bg-white">
                    <button
                      onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                      className="p-1 hover:bg-secondary"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                      <span className="text-sm font-medium w-8 text-center">
                        {item.quantity}
                      </span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      className="p-1 hover:bg-secondary"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    </div>

                    <div className="text-base font-bold text-brand-ink">
                      ${((item.part!.price * item.quantity)).toFixed(2)}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div className="border border-border rounded-md overflow-hidden">
            <div className="px-3 py-2 bg-secondary text-[11px] uppercase tracking-[0.2em] text-brand-ink">
              Address Information
            </div>
            <div className="p-3 space-y-3 bg-white">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                  Email
                </div>
                <Input placeholder="you@email.com" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                  Full Name
                </div>
                <Input placeholder="Full name" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                  Address
                </div>
                <Input placeholder="Street address" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                    City
                  </div>
                  <Input placeholder="City" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                    State/Province
                  </div>
                  <Input placeholder="State" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                    Zip/Postal Code
                  </div>
                  <Input placeholder="Postal code" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                    Country
                  </div>
                  <Input placeholder="Country" />
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                  Phone
                </div>
                <Input placeholder="Phone number" />
              </div>
              <Button type="button" variant="outline" className="w-full">
                Calculate Shipping
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border bg-secondary space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-brand-ink">Subtotal</span>
          <span className="text-xl font-bold text-brand-ink">${formattedSubtotal}</span>
        </div>

        <Button
          onClick={onCheckout}
          disabled={items.length === 0}
          className="w-full bg-brand-navy text-brand-cream hover:opacity-90"
          size="lg"
        >
          Proceed to Checkout
        </Button>
      </div>
    </div>
  );
}
