import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { PartsTable } from "@/components/PartsTable";
import { RightCartPanel } from "@/components/RightCartPanel";
import { TreeSidebar, type PartSelection } from "@/components/TreeSidebar";
import { toast, Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { partsApi, cartApi, categoryApi } from "@/lib/api";
import { useQuery, useMutation } from "@/lib/hooks";

export default function App() {
  const [selectedEngineId, setSelectedEngineId] = useState<number>();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>();
  const [selectedFitment, setSelectedFitment] = useState<PartSelection | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

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

  const handleUpdateQuantity = (itemId: number, quantity: number) => {
    updateQuantityMutation.mutate({ itemId, quantity });
  };

  const handleRemoveItem = (itemId: number) => {
    removeItemMutation.mutate(itemId);
  };

  const handleCheckout = () => {
    toast.info("Checkout functionality coming soon!");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Toaster />
      <Header
        cartItemCount={cartData?.items?.length || 0}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
        <div className="flex-1 lg:overflow-auto">
          <div className="container mx-auto py-4">
            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <TreeSidebar onPartTypeSelect={handlePartTypeSelect} />

              <div>
                {breadcrumb && (
                  <div className="mb-4 rounded border border-border bg-card px-4 py-3 shadow-sm animate-rise">
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
                  <div className="bg-card rounded-lg shadow p-12 text-center">
                    <p className="text-muted-foreground">
                      {!selectedEngineId || !selectedCategoryId
                        ? "Select a vehicle, engine, and part type to view parts."
                        : searchQuery
                          ? "No parts match that search. Try a different keyword."
                          : "No parts found for this category and vehicle combination."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <RightCartPanel
          items={cartData?.items || []}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onCheckout={handleCheckout}
        />
      </div>
    </div>
  );
}
