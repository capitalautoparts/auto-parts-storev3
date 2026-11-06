import { useEffect, useRef, useState } from 'react';
import { Header } from '@/components/Header';
import { ProductRoute } from '@/components/ProductRoute';
import { PartsTable } from '@/components/PartsTable';
import { RightCartPanel } from '@/components/RightCartPanel';
import { TreeSidebar, type PartSelection, type TreeSidebarHandle, type VehicleExpansion } from '@/components/TreeSidebar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import { toast, Toaster } from 'sonner';
import { Loader2, ShoppingCart } from 'lucide-react';
import { partsApi, cartApi, type VehicleContext, type VehicleSearchResult, type Part } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { DIMENSIONS, safeStorage, saveStorage } from '@/features/catalog/model';

const VEHICLE_KEY = 'roysauto.original-vehicle.v1';
function savedVehicle(): VehicleExpansion | null {
  try {
    const value = JSON.parse(safeStorage(VEHICLE_KEY) ?? 'null');
    return value && ['year', 'makeId', 'modelId', 'engineId'].every(key => Number.isInteger(value[key]) && value[key] >= 0)
      && ['makeName', 'modelName', 'engineName'].every(key => typeof value[key] === 'string' && value[key].length <= 120) ? value : null;
  } catch { return null; }
}

export default function App() {
  const [selectedFitment, setSelectedFitment] = useState<PartSelection | null>(null);
  const [activeVehicle, setActiveVehicle] = useState<VehicleExpansion | null>(savedVehicle);
  const [vehicleNotice, setVehicleNotice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const tree = useRef<TreeSidebarHandle>(null);
  const resultsSection = useRef<HTMLElement>(null);
  const restored = useRef(false);
  useEffect(() => {
    if (!restored.current && activeVehicle) tree.current?.expandToVehicle({ type: 'vehicle', label: '', ...activeVehicle });
    restored.current = true;
  }, [activeVehicle]);
  const vehicleContext: VehicleContext | null = activeVehicle;
  const scopedCategory = searchQuery ? undefined : selectedFitment?.category;
  useEffect(() => {
    if (scopedCategory || searchQuery.length >= 2) resultsSection.current?.scrollIntoView({ block: 'start' });
  }, [scopedCategory?.slug, searchQuery, vehicleContext]);
  const { data, isLoading, error, refetch } = useQuery(
    () => partsApi.search({ q: searchQuery || undefined, category: scopedCategory, vehicle: vehicleContext, page, filters }),
    { enabled: !!scopedCategory || searchQuery.trim().length >= 2, deps: [scopedCategory?.slug, vehicleContext, searchQuery, page, filters] },
  );
  const { data: cart, refetch: refreshCart } = useQuery(() => cartApi.get('catalog-test'));

  function resetResults() { setFilters({}); setPage(1); }
  function forgetSavedVehicle() {
    // Use the existing storage helper; null is a valid cleared-state tombstone.
    if (saveStorage(VEHICLE_KEY, 'null')) return true;
    try { localStorage.removeItem(VEHICLE_KEY); return true; } catch { return false; }
  }
  function clearVehicle(focusPicker = true) {
    resetResults(); setActiveVehicle(null); setSelectedFitment(null); setSearchQuery('');
    setVehicleNotice(forgetSavedVehicle() ? '' : 'Vehicle cleared for this visit. The saved choice could not be cleared; it may return after reload. Retry before reloading.');
    if (focusPicker) tree.current?.focusVehiclePicker();
  }
  function rememberVehicle(vehicle: VehicleExpansion) {
    setActiveVehicle(vehicle);
    if (!vehicleNotice && JSON.stringify(vehicle) === JSON.stringify(activeVehicle)) return;
    setVehicleNotice('');
    if (!saveStorage(VEHICLE_KEY, JSON.stringify(vehicle))) {
      const forgotten = forgetSavedVehicle();
      setVehicleNotice(forgotten ? 'Your vehicle could not be saved in this browser. Select it again after reload.'
        : 'Your vehicle could not be saved in this browser. A previous vehicle may return after reload.');
    }
  }
  function selectPartType(selection: PartSelection) {
    resetResults();
    rememberVehicle({ year: selection.year, makeId: selection.make.id, makeName: selection.make.name,
      modelId: selection.model.id, modelName: selection.model.name, engineId: selection.engine.id, engineName: selection.engine.name });
    setSelectedFitment(selection); setSearchQuery('');
  }
  function selectVehicle(vehicle: VehicleExpansion) {
    resetResults(); rememberVehicle(vehicle); setSelectedFitment(null); setSearchQuery('');
  }
  function returnTo(target: 'categories' | 'engines' | 'years') {
    if (vehicleContext) tree.current?.revealSelection(target, vehicleContext, selectedFitment?.category);
  }
  function textSearch(query: string) { setSearchQuery(query.trim()); resetResults(); }
  function vehicleSearch(result: VehicleSearchResult) {
    resetResults(); setSelectedFitment(null); setSearchQuery('');
    if (result.year !== undefined && result.makeId !== undefined && result.makeName !== undefined
      && result.modelId !== undefined && result.modelName !== undefined && result.engineId !== undefined && result.engineName !== undefined) {
      rememberVehicle({ year: result.year, makeId: result.makeId, makeName: result.makeName,
        modelId: result.modelId, modelName: result.modelName, engineId: result.engineId, engineName: result.engineName });
    } else clearVehicle(false);
    tree.current?.expandToVehicle(result);
  }
  async function changeCart(action: () => Promise<unknown>, message?: string) {
    try { await action(); await refreshCart(); if (message) toast.success(message); }
    catch (error) { toast.error((error as Error).message); }
  }
  const addToCart = (partId: string | number, part?: Part) => void changeCart(() => cartApi.addItem('catalog-test', partId, 1, part), 'Added to test cart');
  const cartProps = {
    items: cart?.items ?? [], catalogPreview: true,
    onUpdateQuantity: (id: string | number, quantity: number) => void changeCart(() => cartApi.updateQuantity(id, quantity)),
    onRemoveItem: (id: string | number) => void changeCart(() => cartApi.removeItem(id)),
    onCheckout: () => toast.info('Checkout is disabled during catalog testing.'),
  };
  const changeFilter = (key: string, value: string) => { setFilters(current => ({ ...current, [key]: value })); setPage(1); };
  const renderParts = () => <section ref={resultsSection} className="border-t border-border pt-3 min-w-0" data-testid="inline-parts" aria-label="Catalog results" aria-busy={isLoading}>
    <div className="mb-3 py-2">
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{searchQuery ? 'Part search' : 'Selected fitment'}</div>
      <div className="mt-1 font-semibold text-base text-foreground">
        {vehicleContext ? `${vehicleContext.year} ${vehicleContext.makeName} ${vehicleContext.modelName} > ${vehicleContext.engineName ?? 'All engines'}` : 'All vehicles'}
        {scopedCategory ? ` > ${scopedCategory.name}` : searchQuery ? ` > ${searchQuery}` : ''}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Check engine, submodel, position and application notes before choosing a part.</p>
    </div>
    <div className="flex flex-wrap gap-3 mb-3 text-xs">
      <label className="min-w-0 max-w-full">Brand<select aria-label="Brand" className="block border rounded p-1 max-w-48 bg-white" value={filters.brand ?? ''} onChange={event => changeFilter('brand', event.target.value)}><option value="">All brands</option>{data?.facets?.brands?.map(brand => <option key={brand.brand_id} value={brand.brand_id}>{brand.name}</option>)}</select></label>
      {data?.vehicle_dimensions?.filter(dimension => DIMENSIONS.includes(dimension.dimension as typeof DIMENSIONS[number]) && dimension.dimension !== 'engine_base_id').map(dimension => <label className="min-w-0 max-w-full" key={dimension.dimension}>{dimension.label}<select aria-label={dimension.label} className="block border rounded p-1 max-w-full bg-white" value={filters[dimension.dimension] ?? ''} onChange={event => changeFilter(dimension.dimension, event.target.value)}><option value="">All — check application</option>{dimension.options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>)}
      <label className="flex items-center gap-1"><input type="checkbox" checked={filters.in_stock_only === 'true'} onChange={event => changeFilter('in_stock_only', event.target.checked ? 'true' : '')} />In stock only</label>
      <button className="underline" onClick={() => { setFilters({}); setPage(1); }}>Clear filters</button>
    </div>
    {isLoading ? <div role="status" className="flex items-center justify-center h-40 gap-2"><Loader2 className="h-6 w-6 animate-spin" />Loading ERP parts…</div>
      : error ? <div role="alert" className="p-4 text-red-700">{error.message}<button onClick={refetch} className="underline ml-2">Retry</button></div>
      : data?.parts.length ? <><p className="mb-3 text-xs text-muted-foreground" role="status">{data.pagination.total_is_exact === false ? 'At least ' : ''}{data.pagination.total} matching parts · CAD</p><PartsTable parts={data.parts} onAddToCart={addToCart} /></>
      : <p className="p-8 text-sm text-muted-foreground">No parts match this vehicle and selection. Try another category or remove a filter.</p>}
    {data && <div className="flex justify-center items-center gap-4 my-4 text-sm"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page}</span><Button variant="outline" disabled={!data.pagination.has_more || page >= 100} onClick={() => setPage(page + 1)}>Next</Button></div>}
  </section>;

  return <div className="h-dvh flex flex-col bg-background overflow-hidden">
    <Toaster />
    <ProductRoute onAddToCart={addToCart} />
    <Header cartItemCount={cart?.items.reduce((count, item) => count + item.quantity, 0) ?? 0} searchQuery={searchQuery}
      onSearchChange={textSearch} onVehicleSearch={vehicleSearch} onPartSearch={result => textSearch(result.partNumber ?? '')}
      onCategorySearch={result => tree.current?.expandToCategory(result)} vehicleContext={vehicleContext}
      onAddToCart={part => addToCart(part.id, part)} catalogPreview
      onCatalogClick={() => { setSearchQuery(''); resetResults(); }} onCartClick={() => setMobileCartOpen(true)} />
    <div className="shrink-0 px-4 py-1 border-b text-xs text-muted-foreground flex flex-wrap items-center gap-3">
      <span>Catalog test · Canada / CAD · ERP staging · Checkout disabled</span>
      {vehicleContext && <div className="w-full min-w-0 flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="selected-context">
        <span className="font-semibold text-foreground">Current vehicle</span>
        <Breadcrumb aria-label="Selected vehicle and category" className="min-w-0 flex-1 basis-full lg:basis-auto">
          <BreadcrumbList className="text-xs gap-1">
            {[{ label: String(vehicleContext.year), target: 'years' as const },
              { label: vehicleContext.makeName, target: 'years' as const },
              { label: vehicleContext.modelName, target: 'engines' as const },
              { label: vehicleContext.engineName ?? 'All engines', target: 'categories' as const },
              ...(scopedCategory ? [{ label: scopedCategory.name, target: 'categories' as const }] : []),
            ].map((item, index, items) => <Fragment key={index}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className="min-w-0 max-w-full">
                <BreadcrumbLink asChild><button className="text-left break-words" aria-current={index === items.length - 1 ? 'location' : undefined} onClick={() => returnTo(item.target)}>{item.label}</button></BreadcrumbLink>
              </BreadcrumbItem>
            </Fragment>)}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-wrap gap-2" aria-label="Return to catalog choices">
          <Button size="sm" variant="outline" onClick={() => returnTo('categories')}>Categories</Button>
          <Button size="sm" variant="outline" onClick={() => returnTo('engines')}>Change engine</Button>
          <Button size="sm" variant="outline" onClick={() => returnTo('years')}>Change vehicle</Button>
          <Button size="sm" variant="outline" onClick={() => clearVehicle()}>Clear vehicle</Button>
        </div>
        <p className="w-full">{vehicleNotice ? 'Current choice applies for this visit.' : 'This choice is kept for your next visit.'} Change vehicle keeps it active until you choose another.</p>
      </div>}
      {vehicleNotice && <p role="status" className="w-full text-foreground" data-testid="vehicle-storage-notice">
        {vehicleNotice} <button className="underline" onClick={() => activeVehicle ? rememberVehicle(activeVehicle) : clearVehicle(false)}>Retry {activeVehicle ? 'saving vehicle' : 'clearing saved vehicle'}</button>
      </p>}
      {!vehicleContext && <span className="font-semibold text-foreground" role="status">All vehicles. Select a vehicle to narrow results.</span>}
    </div>
    <div className="flex-1 flex flex-row overflow-hidden">
      <main className="flex-1 min-w-0 overflow-auto p-4 pb-24 lg:pb-4">
        {searchQuery && <div className="mb-6">{renderParts()}<button className="text-sm underline my-3" onClick={() => textSearch('')}>Return to vehicle catalog</button></div>}
        <TreeSidebar ref={tree} onPartTypeSelect={selectPartType} onVehicleSelect={selectVehicle} activeVehicle={activeVehicle} selectedFitment={selectedFitment}
          renderPartsInline={() => !searchQuery && selectedFitment ? renderParts() : null} />
      </main>
      <aside className="hidden lg:block" aria-label="Quick Cart"><RightCartPanel {...cartProps} /></aside>
    </div>
    <div className="lg:hidden fixed bottom-4 right-4 z-50">
      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetTrigger asChild><Button aria-label="Open Quick Cart" className="rounded-full h-14 w-14 bg-brand-accent shadow-lg hover:bg-brand-accent/90 relative"><ShoppingCart className="h-6 w-6" />{(cart?.items.length ?? 0) > 0 && <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-brand-gold text-brand-ink">{cart?.items.length}</Badge>}</Button></SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 overflow-auto bg-white"><SheetHeader className="sr-only"><SheetTitle>Quick Cart</SheetTitle></SheetHeader><RightCartPanel {...cartProps} /></SheetContent>
      </Sheet>
    </div>
  </div>;
}
