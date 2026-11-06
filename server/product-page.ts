import type { IncomingMessage, ServerResponse } from 'node:http';
import { readCatalog } from './catalog-proxy.ts';
import { mapProduct, productMeta, productSku } from './product-data.ts';

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]!);

// The existing HTML shell supplies the hashed Vite entry and styles. Product
// identity is in the response body even with JavaScript disabled. React removes
// the document fallback only after taking over the same-page detail dialog.
export function createProductPageHandler(
  template: () => Promise<string>, fetcher: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env, localDevelopment = false,
) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET'); res.statusCode = 405;
      return res.end('Method not allowed.');
    }
    const input = req.url ?? '';
    const url = new URL(input, 'http://catalog.local');
    const sku = input.startsWith('/products/') && !input.startsWith('//') ? productSku(url.pathname) : null;
    let status = 400, title = 'Invalid product link', description = 'This product link is invalid.';
    let head = '', article = '';
    if (sku) {
      const result = await readCatalog(`/api/catalog?${new URLSearchParams({ resource: 'product', sku })}`, fetcher, env, localDevelopment);
      status = result.status;
      if (status === 200) {
        try {
          const part = mapProduct(result.body, sku), meta = productMeta(part);
          title = meta.title; description = meta.description;
          head = `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`;
          // No upstream SEO HTML or schema is trusted; no offers/price metadata
          // is emitted until an integrated price contract has been accepted.
          const schema = { '@context': 'https://schema.org', '@type': 'Product', sku,
            name: part.description, mpn: part.partNumber, brand: { '@type': 'Brand', name: part.brand }, description };
          head += `<script type="application/ld+json" id="product-schema">${JSON.stringify(schema).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')}</script>`;
          article = `<h1>${escapeHtml(part.description)}</h1><p>${escapeHtml(part.brand)} ${escapeHtml(part.partNumber)}</p><p>ERP SKU: ${escapeHtml(sku)}</p><p>${escapeHtml(part.descriptionText || description)}</p>`;
        } catch { status = 502; }
      }
      if (status !== 200) {
        title = status === 404 ? 'Product not found' : 'Product temporarily unavailable';
        const body = result.body as { reference?: unknown } | null;
        description = status === 404 ? 'No product was found for this ERP SKU.' : 'The staging product could not be loaded. Please try again later.';
        if (typeof body?.reference === 'string') description += ` Reference: ${body.reference}`;
      }
    }
    if (status !== 200) article = `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p>`;
    try {
      const html = await template();
      res.statusCode = status;
      return res.end(html.replace(/<title>[^]*?<\/title>/i, () => `<title>${escapeHtml(title)}</title>`)
        .replace(/<meta\s+name="description"[^>]*>/i, () => `<meta name="description" content="${escapeHtml(description)}" />`)
        .replace('</head>', () => `${head}</head>`)
        .replace('<div id="root">', () => `<article id="product-document">${article}<p>Canada / CAD · ERP staging · Checkout disabled.</p><a href="/">Browse the catalog</a></article><div id="root">`));
    } catch { res.statusCode = 503; res.end('Product temporarily unavailable.'); }
  };
}
