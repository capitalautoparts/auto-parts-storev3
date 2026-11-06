import type { MouseEvent } from 'react';
import { productPath, validSku } from '../../../server/product-data.ts';
import { parseCatalogBackground } from './navigation-state.ts';

export function followProduct(event: MouseEvent<HTMLAnchorElement>, sku: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!validSku(sku)) return;
  event.preventDefault();
  const path = productPath(sku);
  if (window.location.pathname === path) return;
  window.dispatchEvent(new Event('roys:catalog-capture'));
  const background = parseCatalogBackground(window.history.state?.roysCatalog);
  window.history.pushState({ roysProductOverlay: !!background, ...(background ? { roysProductBackground: background } : {}) }, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function closeProduct() {
  if (window.history.state?.roysProductOverlay === true && parseCatalogBackground(window.history.state?.roysProductBackground)) window.history.back();
  else {
    window.history.replaceState(null, '', '/?scope=all');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}
