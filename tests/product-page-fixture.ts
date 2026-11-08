import { escapeHtml, type ProductRenderer } from '../server/product-page.ts';

// Source HTTP fixtures test the handler independently of the build. The real
// React renderer is exercised by the post-build artifact-only release check.
export const fixtureRenderer: ProductRenderer = document => document.status === 200
  ? `<main id="product-document"><h1>${escapeHtml(document.product.name)}</h1><p>ERP SKU: ${escapeHtml(document.product.sku)}</p></main>`
  : `<main id="product-document"><h1>${escapeHtml(document.title)}</h1><p>${escapeHtml(document.message)}</p></main>`;
