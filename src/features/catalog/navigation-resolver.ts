import type { Category, VehicleContext, VehicleEngine, VehicleMake, VehicleModel, VehicleYear } from '../../lib/api.ts';
import { DIMENSIONS } from './model.ts';
import type { ListingNavigationState } from './navigation-state.ts';

export interface NavigationReferences {
  getYears(): Promise<VehicleYear[]>;
  getMakes(year: number): Promise<VehicleMake[]>;
  getModels(makeId: number, year: number): Promise<VehicleModel[]>;
  getEngines(modelId: number, year: number, makeId: number): Promise<VehicleEngine[]>;
  getCategories(): Promise<Category[]>;
  getChildren(parent: Category): Promise<Category[]>;
}
export interface NavigationCategory extends Category { navigationParentKnown: boolean; parentSlug?: string }
export type ListingResolution =
  | { status: 'ready'; state: ListingNavigationState; vehicle: VehicleContext | null; category?: NavigationCategory; unverified: string[] }
  | { status: 'recovery'; reason: 'unknown' | 'unavailable' | 'contract-gap'; message: string };

const unknown = (name: string): ListingResolution => ({ status: 'recovery', reason: 'unknown',
  message: `This ${name} is not available in the selected vehicle references. Choose another selection or return to Part Catalog.` });

/** Bounded reference walk, never a taxonomy crawl or a search-facet membership test. */
export async function resolveListing(state: ListingNavigationState, refs: NavigationReferences): Promise<ListingResolution> {
  try {
    if (state.partType && state.scope.kind === 'all' && !state.category && !state.text.residual) return { status: 'recovery', reason: 'contract-gap',
      message: 'A part-type constraint alone is not supported by this catalog search. Add text, choose a vehicle/category, or return to Part Catalog. The URL has been retained.' };
    let vehicle: VehicleContext | null = null;
    if (state.scope.kind === 'vehicle') {
      const selection = state.scope.vehicle;
      if (!(await refs.getYears()).some(item => item.year === selection.year)) return unknown('year');
      const make = (await refs.getMakes(selection.year)).find(item => item.name === selection.make);
      if (!make) return unknown('make');
      const model = (await refs.getModels(make.id, selection.year)).find(item => item.name === selection.model);
      if (!model) return unknown('model');
      vehicle = { year: selection.year, makeId: make.id, makeName: make.name, modelId: model.id, modelName: model.name };
      const engineId = selection.dimensions.engine_base_id;
      if (engineId) {
        const engine = (await refs.getEngines(model.id, selection.year, make.id)).find(item => String(item.id) === engineId);
        if (!engine) return unknown('engine');
        vehicle.engineId = engine.id; vehicle.engineName = engine.name;
      }
    }
    let category: NavigationCategory | undefined;
    if (state.category) {
      const roots = await refs.getCategories();
      if (state.category.parentSlug) {
        const parent = roots.find(item => item.slug === state.category!.parentSlug);
        if (!parent) return unknown('category parent');
        const child = (await refs.getChildren(parent)).find(item => item.slug === state.category!.slug && item.parentId === parent.id);
        if (!child || !child.name || !Number.isInteger(child.id) || child.id <= 0) return unknown('category');
        category = { ...child, navigationParentKnown: true, parentSlug: parent.slug };
      } else {
        const root = roots.find(item => item.slug === state.category!.slug);
        if (!root) return { status: 'recovery', reason: 'contract-gap',
          message: 'This category URL needs a verified parent category. Return to Part Catalog and choose its branch to create a restorable link. The URL has been retained.' };
        if (!root.name || !Number.isInteger(root.id) || root.id <= 0) return unknown('category');
        category = { ...root, navigationParentKnown: true };
      }
    }
    // These constraints have transport support but no authoritative membership
    // resource in the current allowlist. Preserve them without certifying them.
    const unverified = [
      ...(state.scope.kind === 'vehicle' ? DIMENSIONS.filter(key => key !== 'engine_base_id' && state.scope.kind === 'vehicle' && state.scope.vehicle.dimensions[key]) : []),
      ...(state.partType ? ['part_type'] : []),
    ];
    return { status: 'ready', state, vehicle, category, unverified };
  } catch {
    return { status: 'recovery', reason: 'unavailable',
      message: 'Vehicle or category references are temporarily unavailable. Retry this URL; no different vehicle has been restored.' };
  }
}
