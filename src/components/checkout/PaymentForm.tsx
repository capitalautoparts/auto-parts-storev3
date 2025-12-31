import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Lock } from "lucide-react";

export interface PaymentInfo {
  cardNumber: string;
  expiry: string;
  cvv: string;
  nameOnCard: string;
}

interface PaymentFormProps {
  payment: PaymentInfo;
  onChange: (payment: PaymentInfo) => void;
}

export function PaymentForm({ payment, onChange }: PaymentFormProps) {
  const handleChange = (field: keyof PaymentInfo, value: string) => {
    onChange({ ...payment, [field]: value });
  };

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const groups = digits.match(/.{1,4}/g) || [];
    return groups.join(" ").slice(0, 19);
  };

  // Format expiry as MM/YY
  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length >= 2) {
      return digits.slice(0, 2) + "/" + digits.slice(2, 4);
    }
    return digits;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">Payment Information</h3>
        <Lock className="h-4 w-4 text-emerald-600" />
      </div>

      <div className="p-4 bg-secondary/50 rounded-lg border border-border">
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <CreditCard className="h-4 w-4" />
          <span>Secure payment powered by Nuvei</span>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="nameOnCard">Name on Card</Label>
            <Input
              id="nameOnCard"
              value={payment.nameOnCard}
              onChange={(e) => handleChange("nameOnCard", e.target.value)}
              placeholder="John Doe"
            />
          </div>

          <div>
            <Label htmlFor="cardNumber">Card Number</Label>
            <Input
              id="cardNumber"
              value={payment.cardNumber}
              onChange={(e) =>
                handleChange("cardNumber", formatCardNumber(e.target.value))
              }
              placeholder="1234 5678 9012 3456"
              maxLength={19}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expiry">Expiry Date</Label>
              <Input
                id="expiry"
                value={payment.expiry}
                onChange={(e) =>
                  handleChange("expiry", formatExpiry(e.target.value))
                }
                placeholder="MM/YY"
                maxLength={5}
              />
            </div>
            <div>
              <Label htmlFor="cvv">CVV</Label>
              <Input
                id="cvv"
                type="password"
                value={payment.cvv}
                onChange={(e) =>
                  handleChange("cvv", e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="123"
                maxLength={4}
              />
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Your payment information is encrypted and secure. We never store your full card details.
      </p>
    </div>
  );
}
