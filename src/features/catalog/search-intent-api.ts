import { vehicleApi } from '../../lib/erp-api.ts';
import { interpretSearch, loadIntentEngines } from './search-intent.ts';
import type { InterpretSearchInput, VehicleIntentCandidate } from './search-intent.ts';

/** Opt-in RP3 entry points. References reuse Roys' existing same-origin cache.
 * No listing/facet fetch, category-tree scan, new cache or UI activation. */
export const searchIntentApi = {
  interpret(input: InterpretSearchInput) { return interpretSearch(input, vehicleApi); },
  engines(candidate: VehicleIntentCandidate, options: Pick<InterpretSearchInput, 'signal' | 'timeoutMs'> = {}) {
    return loadIntentEngines(candidate, vehicleApi, options);
  },
};
