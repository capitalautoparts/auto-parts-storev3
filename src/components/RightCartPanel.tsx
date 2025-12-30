import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    <div className="w-80 bg-card border-l flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-muted">
        <h3 className="font-semibold text-base">
          Shopping Cart ({items.length})
        </h3>
      </div>

      {/* Cart Items */}
      <ScrollArea className="flex-1">
        {items.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <p className="font-medium">Your cart is empty</p>
            <p className="text-sm mt-1">Add parts to get started</p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {items.filter(item => item.part !== null).map((item) => (
              <Card key={item.id} className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">
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

                {/* Quantity Controls */}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 border rounded">
                    <button
                      onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                      className="p-1 hover:bg-muted"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-medium w-8 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      className="p-1 hover:bg-muted"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="text-base font-bold text-primary">
                    ${((item.part!.price * item.quantity)).toFixed(2)}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer with Subtotal and Checkout */}
      <div className="p-4 border-t bg-muted space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Subtotal</span>
          <span className="text-xl font-bold text-primary">${formattedSubtotal}</span>
        </div>

        <Button
          onClick={onCheckout}
          disabled={items.length === 0}
          className="w-full"
          size="lg"
        >
          Proceed to Checkout
        </Button>
      </div>
    </div>
  );
}
