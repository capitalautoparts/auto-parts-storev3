import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CarFront, ChevronRight, Search, ShoppingCart, Wrench, X } from 'lucide-react';
import { changeQuery, DIMENSIONS, MARKET, priceLabel, readCart, readQuery, safeStorage, saveStorage, searchParams } from './model';
import type { CartLine, Category, Option, Part, Query, SearchResult } from './model';
import { useCatalog } from './useCatalog';
import './catalog.css';

const params = (values: Record<string, string | undefined>) => new URLSearchParams(
  Object.entries(values).filter((entry): entry is [string, string] => !!entry[1]),
);
const vehicleName = (query: Query) => [query.year, query.make, query.model].filter(Boolean).join(' ');

function SelectField({ label, value, options, onChange, disabled = false, loading = false }: {
  label: string; value?: string; options: { value: string; label: string }[];
  onChange: (value: string) => void; disabled?: boolean; loading?: boolean;
}) {
  return <label className="field"><span>{label}</span><select aria-label={label} value={value ?? ''} disabled={disabled || loading} onChange={e => onChange(e.target.value)}>
    <option value="">{loading ? 'Loading…' : `Choose ${label.toLowerCase()}`}</option>
    {value && !options.some(option => option.value === value) && <option value={value}>{value}</option>}
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select></label>;
}
const namedOptions = (items?: Option[], byName = false) => (items ?? []).map(item => ({
  value: byName ? item.name! : String(item.id), label: item.name ?? item.description ?? item.label ?? String(item.id),
}));

function PartImage({ part }: { part: Part }) {
  const [failed, setFailed] = useState(false);
  return <div className="part-image">{part.image_url && !failed
    ? <img src={part.image_url} alt={part.name} loading="lazy" onError={() => setFailed(true)} />
    : <Wrench aria-label="Part image unavailable" size={32} />}</div>;
}

export default function CatalogExplorer() {
  const [query, setQuery] = useState<Query>(() => readQuery(location.search || safeStorage('roysauto.vehicle.v1') || ''));
  const [draft, setDraft] = useState(query.q ?? '');
  const [cart, setCart] = useState<CartLine[]>(() => readCart(safeStorage('roysauto.cart.v1')));
  const [cartOpen, setCartOpen] = useState(false);
  const [details, setDetails] = useState<Part | null>(null);
  const [notice, setNotice] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);
  const years = useCatalog<{ years: number[] }>('years', params({}));
  const makes = useCatalog<{ makes: Option[] }>('makes', query.year ? params({ year: query.year }) : null);
  const models = useCatalog<{ models: Option[] }>('models', query.year && query.make ? params({ year: query.year, make: query.make }) : null);
  const engines = useCatalog<{ engines: Option[] }>('engines', query.year && query.make && query.model ? params({ year: query.year, make: query.make, model: query.model }) : null);
  const categories = useCatalog<{ data: Category[] }>('categories', params({}));
  const rootCategory = categories.data?.data.find(item => query.category === item.slug || query.category?.startsWith(`${item.slug}-`));
  const children = useCatalog<{ data: { subcategories: Category[] } }>('category', rootCategory ? params({ slug: rootCategory.slug }) : null);
  const search = searchParams(query);
  const results = useCatalog<SearchResult>('search', search);
  const completeVehicle = !!(query.year && query.make && query.model);

  useEffect(() => {
    const pop = () => setQuery(readQuery(location.search));
    addEventListener('popstate', pop);
    return () => removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    setDraft(query.q ?? ''); setDetails(null);
    const vehicle = Object.fromEntries(Object.entries(query).filter(([key]) => ['year', 'make', 'model', ...DIMENSIONS].includes(key)));
    if (!saveStorage('roysauto.vehicle.v1', new URLSearchParams(vehicle).toString())) setStorageWarning(true);
  }, [query]);
  useEffect(() => {
    if (!saveStorage('roysauto.cart.v1', JSON.stringify(cart))) setStorageWarning(true);
  }, [cart]);

  function navigate(next: Query) {
    next = Object.fromEntries(Object.entries(next).filter(([, value]) => typeof value === 'string' && value));
    const encoded = new URLSearchParams(next).toString();
    history.pushState(null, '', encoded ? `?${encoded}` : location.pathname);
    setQuery(next); setNotice('');
  }
  const update = (key: keyof Query, value: string) => navigate(changeQuery(query, key, value));
  function savePart(part: Part) {
    if (cart.length >= 100 && !cart.some(line => line.sku === part.sku)) { setNotice('Your test cart has reached 100 different parts.'); return; }
    setCart(current => {
      const found = current.find(line => line.sku === part.sku);
      return found ? current.map(line => line.sku === part.sku ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line)
        : [...current, { sku: part.sku, name: part.name, part_number: part.part_number, quantity: 1 }];
    });
    setNotice(`${part.part_number} saved to your test cart.`);
  }
  const vehicleError = years.error || makes.error || models.error || engines.error;
  const parts = results.data?.results ?? [];
  const selectedCategory = children.data?.data.subcategories.find(item => item.slug === query.category)?.display_name ?? rootCategory?.display_name;

  return <div className="catalog-app">
    <a href="#catalog-results" className="skip-link">Skip to parts</a>
    <div className="preview-strip"><span>EXPLORATION PREVIEW</span><span>Canada · {MARKET.currency} · Staging data</span></div>
    <header className="catalog-header">
      <a className="wordmark" href="/" aria-label="RoysAuto catalog home">Roys<span>Auto</span><small>BY AUTREX</small></a>
      <form className="part-search" onSubmit={event => { event.preventDefault(); if (draft.trim().length >= 2 || !draft.trim()) update('q', draft.trim()); }} role="search">
        <label className="sr-only" htmlFor="part-search">Part number, brand or keyword</label>
        <Search size={19} aria-hidden="true" />
        <input id="part-search" type="search" value={draft} maxLength={120} minLength={2} onChange={event => setDraft(event.target.value)} placeholder="Part number, brand or keyword" />
        <button type="submit">Search</button>
      </form>
      <button className="cart-toggle" onClick={() => setCartOpen(true)}><ShoppingCart size={20} />Test cart <b>{cart.reduce((total, line) => total + line.quantity, 0)}</b></button>
    </header>

    <section className="vehicle-panel" aria-labelledby="vehicle-title">
      <div className="vehicle-heading"><CarFront size={24} /><div><h1 id="vehicle-title">Find parts for your vehicle</h1><p>{completeVehicle ? vehicleName(query) : 'Select a car, SUV, van or light truck. Or search directly by part number.'}</p></div>
        {query.year && <button className="text-button" onClick={() => navigate(Object.fromEntries(Object.entries(query).filter(([key]) => !['year', 'make', 'model', ...DIMENSIONS, 'page', 'brand', 'part_type'].includes(key))))}>Clear vehicle</button>}
      </div>
      <div className="vehicle-fields">
        <SelectField label="Year" value={query.year} options={(years.data?.years ?? []).map(year => ({ value: String(year), label: String(year) }))} loading={years.loading} onChange={value => update('year', value)} />
        <SelectField label="Make" value={query.make} options={namedOptions(makes.data?.makes, true)} disabled={!query.year} loading={makes.loading} onChange={value => update('make', value)} />
        <SelectField label="Model" value={query.model} options={namedOptions(models.data?.models, true)} disabled={!query.make} loading={models.loading} onChange={value => update('model', value)} />
        <SelectField label="Engine (optional)" value={query.engine_base_id} options={namedOptions(engines.data?.engines)} disabled={!completeVehicle} loading={engines.loading} onChange={value => update('engine_base_id', value)} />
      </div>
      {vehicleError && <p role="alert" className="error-message">{vehicleError}</p>}
    </section>

    <div className="catalog-layout">
      <aside className="category-panel" aria-label="Part categories"><div className="panel-heading"><h2>Parts catalog</h2><span>{categories.data?.data.length ?? '—'} categories</span></div>
        {categories.loading && <p role="status">Loading categories…</p>}
        {categories.error && <p role="alert" className="error-message">{categories.error}</p>}
        <nav className="category-tree" aria-label="Browse categories">
          <button className={!query.category ? 'selected' : ''} onClick={() => update('category', '')}>All categories</button>
          {categories.data?.data.map(category => <div key={category.id}>
            <button className={query.category === category.slug ? 'selected' : ''} aria-expanded={rootCategory?.slug === category.slug} onClick={() => update('category', category.slug)}><span>{category.display_name}</span><ChevronRight size={15} /></button>
            {rootCategory?.slug === category.slug && <div className="category-children">
              {children.loading && <p role="status">Loading…</p>}
              {children.error && <p role="alert">{children.error}</p>}
              {children.data?.data.subcategories.filter(child => (child.mapped_part_type_count ?? 0) > 0).map(child => <button key={child.id} className={query.category === child.slug ? 'selected' : ''} onClick={() => update('category', child.slug)}>{child.display_name}</button>)}
            </div>}
          </div>)}
        </nav>
        <p className="sidebar-note">Vehicle and catalog information comes from Autrex ERP staging.</p>
      </aside>

      <main id="catalog-results" className="results-panel" tabIndex={-1}>
        <div className="results-heading"><div><p className="eyebrow">AUTO PARTS / {completeVehicle ? vehicleName(query) : 'ALL VEHICLES'}</p><h2>{query.q ? `Results for “${query.q}”` : selectedCategory ?? 'Your next repair starts here'}</h2></div>
          {(query.q || query.category || query.brand || query.part_type) && <button className="text-button" onClick={() => navigate(Object.fromEntries(Object.entries(query).filter(([key]) => ['year', 'make', 'model', ...DIMENSIONS].includes(key))))}>Reset filters</button>}
        </div>
        {completeVehicle && <p className="fitment-notice">Showing vehicle matches. Check the engine, submodel, position and application notes before choosing a part.</p>}
        {!completeVehicle && search && <p className="fitment-notice">Browsing all vehicles. Select a complete vehicle to narrow fitment.</p>}
        {results.data?.vehicle_dimensions?.filter(dimension => DIMENSIONS.includes(dimension.dimension as typeof DIMENSIONS[number]) && dimension.dimension !== 'engine_base_id').map(dimension => <div className="dimension-filter" key={dimension.dimension}>
          <SelectField label={dimension.label} value={query[dimension.dimension as keyof Query]} options={namedOptions(dimension.options)} onChange={value => update(dimension.dimension as keyof Query, value)} />
        </div>)}
        {search && <div className="result-filters">
          <SelectField label="Brand" value={query.brand} options={(results.data?.facets?.brands ?? []).map(brand => ({ value: brand.brand_id, label: `${brand.name} (${brand.count})` }))} onChange={value => update('brand', value)} />
          <SelectField label="Part type" value={query.part_type} options={(results.data?.facets?.part_types ?? []).map(type => ({ value: type.id, label: `${type.name} (${type.count})` }))} onChange={value => update('part_type', value)} />
          <SelectField label="Sort" value={query.sort ? `${query.sort}:${query.sort_order ?? 'asc'}` : ''} options={[{ value: 'availability:asc', label: 'Availability' }, { value: 'price:asc', label: 'Price: low to high' }, { value: 'price:desc', label: 'Price: high to low' }]} onChange={value => { const [sort, direction] = value.split(':'); navigate({ ...changeQuery(query, 'sort', sort ?? ''), sort_order: direction }); }} />
          <label className="stock-filter"><input type="checkbox" checked={query.in_stock_only === 'true'} onChange={event => update('in_stock_only', event.target.checked ? 'true' : '')} /> In stock only</label>
        </div>}
        <div className="result-status" role="status">{results.loading ? 'Searching the staging catalog…' : results.data ? `${results.data.pagination.total_is_exact === false ? 'At least ' : ''}${results.data.pagination.total.toLocaleString()} matching parts` : ''}</div>
        {results.error && <div className="empty-state error-message" role="alert"><h3>We couldn’t load these parts</h3><p>{results.error}</p><button onClick={() => location.reload()}>Try again</button></div>}
        {!search && <div className="empty-state"><Wrench size={34} /><h3>Choose a vehicle or a part category</h3><p>Browse the catalog on the left, or enter a part number above. Your vehicle stays selected as you explore.</p><div className="quick-categories">{['brakes', 'suspension', 'steering', 'starting-charging'].map(slug => {
          const category = categories.data?.data.find(item => item.slug === slug);
          return category ? <button key={slug} onClick={() => update('category', slug)}>{category.display_name}<ChevronRight size={16} /></button> : null;
        })}</div></div>}
        {results.data && !parts.length && <div className="empty-state"><h3>No matching parts</h3><p>Try a different part number or remove a filter. Vehicle matches depend on the catalog coverage available in staging.</p></div>}
        {results.data?.pagination.sort_complete === false && <p className="fitment-notice">The ERP returned a partial sort. Refine the search before comparing prices.</p>}
        <div className="parts-list" aria-busy={results.loading}>
          {parts.map(part => <article className="part-row" key={part.sku}>
            <PartImage part={part} />
            <div className="part-description"><p className="part-brand">{part.brand_name}</p><h3>{part.name}</h3><p className="part-number">Part # <strong>{part.part_number}</strong></p>
              <div className="qualifiers">{part.fitment_qualifiers?.map((qualifier, index) => <span key={index}>{qualifier.name}: {qualifier.value}</span>)}</div>
              <button className="text-button" onClick={() => setDetails(part)}>Application details <ChevronRight size={14} /></button>
            </div>
            <div className="part-purchase"><strong className="part-price">{priceLabel(part)}</strong><small>{MARKET.currency} · {part.sellablePackQuantity && part.sellablePackQuantity > 1 ? `Pack of ${part.sellablePackQuantity}` : 'Per sellable unit'}</small>
              <span className="stock-status">{part.availability ? `${part.availability.status.replace(/_/g, ' ')}${part.availability.quantity > 0 ? ` · ${part.availability.quantity} available` : ''}` : 'Availability unconfirmed'}</span>
              {part.core_charge != null && <small>Core charge: {typeof part.core_charge === 'number' ? part.core_charge.toFixed(2) : part.core_charge.amount?.toFixed(2) ?? 'see ERP'} CAD</small>}
              <button className="save-part" onClick={() => savePart(part)}>Save to test cart</button>
            </div>
          </article>)}
        </div>
        {results.data && <nav className="pagination" aria-label="Results pages"><button disabled={+(query.page ?? '1') <= 1 || results.loading} onClick={() => update('page', String(+(query.page ?? '1') - 1))}>Previous</button><span>Page {query.page ?? '1'}</span><button disabled={!results.data.pagination.has_more || results.loading || +(query.page ?? '1') >= 100} onClick={() => update('page', String(+(query.page ?? '1') + 1))}>Next</button></nav>}
      </main>
    </div>
    <div className="cart-notice" role="status" aria-live="polite">{notice}</div>
    {storageWarning && <p role="alert" className="storage-warning">Browser storage is unavailable. Your vehicle and test cart will last only for this visit.</p>}
    <footer className="catalog-footer"><strong>RoysAuto by Autrex</strong><span>Catalog exploration only. Checkout is disabled. Prices and stock are staging data.</span></footer>

    <Dialog.Root open={!!details} onOpenChange={open => { if (!open) setDetails(null); }}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="catalog-dialog">
      <Dialog.Title>{details?.name}</Dialog.Title><Dialog.Description>Part # {details?.part_number}. Review every applicable condition; vehicle selection does not guarantee fit.</Dialog.Description>
      {details && <><p className="part-brand">{details.brand_name}</p><p>{details.fitment_summary ?? 'Select a vehicle to check application coverage.'}</p>
        {details.fitment_qualifiers?.map((item, i) => <p key={i}>{item.name}: {item.value}</p>)}
        <h3>Application notes</h3>{details.applications?.length ? <ul className="application-list">{details.applications.map((application, index) => <li key={index}>
          <strong>{[application.submodel, application.engine, application.drive_type, application.position].filter(Boolean).join(' · ') || 'Application'}</strong>
          {application.notes?.map((note, i) => <p key={i}>{note}</p>)}
          {application.qualifiers?.map((item, i) => <p key={i}>{[item.name, item.value, item.text].filter(Boolean).join(': ')}</p>)}
        </li>)}</ul> : <p>No application notes were supplied for this search. Verify fitment before purchase.</p>}
        <button className="save-part" onClick={() => { savePart(details); setDetails(null); }}>Save to test cart</button></>}
      <Dialog.Close className="dialog-close" aria-label="Close application details"><X size={22} /></Dialog.Close>
    </Dialog.Content></Dialog.Portal></Dialog.Root>

    <Dialog.Root open={cartOpen} onOpenChange={setCartOpen}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="catalog-dialog">
      <Dialog.Title>Your test cart</Dialog.Title><Dialog.Description>Saved on this browser for exploration. Nothing is ordered or reserved. Prices, stock and fitment must be rechecked before any future checkout.</Dialog.Description>
      {!cart.length && <p>Your cart is empty. Save a part to compare options.</p>}
      {cart.map(line => <div className="cart-line" key={line.sku}><div><strong>{line.name}</strong><p>Part # {line.part_number}</p></div><label>Qty<select aria-label={`Quantity for ${line.part_number}`} value={line.quantity} onChange={event => setCart(current => current.map(item => item.sku === line.sku ? { ...item, quantity: +event.target.value } : item))}>{Array.from({ length: 99 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select></label><button className="text-button" onClick={() => setCart(current => current.filter(item => item.sku !== line.sku))}>Remove</button></div>)}
      <p className="fitment-notice">Checkout is disabled in this preview. Helcim is planned for a later phase.</p>
      <Dialog.Close className="dialog-close" aria-label="Close test cart"><X size={22} /></Dialog.Close>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}
