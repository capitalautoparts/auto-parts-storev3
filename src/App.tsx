import { useState, useMemo, useRef } from "react";
import { Header } from "@/components/Header";
import { PartsTable } from "@/components/PartsTable";
import { RightCartPanel } from "@/components/RightCartPanel";
import { TreeSidebar, type PartSelection, type TreeSidebarHandle, type VehicleExpansion } from "@/components/TreeSidebar";
import { OrderConfirmationPage } from "@/pages/OrderConfirmationPage";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast, Toaster } from "sonner";
import { Loader2, ShoppingCart } from "lucide-react";
import { partsApi, cartApi, categoryApi, type VehicleSearchResult, type VehicleContext, type Part } from "@/lib/api";
import { useQuery, useMutation } from "@/lib/hooks";

type AppView = "catalog" | "confirmation";

export default function App() {
  const [selectedEngineId, setSelectedEngineId] = useState<number>();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>();
  const [selectedFitment, setSelectedFitment] = useState<PartSelection | null>(null);
  const [expandedVehicle, setExpandedVehicle] = useState<VehicleExpansion | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>("catalog");
  const [completedOrderId, setCompletedOrderId] = useState<string>("");
  const treeSidebarRef = useRef<TreeSidebarHandle>(null);

  const handleVehicleSearch = (result: VehicleSearchResult) => {
    // Expand tree to the selected vehicle
    treeSidebarRef.current?.expandToVehicle(result);
    // Clear the parts filter when navigating via search
    setSearchQuery("");

    // If a full vehicle with engine is selected, set the vehicle context for category search
    if (result.year && result.makeId && result.makeName && result.modelId && result.modelName && result.engineId && result.engineName) {
      setExpandedVehicle({
        year: result.year,
        makeId: result.makeId,
        makeName: result.makeName,
        modelId: result.modelId,
        modelName: result.modelName,
        engineId: result.engineId,
        engineName: result.engineName,
      });
    }

    toast.success(`Expanded to ${result.label}`);
  };

  const handlePartSearch = (result: VehicleSearchResult) => {
    // For part search, we could filter or highlight
    if (result.partNumber) {
      setSearchQuery(result.partNumber);
      toast.info(`Filtering by part number: ${result.partNumber}`);
    }
  };

  const handleCategorySearch = (result: VehicleSearchResult) => {
    // When searching for categories within vehicle context
    if (result.categoryId) {
      // Use the tree's expandToCategory to expand the tree and select the category
      treeSidebarRef.current?.expandToCategory(result);
      toast.success(`Showing ${result.categoryName || 'parts'}`);
    }
  };

  // Build vehicle context from selected fitment or expanded vehicle for context-aware search
  const vehicleContext: VehicleContext | null = selectedFitment ? {
    year: selectedFitment.year,
    makeId: selectedFitment.make.id,
    makeName: selectedFitment.make.name,
    modelId: selectedFitment.model.id,
    modelName: selectedFitment.model.name,
    engineId: selectedFitment.engine.id,
    engineName: selectedFitment.engine.name,
  } : expandedVehicle ? {
    year: expandedVehicle.year,
    makeId: expandedVehicle.makeId,
    makeName: expandedVehicle.makeName,
    modelId: expandedVehicle.modelId,
    modelName: expandedVehicle.modelName,
    engineId: expandedVehicle.engineId,
    engineName: expandedVehicle.engineName,
  } : null;

  const handleVehicleExpand = (vehicle: VehicleExpansion) => {
    setExpandedVehicle(vehicle);
  };

  const { data: categoriesData } = useQuery(() => categoryApi.getAll());

  const { data: partsData, isLoading: partsLoading } = useQuery(
    () => partsApi.getByCategory(selectedCategoryId!, selectedEngineId),
    { enabled: !!selectedCategoryId && !!selectedEngineId, deps: [selectedCategoryId, selectedEngineId] }
  );

  const { data: cartData, refetch: refetchCart } = useQuery(() => cartApi.get(sessionId));

  const addToCartMutation = useMutation(
    ({ partId, quantity }: { partId: number; quantity: number }) =>
      cartApi.addItem(sessionId, partId, quantity),
    {
      onSuccess: () => {
        refetchCart();
        toast.success("Added to cart!");
      },
      onError: (error) => {
        toast.error(`Failed to add to cart: ${error.message}`);
      },
    }
  );

  const updateQuantityMutation = useMutation(
    ({ itemId, quantity }: { itemId: number; quantity: number }) =>
      cartApi.updateQuantity(itemId, quantity),
    {
      onSuccess: () => {
        refetchCart();
      },
    }
  );

  const removeItemMutation = useMutation(
    (itemId: number) => cartApi.removeItem(itemId),
    {
      onSuccess: () => {
        refetchCart();
        toast.success("Removed from cart");
      },
    }
  );

  const breadcrumb = useMemo(() => {
    if (!selectedFitment || !categoriesData) return "";

    const category = categoriesData.find((c) => c.id === selectedFitment.category.id);
    const parent = category?.parentId ? categoriesData.find((c) => c.id === category.parentId) : null;
    const categoryLabel = parent ? `${parent.name} > ${category?.name ?? selectedFitment.category.name}` : selectedFitment.category.name;
    const vehicleLabel = `${selectedFitment.year} ${selectedFitment.make.name} ${selectedFitment.model.name}`;

    return `${vehicleLabel} > ${selectedFitment.engine.name} > ${categoryLabel}`;
  }, [selectedFitment, categoriesData]);

  const filteredParts = useMemo(() => {
    if (!partsData) return [];
    if (!searchQuery.trim()) return partsData;

    const query = searchQuery.toLowerCase();
    return partsData.filter((part) => {
      const searchable = [
        part.brand,
        part.partNumber,
        part.description,
        part.position,
        part.warranty,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [partsData, searchQuery]);

  const handlePartTypeSelect = (selection: PartSelection) => {
    setSelectedCategoryId(selection.category.id);
    setSelectedEngineId(selection.engine.id);
    setSelectedFitment(selection);
  };

  const handleAddToCart = (partId: number) => {
    addToCartMutation.mutate({ partId, quantity: 1 });
  };

  const handleAddPartToCart = (part: Part) => {
    handleAddToCart(part.id);
  };

  const handleUpdateQuantity = (itemId: number, quantity: number) => {
    updateQuantityMutation.mutate({ itemId, quantity });
  };

  const handleRemoveItem = (itemId: number) => {
    removeItemMutation.mutate(itemId);
  };

  const handleCheckout = () => {
    // Generate order ID and show confirmation
    const orderId = `CAP-${Date.now().toString(36).toUpperCase()}`;
    setCompletedOrderId(orderId);
    setMobileCartOpen(false);
    setCurrentView("confirmation");
    toast.success("Order placed successfully!");
  };

  const handleContinueShopping = () => {
    setCurrentView("catalog");
    setCompletedOrderId("");
  };

  // Render confirmation page after order
  if (currentView === "confirmation") {
    return (
      <>
        <Toaster />
        <OrderConfirmationPage
          orderId={completedOrderId}
          onContinueShopping={handleContinueShopping}
        />
      </>
    );
  }

  // Default: catalog view
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Toaster />
      <Header
        cartItemCount={cartData?.items?.length || 0}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onVehicleSearch={handleVehicleSearch}
        onPartSearch={handlePartSearch}
        onCategorySearch={handleCategorySearch}
        vehicleContext={vehicleContext}
        onAddToCart={handleAddPartToCart}
      />

      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Main Content Area - Tree with inline parts */}
        <div className="flex-1 overflow-auto p-4">
          <TreeSidebar
            ref={treeSidebarRef}
            onPartTypeSelect={handlePartTypeSelect}
            onVehicleExpand={handleVehicleExpand}
            renderPartsInline={() => (
              <div className="border-t border-border pt-4">
                {breadcrumb && (
                  <div className="mb-4 py-3 animate-rise">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Selected fitment
                    </div>
                    <div className="mt-1 font-semibold text-base text-foreground">
                      {breadcrumb}
                    </div>
                    {searchQuery && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Filtering by "{searchQuery}"
                      </div>
                    )}
                  </div>
                )}

                {partsLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredParts.length > 0 ? (
                  <PartsTable parts={filteredParts} onAddToCart={handleAddToCart} />
                ) : (
                  <div className="p-12 text-center">
                    <p className="text-muted-foreground">
                      {searchQuery
                        ? "No parts match that search. Try a different keyword."
                        : "No parts found for this category and vehicle combination."}
                    </p>
                  </div>
                )}
              </div>
            )}
          />
        </div>

        {/* Cart Sidebar - hidden on mobile */}
        <div className="hidden lg:block">
          <RightCartPanel
            items={cartData?.items || []}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onCheckout={handleCheckout}
          />
        </div>
      </div>

      {/* Mobile Cart Button - fixed at bottom right */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
          <SheetTrigger asChild>
            <Button className="rounded-full h-14 w-14 bg-brand-navy shadow-lg hover:bg-brand-navy/90 relative">
              <ShoppingCart className="h-6 w-6" />
              {(cartData?.items?.length || 0) > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-brand-gold text-brand-ink">
                  {cartData?.items?.length}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md p-0">
            <RightCartPanel
              items={cartData?.items || []}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveItem}
              onCheckout={handleCheckout}
            />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
