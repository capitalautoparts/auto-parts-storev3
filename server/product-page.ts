import type { IncomingMessage, ServerResponse } from 'node:http';
import { readCatalog } from './catalog-proxy.ts';
import { mapProduct, productMeta, productSchema, productSku } from './product-data.ts';
import { publicProduct, serializeProductDocument, PRODUCT_BOOTSTRAP_ID, type ProductDocument } from './product-document.ts';

export type ProductRenderer = (document: ProductDocument) => string | Promise<string>;
const renderPackaged: ProductRenderer = async document => {
  // Resolve from the deployed server directory, never from cwd or src/. Vite
  // dev supplies its own explicit source loader; packaged runtime fails closed.
  const artifact = new URL('../dist/server/product-renderer.js', import.meta.url).href;
  const { renderProductDocument } = await import(artifact);
  return renderProductDocument(document);
};

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]!);

// The existing HTML shell supplies the hashed Vite entry and styles. Product
// content and bootstrap are rendered from one verified public model. The client
// hydrates that exact subtree; the catalog App remains a separate browser root.
export function createProductPageHandler(
  template: () => Promise<string>, fetcher: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env, localDevelopment = false, render: ProductRenderer = renderPackaged,
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
    if (!input.startsWith('/products/')) { res.statusCode = 400; return res.end('Invalid product link.'); }
    let url: URL;
    try { url = new URL(input, 'http://catalog.local'); }
    catch { res.statusCode = 400; return res.end('Invalid product link.'); }
    const sku = input.startsWith('/products/') && input.split('?', 1)[0] === url.pathname ? productSku(url.pathname) : null;
    let status = 400, title = 'Invalid product link', description = 'This product link is invalid.';
    let head = '';
    const documentPath = input.split('?', 1)[0];
    let document: ProductDocument = { version: 1, path: documentPath, status: 400, title, message: description };
    let bootstrap = '';
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
          head += `<script type="application/ld+json" id="product-schema">${productSchema(part)}</script>`;
          document = { version: 1, path: documentPath, status: 200, product: publicProduct(part) };
          bootstrap = serializeProductDocument(document);
        } catch { status = 502; head = ''; }
      }
      if (status !== 200) {
        title = status === 404 ? 'Product not found' : 'Product temporarily unavailable';
        const body = result.body as { reference?: unknown; code?: unknown } | null;
        if (body?.code === 'CATALOG_UPSTREAM_REFUSED') res.setHeader('X-Roys-Catalog-Refused', '1');
        if (typeof body?.reference === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(body.reference)) {
          res.setHeader('X-Roys-Catalog-Reference', body.reference);
        }
        description = status === 404 ? 'No product was found for this ERP SKU.' : 'The staging product could not be loaded. Please try again later.';
        if (typeof body?.reference === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(body.reference)) description += ` Reference: ${body.reference}`;
      }
    }
    if (status !== 200) {
      document = { version: 1, path: documentPath, status: status as 400 | 404 | 429 | 502 | 503, title, message: description };
      bootstrap = serializeProductDocument(document);
    }
    try {
      const html = await template();
      if (!html.includes('<div id="root"></div>') || !html.includes('</head>')) throw new Error('Invalid product template.');
      const article = await render(document);
      res.statusCode = status;
      return res.end(html.replace(/<title>[^]*?<\/title>/i, () => `<title>${escapeHtml(title)}</title>`)
        .replace(/<meta\s+name="description"[^>]*>/i, () => `<meta name="description" content="${escapeHtml(description)}" />`)
        .replace('</head>', () => `${head}</head>`)
        .replace('<div id="root"></div>', () => `<div id="root">${article}</div><script id="${PRODUCT_BOOTSTRAP_ID}" type="application/json">${bootstrap}</script>`));
    } catch { res.statusCode = 503; res.end('Product temporarily unavailable.'); }
  };
}
