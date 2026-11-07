import { lazy, Suspense, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { cartApi, partsApi, type Part } from '../../lib/api';
import { WishlistProvider } from '../../contexts/WishlistContext';
import { WishlistButton } from '../../components/wishlist/WishlistButton';
import { Button } from '../../components/ui/button';
import type { PublicProduct } from '../../../server/product-document.ts';
import { useQuery } from '../../lib/hooks';

const DetailModal = lazy(async () => ({ default: (await import('../../components/ProductDetailModal')).ProductDetailModal }));

function Actions({ product }: { product: PublicProduct }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Part | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const fitments = useQuery(() => partsApi.getFitments(product.sku, page), { enabled: open && !!detail, deps: [product.sku, page] });
  const part: Part = { id: product.sku, brand: product.brand, partNumber: product.partNumber, description: product.name,
    price: product.price, stock: product.stock, purchasable: product.purchasable, currency: 'CAD', warranty: '',
    coreCharge: product.coreCharge, packQuantity: product.packQuantity, availability: product.availability, imageUrl: product.imageUrl };
  const add = async (snapshot = part) => {
    setBusy(true);
    try { await cartApi.addItem('catalog-test', product.sku, 1, snapshot); setMessage('Added to test cart. Browse the catalog to review your list.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'The test cart could not be saved.'); }
    finally { setBusy(false); }
  };
  const more = async () => {
    setDetailBusy(true); setMessage('');
    try { setDetail(detail ?? await partsApi.getProduct(product.sku)); setPage(1); setOpen(true); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Additional product details could not be loaded.'); }
    finally { setDetailBusy(false); }
  };
  const changeOpen = (value: boolean) => {
    setOpen(value);
    if (!value) requestAnimationFrame(() => trigger.current?.focus());
  };
  return <><div className="flex flex-wrap items-center gap-3">
    <Button className="bg-brand-accent text-white" disabled={busy || product.price === null || !product.purchasable} onClick={() => void add()}>Add to test cart</Button>
    <WishlistButton partId={part.id} part={part} />
    <Button variant="outline" disabled={detailBusy} onClick={event => { trigger.current = event.currentTarget; void more(); }}>{detailBusy ? 'Loading additional details…' : 'Additional product details'}</Button>
  </div>{message && <p role="status" className="mt-2 text-sm">{message}</p>}
    {open && detail && <Suspense fallback={<p role="status">Opening additional details…</p>}>
      <DetailModal part={{ ...detail, fitments: fitments.data?.fitments ?? [] }} open onOpenChange={changeOpen} onAddToCart={() => void add(detail)}
        fitmentStatus={<div className="p-3 text-sm"><p>Supplied vehicle ranges, submodels and positions do not include engine conditions. Verify application notes.</p>
          {fitments.isLoading ? <p role="status">Loading ERP fitments…</p> : fitments.error
            ? <p role="alert">{fitments.error.message} <button className="underline" onClick={() => void fitments.refetch()}>Retry fitments</button></p>
            : fitments.data && <><p>{fitments.data.total} supplied applications · Page {page} · {fitments.data.fitments.length} rows shown</p>
              <div className="flex gap-3 mt-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous fitments</Button>
                <Button variant="outline" size="sm" disabled={!fitments.data.hasMore || page >= 100} onClick={() => setPage(value => value + 1)}>Next fitments</Button></div></>}
        </div>} />
    </Suspense>}
  </>;
}

// Only imported after the shared public tree has hydrated. Existing list APIs
// own storage and its schema; neither provider nor cart code runs on the server.
export function mountProductActions(node: HTMLElement, product: PublicProduct) {
  const root = createRoot(node);
  root.render(<WishlistProvider><Actions product={product} /></WishlistProvider>);
  return () => root.unmount();
}
