import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AddressForm, type Address } from "@/components/checkout/AddressForm";
import { PaymentForm, type PaymentInfo } from "@/components/checkout/PaymentForm";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import type { CartItem } from "@/lib/api";

interface CheckoutPageProps {
  items: CartItem[];
  onBack: () => void;
  onComplete: (orderId: string) => void;
}

const emptyAddress: Address = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  street1: "",
  street2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "United States",
};

const emptyPayment: PaymentInfo = {
  cardNumber: "",
  expiry: "",
  cvv: "",
  nameOnCard: "",
};

type Step = "shipping" | "billing" | "payment" | "review";

export function CheckoutPage({ items, onBack, onComplete }: CheckoutPageProps) {
  const [step, setStep] = useState<Step>("shipping");
  const [shippingAddress, setShippingAddress] = useState<Address>(emptyAddress);
  const [billingAddress, setBillingAddress] = useState<Address>(emptyAddress);
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [payment, setPayment] = useState<PaymentInfo>(emptyPayment);
  const [isProcessing, setIsProcessing] = useState(false);

  const steps: Step[] = ["shipping", "billing", "payment", "review"];
  const currentStepIndex = steps.indexOf(step);

  const isStepComplete = (s: Step): boolean => {
    const stepIndex = steps.indexOf(s);
    return stepIndex < currentStepIndex;
  };

  const validateAddress = (address: Address): boolean => {
    return !!(
      address.firstName &&
      address.lastName &&
      address.email &&
      address.street1 &&
      address.city &&
      address.state &&
      address.postalCode &&
      address.country
    );
  };

  const validatePayment = (): boolean => {
    return !!(
      payment.nameOnCard &&
      payment.cardNumber.replace(/\s/g, "").length === 16 &&
      payment.expiry.length === 5 &&
      payment.cvv.length >= 3
    );
  };

  const canProceed = (): boolean => {
    switch (step) {
      case "shipping":
        return validateAddress(shippingAddress);
      case "billing":
        return sameAsBilling || validateAddress(billingAddress);
      case "payment":
        return validatePayment();
      case "review":
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
    }
  };

  const handlePrev = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    } else {
      onBack();
    }
  };

  const handlePlaceOrder = async () => {
    setIsProcessing(true);

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate order ID
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    setIsProcessing(false);
    onComplete(orderId);
  };

  const getEffectiveBillingAddress = () => {
    return sameAsBilling ? shippingAddress : billingAddress;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-brand-charcoal text-brand-cream py-4">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              className="text-brand-cream hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-display uppercase tracking-wider">
              Checkout
            </h1>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="border-b bg-secondary/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            {steps.map((s, index) => (
              <div key={s} className="flex items-center">
                <button
                  onClick={() => isStepComplete(s) && setStep(s)}
                  disabled={!isStepComplete(s) && s !== step}
                  className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm transition-colors ${
                    s === step
                      ? "bg-brand-navy text-white"
                      : isStepComplete(s)
                      ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isStepComplete(s) ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="w-4 text-center">{index + 1}</span>
                  )}
                  <span className="hidden sm:inline capitalize">{s}</span>
                </button>
                {index < steps.length - 1 && (
                  <div className="w-8 sm:w-12 h-px bg-border mx-2" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              {step === "shipping" && (
                <AddressForm
                  title="Shipping Address"
                  address={shippingAddress}
                  onChange={setShippingAddress}
                />
              )}

              {step === "billing" && (
                <AddressForm
                  title="Billing Address"
                  address={billingAddress}
                  onChange={setBillingAddress}
                  showSameAsBilling
                  sameAsBilling={sameAsBilling}
                  onSameAsBillingChange={setSameAsBilling}
                />
              )}

              {step === "payment" && (
                <PaymentForm payment={payment} onChange={setPayment} />
              )}

              {step === "review" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Review Your Order</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="p-4 bg-secondary/50 rounded-lg">
                      <h4 className="font-medium mb-2">Shipping Address</h4>
                      <p className="text-sm text-muted-foreground">
                        {shippingAddress.firstName} {shippingAddress.lastName}
                        <br />
                        {shippingAddress.street1}
                        {shippingAddress.street2 && (
                          <>
                            <br />
                            {shippingAddress.street2}
                          </>
                        )}
                        <br />
                        {shippingAddress.city}, {shippingAddress.state}{" "}
                        {shippingAddress.postalCode}
                        <br />
                        {shippingAddress.country}
                      </p>
                    </div>

                    <div className="p-4 bg-secondary/50 rounded-lg">
                      <h4 className="font-medium mb-2">Billing Address</h4>
                      <p className="text-sm text-muted-foreground">
                        {getEffectiveBillingAddress().firstName}{" "}
                        {getEffectiveBillingAddress().lastName}
                        <br />
                        {getEffectiveBillingAddress().street1}
                        {getEffectiveBillingAddress().street2 && (
                          <>
                            <br />
                            {getEffectiveBillingAddress().street2}
                          </>
                        )}
                        <br />
                        {getEffectiveBillingAddress().city},{" "}
                        {getEffectiveBillingAddress().state}{" "}
                        {getEffectiveBillingAddress().postalCode}
                        <br />
                        {getEffectiveBillingAddress().country}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-secondary/50 rounded-lg">
                    <h4 className="font-medium mb-2">Payment Method</h4>
                    <p className="text-sm text-muted-foreground">
                      Card ending in {payment.cardNumber.slice(-4)}
                      <br />
                      {payment.nameOnCard}
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8 pt-6 border-t">
                <Button variant="outline" onClick={handlePrev}>
                  {currentStepIndex === 0 ? "Back to Cart" : "Previous"}
                </Button>

                {step === "review" ? (
                  <Button
                    onClick={handlePlaceOrder}
                    disabled={isProcessing}
                    className="bg-brand-navy hover:bg-brand-navy/90"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Place Order"
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="bg-brand-navy hover:bg-brand-navy/90"
                  >
                    Continue
                  </Button>
                )}
              </div>
            </Card>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-4">
              <OrderSummary items={items} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
