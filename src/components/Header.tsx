import { Search, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  cartItemCount: number;
  onSearchChange: (query: string) => void;
}

export function Header({ cartItemCount, onSearchChange }: HeaderProps) {
  return (
    <header className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold">Capital Auto Parts</h1>
            <p className="text-xs opacity-90">ALL THE PARTS YOUR CAR WILL EVER NEED</p>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by year, make, model, part..."
                className="pl-10 bg-background text-foreground"
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          </div>

          {/* Cart Icon */}
          <div className="flex-shrink-0 relative">
            <ShoppingCart className="h-6 w-6" />
            {cartItemCount > 0 && (
              <Badge
                className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive text-destructive-foreground"
              >
                {cartItemCount}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
