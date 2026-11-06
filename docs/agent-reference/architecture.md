# Architecture

## Stack

Vite 7, React 18, TypeScript 5.9, Tailwind 4 (`@tailwindcss/vite`, tokens in `src/index.css`, `tailwind.config.js` maps `brand-*`),
Radix UI primitives wrapped in `src/components/ui`, `lucide-react` icons, `sonner` toasts. `wouter` is a dependency but
`src/` does not import it: there is no client-side routing. Path alias `@` = `src` (`vite.config.ts`). Dev server port 3000.

## src/ map

| Path | Role |
|---|---|
| `main.tsx` | Mounts `<AuthProvider disabled><WishlistProvider><App/></WishlistProvider></AuthProvider>` |
| `App.tsx` | The only page. Holds state: `selectedFitment`, `expandedVehicle` (persisted at `localStorage` key `roysauto.original-vehicle.v1`), `searchQuery`, `filters`, `page`, `mobileCartOpen`. Lays out Header, tree + results, desktop `RightCartPanel`, mobile cart `Sheet` |
| `components/Header.tsx` | Top bar, nav placeholders (Help, Order Status, Promotions, Account, Tools, VIN Lookup), search, cart/wishlist counts |
| `components/VehicleSearchBar.tsx` | Search box using `vehicleApi.search` / `searchCategories` (vehicle "2013 Hyundai", part number/keyword, category) |
| `components/TreeSidebar.tsx` | Year > Make > Model > Engine > Category tree; exposes `expandToVehicle` / `expandToCategory` via ref; emits `PartSelection` |
| `components/PartsTable.tsx` | Result rows: image, tier badge, part, details, price, Add, Details, wishlist. `part.tier` is never set by the ERP mapper, so the tier cell shows an em dash today |
| `components/ProductDetailModal.tsx`, `ProductImage.tsx` | Part detail dialog, image with fallback |
| `components/RightCartPanel.tsx` | Quick Cart, quantity controls, address forms, mock shipping options (checkout disabled; nothing is placed or charged) |
| `components/wishlist/*`, `components/auth/AuthModal.tsx` | Wishlist button/panel; auth modal (auth is disabled) |
| `components/ui/*` | shadcn-style Radix wrappers (button, dialog, sheet, table, badge, select, ...). Reuse these |
| `contexts/WishlistContext.tsx` | Wishlist in `localStorage` key `roysauto.original-wishlist.v1` |
| `contexts/AuthContext.tsx` | Mock user in key `cap-auth-user`; mounted with `disabled`, so no sign-in persists |
| `features/catalog/model.ts` | Market (`MARKET` = CA/CAD/en-CA; US/USD exists but `enabled:false`), query keys and `readQuery/changeQuery/searchParams`, types, `priceLabel`, `readCart`, `safeStorage/saveStorage`, `catalogFetch` |
| `lib/erp-api.ts` | `vehicleApi`, `categoryApi`, `partsApi`, `cartApi`; ERP-to-UI mapping (`mapErpPart`); 5-minute reference cache (max 150 entries), in-flight de-duplication; cart in `localStorage` key `roysauto.original-cart.v1` |
| `lib/api.ts` | UI-facing types (`Part`, `Category`, `Cart`, `VehicleContext`, ...); re-exports the four API objects |
| `lib/hooks.ts` | `useQuery` (ignores stale responses) and `useMutation` |
| `lib/availability.ts`, `lib/utils.ts` | Stock label helper; `cn` class merger |
| `hooks/useMobile.ts`, `useComposition.ts` | Breakpoint hook; IME composition helper |

## State, cart, wishlist, auth

State is plain React state in `App.tsx` plus two contexts. Cart is not a context: `cartApi` reads/writes `localStorage`
(max 100 lines, quantity 1..99, validated on read by `decodeCart`), and App fetches it through `useQuery`. Cart prices are
snapshots, not a quote. Storage failures are tolerated (`safeStorage`), and `cartApi` throws when it cannot save.
There is no silent mock fallback after an API error.

## Server

- `server/catalog-proxy.ts` exports `upstreamUrl`, `catalogEnabled`, `createCatalogHandler`, and a default handler.
- `api/catalog.ts` is a one-line re-export for the Vercel function. `vite.config.ts` mounts the same handler at `/api/catalog`
  for `vite` and `vite preview` with `localDevelopment=true`, which skips the activation gate.
- Tests: `tests/catalog.test.ts` (node:test, run via `scripts/test.mjs` with `--experimental-strip-types`) and
  `tests/function-entrypoint.test.mjs` (emitted function starts). `tsconfig` rewrites relative `.ts` imports to `.js` for the emitted function.

## Catalog proxy contract

Browser calls `GET /api/catalog?resource=<name>&<params>`. Anything else is rejected.

| resource | upstream path (under the fixed gateway `/api/v1`) | allowed params | required |
|---|---|---|---|
| `years` | `/vehicles/years` | none | none |
| `makes` | `/vehicles/makes` | `year` | `year` |
| `models` | `/vehicles/models` | `year`, `make` | both |
| `engines` | `/vehicles/engines` | `year`, `make`, `model` | all three |
| `categories` | `/taxonomy/categories` | none | none |
| `category` | `/taxonomy/categories/<slug>` | `slug` | `slug` (`^[a-z0-9]+(-[a-z0-9]+)*$`) |
| `search` | `/search` | `q, year, make, model, engine_base_id, sub_model_id, drive_type_id, body_style_config_id, transmission_id, region_id, category, part_type, brand, in_stock_only, sort, sort_order, page, limit, include_facets, include_vehicle_dimensions` | see below |

Validation (all in `upstreamUrl`): request URL must start with a single `/`, path `/` or `/api/catalog`, no hash; unknown resource or
parameter, duplicate parameter, empty or over-120-char value, control characters are rejected. `year`, `page`, `limit`, `part_type`
and every `*_id` must match `^[1-9]\d{0,8}$`; year 1900..2100; `page` <= 100; `limit` <= 24; `include_facets` and
`include_vehicle_dimensions` are `0|1`; `in_stock_only` is `all|true`; `sort` is `price|availability|relevance`; `sort_order` `asc|desc`.
Search needs `q` (>= 2 chars) or `category` or a full year+make+model; make/model/`*_id` filters require the full vehicle.
Added upstream: `vehicleType=light-duty` for years/makes/models; `limit=24` and `in_stock_only=all` defaults for search.

Handler behavior: GET only (405 + `Allow: GET` otherwise). Response headers `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`.
Upstream fetch: 15 s timeout, `redirect: 'error'`, UA `RoysAuto-Catalog-Preview/1.0 (+Autrex; staging read-only)`, no caller headers or
credentials forwarded. Upstream `x-erp-stub: 1` -> 502 (gateway development stub rejected). Non-2xx -> 429 stays 429, everything else 502;
a 403 adds the `cf-ray` value as `reference`. Non-JSON or body over 2,000,000 bytes -> 502.

Activation gate (`catalogEnabled`, bypassed only for local Vite): requires `VERCEL=1` and `ROYS_CATALOG_PREVIEW_ENABLED=true`, then
`VERCEL_ENV=preview`, or `VERCEL_ENV=production` with `VERCEL_PROJECT_ID=prj_MDoqEvUIZHzv65GCFYxLE03xVt2p` and
`VERCEL_GIT_COMMIT_REF=main`. Otherwise 503 with code `CATALOG_FLAG_DISABLED` (flag not `true`) or `CATALOG_DEPLOYMENT_NOT_ALLOWED`.
Error bodies: `{ error: string, code?: string, reference?: string }`; invalid input is 400 with `{ error }`.
The client (`catalogFetch`) turns non-JSON, malformed or oversized (>2,000,000 bytes) responses into one retryable message.

D1575: the on-prem upstream PR adds a second fixed upstream, `http://192.168.88.233/api/erp`, selected only by `ROYS_ONPREM=1` (with `ROYS_CATALOG_PREVIEW_ENABLED=true`, `VERCEL` not `1`); see `deploy-vercel.md`. Not in this branch's code yet.
