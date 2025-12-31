import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export interface Address {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface AddressFormProps {
  title: string;
  address: Address;
  onChange: (address: Address) => void;
  showSameAsBilling?: boolean;
  sameAsBilling?: boolean;
  onSameAsBillingChange?: (same: boolean) => void;
}

export function AddressForm({
  title,
  address,
  onChange,
  showSameAsBilling,
  sameAsBilling,
  onSameAsBillingChange,
}: AddressFormProps) {
  const handleChange = (field: keyof Address, value: string) => {
    onChange({ ...address, [field]: value });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>

      {showSameAsBilling && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="sameAsBilling"
            checked={sameAsBilling}
            onCheckedChange={(checked) => onSameAsBillingChange?.(checked === true)}
          />
          <Label htmlFor="sameAsBilling" className="text-sm">
            Same as billing address
          </Label>
        </div>
      )}

      {(!showSameAsBilling || !sameAsBilling) && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={address.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                placeholder="John"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={address.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={address.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={address.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="street1">Street Address</Label>
            <Input
              id="street1"
              value={address.street1}
              onChange={(e) => handleChange("street1", e.target.value)}
              placeholder="123 Main St"
            />
          </div>

          <div>
            <Label htmlFor="street2">Apartment, Suite, etc. (optional)</Label>
            <Input
              id="street2"
              value={address.street2}
              onChange={(e) => handleChange("street2", e.target.value)}
              placeholder="Apt 4B"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={address.city}
                onChange={(e) => handleChange("city", e.target.value)}
                placeholder="New York"
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={address.state}
                onChange={(e) => handleChange("state", e.target.value)}
                placeholder="NY"
              />
            </div>
            <div>
              <Label htmlFor="postalCode">ZIP Code</Label>
              <Input
                id="postalCode"
                value={address.postalCode}
                onChange={(e) => handleChange("postalCode", e.target.value)}
                placeholder="10001"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={address.country}
              onChange={(e) => handleChange("country", e.target.value)}
              placeholder="United States"
            />
          </div>
        </div>
      )}
    </div>
  );
}
