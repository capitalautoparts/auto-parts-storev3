import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { TreeSidebar } from "@/components/TreeSidebar";
import { PartsTable } from "@/components/PartsTable";
import { RightCartPanel } from "@/components/RightCartPanel";
import { toast, Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { partsApi, cartApi, categoryApi } from "@/lib/api";
import { useQuery, useMutation } from "@/lib/hooks";

export default function App() {
  const [selectedEngineId, setSelectedEngineId] = useState<number>();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>();
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  const { data: categoriesData } = useQuery(() => categoryApi.getAll());

  const { data: partsData, isLoading: partsLoading, refetch: refetchParts } = useQuery(
    () => partsApi.getByCategory(selectedCategoryId!, selectedEngineId),
    { enabled: !!selectedCategoryId && !!selectedEngineId }
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
    if (!selectedCategoryId || !categoriesData) return "";
    
    const category = categoriesData.find(c => c.id === selectedCategoryId);
    if (!category) return "";
    
    const parts = [];
    const parent = category.parentId ? categoriesData.find(c => c.id === category.parentId) : null;
    if (parent) parts.push(parent.name);
    parts.push(category.name);
    
    return parts.join(" > ");
  }, [selectedCategoryId, categoriesData]);

  const handlePartTypeSelect = (categoryId: number, engineId: number) => {
    setSelectedCategoryId(categoryId);
    setSelectedEngineId(engineId);
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
        onSearchChange={(query) => console.log("Search:", query)}
      />

      <div className="flex-1 flex overflow-hidden">
        <TreeSidebar onPartTypeSelect={handlePartTypeSelect} />

        <div className="flex-1 overflow-auto">
          <div className="container mx-auto py-4">
            {breadcrumb && (
              <div className="mb-4 text-sm text-muted-foreground">
                {breadcrumb}
              </div>
            )}

            {partsLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : partsData && partsData.length > 0 ? (
              <PartsTable parts={partsData} onAddToCart={handleAddToCart} />
            ) : (
              <div className="bg-card rounded-lg shadow p-12 text-center">
                <p className="text-muted-foreground">
                  {!selectedEngineId || !selectedCategoryId
                    ? "Select a vehicle and part type from the tree to view parts."
                    : "No parts found for this category and vehicle combination."}
                </p>
              </div>
            )}
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
