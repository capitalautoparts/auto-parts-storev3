import { useEffect, useRef, useState } from 'react';
import { Header } from '@/components/Header';
import { ProductRoute } from '@/components/ProductRoute';
import { PartsTable } from '@/components/PartsTable';
import { RightCartPanel } from '@/components/RightCartPanel';
import { TreeSidebar, type PartSelection, type TreeSidebarHandle, type VehicleExpansion } from '@/components/TreeSidebar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button, buttonVariants } from '@/components/ui/button';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import { toast, Toaster } from 'sonner';
import { Loader2, ShoppingCart } from 'lucide-react';
import { partsApi, cartApi, type VehicleContext, type VehicleSearchResult, type Part } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { DIMENSIONS } from '@/features/catalog/model';
import { emptyListing } from '@/features/catalog/navigation-controller';
import { listingQuery, serializeNavigation } from '@/features/catalog/navigation-state';
import { useCatalogNavigation } from '@/features/catalog/use-catalog-navigation';
import { restoreCatalogPresentation } from '@/features/catalog/navigation-presentation';

export default function App() {
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const tree = useRef<TreeSidebarHandle>(null);
  const main = useRef<HTMLElement>(null);
  const resultsSection = useRef<HTMLElement>(null);
  const { controller, snapshot, notice: vehicleNotice, restoring } = useCatalogNavigation(main, tree);
  const listing = snapshot.listing;
  const state = listing?.state ?? emptyListing();
  const activeVehicle = listing?.vehicle ?? null;
  const vehicleContext: VehicleContext | null = activeVehicle;
  const scopedCategory = listing?.category;
  const searchQuery = state.text.residual;
  const page = state.filters.page;
  const query = listingQuery(state);
  const filters: Record<string, string> = Object.fromEntries(Object.entries(query).filter(([key]) =>
    [...DIMENSIONS, 'part_type', 'brand', 'in_stock_only', 'sort', 'sort_order'].includes(key)));
  const selectedFitment: PartSelection | null = activeVehicle && activeVehicle.engineId !== undefined && scopedCategory ? {
    year: activeVehicle.year, make: { id: activeVehicle.makeId, name: activeVehicle.makeName },
    model: { id: activeVehicle.modelId, name: activeVehicle.modelName, makeId: activeVehicle.makeId },
    engine: { id: activeVehicle.engineId, name: activeVehicle.engineName ?? 'Engine unspecified', modelId: activeVehicle.modelId }, category: scopedCategory,
  } : null;
  const showResults = !!scopedCategory || searchQuery.trim().length >= 2 || !!activeVehicle;
  const inlineResults = !!selectedFitment && !searchQuery && !!scopedCategory?.navigationParentKnown;
  const { data, isLoading, error, refetch } = useQuery(
    () => partsApi.search({ q: searchQuery || undefined, category: scopedCategory, vehicle: vehicleContext, page, filters }),
    { enabled: !!listing && showResults, deps: [scopedCategory?.slug, vehicleContext, searchQuery, page, filters] },
  );
  const { data: cart, refetch: refreshCart } = useQuery(() => cartApi.get('catalog-test'));

  // Restore disclosure before waiting for asynchronously mounted tree/results.
  useEffect(() => {
    if (snapshot.status !== 'ready') return;
    restoring.current = true;
    setDraft('');
    if (snapshot.presentation?.disclosure) tree.current?.restoreDisclosure(snapshot.presentation.disclosure);
    else if (activeVehicle) {
      if (scopedCategory) tree.current?.revealSelection('selection', activeVehicle, scopedCategory, false);
      else tree.current?.expandToVehicle({ type: 'vehicle', label: '', ...activeVehicle }, false);
    }
  }, [snapshot.revision]);
  useEffect(() => {
    if (snapshot.status !== 'ready' || !main.current) return;
    const container = main.current;
    const presentation = snapshot.presentation;
    let frame = 0;
    let finished = false;
    const restore = () => {
      if (finished || isLoading) return;
      const target = showResults ? resultsSection.current : document.getElementById('vehicle-picker');
      if (!restoreCatalogPresentation(container, presentation, isLoading, target)) return;
      finished = true; restoring.current = false;
      controller.savePresentation();
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(restore); };
    const observer = new MutationObserver(schedule);
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-busy'] });
    schedule();
    return () => { finished = true; cancelAnimationFrame(frame); observer.disconnect(); };
  }, [snapshot.revision, isLoading]);

  function clearVehicle() { void controller.transition({ type: 'clear-vehicle' }); }
  function selectPartType(selection: PartSelection) {
    const vehicle = { year: selection.year, make: selection.make.name, model: selection.model.name,
      dimensions: selection.engine.id ? { engine_base_id: String(selection.engine.id) } : {} };
    // One atomic vehicle/category commit; Category.id is never a PCDB ID.
    void controller.selectCategory(vehicle,
      { kind: 'category-slug', slug: selection.category.slug!, ...(selection.categoryParentSlug ? { parentSlug: selection.categoryParentSlug } : {}) });
  }
  function selectVehicle(vehicle: VehicleExpansion) {
    void controller.transition({ type: 'replace-vehicle', vehicle: { year: vehicle.year, make: vehicle.makeName, model: vehicle.modelName,
      dimensions: vehicle.engineId ? { engine_base_id: String(vehicle.engineId) } : {} } });
  }
  function returnTo(target: 'categories' | 'engines' | 'years' | 'makes' | 'models' | 'selection') {
    if (target === 'selection' && scopedCategory && !scopedCategory.navigationParentKnown) {
      resultsSection.current?.focus(); resultsSection.current?.scrollIntoView({ block: 'start' }); return;
    }
    if (vehicleContext) tree.current?.revealSelection(target, vehicleContext, selectedFitment?.category);
  }
  function showCatalog() { void controller.transition({ type: 'catalog-root' }); }
  function textSearch(text: string) { void controller.transition({ type: 'change-query', key: 'q', value: text.trim() }); }
  function vehicleSearch(result: VehicleSearchResult) {
    if (result.year !== undefined && result.makeId !== undefined && result.makeName !== undefined
      && result.modelId !== undefined && result.modelName !== undefined && result.engineId !== undefined) {
      selectVehicle({ year: result.year, makeId: result.makeId, makeName: result.makeName,
        modelId: result.modelId, modelName: result.modelName, engineId: result.engineId, engineName: result.engineName });
    } else {
      setDraft(`Choosing ${result.label}. Choose an engine to apply this vehicle; the current results remain active.`);
      tree.current?.expandToVehicle(result);
    }
  }
  function clearFilters() {
    void controller.clearFilters();
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
  const changeFilter = (key: Exclude<keyof typeof query, 'year' | 'make' | 'model' | 'engine_base_id'>, value: string) => { void controller.transition({ type: 'change-query', key, value }); };
  const pageHref = (number: number) => serializeNavigation({ ...state, filters: { ...state.filters, page: number } });
  const renderParts = () => <section ref={resultsSection} id="catalog-results" tabIndex={-1} className="border-t border-border pt-3 min-w-0" data-testid="inline-parts" aria-label="Catalog results" aria-busy={isLoading}>
    <div className="mb-2">
      <h2 className="font-semibold text-sm text-foreground">{searchQuery ? `Search: ${searchQuery}` : scopedCategory?.name ?? 'Vehicle parts'}</h2>
      <p className="text-xs text-muted-foreground">Check engine, submodel, position and application notes before choosing a part.</p>
    </div>
    <div className="flex flex-wrap gap-3 mb-3 text-xs">
      <label className="min-w-0 max-w-full">Brand<select id="catalog-brand" aria-label="Brand" className="block border rounded p-1 max-w-48 bg-white" value={filters.brand ?? ''} onChange={event => changeFilter('brand', event.target.value)}><option value="">All brands</option>{data?.facets?.brands?.map(brand => <option key={brand.brand_id} value={brand.brand_id}>{brand.name}</option>)}</select></label>
      {data?.vehicle_dimensions?.filter(dimension => DIMENSIONS.includes(dimension.dimension as typeof DIMENSIONS[number]) && dimension.dimension !== 'engine_base_id').map(dimension => <label className="min-w-0 max-w-full" key={dimension.dimension}>{dimension.label}<select id={`catalog-${dimension.dimension}`} aria-label={dimension.label} className="block border rounded p-1 max-w-full bg-white" value={filters[dimension.dimension] ?? ''} onChange={event => changeFilter(dimension.dimension as typeof DIMENSIONS[number] & Exclude<typeof DIMENSIONS[number], 'engine_base_id'>, event.target.value)}><option value="">All — check application</option>{dimension.options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>)}
      <label className="flex items-center gap-1"><input id="catalog-in-stock" type="checkbox" checked={filters.in_stock_only === 'true'} onChange={event => changeFilter('in_stock_only', event.target.checked ? 'true' : '')} />In stock only</label>
      <button className="underline" onClick={clearFilters}>Clear filters</button>
    </div>
    {isLoading ? <div role="status" className="flex items-center justify-center h-40 gap-2"><Loader2 className="h-6 w-6 animate-spin" />Loading ERP parts…</div>
      : error ? <div role="alert" className="p-4 text-red-700">{error.message}<button onClick={refetch} className="underline ml-2">Retry</button></div>
      : data?.parts.length ? <><p className="mb-3 text-xs text-muted-foreground" role="status">{data.pagination.total_is_exact === false ? 'At least ' : ''}{data.pagination.total} matching parts · CAD</p><PartsTable parts={data.parts} onAddToCart={addToCart} /></>
      : <p className="p-8 text-sm text-muted-foreground">No parts match this vehicle and selection. Try another category or remove a filter.</p>}
    {data && <div className="flex justify-center items-center gap-4 my-4 text-sm">
      {page > 1 ? <a id="catalog-previous" className={buttonVariants({ variant: 'outline' })} href={pageHref(page - 1)} onClick={event => {
        if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); changeFilter('page', String(page - 1));
      }}>Previous</a> : <Button variant="outline" disabled>Previous</Button>}
      <span>Page {page}</span>
      {data.pagination.has_more && page < 100 ? <a id="catalog-next" className={buttonVariants({ variant: 'outline' })} href={pageHref(page + 1)} onClick={event => {
        if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); changeFilter('page', String(page + 1));
      }}>Next</a> : <Button variant="outline" disabled>Next</Button>}
    </div>}

  </section>;

  return <div className="h-dvh flex flex-col bg-background overflow-hidden">
    <Toaster />
    <ProductRoute onAddToCart={addToCart} />
    <Header cartItemCount={cart?.items.reduce((count, item) => count + item.quantity, 0) ?? 0} searchQuery={searchQuery}
      onSearchChange={textSearch} onVehicleSearch={vehicleSearch} onPartSearch={result => textSearch(result.partNumber ?? '')}
      onCategorySearch={result => tree.current?.expandToCategory(result)} vehicleContext={vehicleContext}
      onAddToCart={part => addToCart(part.id, part)} catalogPreview
      onCatalogClick={showCatalog} onCartClick={() => setMobileCartOpen(true)} />
    <div className="shrink-0 px-3 py-1 border-b text-xs text-muted-foreground space-y-1" data-testid="catalog-context">
      <span>Canada / CAD · ERP staging test · Checkout disabled</span>{' '}
      {vehicleContext && <div className="min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="selected-context">
        <Breadcrumb aria-label="Selected vehicle and category" className="min-w-0 flex-1 basis-full lg:basis-auto">
          <BreadcrumbList className="text-sm gap-x-1 gap-y-0">
            <BreadcrumbItem><span className="font-semibold text-foreground text-xs">Current vehicle:</span></BreadcrumbItem>
            <BreadcrumbItem><BreadcrumbLink asChild><a href="/?scope=all" className="py-1 underline underline-offset-2" onClick={event => {
              if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault(); showCatalog();
            }}>Part Catalog</a></BreadcrumbLink></BreadcrumbItem>
            {[{ label: String(vehicleContext.year), target: 'makes' as const },
              { label: vehicleContext.makeName, target: 'models' as const },
              { label: vehicleContext.modelName, target: 'engines' as const },
              { label: vehicleContext.engineName ?? 'All engines', target: 'categories' as const },
              ...(scopedCategory ? [{ label: scopedCategory.name, target: 'selection' as const }] : []),
            ].map((item, index, items) => <Fragment key={index}>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0 max-w-full">
                <BreadcrumbLink asChild><button className="py-1 text-left break-words underline underline-offset-2" aria-current={index === items.length - 1 ? 'location' : undefined} onClick={() => returnTo(item.target)}>{item.label}</button></BreadcrumbLink>
              </BreadcrumbItem>
            </Fragment>)}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="min-w-0 max-w-full flex flex-wrap items-start gap-2" aria-label="Return to catalog choices">
          <details className="group min-w-0 max-w-full" data-testid="vehicle-options">
            <summary className="min-h-9 flex items-center cursor-pointer rounded border border-border px-3 text-sm text-foreground hover:bg-muted">Vehicle options <span aria-hidden="true" className="ml-2 group-open:rotate-180">⌄</span></summary>
            <div className="py-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => returnTo('categories')}>Categories</Button>
              <Button size="sm" variant="outline" onClick={() => returnTo('engines')}>Change engine</Button>
              <Button size="sm" variant="outline" onClick={() => returnTo('years')}>Change vehicle</Button>
            </div>
            <p className="max-w-sm pb-2">Current choice applies for this visit. Explicitly choosing a vehicle saves it when browser storage is available. Browse without changing it; choose another engine to switch.</p>
          </details>
          <Button size="sm" variant="outline" className="min-h-9" onClick={() => clearVehicle()}>Clear vehicle</Button>
        </div>
      </div>}
      {vehicleNotice && <p role="status" className="w-full text-foreground" data-testid="vehicle-storage-notice">
        {vehicleNotice} <button className="underline" onClick={() => activeVehicle ? void controller.navigate(state, 'remember') : clearVehicle()}>Retry {activeVehicle ? 'saving vehicle' : 'clearing saved vehicle'}</button>
      </p>}
      {snapshot.status === 'ready' && !vehicleContext && <span className="font-semibold text-foreground" role="status">All vehicles. Select a vehicle to narrow results.</span>}
    </div>
    <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
      <main ref={main} id="catalog-main" tabIndex={-1} className="flex-1 min-w-0 overflow-auto p-3"
        onScroll={() => controller.savePresentation()} onFocusCapture={() => controller.savePresentation()}>
        {snapshot.status === 'resolving' && <p role="status">Resolving catalog URL…</p>}
        {snapshot.recovery && <div role="alert" data-testid="navigation-recovery" className="p-3 text-sm">
          <p>{snapshot.recovery.message}</p><button className="underline mr-3" onClick={() => void controller.retry()}>Retry selection</button>
          <a href="/?scope=all" onClick={event => { if (!event.button && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); showCatalog(); } }}>Part Catalog</a>
        </div>}
        {!!listing?.unverified.length && <p role="status" data-testid="unverified-filters" className="mb-2 text-xs">
          Some saved filters could not be verified ({listing.unverified.map(key => `${key}=${query[key as keyof typeof query]}`).join(', ')}). They still narrow this search; check application notes.
          {' '}<button className="underline" onClick={clearFilters}>Clear unverified filters</button>
        </p>}
        {draft && <p role="status" className="mb-2 text-xs">{draft} <button className="underline" onClick={() => setDraft('')}>Cancel draft</button></p>}
        {listing && showResults && !inlineResults && <div className="mb-6">{renderParts()}{searchQuery && <button className="text-sm underline my-3" onClick={() => textSearch('')}>Return to vehicle catalog</button>}</div>}
        <TreeSidebar ref={tree} onPartTypeSelect={selectPartType} onVehicleSelect={selectVehicle} activeVehicle={activeVehicle} selectedFitment={selectedFitment}
          onDisclosureChange={() => controller.savePresentation()} renderPartsInline={() => inlineResults ? renderParts() : null} />
      </main>
      <aside className="hidden lg:block" aria-label="Quick Cart"><RightCartPanel {...cartProps} /></aside>
    </div>
    <div className="lg:hidden shrink-0 border-t border-border bg-background px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]" data-testid="mobile-cart-strip">
      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetTrigger aria-label="Open Quick Cart" className={buttonVariants({ className: 'h-11 w-full bg-brand-accent hover:bg-brand-accent/90' })}><ShoppingCart className="h-5 w-5" /><span>Quick Cart</span><Badge className="bg-brand-gold text-brand-ink">{cart?.items.length ?? 0} saved</Badge></SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 overflow-auto bg-white"><SheetHeader className="sr-only"><SheetTitle>Quick Cart</SheetTitle></SheetHeader><RightCartPanel {...cartProps} /></SheetContent>
      </Sheet>
    </div>
  </div>;
}
