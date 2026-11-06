# Roy's Auto: RockAuto parity roadmap (Phase 2)

Status: plan only. No code changes ship with this document.
Owner: Roy's Auto orchestrator. Date: 2026-11-06.

Goal: make the Roy's Auto catalog feel like a wholesaler's catalog. That means an
instant vehicle tree, dense tables that show several price tiers per part, in-tree
"in cart" markers, and quick part-number lookup. Checkout stays closed until Brian
opens it.

## 1. Evidence and method

- Repo files read: `AGENTS.md`, `README.md`, `API_SPEC.md`, `docs/*.md`,
  `server/catalog-proxy.ts`, `src/lib/erp-api.ts`, `src/lib/api.ts`,
  `src/features/catalog/model.ts`, `src/App.tsx`, and `src/components/{TreeSidebar,PartsTable,RightCartPanel,VehicleSearchBar,ProductDetailModal,Header}.tsx`.
- Mockups: `/srv/dev/reports/infra/roysauto-2026-11-06/roys-auto-storefront-{desktop,mobile}.png`.
  They show a year > make > model > engine > category > part-type tree, rows grouped by
  position (REAR), a Tier badge column (Daily Driver, Premium), warranty text, a stock
  tick, an Add button, a Quick Cart, and nav items Order Status, VIN Lookup, Part Number
  Search, Tools.
- ERP read-only inspection (`/srv/dev/AutoProPartsERP`, `rg` only): the public API routers
  under `server/src/routes/public-api/v1/*.ts`, and the browser allowlist in
  `/srv/dev/capautov3/src/lib/api/erp-browser-policy.ts`.
- RockAuto: two normal page fetches from VM510 (home page and help page, both HTTP 200;
  a catalog-page fetch was attempted but not read). No crawling and no automation. The pages are heavy JS apps, so
  the behaviour column below combines what those pages showed with general knowledge,
  and I label it that way. What the pages showed: top nav "Part Catalog | Part Number
  Search | Tools & Universal Parts | Cart | Account"; footer links "Order Status &
  Returns", "Warranties", "Promotions & Rebates", "Gift Certificates"; home copy "Click
  make to choose vehicle and see parts that fit. All parts with prices are in stock";
  and "Placing an order: add parts to cart, enter country & ..." (the shipping estimate
  runs before sign-in). Everything else is general knowledge, not fetched. Verify it
  visually before copying any specific layout.
- Copy behaviours, never RockAuto's trade dress, text, logos or images. Roy's Auto keeps
  its own visual identity (the mockups).

## 2. Current state

What the repo does today (single-page Vite/React app plus one serverless catalog proxy):

- Tree: `TreeSidebar.tsx` is a year > make > model > engine > category > part-type
  tree, backed by `vehicleApi` and `categoryApi` in `src/lib/erp-api.ts`. Reference
  calls are cached in memory for 5 minutes with in-flight dedupe (`reference()`, 150
  entries). Category children are filtered by `mapped_part_type_count`, which is global, not per
  vehicle, so empty part types can still appear for a given vehicle (ask E3).
- Results: `App.tsx` calls `partsApi.search` (24 per page, facets, vehicle dimensions)
  and renders `PartsTable.tsx`, grouped by position, with a Tier column and a warranty
  line. `mapErpPart` never sets `tier`, and sets `warranty: ''`, so those two cells are
  always empty. The only filters are a brand facet, vehicle dimensions and an
  in-stock toggle. The table is paged with Previous/Next, not virtualized.
- Search: header text search is `q` against `/search`; `VehicleSearchBar.tsx` also
  parses "2013 Hyundai Elantra" style text into vehicle steps.
- Cart: `cartApi` is browser-local (`roysauto.original-cart.v1` in localStorage,
  max 100 lines, qty 1-99). `RightCartPanel.tsx` is the Quick Cart. Its shipping options
  are mock data, and `onCheckout` only toasts "Checkout is disabled".
- Header (`Header.tsx`): VIN Lookup, Order Status, Help and Wishlist exist as UI
  entries. None is connected to data. Wishlist is local.
- Saved vehicle: one vehicle in localStorage (`roysauto.original-vehicle.v1`, `App.tsx`).
- Proxy: `server/catalog-proxy.ts` accepts GET only, with a fixed upstream
  `https://staging.autrex.ca/api/erp` and exactly seven resources: `years`, `makes`,
  `models`, `engines`, `categories`, `category` (slug) and `search`. Search params:
  `q`, year/make/model, `engine_base_id`, `sub_model_id`, `drive_type_id`,
  `body_style_config_id`, `transmission_id`, `region_id`, `category`, `part_type`,
  `brand`, `in_stock_only`, `sort` (price, availability, relevance), `sort_order`,
  `page` (max 100), `limit` (max 24), `include_facets`, `include_vehicle_dimensions`.
  It replies `Cache-Control: no-store`, rejects `X-ERP-Stub`, caps responses at 2 MB and
  times out at 15 s.

Constraints that bind every WP below:

| Rule | Meaning for this roadmap |
| --- | --- |
| D1492 | Canada / CAD first (`MARKET` in `model.ts`). ERP staging reads only. Protected previews and the existing main test site. No new credentials, production domains, Shopify checkout, payment processing or business-data mutations. |
| D1575 | The catalog-connected test site moves to our own servers, same pattern as capautov3 staging, and reads ERP staging over the LAN, not through Cloudflare. That is an infra-owned PR and swaps the single fixed upstream in `server/catalog-proxy.ts`. This roadmap must not add a second upstream. |
| Checkout | Disabled until Brian opens it. Every WP that touches order placement, payment or customer accounts is marked **blocked until Brian opens checkout**. |
| Browser | No credentials or database URL in the browser or this repo. Browser calls go only to same-origin `/api/catalog`. |
| ERP | This repo never changes the ERP. Missing ERP behaviour becomes an ask in section 6 for the ERP lanes. |

Important distinction. Two things are not the same:

1. A route the ERP already serves and the capautov3 browser policy already permits. Using
   it from Roy's Auto needs only a Roy's proxy allowlist edit (small repo change, no
   ERP change). Marked **proxy+** below.
2. Behaviour the ERP does not expose publicly at all. That needs ERP API work.
   Marked **ERP ask**.

## 3. Pattern matrix

Legend for "ERP gateway today": the seven resources in the Roy's proxy. "proxy+" means
the ERP route exists and is in `erp-browser-policy.ts`, so only the Roy's proxy
allowlist grows. ERP routes are in `AutoProPartsERP/server/src/routes/public-api/v1/`.

| # | Pattern | RockAuto behaviour | Roy's Auto today | ERP gateway support today | ERP API work needed | WP |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Instant catalog tree (year > make > model > engine > category > part type) | One page, tree expands in place on click, no full reload, URL is the tree path (deep-linkable). | Tree exists in `TreeSidebar.tsx`. State is not in the URL. No prefetch. | Yes: `years`, `makes`, `models`, `engines`, `categories`, `category`. | Optional: one call returning part-type counts for a vehicle and category (ask E3), so empty branches never show. Optional: submodels route (policy permits `vehicles/submodels`, **proxy+**). | R1, R2 |
| 2 | Breadcrumb and deep links | Path of the tree is in the URL and back button works. | Heading line in `App.tsx` only. | Not needed. | None. | R1 |
| 3 | Part-number search | Dedicated "Part Number Search" tab, accepts brand-agnostic number. | `q` in the header search, 2-character minimum. | Yes via `search?q=`. Quality of exact-match ranking is untested. | Ask E2 only if exact/normalized part-number match is weak. | R3 |
| 4 | Interchange / cross-reference | Part number search also shows OE and aftermarket equivalents. | `Part.interchanges` type and an "Interchanges" tab in `ProductDetailModal.tsx`. Never populated. | Not in the Roy's proxy. ERP has `GET /v1/interchange/:partNumber`, `/v1/interchange/search` (`public-api/v1/interchange.ts`) and `/v1/products/:sku/interchanges`. All are permitted by `erp-browser-policy.ts`. | **proxy+**. Ask E2 only for response shape gaps. | R6 |
| 5 | VIN lookup | Not a core RockAuto feature (it is vehicle picker based). Roy's mockup shows a VIN Lookup button. | Header button only. | No. `server/src/routes/vin.ts` (`POST /decode`) requires staff permission `products:View`. Not in the browser policy. Related: `fitment/resolve-vehicle` exists. | **ERP ask E1**: public VIN decode returning year/make/model/engine ids. | R8 |
| 6 | Multiple tiers per part (economy / daily driver / premium) | Each part type lists several brands at different prices and quality, grouped by position, cheapest first. | Tier column exists, never populated. Position grouping works. | Brands and prices are returned in `search`. There is no explicit tier or quality field. | **ERP ask E4**: `quality_tier` and `warranty` on each search result. Until then R4 may derive tiers client-side from price rank within a part type, labelled "Price tier". | R4 |
| 7 | Position (front/rear/left/right) | Position is a first-class group heading. | Grouped by `fitment_qualifiers` "position". | Yes if the qualifier is present. Policy also permits `pcdb/positions`. | None for now. | R4 |
| 8 | Warranty | Warranty shown per listing and on a Warranties page. | `warranty` field is `''` always. UI row hidden. | Not exposed. | **ERP ask E4** (same). | R4 |
| 9 | Dense fast tables, wholesaler feel | Compact rows, no pagination feeling, many brands visible, prices prominent. | 24 per page, paged. Rows are tall (see mockup). | Page size capped at 24 by Roy's proxy. | Optional: raise the limit if ERP allows (ask E7). | R5 |
| 10 | In-tree "in cart" markers | Part types in the tree carry a cart marker. | None. | Not needed (cart is local). | None. Needs part-type id on each cart line, which the search result must carry (ask E4 includes `part_type_id`). | R2 |
| 11 | Cart persistence | Cart kept in account or session. | localStorage, 100 line cap. | Not needed for guest cart. | Server cart is **blocked until Brian opens checkout**. | R10 |
| 12 | Saved vehicles / garage | Account garage, recent vehicles. | One saved vehicle in localStorage. | ERP has `public-api/v1/garage.ts` and `account.ts` (`GET /garage`, needs account login). Not in the browser policy for guests. | Guest garage stays local (no ERP). Account garage is **blocked until Brian opens checkout/accounts**. | R7 |
| 13 | Shipping-cost estimator | Estimate by destination before sign-in. | Mock options in `RightCartPanel.tsx`. | No. ERP has `POST /erp/shipping/calculate` in the policy (POST list) and `GET /v1/shipping-cutoff`. Roy's proxy is GET-only. | **ERP ask E5**: read-only estimate by postal code and cart lines. Needs a POST allowlist decision by Brian (read-only but not GET). | R9 |
| 14 | Order status lookup | Order Status & Returns page, lookup by order number and email. | Header link only. | `GET public/track/:orderNumber` is in the policy (`api/public/track/*`), but there are no real orders on a catalog-only test site. | **ERP ask E6**: lookup requires email or token. Test with staging orders only. **Blocked until Brian opens checkout.** | R11 |
| 15 | Returns / warranty info | Static policy pages. | Help button, no content. | Not ERP data. | None. Content comes from Roy's business owner. Static pages in repo. | R12 |
| 16 | Multiple warehouses / ship-from | Each listing shows the warehouse and per-warehouse ship cost. | `availability.quantity` and `lead_time_days` only. | `GET /v1/locations` exists and is in the policy (`api/public/v1/locations`). `availability`, `shipping-cutoff` exist (**proxy+**). | **ERP ask E4** to carry `ship_from` in results. | R9 |
| 17 | Core charges | Shown as a separate line, added to the price. | `coreCharge` is mapped and displayed. | Yes (`core_charge` in `search`). | None. | R4 |
| 18 | Part images, specs, "more info" | Thumbnail and an info link on each row. | `ProductImage`, `ProductDetailModal` tabs. Spec data from `fitment_qualifiers`. | `search` returns `image_url`. `GET /v1/products/:sku` and `/fitments` are **proxy+**. | None expected. | R6 |
| 19 | Closeout / promotions feel | Closeout and promotion banners, rebates. | None. | `public/v1/promotions/active` and `rebates/active` are in the policy (**proxy+**). | Ask E8 if a closeout flag per part is wanted. | R12 |
| 20 | Year/make search convenience | Typeahead for vehicle. | Parsing in `vehicleApi.search`. | Covered by existing routes. | None. | R1 |

## 4. Performance budgets (1M-part catalog)

| Interaction | Budget | Notes |
| --- | --- | --- |
| Tree node expand (years, makes, models, engines, category children) | **< 150 ms** from click to children painted, p95 | Cold data may use a skeleton. The warm path must hit the cache. |
| Part-type click to first table rows | < 500 ms p95 (stretch goal, not a hard gate) | Search with fitment is heavier than a tree node. |
| Search (text or part number) to first results | **< 300 ms p95** server round trip | Measured at the proxy. |
| Add to cart, marker update | < 50 ms | Local state only. |
| Table scroll | 60 fps with 500 rows | Virtualized. |

Caching strategy:

1. Proxy: reference routes (`years`, `makes`, `models`, `engines`, `categories`,
   `category`) change rarely. Today the Roy's handler sends `Cache-Control: no-store`
   on everything. Change reference routes to `public, max-age=300, stale-while-revalidate=3600`
   and keep `no-store` for `search`. capautov3 already caches static VCDB paths for
   1 h at the edge with 24 h stale-while-revalidate (see its ERP route handler, around
   the "Static VCDB/fitment paths" comment), which is the model. Do this in WP-R1.
2. Browser: keep the in-memory `reference()` cache. Add a persistent, versioned
   `sessionStorage` copy of the year list and last vehicle's branches so a reload
   expands instantly. Respect the existing storage-failure handling (`safeStorage`).
3. Prefetch: on expanding a node, prefetch its likely first child (most recent vehicle,
   first make); on hover or focus of a node for 120 ms, prefetch its children.
   Bound it: max 2 parallel prefetches, abort on navigation.
4. Search: debounce 150 ms, abort the previous request, and cache the last 20 search
   keys for 60 s. Sort and filter changes reuse facets.
5. Tables: virtualize rows (windowing) once a result set exceeds 100 rows, and fetch
   by cursor or page chunks, not full lists.

How to measure:

- Browser: a Playwright run on VM511 using Firefox, with `performance.now()` marks
  around click and the first painted child row (`data-testid="tree-children"`), 30
  samples per node type, report p50 and p95. Discard 3 warm-up runs.
  Use the same script at desktop 1440 and mobile 390, with Firefox CPU throttling
  at 4x for mobile.
- Proxy: log `Server-Timing: erp;dur=<ms>, proxy;dur=<ms>` on every `/api/catalog`
  response (WP-R1). A VM511 script replays 200 representative requests (tree and
  search) against staging and reports p50/p95 for `erp` and `proxy` separately.
  This keeps the budget honest when ERP, not the UI, is the slow part.
- Gate: a `docs/evidence/perf-*.json` artifact in each PR that changes the tree or
  search. Run custom measurements on VM511, never on VM510.
- ERP-side budget (for the ERP lanes): 80 ms p95 for reference routes and 200 ms p95
  for `search`, so the proxy hop stays inside 300 ms.

## 5. Phased work packages

Size: S is under half a day, M is 1-2 days, L is 3+ days. "Servable now" means the
WP works with today's seven proxy resources and no ERP change.
Visual check for every UI WP: integrated page, Firefox on VM511, desktop 1440 and
mobile 390, both screenshots attached to the PR. Do not duplicate active CI.

### Phase A: servable with the existing gateway

**WP-R1: Tree polish, breadcrumb and fast reference data** (M, servable now: yes)
- Goal: tree feels instant and is deep-linkable.
- Scope: `src/components/TreeSidebar.tsx`, `src/App.tsx`, `src/lib/erp-api.ts`,
  `server/catalog-proxy.ts` (cache headers and `Server-Timing` only, same upstream),
  `tests/catalog.test.ts`.
- Dependencies: none.
- Acceptance:
  - Tree path is mirrored in the URL query (`year`, `make`, `model`, `engine`, `category`,
    `part_type`) and reload or Back restores it.
  - A breadcrumb above the results shows each level and each is clickable.
  - Reference routes respond with a cacheable `Cache-Control`, search still `no-store`
    (unit test in `tests/catalog.test.ts`).
  - Warm tree expand p95 < 150 ms in the Firefox measurement.
  - Proxy still rejects unknown resource, params and non-GET.
- Visual: 1440 shows tree plus breadcrumb. 390 shows a collapsible tree and a
  breadcrumb that wraps without horizontal scroll.

**WP-R2: In-tree cart markers and quick cart upgrade** (M, yes)
- Goal: parts already in the cart are visible in the tree.
- Scope: `TreeSidebar.tsx`, `src/lib/erp-api.ts` (store part-type id on cart lines),
  `RightCartPanel.tsx`, `PartsTable.tsx`.
- Dependencies: none (E4's `part_type_id` is optional; fall back to the part type the
  user was browsing when adding).
- Acceptance:
  - Adding a part marks its part-type node and every ancestor with a count badge.
  - Removing the last line clears the marker.
  - Rows already in the cart show "In cart (n)" and a quantity stepper.
  - Existing cart cap (100 lines) and validation in `decodeCart` unchanged.
  - Markers survive reload (localStorage) and have an accessible name.
- Visual: 1440 tree plus right Quick Cart. 390 cart sheet and tree marker visible.

**WP-R3: Part-number search tab and exact-match handling** (S, yes)
- Goal: dedicated "Part Number Search" that works with `search?q=`.
- Scope: `Header.tsx`, `VehicleSearchBar.tsx`, `App.tsx`, `src/lib/erp-api.ts`.
- Dependencies: none. A result-quality finding feeds ask E2.
- Acceptance:
  - A tab or mode switch labelled Part Number Search; input trims, uppercases, ignores
    spaces and dashes for display only (the query is sent verbatim).
  - Exact SKU or part number (for example `DVNJ_ALD1212M`, which `docs/staging-catalog-gateway.md`
    records) returns the part first.
  - Fewer than two characters shows the existing error without a request.
  - "No match" state offers vehicle search.
- Visual: 1440 and 390, input does not overflow, keyboard on mobile does not hide results.

**WP-R4: Tiered, grouped part table** (M, yes with derived tiers)
- Goal: economy / daily driver / premium rows grouped by position with warranty.
- Scope: `PartsTable.tsx`, `src/lib/erp-api.ts` (`mapErpPart`), `src/lib/api.ts`.
- Dependencies: ERP ask E4 for real `quality_tier` and `warranty`. Without it, derive
  a "Price tier" from price rank within the part type (lowest third economy, middle
  third daily driver, top third premium) and show no invented warranty text.
- Acceptance:
  - Tier badge populated for every row; derived tiers are labelled as price tiers, not
    quality claims.
  - Within each position group, rows sort by tier then price. Rows with null price sort last
    and show "Price unavailable" (existing `priceLabel` behaviour).
  - Core charge, pack quantity and stock state shown on the row.
  - When the ERP supplies `quality_tier` and `warranty`, they win over derived values (unit test with both).
- Visual: 1440 compact rows; 390 stacked card rows, no truncated price.

**WP-R5: Dense table and virtualization** (M, yes)
- Goal: wholesaler density and smooth scroll.
- Scope: `PartsTable.tsx`, a small windowing helper in `src/lib/`, `package.json` only
  if a windowing library is justified (prefer in-repo code).
- Dependencies: WP-R4. Optionally E7 (higher page size).
- Acceptance:
  - Row height reduced to a compact layout that fits at least 12 rows in a 900 px tall
    desktop viewport.
  - Rendering 500 rows keeps scroll at 60 fps in the Firefox trace; DOM node count stays
    bounded.
  - Keyboard navigation and screen reader row semantics are retained.
- Visual: 1440 about 12 rows visible; 390 cards at 4+ rows per screen.

### Phase B: needs proxy allowlist growth (still no ERP change)

Each WP here adds routes to the Roy's proxy allowlist only. That is a security
review item: GET only, anchored patterns, same single upstream, no arbitrary path.
Each PR must show the exact new patterns copied from `erp-browser-policy.ts`.

**WP-R6: Product detail, interchange and fitments** (M, no, **proxy+**)
- Goal: fill the Details modal tabs (Interchanges, Fitments, Assets).
- Scope: `server/catalog-proxy.ts` (add `product`, `product_fitments`,
  `product_interchanges`, `interchange`), `ProductDetailModal.tsx`, `erp-api.ts`.
- Dependencies: ERP read-only verification of response shapes (ERP lane confirms E2).
- Acceptance:
  - New resources validate SKU or part-number characters and length like existing
    params; unit tests reject path traversal and extra params.
  - The modal shows OE and aftermarket interchanges and a fitment list from live data.
  - Unavailable data shows an honest empty state.
- Visual: 1440 modal, 390 full-height sheet.

**WP-R7: Saved vehicles (guest garage)** (S, yes)
- Goal: keep up to 5 recent vehicles locally and pick one quickly.
- Scope: `App.tsx`, `VehicleSearchBar.tsx`, `src/features/catalog/model.ts` storage helpers.
- Dependencies: none. Account garage is **blocked until Brian opens checkout/accounts**.
- Acceptance:
  - Last 5 vehicles stored with validation like `savedVehicle()`; corrupt data is ignored.
  - Selecting one expands the tree; a clear control removes it.
  - Works with storage disabled (toast, no crash).
- Visual: 1440 dropdown; 390 full-width list.

**WP-R8: VIN lookup** (M, no, **ERP ask E1**)
- Goal: enter a 17-character VIN, land on the right vehicle in the tree.
- Scope: `Header.tsx` (existing VIN Lookup button), proxy resource `vin`, `VehicleSearchBar.tsx`.
- Dependencies: ERP ask E1. Do not use the staff `vin.ts` route.
- Acceptance:
  - VIN validated client side (17 chars, no I/O/Q, check digit) before any request.
  - A decoded vehicle expands the tree to the engine level; partial decode asks for the missing step.
  - No VIN is logged or stored (privacy). Rate limited by the ERP.
  - Fallback copy when decode is unavailable.
- Visual: 1440 modal; 390 full screen, numeric keyboard hint off (VIN is alphanumeric).

**WP-R9: Shipping estimate and ship-from** (M, no, **ERP ask E5**)
- Goal: replace mock shipping in the Quick Cart with a real estimate by postal code.
- Scope: `RightCartPanel.tsx`, proxy resource `shipping_estimate`, `erp-api.ts`.
- Dependencies: E5, and Brian's decision on allowing a read-only POST (the proxy is GET-only
  today; prefer a GET estimate in E5 so the allowlist stays GET-only).
- Acceptance:
  - Mock options removed. Estimate shown as "estimate, CAD, before tax" with the ship-from location.
  - Invalid postal code (Canadian A1A 1A1 format) handled client side.
  - Estimate failure never blocks the cart.
  - No address is stored outside the browser.
- Visual: 1440 cart panel; 390 cart sheet.

### Phase C: gated on Brian opening checkout

All of these are **blocked until Brian opens checkout**. Do not start them.

**WP-R10: Persistent server cart** (L). ERP cart/account write route. Blocked.
**WP-R11: Order status lookup** (M). ERP ask E6. Blocked; needs real staging orders and email verification.
**WP-R13: Checkout and payment** (L). Out of scope for D1492 (no payments, no Shopify
checkout). Needs a new decision from Brian.

### Phase D: content and polish

**WP-R12: Help, returns, warranty pages and promotions** (S, yes for static content)
- Goal: Help menu opens real pages (Returns, Warranty, Shipping info) and shows active promotions.
- Scope: `Header.tsx`, new static page components, optional proxy resource `promotions` (**proxy+**).
- Dependencies: policy text from Roy's owner (do not invent). E8 only if per-part closeout flags are wanted.
- Acceptance: pages render without ERP data, are linked from the header and the Quick Cart,
  and carry no placeholder claims; each page states "Canada / CAD".
- Visual: 1440 and 390 readable line length, no horizontal scroll.

Suggested order: R1, R2, R3, R4, R5 (all servable now), then R7, R12, R6, R9, R8,
then Phase C when Brian opens it.

## 6. ERP API asks (for the ERP lanes; this repo never changes the ERP)

All are read-only, CAD, public, rate limited, and must not expose cost, vendor names
or internal ids that identify suppliers. Shapes are proposals.

**E1. Public VIN decode.** `GET /api/v1/vehicles/vin/{vin}`.
Response: `{ vin, valid, vehicle: { year, make, model, submodel?, engine: { id, description }, base_vehicle_id }, confidence, alternatives: [] }`.
Today only the staff-only `POST /decode` in `server/src/routes/vin.ts` exists.

**E2. Part-number and interchange search contract.** Confirm that `GET /api/v1/search?q=` ranks exact
and normalized part-number matches first, and document `GET /api/v1/interchange/{partNumber}`:
`{ part_number, brand, equivalents: [{ part_number, brand_name, type: "oe"|"aftermarket", sku? }] }`.
Routes exist (`public-api/v1/interchange.ts`); the ask is a stable documented shape and exact-match ranking.

**E3. Fitment-aware tree counts.** `GET /api/v1/taxonomy/vehicles/{year}/{make}/{model}?engine_base_id=` returning
`{ categories: [{ slug, display_name, part_type_count, part_types: [{ id, name, part_count }] }] }`
so empty branches are hidden. A similar route exists in `erp-browser-policy.ts`
(`taxonomy/vehicles/{year}/{make}/{model}`); confirm it carries engine scoping and counts.

**E4. Result fields on `search`.** Add, per result: `quality_tier: "economy"|"daily_driver"|"premium"|"performance"|null`,
`warranty: { months: number|null, label: string|null }`, `part_type_id`, `position`,
`ship_from: { location_id, city, province }|null`. All nullable and additive.

**E5. Shipping estimate.** Prefer `GET /api/v1/shipping/estimate?postal_code=A1A1A1&skus=SKU1:2,SKU2:1`
returning `{ currency: "CAD", options: [{ id, label, amount, eta_days_min, eta_days_max }], ship_from, disclaimer }`.
`POST /api/erp/shipping/calculate` exists in the policy but is POST. A GET keeps the Roy's
proxy GET-only.

**E6. Order status lookup.** `POST` or `GET /api/v1/orders/status` with `order_number` plus `email` (or signed token),
returning `{ status, lines, shipments: [{ carrier, tracking_number, tracking_url }] }`.
Must not reveal data on a mismatch (same error for unknown order or wrong email).
Only for staging orders until Brian opens checkout.

**E7. Page size.** Allow `limit` up to 100 on `search` for the Roy's key, with
`Server-Timing`. The proxy currently caps at 24, so the table needs more pages.

**E8. Closeout and promotion flags.** Per result `badges: ["closeout","promo"]`, plus
`GET /api/v1/promotions/active` documented as stable. Optional.

**E9. Performance.** SLO of 80 ms p95 for reference routes and 200 ms p95 for `search` on
staging with a representative 1M-part load, cache headers
(`Cache-Control`, `ETag`) on reference routes, and `Server-Timing` on responses.

## 7. Risks and decisions for Brian

- D1575 hosting move changes the upstream; re-check this plan's proxy WPs after it lands.
- A read-only POST (E5 variant) needs Brian's approval; GET is the default.
- Derived price tiers (WP-R4) could mislead buyers if shown as quality; keep the label
  "Price tier" until E4 ships.
- Do not copy RockAuto's text, imagery or exact layout. Behaviours are not protectable;
  the page design must stay Roy's Auto.
- VIN and postal code are personal data in logs: no logging of either at proxy or browser.
