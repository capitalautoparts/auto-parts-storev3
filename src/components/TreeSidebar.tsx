import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  vehicleApi,
  categoryApi,
  type VehicleMake,
  type VehicleModel,
  type VehicleEngine,
  type Category,
  type VehicleSearchResult,
  type VehicleContext,
} from "@/lib/api";
import { useQuery } from "@/lib/hooks";

export interface PartSelection {
  year: number;
  make: VehicleMake;
  model: VehicleModel;
  engine: VehicleEngine;
  category: Category;
}

export interface TreeSidebarHandle {
  expandToVehicle: (result: VehicleSearchResult) => void;
  expandToCategory: (result: VehicleSearchResult) => void;
  revealSelection: (target: 'categories' | 'engines' | 'years', vehicle: VehicleContext, category?: Category) => void;
}

export interface VehicleExpansion {
  year: number;
  makeId: number;
  makeName: string;
  modelId: number;
  modelName: string;
  engineId: number;
  engineName: string;
}

interface TreeSidebarProps {
  onPartTypeSelect: (selection: PartSelection) => void;
  onVehicleSelect: (vehicle: VehicleExpansion) => void;
  activeVehicle: VehicleExpansion | null;
  selectedFitment: PartSelection | null;
  renderPartsInline?: (selection: PartSelection) => React.ReactNode;
}

export const TreeSidebar = forwardRef<TreeSidebarHandle, TreeSidebarProps>(
  function TreeSidebar({ onPartTypeSelect, onVehicleSelect, activeVehicle, selectedFitment, renderPartsInline }, ref) {
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [expandedMakes, setExpandedMakes] = useState<Set<string>>(new Set());
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
  const [expandedEngines, setExpandedEngines] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const selectedPath = activeVehicle ? { year: activeVehicle.year, makeId: activeVehicle.makeId,
    modelId: activeVehicle.modelId, engineId: activeVehicle.engineId, categoryId: selectedFitment?.category.id } : {};
  const root = useRef<HTMLDivElement>(null);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  // Ancestors can remount while their cached reference data loads. Focus once the
  // requested native control exists, without a timing guess or another request.
  useEffect(() => {
    if (!focusTarget || !root.current) return;
    const focus = () => {
      const target = document.getElementById(focusTarget);
      const control = target?.matches('button') ? target : target?.querySelector('button');
      if (!control || !root.current?.contains(control) || control.closest('[hidden]')) return false;
      control.focus(); control.scrollIntoView({ block: 'center' }); setFocusTarget(null); return true;
    };
    if (focus()) return;
    const observer = new MutationObserver(() => { if (focus()) observer.disconnect(); });
    observer.observe(root.current, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    return () => observer.disconnect();
  }, [focusTarget]);

  const { data: yearsData, isLoading: yearsLoading, error: yearsError, refetch: retryYears } = useQuery(() => vehicleApi.getYears());
  const { data: categoriesData, error: categoriesError, refetch: retryCategories } = useQuery(() => categoryApi.getAll());

  // Expose expandToVehicle and expandToCategory functions via ref
  useImperativeHandle(ref, () => ({
    revealSelection: (target, vehicle, category) => {
      const { year, makeId, modelId, engineId } = vehicle;
      if (target !== 'years') {
        setExpandedYears(prev => new Set(prev).add(year));
        setExpandedMakes(prev => new Set(prev).add(`${year}-${makeId}`));
        setExpandedModels(prev => new Set(prev).add(`${year}-${makeId}-${modelId}`));
      }
      const engineKey = `${year}-${makeId}-${modelId}-${engineId}`;
      if (target === 'categories' && engineId !== undefined) {
        setExpandedEngines(prev => new Set(prev).add(engineKey));
        if (category?.parentId) setExpandedCategories(prev => new Set(prev).add(`${engineKey}-${category.parentId}`));
      }
      setFocusTarget(target === 'years' ? `vehicle-year-${year}` : engineId === undefined
        ? `vehicle-model-${year}-${makeId}-${modelId}` : target === 'engines' ? `vehicle-engine-${engineKey}`
        : category ? `vehicle-category-${engineKey}-${category.parentId ?? category.id}` : `vehicle-categories-${engineKey}`);
    },
    expandToVehicle: (result: VehicleSearchResult) => {
      if (!result.year) return;

      // Expand year
      setExpandedYears(prev => new Set(prev).add(result.year!));

      // Expand make if provided
      if (result.makeId) {
        setExpandedMakes(prev => new Set(prev).add(`${result.year}-${result.makeId}`));
      }

      // Expand model if provided
      if (result.makeId && result.modelId) {
        setExpandedModels(prev => new Set(prev).add(`${result.year}-${result.makeId}-${result.modelId}`));
      }

      // Expand engine if provided
      if (result.engineId !== undefined) {
        setExpandedEngines(prev => new Set(prev).add(`${result.year}-${result.makeId}-${result.modelId}-${result.engineId}`));
      }

    },
    expandToCategory: (result: VehicleSearchResult) => {
      if (!result.year || !result.makeId || !result.modelId || result.engineId === undefined || !result.categoryId) return;

      // Expand all levels to show the category
      setExpandedYears(prev => new Set(prev).add(result.year!));
      setExpandedMakes(prev => new Set(prev).add(`${result.year}-${result.makeId}`));
      setExpandedModels(prev => new Set(prev).add(`${result.year}-${result.makeId}-${result.modelId}`));
      setExpandedEngines(prev => new Set(prev).add(`${result.year}-${result.makeId}-${result.modelId}-${result.engineId}`));

      const category: Category = { id: result.categoryId, name: result.categoryName ?? result.label, slug: result.categorySlug, parentId: result.categoryParentId ?? null };
      if (category.parentId) setExpandedCategories(prev => new Set(prev).add(`${result.year}-${result.makeId}-${result.modelId}-${result.engineId}-${category.parentId}`));
      const selection: PartSelection = {
        year: result.year,
        make: { id: result.makeId, name: result.makeName! },
        model: { id: result.modelId, name: result.modelName!, makeId: result.makeId },
        engine: { id: result.engineId, name: result.engineName!, modelId: result.modelId },
        category,
      };
      onPartTypeSelect(selection);
    },
  }));

  const toggleYear = (year: number) => {
    const newExpanded = new Set(expandedYears);
    if (newExpanded.has(year)) {
      newExpanded.delete(year);
    } else {
      newExpanded.add(year);
    }
    setExpandedYears(newExpanded);
  };

  const toggleMake = (year: number, makeId: number) => {
    const key = `${year}-${makeId}`;
    const newExpanded = new Set(expandedMakes);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedMakes(newExpanded);
  };

  const toggleModel = (year: number, makeId: number, modelId: number) => {
    const key = `${year}-${makeId}-${modelId}`;
    const newExpanded = new Set(expandedModels);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedModels(newExpanded);
  };

  const toggleEngine = (engineKey: string) => {
    setExpandedEngines(prev => {
      const next = new Set(prev);
      if (next.has(engineKey)) next.delete(engineKey); else next.add(engineKey);
      return next;
    });
  };
  const selectEngine = (vehicle: VehicleExpansion) => {
    setExpandedEngines(prev => new Set(prev).add(`${vehicle.year}-${vehicle.makeId}-${vehicle.modelId}-${vehicle.engineId}`));
    onVehicleSelect(vehicle);
  };

  const toggleCategory = (categoryKey: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryKey)) {
      newExpanded.delete(categoryKey);
    } else {
      newExpanded.add(categoryKey);
    }
    setExpandedCategories(newExpanded);
  };

  const handlePartTypeClick = (selection: PartSelection) => {
    onPartTypeSelect(selection);
  };

  const categoryTree = categoriesData
    ? categoriesData.filter(c => !c.parentId).map(root => ({
        ...root,
        children: categoriesData.filter(c => c.parentId === root.id),
      }))
    : [];

  return (
    <div ref={root} className="w-full min-w-0" data-testid="vehicle-tree">
      <div className="py-2 text-xs uppercase tracking-[0.3em] font-display text-foreground font-semibold">
        Part Catalog
      </div>

      {yearsLoading && <p role="status" className="p-2 text-sm">Loading vehicle catalog…</p>}
      {(yearsError || categoriesError) && <div role="alert" className="p-3 text-sm text-red-700">{(yearsError || categoriesError)?.message}<button onClick={() => {
        if (yearsError) void retryYears();
        if (categoriesError) void retryCategories();
      }} className="underline ml-2">Retry</button></div>}
      <div className="text-sm">
        {yearsData?.map((yearData) => (
            <YearNode
              key={yearData.year}
              year={yearData.year}
              isExpanded={expandedYears.has(yearData.year)}
              onToggle={() => toggleYear(yearData.year)}
              expandedMakes={expandedMakes}
              expandedModels={expandedModels}
              expandedEngines={expandedEngines}
              expandedCategories={expandedCategories}
              categoryTree={categoryTree}
              selectedPath={selectedPath}
              selectedFitment={selectedFitment}
              renderPartsInline={renderPartsInline}
              onToggleMake={toggleMake}
              onToggleModel={toggleModel}
              onToggleEngine={toggleEngine}
              onSelectEngine={selectEngine}
              onToggleCategory={toggleCategory}
              onPartTypeClick={handlePartTypeClick}
            />
          ))}
      </div>
    </div>
  );
});

interface YearNodeProps {
  year: number;
  isExpanded: boolean;
  onToggle: () => void;
  expandedMakes: Set<string>;
  expandedModels: Set<string>;
  expandedEngines: Set<string>;
  expandedCategories: Set<string>;
  categoryTree: any[];
  selectedPath: any;
  selectedFitment: PartSelection | null;
  renderPartsInline?: (selection: PartSelection) => React.ReactNode;
  onToggleMake: (year: number, makeId: number) => void;
  onToggleModel: (year: number, makeId: number, modelId: number) => void;
  onToggleEngine: (engineKey: string) => void;
  onSelectEngine: (vehicle: VehicleExpansion) => void;
  onToggleCategory: (categoryKey: string) => void;
  onPartTypeClick: (selection: PartSelection) => void;
}

function YearNode({
  year,
  isExpanded,
  onToggle,
  expandedMakes,
  expandedModels,
  expandedEngines,
  expandedCategories,
  categoryTree,
  selectedPath,
  selectedFitment,
  renderPartsInline,
  onToggleMake,
  onToggleModel,
  onToggleEngine,
  onSelectEngine,
  onToggleCategory,
  onPartTypeClick,
}: YearNodeProps) {
  const { data: makesData, isLoading, error, refetch } = useQuery(
    () => vehicleApi.getMakes(year),
    { enabled: isExpanded }
  );

  return (
    <div data-vehicle-year={year}>
      <button
        id={`vehicle-year-${year}`} aria-expanded={isExpanded} aria-controls={`vehicle-year-${year}-children`}
        onClick={onToggle}
        className="w-full text-left px-2 py-1 hover:bg-muted rounded flex items-center gap-1"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
        )}
        <span>{year}</span>
      </button>

      <div id={`vehicle-year-${year}-children`} hidden={!isExpanded}>
      {isExpanded && <BranchStatus loading={isLoading} error={error} onRetry={refetch} />}
      {isExpanded && makesData && (
        <div className="ml-3">
          {makesData.map((make) => (
            <MakeNode
              key={make.id}
              year={year}
              make={make}
              isExpanded={expandedMakes.has(`${year}-${make.id}`)}
              onToggle={() => onToggleMake(year, make.id)}
              expandedModels={expandedModels}
              expandedEngines={expandedEngines}
              expandedCategories={expandedCategories}
              categoryTree={categoryTree}
              selectedPath={selectedPath}
              selectedFitment={selectedFitment}
              renderPartsInline={renderPartsInline}
              onToggleModel={onToggleModel}
              onToggleEngine={onToggleEngine}
              onSelectEngine={onSelectEngine}
              onToggleCategory={onToggleCategory}
              onPartTypeClick={onPartTypeClick}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

interface MakeNodeProps {
  year: number;
  make: VehicleMake;
  isExpanded: boolean;
  onToggle: () => void;
  expandedModels: Set<string>;
  expandedEngines: Set<string>;
  expandedCategories: Set<string>;
  categoryTree: any[];
  selectedPath: any;
  selectedFitment: PartSelection | null;
  renderPartsInline?: (selection: PartSelection) => React.ReactNode;
  onToggleModel: (year: number, makeId: number, modelId: number) => void;
  onToggleEngine: (engineKey: string) => void;
  onSelectEngine: (vehicle: VehicleExpansion) => void;
  onToggleCategory: (categoryKey: string) => void;
  onPartTypeClick: (selection: PartSelection) => void;
}

function MakeNode({
  year,
  make,
  isExpanded,
  onToggle,
  expandedModels,
  expandedEngines,
  expandedCategories,
  categoryTree,
  selectedPath,
  selectedFitment,
  renderPartsInline,
  onToggleModel,
  onToggleEngine,
  onSelectEngine,
  onToggleCategory,
  onPartTypeClick,
}: MakeNodeProps) {
  const { data: modelsData, isLoading, error, refetch } = useQuery(
    () => vehicleApi.getModels(make.id, year),
    { enabled: isExpanded }
  );

  return (
    <div>
      <button
        id={`vehicle-make-${year}-${make.id}`} aria-expanded={isExpanded} aria-controls={`vehicle-make-${year}-${make.id}-children`}
        onClick={onToggle}
        className="w-full text-left px-2 py-1 hover:bg-muted rounded flex items-center gap-1"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
        )}
        {make.country && (
          <span className="text-[10px] font-semibold text-muted-foreground uppercase">
            {make.country}
          </span>
        )}
        <span>{make.name}</span>
      </button>

      <div id={`vehicle-make-${year}-${make.id}-children`} hidden={!isExpanded}>
      {isExpanded && <BranchStatus loading={isLoading} error={error} onRetry={refetch} />}
      {isExpanded && modelsData && (
        <div className="ml-3">
          {modelsData.map((model) => (
            <ModelNode
              key={model.id}
              year={year}
              make={make}
              makeId={make.id}
              model={model}
              isExpanded={expandedModels.has(`${year}-${make.id}-${model.id}`)}
              onToggle={() => onToggleModel(year, make.id, model.id)}
              expandedEngines={expandedEngines}
              expandedCategories={expandedCategories}
              categoryTree={categoryTree}
              selectedPath={selectedPath}
              selectedFitment={selectedFitment}
              renderPartsInline={renderPartsInline}
              onToggleEngine={onToggleEngine}
              onSelectEngine={onSelectEngine}
              onToggleCategory={onToggleCategory}
              onPartTypeClick={onPartTypeClick}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

interface ModelNodeProps {
  year: number;
  make: VehicleMake;
  makeId: number;
  model: VehicleModel;
  isExpanded: boolean;
  onToggle: () => void;
  expandedEngines: Set<string>;
  expandedCategories: Set<string>;
  categoryTree: any[];
  selectedPath: any;
  selectedFitment: PartSelection | null;
  renderPartsInline?: (selection: PartSelection) => React.ReactNode;
  onToggleEngine: (engineKey: string) => void;
  onSelectEngine: (vehicle: VehicleExpansion) => void;
  onToggleCategory: (categoryKey: string) => void;
  onPartTypeClick: (selection: PartSelection) => void;
}

function ModelNode({
  year,
  make,
  model,
  isExpanded,
  onToggle,
  expandedEngines,
  expandedCategories,
  categoryTree,
  selectedPath,
  selectedFitment,
  renderPartsInline,
  onToggleEngine,
  onSelectEngine,
  onToggleCategory,
  onPartTypeClick,
}: ModelNodeProps) {
  const { data: enginesData, isLoading, error, refetch } = useQuery(
    () => vehicleApi.getEngines(model.id, year, make.id),
    { enabled: isExpanded }
  );

  return (
    <div>
      <button
        id={`vehicle-model-${year}-${make.id}-${model.id}`} aria-expanded={isExpanded} aria-controls={`vehicle-model-${year}-${make.id}-${model.id}-children`}
        onClick={onToggle}
        className="w-full text-left px-2 py-1 hover:bg-muted rounded flex items-center gap-1"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
        )}
        <span>{model.name}</span>
      </button>

      <div id={`vehicle-model-${year}-${make.id}-${model.id}-children`} hidden={!isExpanded}>
      {isExpanded && <BranchStatus loading={isLoading} error={error} onRetry={refetch} />}
      {isExpanded && enginesData && (
        <div className="ml-3">
          {enginesData.map((engine) => (
            <EngineNode
              key={engine.id}
              engine={engine}
              year={year}
              make={make}
              model={model}
              isExpanded={expandedEngines.has(`${year}-${make.id}-${model.id}-${engine.id}`)}
              onToggle={() => onToggleEngine(`${year}-${make.id}-${model.id}-${engine.id}`)}
              onSelect={() => onSelectEngine({
                year,
                makeId: make.id,
                makeName: make.name,
                modelId: model.id,
                modelName: model.name,
                engineId: engine.id,
                engineName: engine.name,
              })}
              expandedCategories={expandedCategories}
              categoryTree={categoryTree}
              selectedPath={selectedPath}
              selectedFitment={selectedFitment}
              renderPartsInline={renderPartsInline}
              onToggleCategory={onToggleCategory}
              onPartTypeClick={onPartTypeClick}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

interface EngineNodeProps {
  engine: VehicleEngine;
  year: number;
  make: VehicleMake;
  model: VehicleModel;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  expandedCategories: Set<string>;
  categoryTree: any[];
  selectedPath: any;
  selectedFitment: PartSelection | null;
  renderPartsInline?: (selection: PartSelection) => React.ReactNode;
  onToggleCategory: (categoryKey: string) => void;
  onPartTypeClick: (selection: PartSelection) => void;
}

function EngineNode({
  onSelect,
  engine,
  year,
  make,
  model,
  isExpanded,
  onToggle,
  expandedCategories,
  categoryTree,
  selectedPath,
  selectedFitment,
  renderPartsInline,
  onToggleCategory,
  onPartTypeClick,
}: EngineNodeProps) {
  const engineKey = `${year}-${make.id}-${model.id}-${engine.id}`;
  const isCurrent = selectedPath.year === year && selectedPath.makeId === make.id
    && selectedPath.modelId === model.id && selectedPath.engineId === engine.id;
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)]">
      <button onClick={onToggle} aria-label={`${isExpanded ? 'Collapse' : 'Expand'} categories for ${engine.name}`}
        aria-expanded={isExpanded} aria-controls={`vehicle-categories-${engineKey}`}
        className={cn("p-2 rounded-l flex items-center justify-center hover:bg-muted", isCurrent && "bg-accent")}>
        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      <button id={`vehicle-engine-${engineKey}`} onClick={onSelect} title={`Choose ${engine.name}`} aria-current={isCurrent ? 'true' : undefined}
        className={cn("min-w-0 text-left px-2 py-1 rounded-r break-words hover:bg-muted", isCurrent && "bg-accent font-semibold")}>{engine.name}</button>

      <div id={`vehicle-categories-${engineKey}`} className="col-span-2 min-w-0" hidden={!isExpanded}>
      {isExpanded && (
        <div className="ml-3">
          {categoryTree.map((category) => (
            <CategoryNode
              key={category.id}
              category={category}
              engineId={engine.id}
              engine={engine}
              year={year}
              make={make}
              model={model}
              isExpanded={expandedCategories.has(`${year}-${make.id}-${model.id}-${engine.id}-${category.id}`)}
              onToggle={() => onToggleCategory(`${year}-${make.id}-${model.id}-${engine.id}-${category.id}`)}
              selectedPath={selectedPath}
              selectedFitment={selectedFitment}
              renderPartsInline={renderPartsInline}
              onPartTypeClick={onPartTypeClick}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

interface CategoryNodeProps {
  category: Category & { children?: Category[] };
  year: number;
  make: VehicleMake;
  model: VehicleModel;
  engineId: number;
  engine: VehicleEngine;
  isExpanded: boolean;
  onToggle: () => void;
  selectedPath: any;
  selectedFitment: PartSelection | null;
  renderPartsInline?: (selection: PartSelection) => React.ReactNode;
  onPartTypeClick: (selection: PartSelection) => void;
}

function CategoryNode({
  category,
  year,
  make,
  model,
  engineId,
  engine,
  isExpanded,
  onToggle,
  selectedPath,
  selectedFitment,
  renderPartsInline,
  onPartTypeClick,
}: CategoryNodeProps) {
  const hasChildren = category.parentId === null;
  const { data: childCategories, isLoading, error, refetch } = useQuery(() => categoryApi.getChildren(category), { enabled: hasChildren && isExpanded, deps: [category.id] });
  const isThisVehicle = selectedPath.year === year && selectedPath.makeId === make.id && selectedPath.modelId === model.id && selectedPath.engineId === engineId;

  const isThisCategorySelected = selectedPath.categoryId === category.id && isThisVehicle;

  return (
    <div>
      <button
        id={`vehicle-category-${year}-${make.id}-${model.id}-${engineId}-${category.id}`}
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-controls={hasChildren ? `vehicle-category-${year}-${make.id}-${model.id}-${engineId}-${category.id}-children` : undefined}
        aria-current={isThisCategorySelected ? 'true' : undefined}
        onClick={() => {
          if (hasChildren) {
            onToggle();
          } else {
            onPartTypeClick({
              year,
              make,
              model,
              engine,
              category,
            });
          }
        }}
        className={cn(
          "w-full text-left px-2 py-1 hover:bg-muted rounded flex items-center gap-1",
          selectedPath.categoryId === category.id && isThisVehicle && "bg-accent font-semibold"
        )}
      >
        {hasChildren && (
          isExpanded ? (
            <ChevronDown className="h-3 w-3 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 flex-shrink-0" />
          )
        )}
        {!hasChildren && <span className="w-3" />}
        <span>{category.name}</span>
      </button>

      {/* Render parts inline for leaf categories */}
      {isThisCategorySelected && selectedFitment && renderPartsInline && (
        <div className="mt-4 -ml-6 min-w-0">
          {renderPartsInline(selectedFitment)}
        </div>
      )}

      <div id={`vehicle-category-${year}-${make.id}-${model.id}-${engineId}-${category.id}-children`} hidden={!isExpanded}>
      {isExpanded && hasChildren && (
        <div className="ml-3">
          <BranchStatus loading={isLoading} error={error} onRetry={refetch} />
          <button className="w-full text-left px-2 py-1 hover:bg-muted rounded text-xs" onClick={() => onPartTypeClick({ year, make, model, engine, category })}>View all {category.name}</button>
          {(childCategories ?? []).map((child) => {
            const isChildSelected = selectedPath.categoryId === child.id && isThisVehicle;
            return (
              <div key={child.id}>
                <button
                  aria-current={isChildSelected ? 'true' : undefined}
                  onClick={() =>
                    onPartTypeClick({
                      year,
                      make,
                      model,
                      engine,
                      category: child,
                    })
                  }
                  className={cn(
                    "w-full text-left px-2 py-1 hover:bg-muted rounded flex items-center gap-1",
                    isChildSelected && "bg-accent font-semibold"
                  )}
                >
                  <span className="w-3" />
                  <span>{child.name}</span>
                </button>
                {/* Render parts inline for selected child categories */}
                {isChildSelected && selectedFitment && renderPartsInline && (
                  <div className="mt-4 -ml-6 min-w-0">
                    {renderPartsInline(selectedFitment)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}


function BranchStatus({ loading, error, onRetry }: { loading: boolean; error: Error | null; onRetry?: () => Promise<void> }) {
  return loading ? <p role="status" className="ml-4 py-1 text-xs text-muted-foreground">Loading…</p> : error ? <p role="alert" className="ml-4 py-1 text-xs text-red-700">{error.message}{onRetry && <button onClick={() => void onRetry()} className="underline ml-2">Retry</button>}</p> : null;
}
