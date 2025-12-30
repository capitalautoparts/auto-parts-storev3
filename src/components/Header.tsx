import { Search, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  cartItemCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function Header({
  cartItemCount,
  searchQuery,
  onSearchChange,
}: HeaderProps) {
  return (
    <header className="bg-brand-navy text-brand-cream shadow-lg animate-rise">
      <div className="border-b border-white/10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-brand-gold text-brand-ink flex items-center justify-center font-display text-sm tracking-[0.2em]">
              CAP
            </div>
            <div>
              <h1 className="text-2xl font-display uppercase tracking-[0.08em]">
                Capital Auto Parts
              </h1>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/85">
                All the parts your car will ever need
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-5 text-[11px] uppercase tracking-[0.2em] text-white/90">
            <button className="hover:text-white">Help</button>
            <button className="hover:text-white">Order Status</button>
            <button className="hover:text-white">Promotions</button>
            <button className="hover:text-white">Account</button>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col text-right text-[10px] uppercase tracking-[0.2em] text-white/85">
              <span>Open Mon-Sat</span>
              <span>8am - 8pm</span>
            </div>
            <div className="flex-shrink-0 relative">
              <ShoppingCart className="h-6 w-6" />
              {cartItemCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs bg-brand-gold text-brand-ink">
                  {cartItemCount}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white text-brand-ink border-b border-border">
        <div className="container mx-auto px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-semibold">
            <button className="px-3 py-1 border border-border rounded">Part Catalog</button>
            <button className="px-3 py-1 border border-border rounded">Part Number Search</button>
            <button className="px-3 py-1 border border-border rounded">Tools</button>
          </div>

          <div className="flex-1 max-w-xl w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                placeholder="Search by part number, keyword, or brand..."
                className="pl-10 bg-white text-brand-ink border border-border shadow-sm"
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="border-border text-brand-ink">
              VIN Lookup
            </Button>
            <Button type="button" variant="outline" className="border-border text-brand-ink">
              Need Help?
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
