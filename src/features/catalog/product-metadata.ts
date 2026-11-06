import type { Part } from '../../lib/api.ts';
import { productSchema } from '../../../server/product-data.ts';

export function syncProductSchema(document: Document, part?: Part, pendingSku?: string) {
  const nodes = [...document.querySelectorAll<HTMLScriptElement>('#product-schema')];
  let schema = nodes.shift();
  for (const duplicate of nodes) duplicate.remove();
  if (part) {
    if (!schema) { schema = document.createElement('script'); schema.id = 'product-schema'; document.head.append(schema); }
    schema.type = 'application/ld+json';
    schema.textContent = productSchema(part);
  } else {
    // Retain verified server identity while that same direct-entry SKU loads.
    // A different route, failed request or malformed node cannot retain stale data.
    try {
      const current = JSON.parse(schema?.textContent ?? 'null');
      if (pendingSku && current?.sku === pendingSku && current['@type'] === 'Product'
        && current['@context'] === 'https://schema.org' && !('offers' in current) && !('price' in current)) return;
    } catch { /* An invalid schema must not survive navigation. */ }
    schema?.remove();
  }
}
