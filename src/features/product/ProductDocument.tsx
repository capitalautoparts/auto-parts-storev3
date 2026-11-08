import type { ProductDocument as DocumentData } from '../../../server/product-document.ts';
import { availabilitySummary } from '../../lib/availability.ts';

const cad = (amount: number) => `CAD $${amount.toFixed(2)}`;

/** The same public-only subtree is rendered on Node and hydrated by the browser. */
export function ProductDocument({ document }: { document: DocumentData }) {
  const product = document.status === 200 ? document.product : null;
  const availability = product ? availabilitySummary(product) : null;
  return <main id="product-document" className="mx-auto max-w-5xl px-4 py-6 sm:px-8 text-brand-ink bg-white min-h-screen break-words">
    <a href="/" className="underline text-brand-accent">Browse the catalog</a>
    <p className="text-sm text-gray-600 mt-4">Canada / CAD · ERP staging · Checkout disabled.</p>
    {product ? <>
      <h1 className="text-2xl sm:text-3xl font-bold mt-4">{product.name}</h1>
      <p className="mt-2 font-semibold">{product.brand} · {product.partNumber}</p>
      <p className="text-sm mt-1">ERP SKU: {product.sku}</p>
      {product.imageUrl && <img src={product.imageUrl} alt={`${product.brand} ${product.partNumber}`} width="240" height="240" className="mt-4 h-48 w-48 sm:h-60 sm:w-60 object-contain border rounded" />}
      <section aria-label="Current supplied product state" className="mt-6 p-4 border rounded">
        <p className="font-semibold">{product.price === null ? 'Price unavailable' : cad(product.price)}</p>
        <p>CAD · {product.packQuantity > 1 ? `pack of ${product.packQuantity}` : 'sellable unit'}</p>
        <p>Pack quantity: {product.packQuantity}</p>
        {product.coreCharge !== null && <p>Core charge: {cad(product.coreCharge)}</p>}
        <p>{availability?.label}{availability?.confirmedStock && product.stock > 0 ? ` (${product.stock} available)` : ''}</p>
      </section>
      <div id="product-actions" className="mt-4" aria-live="polite" />
      {product.descriptions.length > 0 && <section className="mt-6" aria-labelledby="product-description-heading">
        <h2 id="product-description-heading" className="font-bold text-xl">Description</h2>
        {product.descriptions.map((row, index) => <p key={index} lang={row.language} className="mt-3 whitespace-pre-wrap">{row.text}</p>)}
      </section>}
      {product.specifications.length > 0 && <section className="mt-6" aria-labelledby="product-specifications-heading">
        <h2 id="product-specifications-heading" className="font-bold text-xl">Supplied specifications</h2>
        <dl className="mt-3 divide-y">{product.specifications.map((row, index) => <div key={index} className="py-2 sm:grid sm:grid-cols-2 gap-4">
          <dt className="font-semibold">{row.name}</dt><dd className="whitespace-pre-wrap">{row.value}{row.unit ? ` ${row.unit}` : ''}</dd>
        </div>)}</dl>
      </section>}
      {product.conditions.length > 0 && <section className="mt-6" aria-labelledby="product-conditions-heading">
        <h2 id="product-conditions-heading" className="font-bold text-xl">Supplied application conditions</h2>
        <ul className="list-disc pl-5 mt-3">{product.conditions.map((note, index) => <li key={index}>{note}</li>)}</ul>
      </section>}
      <p className="mt-6 text-sm text-gray-600">Verify the vehicle application before choosing a part. This document does not confirm fitment for a selected vehicle.</p>
    </> : <section className="mt-6" role="alert"><h1 className="text-2xl font-bold">{document.status !== 200 && document.title}</h1>
      <p className="mt-3">{document.status !== 200 && document.message}</p></section>}
  </main>;
}
