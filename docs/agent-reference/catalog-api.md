# Catalog API (ERP staging gateway)

All catalog data comes from the fixed gateway `https://staging.autrex.ca/api/erp` (read-only, ERP staging). Browser code never
calls it: it calls `GET /api/catalog?resource=...` and `server/catalog-proxy.ts` maps that to `<gateway>/api/v1<path>`
(allowlist and validation: `architecture.md`). The ERP is not changed from this repo; missing capability is filed for ERP lanes.
D1575 adds a fixed on-prem LAN upstream (`http://192.168.88.233/api/erp`, landing in the on-prem upstream PR); the paths and shapes below do not change.

The client calls go through `catalogFetch(resource, params)` in `src/features/catalog/model.ts`; `src/lib/erp-api.ts` wraps them.
Reference calls (years, makes, models, engines, categories, category) are cached 5 minutes client-side; search is not.

## Endpoints

| resource | Request (query params) | Response shape the client reads | Wrapper |
|---|---|---|---|
| `years` | none (proxy adds `vehicleType=light-duty`) | `{ years: number[] }` | `vehicleApi.getYears` -> `[{year}]` |
| `makes` | `year` | `{ makes: { id: number; name: string; country?: string }[] }` | `getMakes(year)` |
| `models` | `year`, `make` (make **name**) | `{ models: { id: number; name: string }[] }` | `getModels(makeId, year)`; resolves make id to name through `makes` |
| `engines` | `year`, `make`, `model` (names) | `{ engines: { id: number; description: string }[] }`; empty list becomes a single "Engine unspecified" item with id 0 | `getEngines(modelId, year, makeId)` |
| `categories` | none | `{ data: Category[] }` | `categoryApi.getAll` (top-level) |
| `category` | `slug` | `{ data: { subcategories: Category[] } }`; only items with `mapped_part_type_count > 0` are shown | `categoryApi.getChildren` |
| `search` | see below | `SearchResult` | `partsApi.search` |

`Category` = `{ id, display_name, slug, mapped_part_type_count? }`.

### search

Request params (names exactly as the proxy allows): `q`, `year`, `make`, `model`, `engine_base_id` (sent from the selected engine id when
nonzero), `sub_model_id`, `drive_type_id`, `body_style_config_id`, `transmission_id`, `region_id`, `category` (category slug), `part_type`,
`brand`, `in_stock_only` (`all|true`), `sort` (`price|availability|relevance`), `sort_order` (`asc|desc`), `page`, `limit` (client sends 24, max 24),
`include_facets=1`, `include_vehicle_dimensions=1` (when a vehicle is selected). Rules: need `q` >= 2 chars, or `category`, or full year+make+model.
`model.ts#searchParams` builds the URL query and drops vehicle keys unless year+make+model are all set; `changeQuery` clears dependent keys.

Response (`SearchResult`):

- `results: Part[]` where `Part` = `{ sku, slug?, part_number, name, brand_name, pricing?: { price: number|null, currency }, core_charge?: number | { amount? }, availability?: { status, quantity: number|null, lead_time_days? }, sellablePackQuantity?, image_url?, fitment_summary?, applications?: [{ submodel?, engine?, position?, drive_type?, notes?: string[], qualifiers?: string[] }], fitment_qualifiers?: [{ name, value }] }`
- `pagination: { total, page, has_more, total_is_exact?, sort_complete? }`
- `facets?: { brands?: [{ brand_id, name, count }], part_types?: [{ id, name, count }] }`
- `vehicle_dimensions?: [{ dimension, label, options: [{ id, name?, description?, label?, count? }] }]` (the UI offers every dimension except `engine_base_id`)

Mapping (`mapErpPart`): `id = sku`; price is used only when `pricing.currency === 'CAD'` and a finite number >= 0, otherwise `null` and the UI
shows "Price unavailable" (`priceLabel`); `position` and `specs` come from `fitment_qualifiers`; tier and warranty are not provided by the ERP
payload and are not invented (warranty is `''`, `tier` unset); `applications[].qualifiers` are plain strings joined into
`applicationNotes`, and `fitment_summary` becomes `fitmentSummary`. Search results carry no per-application year/make/model, so the
adapter never turns the selected vehicle into a confirmed fitment (`fitments` is `[]`); untracked availability shows "Available to order" (the default lead time is not an ETA).

## Fitment tree call sequence

1. `years` -> list years (tree roots).
2. Expand a year: `makes?year=Y`.
3. Expand a make: `models?year=Y&make=<name>`.
4. Expand a model: `engines?year=Y&make=<name>&model=<name>`. Same-named model years share ERP ids, so tree keys include the full vehicle context.
5. Engine chosen: `categories` (top level), then on expand `category?slug=<slug>` for children (only mapped ones).
6. Category chosen: `search?category=<slug>&year=Y&make=<name>&model=<name>&engine_base_id=<id>&limit=24&include_facets=1&include_vehicle_dimensions=1` (+ `page`, `brand`, `in_stock_only`, dimension filters).
7. Header search: a typed `YYYY [make [model]]` string walks makes/models; any other text goes to `search?q=<text>` (part number or keyword).

Late responses are discarded by `useQuery`, so only the newest request updates the page.

## Known limits

No endpoint is used for pricing tiers, warranty, shipping quotes, tax, orders, VIN decoding or accounts. Those need ERP work and stay
placeholders. Evidence of a working end-to-end read sequence: `docs/staging-catalog-gateway.md` and `docs/evidence/d1492-staging-gateway/`.
