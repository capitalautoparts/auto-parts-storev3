import type { MouseEvent } from 'react';
import { productPath, validSku } from '../../../server/product-data.ts';

export function followProduct(event: MouseEvent<HTMLAnchorElement>, sku: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (!validSku(sku)) return;
  const path = productPath(sku);
  if (window.location.pathname === path) return;
  window.history.pushState({ roysProductOverlay: true }, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function closeProduct() {
  if (window.history.state?.roysProductOverlay === true) window.history.back();
  else {
    window.history.replaceState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}
