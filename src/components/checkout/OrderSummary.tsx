import { ProductImage } from "@/components/ProductImage";
import type { CartItem } from "@/lib/api";

interface OrderSummaryProps {
  items: CartItem[];
}

export function OrderSummary({ items }: OrderSummaryProps) {
  const subtotal = items.reduce(
    (sum, item) => sum + (item.part?.price || 0) * item.quantity,
    0
  );
  const shipping = subtotal > 100 ? 0 : 9.99;
  const tax = subtotal * 0.08; // 8% tax estimate
  const total = subtotal + shipping + tax;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Order Summary</h3>

      <div className="space-y-3 max-h-64 overflow-auto">
        {items.map((item) => (
          <div key={item.id} className="flex gap-3 p-3 bg-secondary rounded-lg">
            <ProductImage
              src={item.part?.imageUrl}
              alt={item.part?.description || "Part"}
              className="w-12 h-12"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{item.part?.brand}</div>
              <div className="text-xs text-muted-foreground">
                {item.part?.partNumber}
              </div>
              <div className="text-xs text-muted-foreground">
                Qty: {item.quantity}
              </div>
            </div>
            <div className="text-sm font-semibold">
              ${((item.part?.price || 0) * item.quantity).toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Shipping</span>
          <span>{shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Estimated Tax</span>
          <span>${tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold border-t pt-2">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      {subtotal < 100 && (
        <p className="text-xs text-muted-foreground">
          Add ${(100 - subtotal).toFixed(2)} more for free shipping!
        </p>
      )}
    </div>
  );
}
