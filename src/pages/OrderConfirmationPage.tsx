import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, Package, Printer } from "lucide-react";

interface OrderConfirmationPageProps {
  orderId: string;
  onContinueShopping: () => void;
}

export function OrderConfirmationPage({
  orderId,
  onContinueShopping,
}: OrderConfirmationPageProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-brand-charcoal text-brand-cream py-4">
        <div className="container mx-auto px-4">
          <h1 className="text-xl font-display uppercase tracking-wider text-center">
            Order Confirmed
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 text-center">
            <div className="mb-6">
              <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto" />
            </div>

            <h2 className="text-2xl font-bold mb-2">Thank You for Your Order!</h2>
            <p className="text-muted-foreground mb-6">
              Your order has been placed successfully.
            </p>

            <div className="bg-secondary/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground">Order Number</p>
              <p className="text-lg font-mono font-bold">{orderId}</p>
            </div>

            <div className="space-y-4 text-left mb-8">
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-brand-navy mt-0.5" />
                <div>
                  <p className="font-medium">What's Next?</p>
                  <p className="text-sm text-muted-foreground">
                    You'll receive an email confirmation shortly with your order details
                    and tracking information once your order ships.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={onContinueShopping}
                className="bg-brand-navy hover:bg-brand-navy/90"
              >
                Continue Shopping
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print Receipt
              </Button>
            </div>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Questions about your order?{" "}
            <button className="text-brand-navy hover:underline">Contact Support</button>
          </p>
        </div>
      </div>
    </div>
  );
}
