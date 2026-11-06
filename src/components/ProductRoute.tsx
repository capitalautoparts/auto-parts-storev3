import { useEffect, useState } from 'react';
import { ProductDetailModal } from './ProductDetailModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { partsApi, type Part } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { closeProduct } from '@/features/catalog/product-navigation';
import { syncProductSchema } from '@/features/catalog/product-metadata';
import { productMeta, productSku } from '../../server/product-data.ts';

export function ProductRoute({ onAddToCart }: { onAddToCart: (id: string | number, part?: Part) => void }) {
  const [pathname, setPathname] = useState(window.location.pathname);
  const [fitmentPage, setFitmentPage] = useState(1);
  const sku = productSku(pathname), isProduct = pathname.startsWith('/products/');
  useEffect(() => {
    const update = () => { setPathname(window.location.pathname); setFitmentPage(1); };
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const product = useQuery(() => partsApi.getProduct(sku!), { enabled: !!sku, deps: [sku] });
  const fitments = useQuery(() => partsApi.getFitments(sku!, fitmentPage), { enabled: !!sku && !!product.data, deps: [sku, !!product.data, fitmentPage] });
  useEffect(() => {
    document.getElementById('product-document')?.remove();
    syncProductSchema(document, product.data, product.isLoading && sku ? sku : undefined);
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (product.data) {
      const meta = productMeta(product.data);
      document.title = meta.title;
      if (description) description.content = meta.description;
      if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
      canonical.href = meta.canonical;
    } else {
      document.title = isProduct ? 'Product details | Roy’s Auto' : 'Roy’s Auto | Catalog preview';
      if (description) description.content = 'Roy’s Auto — auto parts catalog exploration for Canada.';
      canonical?.remove();
    }
  }, [product.data, product.isLoading, sku, isProduct]);
  if (!isProduct) return null;
  if (!product.data) return <Dialog open onOpenChange={open => { if (!open) closeProduct(); }}>
    <DialogContent className="bg-white max-w-2xl">
      <DialogHeader><DialogTitle>{sku ? 'Product details' : 'Invalid product link'}</DialogTitle>
        <DialogDescription>Canada / CAD · ERP staging</DialogDescription></DialogHeader>
      {product.isLoading ? <p role="status">Loading ERP product…</p> : <div role="alert">
        <p>{sku ? product.error?.message ?? 'Product unavailable.' : 'This product link is invalid.'}</p>
        {sku && <Button variant="outline" onClick={() => void product.refetch()}>Retry</Button>}
      </div>}
      <Button variant="outline" onClick={closeProduct}>Return to catalog</Button>
    </DialogContent>
  </Dialog>;
  const part = { ...product.data, fitments: fitments.data?.fitments ?? [] };
  return <ProductDetailModal part={part} open onOpenChange={open => { if (!open) closeProduct(); }}
    onAddToCart={id => onAddToCart(id, product.data)}
    fitmentStatus={<div className="p-3 text-sm">
      <p>ERP applications list vehicle ranges, submodels and positions. Engine conditions are not supplied in these rows; verify the application notes.</p>
      {fitments.isLoading ? <p role="status">Loading ERP fitments…</p> : fitments.error ? <div role="alert">{fitments.error.message} <button className="underline" onClick={() => void fitments.refetch()}>Retry fitments</button></div> : fitments.data && <>
        <p>{fitments.data.total} supplied applications · Page {fitmentPage} · {fitments.data.fitments.length} rows shown</p>
        <div className="flex gap-3 mt-2"><Button variant="outline" size="sm" disabled={fitmentPage <= 1} onClick={() => setFitmentPage(page => page - 1)}>Previous fitments</Button>
          <Button variant="outline" size="sm" disabled={!fitments.data.hasMore || fitmentPage >= 100} onClick={() => setFitmentPage(page => page + 1)}>Next fitments</Button></div>
      </>}
    </div>} />;
}
