import { useState } from "react";
import { ShoppingCart, Menu, User, LogOut, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { VehicleSearchBar } from "@/components/VehicleSearchBar";
import { AuthModal } from "@/components/auth/AuthModal";
import { WishlistPanel } from "@/components/wishlist/WishlistPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlist } from "@/contexts/WishlistContext";
import type { VehicleSearchResult, VehicleContext, Part } from "@/lib/api";

interface HeaderProps {
  cartItemCount: number;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onVehicleSearch?: (result: VehicleSearchResult) => void;
  onPartSearch?: (result: VehicleSearchResult) => void;
  onCategorySearch?: (result: VehicleSearchResult) => void;
  vehicleContext?: VehicleContext | null;
  onAddToCart?: (part: Part) => void;
}

export function Header({
  cartItemCount,
  onVehicleSearch,
  onPartSearch,
  onCategorySearch,
  onSearchChange,
  vehicleContext,
  onAddToCart,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mobileWishlistOpen, setMobileWishlistOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const { items: wishlistItems, itemCount: wishlistItemCount, removeFromWishlist } = useWishlist();

  return (
    <header className="bg-brand-navy text-white shadow-lg animate-rise">
      <div className="border-b border-black/20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Mobile menu button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" className="text-white hover:bg-black/20">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-brand-navy text-white border-r-0">
              <SheetHeader>
                <SheetTitle className="text-white">Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 mt-6">
                <button className="text-left py-2 px-3 hover:bg-black/20 rounded transition-colors">
                  Part Catalog
                </button>
                <button className="text-left py-2 px-3 hover:bg-black/20 rounded transition-colors">
                  Part Number Search
                </button>
                <button className="text-left py-2 px-3 hover:bg-black/20 rounded transition-colors">
                  Tools
                </button>
                <button className="text-left py-2 px-3 hover:bg-black/20 rounded transition-colors">
                  VIN Lookup
                </button>
                <hr className="border-black/20" />
                <button className="text-left py-2 px-3 hover:bg-black/20 rounded transition-colors">
                  Help
                </button>
                <button className="text-left py-2 px-3 hover:bg-black/20 rounded transition-colors">
                  Order Status
                </button>
                <button className="text-left py-2 px-3 hover:bg-black/20 rounded transition-colors">
                  Promotions
                </button>
                <button
                  className="text-left py-2 px-3 hover:bg-black/20 rounded transition-colors flex items-center gap-2"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setMobileWishlistOpen(true);
                  }}
                >
                  <Heart className="h-4 w-4" />
                  Wishlist
                  {wishlistItemCount > 0 && (
                    <Badge className="ml-auto bg-white text-brand-navy text-xs font-bold">
                      {wishlistItemCount}
                    </Badge>
                  )}
                </button>
                {isAuthenticated ? (
                  <>
                    <div className="py-2 px-3 text-sm">
                      <div className="font-medium">{user?.firstName} {user?.lastName}</div>
                      <div className="text-white/70 text-xs">{user?.email}</div>
                    </div>
                    <button
                      className="text-left py-2 px-3 hover:bg-black/20 rounded transition-colors flex items-center gap-2"
                      onClick={() => {
                        logout();
                        setMobileMenuOpen(false);
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <button
                    className="text-left py-2 px-3 hover:bg-black/20 rounded transition-colors"
                    onClick={() => {
                      setAuthModalOpen(true);
                      setMobileMenuOpen(false);
                    }}
                  >
                    Account
                  </button>
                )}
              </nav>
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white text-brand-navy flex items-center justify-center font-display text-sm tracking-[0.2em] font-bold">
              CAP
            </div>
            <div className="hidden sm:block">
              <h1 className="text-2xl font-display uppercase tracking-[0.08em]">
                Capital Auto Parts
              </h1>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-5 text-[11px] uppercase tracking-[0.2em] text-white/80">
            <button className="hover:text-white hover:underline">Help</button>
            <button className="hover:text-white hover:underline">Order Status</button>
            <button className="hover:text-white hover:underline">Promotions</button>
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 hover:text-white hover:underline">
                  <User className="h-4 w-4" />
                  <span>{user?.firstName}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled>
                    {user?.email}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button className="hover:text-white hover:underline" onClick={() => setAuthModalOpen(true)}>
                Account
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right text-[10px] uppercase tracking-[0.15em] text-white/80">
              <span>Open Mon-Sat</span>
              <span className="font-semibold text-white">8am - 8pm</span>
            </div>
            {/* Wishlist icon */}
            <div className="hidden lg:block">
              <WishlistPanel onAddToCart={onAddToCart} />
            </div>
            {/* Cart icon - hidden on mobile since we have floating button */}
            <div className="hidden lg:flex flex-shrink-0 relative">
              <ShoppingCart className="h-6 w-6" />
              {cartItemCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs bg-white text-brand-navy font-bold">
                  {cartItemCount}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#a00a0a] text-white border-b border-black/20">
        <div className="container mx-auto px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Desktop nav buttons - hidden on mobile */}
          <div className="hidden lg:flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-semibold">
            <button className="px-3 py-1 border border-white/40 rounded hover:bg-black/20 transition-colors">Part Catalog</button>
            <button className="px-3 py-1 border border-white/40 rounded hover:bg-black/20 transition-colors">Part Number Search</button>
            <button className="px-3 py-1 border border-white/40 rounded hover:bg-black/20 transition-colors">Tools</button>
          </div>

          {/* Search bar - full width on mobile */}
          <div className="flex-1 max-w-xl w-full lg:mx-auto">
            <VehicleSearchBar
              onVehicleSelect={onVehicleSearch || (() => {})}
              onPartSelect={onPartSearch}
              onCategorySelect={onCategorySearch}
              onTextSearch={onSearchChange}
              vehicleContext={vehicleContext}
              className="w-full"
            />
          </div>

          {/* Desktop utility buttons - hidden on mobile */}
          <div className="hidden lg:flex items-center gap-2">
            <Button type="button" variant="outline" className="border-white/40 text-white hover:bg-black/20 bg-transparent">
              VIN Lookup
            </Button>
            <Button type="button" variant="outline" className="border-white/40 text-white hover:bg-black/20 bg-transparent">
              Need Help?
            </Button>
          </div>
        </div>
      </div>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />

      {/* Mobile Wishlist Sheet */}
      <Sheet open={mobileWishlistOpen} onOpenChange={setMobileWishlistOpen}>
        <SheetContent side="right" className="w-full sm:w-96">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              My Wishlist ({wishlistItemCount})
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4 overflow-y-auto max-h-[calc(100vh-120px)]">
            {wishlistItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Heart className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Your wishlist is empty</p>
                <p className="text-sm mt-1">Save parts you're interested in for later</p>
              </div>
            ) : (
              wishlistItems.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 p-3 border rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="w-16 h-16 bg-muted rounded flex items-center justify-center text-muted-foreground flex-shrink-0">
                    {item.part?.imageUrl ? (
                      <img
                        src={item.part.imageUrl}
                        alt={item.part.partNumber}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <ShoppingCart className="h-6 w-6" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {item.part?.brand} {item.part?.partNumber}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {item.part?.description}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold text-sm">
                        ${item.part?.price?.toFixed(2)}
                      </span>
                      <div className="flex gap-1">
                        {item.part && onAddToCart && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              onAddToCart(item.part!);
                              removeFromWishlist(item.partId);
                            }}
                          >
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                          onClick={() => removeFromWishlist(item.partId)}
                        >
                          <Heart className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
