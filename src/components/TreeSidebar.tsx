import { useState, useImperativeHandle, forwardRef } from "react";
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
  onVehicleExpand?: (vehicle: VehicleExpansion) => void;
  renderPartsInline?: (selection: PartSelection) => React.ReactNode;
}

export const TreeSidebar = forwardRef<TreeSidebarHandle, TreeSidebarProps>(
  function TreeSidebar({ onPartTypeSelect, onVehicleExpand, renderPartsInline }, ref) {
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [expandedMakes, setExpandedMakes] = useState<Set<string>>(new Set());
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
  const [expandedEngines, setExpandedEngines] = useState<Set<number>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());

  const [selectedPath, setSelectedPath] = useState<{
    year?: number;
    makeId?: number;
    modelId?: number;
    engineId?: number;
    categoryId?: number;
  }>({});
  const [selectedFitment, setSelectedFitment] = useState<PartSelection | null>(null);

  const { data: yearsData } = useQuery(() => vehicleApi.getYears());
  const { data: categoriesData } = useQuery(() => categoryApi.getAll());

  // Expose expandToVehicle and expandToCategory functions via ref
  useImperativeHandle(ref, () => ({
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
        setExpandedModels(prev => new Set(prev).add(`${result.makeId}-${result.modelId}`));
      }

      // Expand engine if provided
      if (result.engineId) {
        setExpandedEngines(prev => new Set(prev).add(result.engineId!));
      }

      // Update selected path for highlighting
      setSelectedPath({
        year: result.year,
        makeId: result.makeId,
        modelId: result.modelId,
        engineId: result.engineId,
      });
    },
    expandToCategory: (result: VehicleSearchResult) => {
      if (!result.year || !result.makeId || !result.modelId || !result.engineId || !result.categoryId) return;

      // Expand all levels to show the category
      setExpandedYears(prev => new Set(prev).add(result.year!));
      setExpandedMakes(prev => new Set(prev).add(`${result.year}-${result.makeId}`));
      setExpandedModels(prev => new Set(prev).add(`${result.makeId}-${result.modelId}`));
      setExpandedEngines(prev => new Set(prev).add(result.engineId!));

      // Find the category and expand parent if needed
      const category = categoriesData?.find(c => c.id === result.categoryId);
      if (category?.parentId) {
        setExpandedCategories(prev => new Set(prev).add(category.parentId!));
      }

      // Update selected path
      setSelectedPath({
        year: result.year,
        makeId: result.makeId,
        modelId: result.modelId,
        engineId: result.engineId,
        categoryId: result.categoryId,
      });

      // Also create and set the fitment for inline parts display
      if (categoriesData) {
        const cat = categoriesData.find(c => c.id === result.categoryId);
        if (cat) {
          // We need to construct the PartSelection
          // The make, model, engine data will be fetched by the tree nodes
          // For now, we'll use placeholder data that will be populated when the tree renders
          const makesForYear = vehicleApi.getMakes(result.year!);
          const modelsForMake = vehicleApi.getModels(result.makeId!, result.year!);
          const enginesForModel = vehicleApi.getEngines(result.modelId!);

          Promise.all([makesForYear, modelsForMake, enginesForModel]).then(([makes, models, engines]) => {
            const make = makes.find(m => m.id === result.makeId);
            const model = models.find(m => m.id === result.modelId);
            const engine = engines.find(e => e.id === result.engineId);

            if (make && model && engine) {
              const selection: PartSelection = {
                year: result.year!,
                make,
                model,
                engine,
                category: cat,
              };
              setSelectedFitment(selection);
              onPartTypeSelect(selection);
            }
          });
        }
      }
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

  const toggleModel = (makeId: number, modelId: number) => {
    const key = `${makeId}-${modelId}`;
    const newExpanded = new Set(expandedModels);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedModels(newExpanded);
  };

  const toggleEngine = (engineId: number, vehicleInfo?: VehicleExpansion) => {
    const newExpanded = new Set(expandedEngines);
    const isExpanding = !newExpanded.has(engineId);
    if (isExpanding) {
      newExpanded.add(engineId);
      // Notify parent when engine is expanded
      if (vehicleInfo && onVehicleExpand) {
        onVehicleExpand(vehicleInfo);
      }
    } else {
      newExpanded.delete(engineId);
    }
    setExpandedEngines(newExpanded);
  };

  const toggleCategory = (categoryId: number) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handlePartTypeClick = (selection: PartSelection) => {
    setSelectedPath({
      year: selection.year,
      makeId: selection.make.id,
      modelId: selection.model.id,
      engineId: selection.engine.id,
      categoryId: selection.category.id,
    });
    setSelectedFitment(selection);
    onPartTypeSelect(selection);
  };

  const categoryTree = categoriesData
    ? categoriesData.filter(c => !c.parentId).map(root => ({
        ...root,
        children: categoriesData.filter(c => c.parentId === root.id),
      }))
    : [];

  return (
    <div className="w-full">
      <div className="py-2 text-xs uppercase tracking-[0.3em] font-display text-foreground font-semibold">
        Part Catalog
      </div>

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
  expandedEngines: Set<number>;
  expandedCategories: Set<number>;
  categoryTree: any[];
  selectedPath: any;
  selectedFitment: PartSelection | null;
  renderPartsInline?: (selection: PartSelection) => React.ReactNode;
  onToggleMake: (year: number, makeId: number) => void;
  onToggleModel: (makeId: number, modelId: number) => void;
  onToggleEngine: (engineId: number, vehicleInfo?: VehicleExpansion) => void;
  onToggleCategory: (categoryId: number) => void;
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
  onToggleCategory,
  onPartTypeClick,
}: YearNodeProps) {
  const { data: makesData } = useQuery(
    () => vehicleApi.getMakes(year),
    { enabled: isExpanded }
  );

  return (
    <div>
      <button
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
              onToggleCategory={onToggleCategory}
              onPartTypeClick={onPartTypeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MakeNodeProps {
  year: number;
  make: VehicleMake;
  isExpanded: boolean;
  onToggle: () => void;
  expandedModels: Set<string>;
  expandedEngines: Set<number>;
  expandedCategories: Set<number>;
  categoryTree: any[];
  selectedPath: any;
  selectedFitment: PartSelection | null;
  renderPartsInline?: (selection: PartSelection) => React.ReactNode;
  onToggleModel: (makeId: number, modelId: number) => void;
  onToggleEngine: (engineId: number, vehicleInfo?: VehicleExpansion) => void;
  onToggleCategory: (categoryId: number) => void;
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
  onToggleCategory,
  onPartTypeClick,
}: MakeNodeProps) {
  const { data: modelsData } = useQuery(
    () => vehicleApi.getModels(make.id, year),
    { enabled: isExpanded }
  );

  return (
    <div>
      <button
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

      {isExpanded && modelsData && (
        <div className="ml-3">
          {modelsData.map((model) => (
            <ModelNode
              key={model.id}
              year={year}
              make={make}
              makeId={make.id}
              model={model}
              isExpanded={expandedModels.has(`${make.id}-${model.id}`)}
              onToggle={() => onToggleModel(make.id, model.id)}
              expandedEngines={expandedEngines}
              expandedCategories={expandedCategories}
              categoryTree={categoryTree}
              selectedPath={selectedPath}
              selectedFitment={selectedFitment}
              renderPartsInline={renderPartsInline}
              onToggleEngine={onToggleEngine}
              onToggleCategory={onToggleCategory}
              onPartTypeClick={onPartTypeClick}
            />
          ))}
        </div>
      )}
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
  expandedEngines: Set<number>;
  expandedCategories: Set<number>;
  categoryTree: any[];
  selectedPath: any;
  selectedFitment: PartSelection | null;
  renderPartsInline?: (selection: PartSelection) => React.ReactNode;
  onToggleEngine: (engineId: number, vehicleInfo?: VehicleExpansion) => void;
  onToggleCategory: (categoryId: number) => void;
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
  onToggleCategory,
  onPartTypeClick,
}: ModelNodeProps) {
  const { data: enginesData } = useQuery(
    () => vehicleApi.getEngines(model.id),
    { enabled: isExpanded }
  );

  return (
    <div>
      <button
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

      {isExpanded && enginesData && (
        <div className="ml-3">
          {enginesData.map((engine) => (
            <EngineNode
              key={engine.id}
              engine={engine}
              year={year}
              make={make}
              model={model}
              isExpanded={expandedEngines.has(engine.id)}
              onToggle={() => onToggleEngine(engine.id, {
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
  );
}

interface EngineNodeProps {
  engine: VehicleEngine;
  year: number;
  make: VehicleMake;
  model: VehicleModel;
  isExpanded: boolean;
  onToggle: () => void;
  expandedCategories: Set<number>;
  categoryTree: any[];
  selectedPath: any;
  selectedFitment: PartSelection | null;
  renderPartsInline?: (selection: PartSelection) => React.ReactNode;
  onToggleCategory: (categoryId: number) => void;
  onPartTypeClick: (selection: PartSelection) => void;
}

function EngineNode({
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
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full text-left px-2 py-1 hover:bg-muted rounded flex items-center gap-1"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
        )}
        <span>{engine.name}</span>
      </button>

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
              isExpanded={expandedCategories.has(category.id)}
              onToggle={() => onToggleCategory(category.id)}
              selectedPath={selectedPath}
              selectedFitment={selectedFitment}
              renderPartsInline={renderPartsInline}
              onPartTypeClick={onPartTypeClick}
            />
          ))}
        </div>
      )}
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
  const hasChildren = category.children && category.children.length > 0;

  const isThisCategorySelected = !hasChildren && selectedPath.categoryId === category.id && selectedPath.engineId === engineId;

  return (
    <div>
      <button
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
          selectedPath.categoryId === category.id && selectedPath.engineId === engineId && "bg-accent font-semibold"
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
        <div className="mt-4 -ml-6">
          {renderPartsInline(selectedFitment)}
        </div>
      )}

      {isExpanded && hasChildren && (
        <div className="ml-3">
          {category.children!.map((child) => {
            const isChildSelected = selectedPath.categoryId === child.id && selectedPath.engineId === engineId;
            return (
              <div key={child.id}>
                <button
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
                  <div className="mt-4 -ml-6">
                    {renderPartsInline(selectedFitment)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

