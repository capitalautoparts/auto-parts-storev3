import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Minus, Plus, X, Truck, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { CartItem } from "@/lib/api";

interface ShippingOption {
  id: string;
  carrier: string;
  name: string;
  price: number;
  estimatedDays: string;
}

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
  const [shippingCalculated, setShippingCalculated] = useState(false);
  const [calculatingShipping, setCalculatingShipping] = useState(false);
  const [selectedShipping, setSelectedShipping] = useState<string>("");
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [processingOrder, setProcessingOrder] = useState(false);

  // Form state
  const [shippingAddress, setShippingAddress] = useState({
    email: "",
    fullName: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Canada",
    phone: "",
  });

  const [billingAddress, setBillingAddress] = useState({
    fullName: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Canada",
  });

  const [payment, setPayment] = useState({
    cardNumber: "",
    expMonth: "",
    expYear: "",
    cvv: "",
  });

  // Mock shipping options
  const shippingOptions: ShippingOption[] = [
    { id: "standard", carrier: "UPS", name: "Ground", price: 17.80, estimatedDays: "5-7 business days" },
    { id: "express", carrier: "UPS", name: "Express", price: 23.28, estimatedDays: "2-3 business days" },
    { id: "overnight", carrier: "UPS", name: "Next Day", price: 34.50, estimatedDays: "1 business day" },
  ];

  const subtotal = items.reduce((sum, item) => sum + (item.part?.price || 0) * item.quantity, 0);
  const selectedShippingOption = shippingOptions.find(o => o.id === selectedShipping);
  const shippingCost = selectedShippingOption?.price || 0;
  const taxRate = 0.13; // 13% HST
  const tax = (subtotal + shippingCost) * taxRate;
  const total = subtotal + shippingCost + tax;

  const handleCalculateShipping = () => {
    if (!shippingAddress.postalCode || !shippingAddress.country) {
      toast.error("Please enter postal code and country");
      return;
    }
    setCalculatingShipping(true);
    // Simulate API call
    setTimeout(() => {
      setShippingCalculated(true);
      setSelectedShipping("standard");
      setCalculatingShipping(false);
    }, 1000);
  };

  const handlePlaceOrder = () => {
    // Validate form
    if (!shippingAddress.email || !shippingAddress.fullName || !shippingAddress.address) {
      toast.error("Please fill in shipping address");
      return;
    }
    if (!selectedShipping) {
      toast.error("Please select a shipping option");
      return;
    }
    if (!payment.cardNumber || !payment.expMonth || !payment.expYear || !payment.cvv) {
      toast.error("Please fill in payment information");
      return;
    }

    setProcessingOrder(true);
    // Simulate order processing
    setTimeout(() => {
      setProcessingOrder(false);
      onCheckout(); // This will show confirmation
    }, 2000);
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : value;
  };

  return (
    <div className="w-full lg:w-80 bg-card border-l border-border flex flex-col h-full">
      <div className="p-3 bg-brand-navy text-white text-xs uppercase tracking-[0.3em] font-display border-b border-black/20">
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

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Cart Items */}
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

          {items.length > 0 && (
            <>
              {/* Shipping Address */}
              <div className="border border-border rounded-md overflow-hidden">
                <div className="px-3 py-2 bg-[#a00a0a] text-white text-[11px] uppercase tracking-[0.2em] font-semibold">
                  Shipping Address
                </div>
                <div className="p-3 space-y-3 bg-white">
                  <div>
                    <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Email</Label>
                    <Input
                      placeholder="you@email.com"
                      value={shippingAddress.email}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Full Name</Label>
                    <Input
                      placeholder="Full name"
                      value={shippingAddress.fullName}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, fullName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Address</Label>
                    <Input
                      placeholder="Street address"
                      value={shippingAddress.address}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">City</Label>
                      <Input
                        placeholder="City"
                        value={shippingAddress.city}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, city: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">State/Province</Label>
                      <Input
                        placeholder="State"
                        value={shippingAddress.state}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, state: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Postal Code</Label>
                      <Input
                        placeholder="Postal code"
                        value={shippingAddress.postalCode}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, postalCode: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Country</Label>
                      <Input
                        placeholder="Country"
                        value={shippingAddress.country}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, country: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Phone</Label>
                    <Input
                      placeholder="Phone number"
                      value={shippingAddress.phone}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleCalculateShipping}
                    disabled={calculatingShipping}
                  >
                    {calculatingShipping ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Calculating...
                      </>
                    ) : (
                      "Calculate Shipping"
                    )}
                  </Button>
                </div>
              </div>

              {/* Billing Address */}
              <div className="border border-border rounded-md overflow-hidden">
                <div className="px-3 py-2 bg-[#a00a0a] text-white text-[11px] uppercase tracking-[0.2em] font-semibold">
                  Billing Address
                </div>
                <div className="p-3 space-y-3 bg-white">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sameAsBilling"
                      checked={sameAsBilling}
                      onCheckedChange={(checked) => setSameAsBilling(checked as boolean)}
                    />
                    <Label htmlFor="sameAsBilling" className="text-sm">Same as Shipping Address</Label>
                  </div>

                  {!sameAsBilling && (
                    <div className="space-y-3 pt-2">
                      <div>
                        <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Full Name</Label>
                        <Input
                          placeholder="Full name"
                          value={billingAddress.fullName}
                          onChange={(e) => setBillingAddress(prev => ({ ...prev, fullName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Address</Label>
                        <Input
                          placeholder="Street address"
                          value={billingAddress.address}
                          onChange={(e) => setBillingAddress(prev => ({ ...prev, address: e.target.value }))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">City</Label>
                          <Input
                            placeholder="City"
                            value={billingAddress.city}
                            onChange={(e) => setBillingAddress(prev => ({ ...prev, city: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">State/Province</Label>
                          <Input
                            placeholder="State"
                            value={billingAddress.state}
                            onChange={(e) => setBillingAddress(prev => ({ ...prev, state: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Postal Code</Label>
                          <Input
                            placeholder="Postal code"
                            value={billingAddress.postalCode}
                            onChange={(e) => setBillingAddress(prev => ({ ...prev, postalCode: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Country</Label>
                          <Input
                            placeholder="Country"
                            value={billingAddress.country}
                            onChange={(e) => setBillingAddress(prev => ({ ...prev, country: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Shipping Options */}
              {shippingCalculated && (
                <div className="border border-border rounded-md overflow-hidden">
                  <div className="px-3 py-2 bg-[#a00a0a] text-white text-[11px] uppercase tracking-[0.2em] font-semibold flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Shipping Options
                  </div>
                  <div className="bg-white divide-y divide-border">
                    {shippingOptions.map((option) => (
                      <label
                        key={option.id}
                        className={`flex items-center justify-between p-3 cursor-pointer hover:bg-secondary/50 ${
                          selectedShipping === option.id ? "bg-green-50" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="shipping"
                            value={option.id}
                            checked={selectedShipping === option.id}
                            onChange={() => setSelectedShipping(option.id)}
                            className="text-brand-navy"
                          />
                          <div>
                            <div className="text-sm font-medium">
                              {option.carrier} {option.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {option.estimatedDays}
                            </div>
                          </div>
                        </div>
                        <div className="font-semibold text-sm">
                          CAD${option.price.toFixed(2)}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment */}
              <div className="border border-border rounded-md overflow-hidden">
                <div className="px-3 py-2 bg-[#a00a0a] text-white text-[11px] uppercase tracking-[0.2em] font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment
                </div>
                <div className="p-3 space-y-3 bg-white">
                  <div>
                    <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Card Number</Label>
                    <Input
                      placeholder="1234 5678 9012 3456"
                      value={payment.cardNumber}
                      onChange={(e) => setPayment(prev => ({ ...prev, cardNumber: formatCardNumber(e.target.value) }))}
                      maxLength={19}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Exp Month</Label>
                      <Input
                        placeholder="MM"
                        value={payment.expMonth}
                        onChange={(e) => setPayment(prev => ({ ...prev, expMonth: e.target.value.slice(0, 2) }))}
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Exp Year</Label>
                      <Input
                        placeholder="YY"
                        value={payment.expYear}
                        onChange={(e) => setPayment(prev => ({ ...prev, expYear: e.target.value.slice(0, 2) }))}
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">CVV</Label>
                      <Input
                        placeholder="123"
                        type="password"
                        value={payment.cvv}
                        onChange={(e) => setPayment(prev => ({ ...prev, cvv: e.target.value.slice(0, 4) }))}
                        maxLength={4}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Your payment information is secure and encrypted.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Order Summary Footer */}
      <div className="p-4 border-t border-border bg-secondary space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">${subtotal.toFixed(2)}</span>
        </div>
        {shippingCalculated && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Shipping</span>
              <span className="font-medium">${shippingCost.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tax (HST 13%)</span>
              <span className="font-medium">${tax.toFixed(2)}</span>
            </div>
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-brand-ink">Total</span>
                <span className="text-xl font-bold text-brand-ink">CAD${total.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}
        {!shippingCalculated && (
          <div className="flex items-center justify-between">
            <span className="font-semibold text-brand-ink">Subtotal</span>
            <span className="text-xl font-bold text-brand-ink">${subtotal.toFixed(2)}</span>
          </div>
        )}

        <Button
          onClick={handlePlaceOrder}
          disabled={items.length === 0 || !shippingCalculated || processingOrder}
          className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
          size="lg"
        >
          {processingOrder ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            "Place Order"
          )}
        </Button>

        {!shippingCalculated && items.length > 0 && (
          <p className="text-xs text-center text-muted-foreground">
            Calculate shipping to see total and place order
          </p>
        )}
      </div>
    </div>
  );
}
