import { commitCategorySelection, initialNavigation, parseCatalogBackground, parseNavigationUrl, serializeNavigation, transitionNavigation } from './navigation-state.ts';
import type { CatalogBackground, ListingNavigationState, NavigationTransition, VehicleSelection } from './navigation-state.ts';
import type { ListingResolution } from './navigation-resolver.ts';
import type { VehicleContext } from '../../lib/api.ts';

export const emptyListing = (): ListingNavigationState => {
  const parsed = parseNavigationUrl('/?scope=all');
  if (parsed.status !== 'parsed' || parsed.state.kind === 'product') throw new Error('Invalid catalog root');
  return parsed.state;
};
export interface NavigationPorts {
  href(): string;
  historyState(): Record<string, unknown> | null;
  push(href: string, state: Record<string, unknown>): void;
  replace(state: Record<string, unknown>, href?: string): void;
  capture(): CatalogBackground | null;
  remembered(): VehicleSelection | null;
  resolve(state: ListingNavigationState): Promise<ListingResolution>;
  remember(vehicle: VehicleSelection, context: VehicleContext | null): void;
  forget(): void;
}
export interface CatalogSnapshot {
  revision: number;
  status: 'resolving' | 'ready' | 'recovery' | 'product';
  listing?: Extract<ListingResolution, { status: 'ready' }>;
  recovery?: { reason: 'syntax' | 'unknown' | 'unavailable' | 'contract-gap'; message: string };
  presentation?: CatalogBackground;
  origin: 'hydrate' | 'pop' | 'action';
}

/** Owns activation/side effects; stale resolutions cannot commit, save or push. */
export class CatalogNavigationController {
  private sequence = 0;
  private intended?: ListingNavigationState;
  private intendedMemory: 'remember' | 'remove' | 'unchanged' = 'unchanged';
  private listeners = new Set<() => void>();
  private snapshot: CatalogSnapshot = { revision: 0, status: 'resolving', origin: 'hydrate' };
  private ports: NavigationPorts;
  constructor(ports: NavigationPorts) { this.ports = ports; }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(value: Omit<CatalogSnapshot, 'revision'>) {
    this.snapshot = { ...value, revision: this.snapshot.revision + 1 };
    this.listeners.forEach(listener => listener());
  }
  savePresentation = () => {
    const background = this.ports.capture();
    if (background && this.snapshot.status !== 'product') this.ports.replace({ ...this.ports.historyState(), roysCatalog: background });
  };
  async load(origin: 'hydrate' | 'pop' = 'hydrate') {
    const id = ++this.sequence;
    this.intended = undefined; // Popstate supersedes any uncommitted edits.
    this.intendedMemory = 'unchanged';
    const href = this.ports.href();
    const parsed = parseNavigationUrl(href);
    const presentation = parseCatalogBackground(this.ports.historyState()?.roysCatalog) ?? undefined;
    const initial = initialNavigation(parsed, parsed.status === 'absent' ? this.ports.remembered() : null);
    if (initial.source === 'recovery') {
      this.publish({ status: 'recovery', origin, recovery: { reason: 'syntax', message: 'This catalog URL contains invalid or unsupported input. Correct it or return to Part Catalog. No saved vehicle has been applied.' } });
      return;
    }
    if (initial.source === 'url' && initial.state.kind === 'product') {
      this.publish({ status: 'product', origin, listing: this.snapshot.listing });
      return;
    }
    const state = initial.source === 'url' ? initial.state as ListingNavigationState
      : initial.source === 'remembered' ? { ...emptyListing(), scope: { kind: 'vehicle' as const, vehicle: initial.vehicle } } : emptyListing();
    this.intended = state;
    this.publish({ status: 'resolving', origin });
    const resolved = await this.ports.resolve(state);
    if (id !== this.sequence) return;
    if (resolved.status === 'recovery') this.publish({ status: 'recovery', origin, recovery: resolved });
    else {
      // Freeze a bare-home convenience restoration into this history entry's
      // URL, so a later memory change cannot change what Back means. No push.
      if (parsed.status === 'absent') this.ports.replace({ ...this.ports.historyState() }, serializeNavigation(state));
      this.publish({ status: 'ready', origin, listing: resolved, presentation: presentation?.href === href ? presentation : undefined });
    }
  }
  async navigate(state: ListingNavigationState, memory: 'remember' | 'remove' | 'unchanged' = 'unchanged') {
    const id = ++this.sequence;
    this.intended = state;
    this.intendedMemory = memory;
    // Capture before loading can unmount the current results/disclosures.
    this.savePresentation();
    const resolved = await this.ports.resolve(state);
    if (id !== this.sequence) return;
    if (resolved.status === 'recovery') { this.publish({ status: 'recovery', origin: 'action', recovery: resolved }); return; }
    const href = serializeNavigation(state);
    if (memory === 'remove') this.ports.forget();
    if (memory === 'remember' && state.scope.kind === 'vehicle') this.ports.remember(state.scope.vehicle, resolved.vehicle);
    const current = parseNavigationUrl(this.ports.href());
    const currentHref = current.status === 'parsed' ? serializeNavigation(current.state) : this.ports.href();
    if (href !== currentHref) this.ports.push(href, {});
    this.intendedMemory = 'unchanged';
    this.publish({ status: 'ready', origin: 'action', listing: resolved });
  }
  transition(action: NavigationTransition) {
    const result = transitionNavigation(this.intended ?? this.snapshot.listing?.state ?? emptyListing(), action);
    if (result.navigation.status !== 'parsed' || result.navigation.state.kind === 'product') return;
    return this.navigate(result.navigation.state, result.memory === 'remove' ? 'remove'
      : action.type === 'replace-vehicle' || action.type === 'replace-engine' ? 'remember'
      : action.type === 'catalog-root' ? 'unchanged' : this.intendedMemory);
  }
  selectCategory(vehicle: VehicleSelection, category: NonNullable<ListingNavigationState['category']>) {
    return this.navigate(commitCategorySelection(this.intended ?? this.snapshot.listing?.state ?? emptyListing(), vehicle, category), 'remember');
  }
  clearFilters() {
    const state = this.intended ?? this.snapshot.listing?.state ?? emptyListing();
    return this.navigate({ ...state, filters: { sort: 'relevance', sortOrder: 'asc', page: 1 }, availability: 'all', partType: undefined,
      scope: state.scope.kind === 'vehicle' ? { kind: 'vehicle', vehicle: { ...state.scope.vehicle,
        dimensions: state.scope.vehicle.dimensions.engine_base_id ? { engine_base_id: state.scope.vehicle.dimensions.engine_base_id } : {} } } : state.scope }, this.intendedMemory);
  }
  retry() {
    return this.snapshot.origin === 'action' && this.intended ? this.navigate(this.intended, this.intendedMemory) : this.load('pop');
  }
  dispose() { this.sequence++; }
}
