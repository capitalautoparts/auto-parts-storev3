import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  vehicleApi,
  categoryApi,
  type VehicleMake,
  type VehicleModel,
  type VehicleEngine,
  type Category,
} from "@/lib/api";
import { useQuery } from "@/lib/hooks";

export interface PartSelection {
  year: number;
  make: VehicleMake;
  model: VehicleModel;
  engine: VehicleEngine;
  category: Category;
}

interface TreeSidebarProps {
  onPartTypeSelect: (selection: PartSelection) => void;
}

export function TreeSidebar({ onPartTypeSelect }: TreeSidebarProps) {
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

  const { data: yearsData } = useQuery(() => vehicleApi.getYears());
  const { data: categoriesData } = useQuery(() => categoryApi.getAll());

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

  const toggleEngine = (engineId: number) => {
    const newExpanded = new Set(expandedEngines);
    if (newExpanded.has(engineId)) {
      newExpanded.delete(engineId);
    } else {
      newExpanded.add(engineId);
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
    onPartTypeSelect(selection);
  };

  const categoryTree = categoriesData
    ? categoriesData.filter(c => !c.parentId).map(root => ({
        ...root,
        children: categoriesData.filter(c => c.parentId === root.id),
      }))
    : [];

  return (
    <div className="w-full bg-white border border-border flex flex-col h-full">
      <div className="px-3 py-2 text-xs uppercase tracking-[0.3em] font-display border-b border-border text-foreground">
        Part Catalog
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 text-sm">
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
              onToggleMake={toggleMake}
              onToggleModel={toggleModel}
              onToggleEngine={toggleEngine}
              onToggleCategory={toggleCategory}
              onPartTypeClick={handlePartTypeClick}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

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
  onToggleMake: (year: number, makeId: number) => void;
  onToggleModel: (makeId: number, modelId: number) => void;
  onToggleEngine: (engineId: number) => void;
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
  onToggleModel: (makeId: number, modelId: number) => void;
  onToggleEngine: (engineId: number) => void;
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
  onToggleEngine: (engineId: number) => void;
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
              onToggle={() => onToggleEngine(engine.id)}
              expandedCategories={expandedCategories}
              categoryTree={categoryTree}
              selectedPath={selectedPath}
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
  onPartTypeClick,
}: CategoryNodeProps) {
  const hasChildren = category.children && category.children.length > 0;

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

      {isExpanded && hasChildren && (
        <div className="ml-3">
          {category.children!.map((child) => (
            <button
              key={child.id}
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
                selectedPath.categoryId === child.id && selectedPath.engineId === engineId && "bg-accent font-semibold"
              )}
            >
              <span className="w-3" />
              <span>{child.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

