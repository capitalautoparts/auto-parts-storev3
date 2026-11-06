import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import { categoryApi, vehicleApi } from '../../lib/erp-api.ts';
import { safeStorage, saveStorage } from './model.ts';
import { CatalogNavigationController } from './navigation-controller.ts';
import { parseNavigationUrl } from './navigation-state.ts';
import { captureCatalogPresentation } from './navigation-presentation.ts';
import type { VehicleSelection } from './navigation-state.ts';
import { resolveListing } from './navigation-resolver.ts';
import type { TreeSidebarHandle } from '../../components/TreeSidebar.tsx';

const VEHICLE_KEY = 'roysauto.original-vehicle.v1';
export function readRememberedVehicle(): VehicleSelection | null {
  try {
    const value = JSON.parse(safeStorage(VEHICLE_KEY) ?? 'null');
    if (!value || typeof value !== 'object' || !Number.isInteger(value.year)
      || !['makeName', 'modelName'].every(key => typeof value[key] === 'string' && value[key].trim())) return null;
    const params = new URLSearchParams({ year: String(value.year), make: value.makeName, model: value.modelName,
      ...(value.engineId ? { engine_base_id: String(value.engineId) } : {}), ...value.dimensions });
    const parsed = parseNavigationUrl(`/?${params}`);
    return parsed.status === 'parsed' && parsed.state.kind !== 'product' && parsed.state.scope.kind === 'vehicle' ? parsed.state.scope.vehicle : null;
  } catch { return null; }
}

export function useCatalogNavigation(main: RefObject<HTMLElement>, tree: RefObject<TreeSidebarHandle>) {
  const [notice, setNotice] = useState('');
  const restoring = useRef(true);
  const [controller] = useState(() => {
    const forget = () => {
      if (saveStorage(VEHICLE_KEY, 'null')) return true;
      try { localStorage.removeItem(VEHICLE_KEY); return true; } catch { return false; }
    };
    return new CatalogNavigationController({
      href: () => window.location.pathname + window.location.search + window.location.hash,
      historyState: () => window.history.state,
      push: (href, state) => window.history.pushState(state, '', href),
      replace: (state, href) => window.history.replaceState(state, '', href),
      capture: () => {
        if (restoring.current || !main.current) return null;
        const active = document.activeElement;
        const href = window.location.pathname + window.location.search;
        return captureCatalogPresentation(main.current, href, tree.current?.captureDisclosure(), active instanceof HTMLElement ? active : null);
      },
      remembered: readRememberedVehicle,
      resolve: state => resolveListing(state, { ...vehicleApi, getCategories: categoryApi.getAll, getChildren: categoryApi.getChildren }),
      remember: (selection, context) => {
        setNotice('');
        const saved = { ...context, dimensions: selection.dimensions };
        if (!saveStorage(VEHICLE_KEY, JSON.stringify(saved))) setNotice(forget()
          ? 'Your vehicle could not be saved in this browser. Select it again after reload.'
          : 'Your vehicle could not be saved in this browser. A previous vehicle may return after reload.');
      },
      forget: () => setNotice(forget() ? '' : 'Vehicle cleared for this visit. The saved choice could not be cleared; it may return after reload. Retry before reloading.'),
    });
  });
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => {
    const pop = () => { restoring.current = true; void controller.load('pop'); };
    const capture = () => controller.savePresentation();
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    window.addEventListener('popstate', pop);
    window.addEventListener('roys:catalog-capture', capture);
    void controller.load();
    return () => {
      controller.dispose();
      window.history.scrollRestoration = previous;
      window.removeEventListener('popstate', pop);
      window.removeEventListener('roys:catalog-capture', capture);
    };
  }, [controller]);
  return { controller, snapshot, notice, restoring };
}
