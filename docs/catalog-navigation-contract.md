# Catalog navigation contract — inactive first slice

WP-SEO1A, 6 November 2026 (EST). This adds a pure module and synthetic regression
fixtures; nothing imports it into the application, router, renderer, server or
storage adapters. It activates no routes, requests, redirects, history behavior,
deployment settings or indexing. Parent owns integration and the separate active
vehicle UI work.

This is the first implementation slice of the saved
`/srv/dev/reports/roys-search-seo-plan-2026-11-06/PLAN.txt`, using the bounded
findings in `/srv/dev/reports/roys-search-research-2026-11-06/REPORT.txt` rather
than repeating the audits. Existing contracts are `model.ts` (`DIMENSIONS`,
`QUERY_KEYS`, `changeQuery`) and `server/product-data.ts` (SKU validation and
encoding). These files remain unchanged. The only existing-file change registers
the new test file in `scripts/test.mjs`.

## Parsed shape versus verified identity

`parseNavigationUrl` returns `absent`, `invalid` with recoverable issues, or
`parsed` with discriminated `catalog`, `search` or `product` state.
**Parsed always means unresolved.** It is safe to inspect/recover syntax; it is
not proof of entity existence, compatible engine/configuration membership,
fitment, eligible stock, useful content or indexability. It is not an API request
builder. Future consumers must resolve references before activation.

Listing state has exactly one scope: `all`, or one complete year/make/model with
six optional configuration IDs. Make/model remain names because that is the
current API contract; no IDs, slugs or aliases are guessed. All six existing
`DIMENSIONS` are retained independently: `engine_base_id`, `sub_model_id`,
`drive_type_id`, `body_style_config_id`, `transmission_id`, `region_id`.

The merchandising `category` slug and `part_type` PCDB ID are separate. A parsed
part type is explicitly `unresolved-pcdb`. `VerifiedPcdbPartType` and
`ResolvedNavigationState` describe a future external resolver's output; the
module has no function that manufactures verified references. That producer
must match every selected reference to the parsed state, supply authoritative
source evidence, and check vehicle plus every selected dimension's membership.
A selected category must have its slug verified; a selected part type needs its
own PCDB reference and any requested category relationship checked. `Category.id`
is never substituted for PCDB `part_type`. Ambiguous, unknown, mismatched and
unavailable reference lookups must leave state unresolved or recoverable; an
outage is not proof an entity is missing. Synthetic fixture numbers assert none
of these real-world relationships.

## Query URLs and structural rules

Only `/` query URLs and the existing `/products/<encoded SKU>` path are parsed.
Proposed catalog path grammar below is documentation only and is rejected by
this parser. New keys in this inactive contract are `scope`, `original_q`, and
`market`; current query names are retained for everything else. These new keys
are not proxy parameters and must never be blindly forwarded to the API.

| Field | Contract |
| --- | --- |
| `scope` | `all` or `vehicle`. Full YMM implies vehicle when omitted; no vehicle keys implies all. `scope=all` plus any vehicle input is invalid. |
| `year`, `make`, `model` | Complete together; year 1900–2100. Partial explicit input is recoverable, never dropped or interpreted as unscoped text. |
| Six dimensions; `part_type` | Positive decimal IDs, 1–999999999, matching the current proxy. No leading zeros/signs/decimal/exponent aliases. Engine `0` alone is the existing unspecified sentinel: accepted only with full YMM, then omitted. Other IDs reject zero. |
| `q`, `original_q` | `q` is residual part text, at least two trimmed characters if present; original text defaults to `q`. `original_q` preserves the entered full phrase when external interpretation consumed some/all of it. No vehicle/engine/alias parsing or MPN inference occurs here. Original-only catalog state is allowed after full consumption. |
| `category` | Lowercase hyphenated slug, separate from a PCDB ID; existence/relationship unresolved. |
| `brand` | Existing opaque brand string, no guessed numeric mapping. |
| `in_stock_only` | `all` (Roys default) or `true`. No ERP `purchasable` mode is introduced. |
| `sort`, `sort_order`, `page` | `relevance` / `asc` / `1` defaults; alternatives `price` or `availability`, `desc`, pages 1–100. |
| `market` | Only `CA`; state carries CA/CAD/en-CA. Disabled US is rejected, never silently converted. |

Every supplied query value is nonblank, at most 120 characters, with no ASCII
controls. Make/model have no leading/trailing whitespace. All duplicate keys
are invalid, including identical values and percent-encoded aliases. Malformed
percent/UTF-8 encodings, fragments, absolute/protocol-relative paths and
backslashes are rejected. Unknown keys are recoverable `unsupported-key` input,
including ordinary `utm_source`, `utm_campaign` and `gclid` tracking links.
There is no tracking allowlist in this slice: adapters must disclose recovery
instead of silently stripping unknown meaningful filters or treating the URL as
absent. This deliberately conservative policy is covered by fixtures.

Serialization uses existing `QUERY_KEYS` order, prepends essential `scope=all`
for global state, and appends a differing `original_q`. It omits equivalent
defaults (CA, availability all, relevance, asc, page 1, engine 0, redundant
original text, implied vehicle scope). `URLSearchParams` handles Unicode, spaces,
ampersands and literal plus signs. This is deterministic normalization, **not**
authorization for server canonical redirects or content equivalence claims.
Structural validity alone also does not authorize a listing request: an empty
global catalog has no API search target.

## One vehicle, refresh and deliberate actions

`initialNavigation` receives a parsed result and at most one already decoded
remembered vehicle. It has no browser/storage APIs and emits no storage writes.
It rechecks remembered structure; membership remains externally unresolved.

1. Every explicit parsed URL wins over memory, including product URLs and an
   explicit unscoped search (`/?q=ALD1212M` or `/?scope=all&q=ALD1212M`).
2. Invalid/partial explicit URLs (including `/?`) return recovery. They never
   restore or silently merge with a remembered vehicle.
3. Only the bare `/` is absent and may restore the single remembered vehicle.
4. URL hydration, refresh, Back/Forward and shared-link visits do not themselves
   update the garage. Only deliberate user actions may persist a verified
   selection, under the future adapter's control.
5. Explicit Clear removes the remembered vehicle and resets to the empty
   unscoped catalog: empty original/residual text, no category/type/config/brand,
   availability all, default sort/order, page 1. Its URL must be `/?scope=all`,
   not bare `/`. Search-the-same-term-across-all-vehicles is a distinct future
   action; Clear does not perform it.

This is Roys policy. A later Autrex adapter must preserve that storefront's
existing explicit-route-over-saved layering and commerce defaults. It must not
use this contract to introduce fallback from an invalid explicit URL.

`transitionNavigation` defines pure deliberate-action results, with no UI
wiring. `replace-vehicle` takes one complete new selection and clears old result
intent and filters. `replace-engine` keeps YMM, drops the previous other config
selections pending revalidation, and clears category/original/residual text,
part type, brand, availability/sort/page to defaults. An engine cannot be
selected without a complete vehicle. Ordinary non-engine config filter edits
preserve the selected engine and all unrelated dimensions; they reset page only
and require external revalidation rather than inventing universal configuration
incompatibility. Category/residual-text edits clear brand/type/page using the
existing `changeQuery`; a part-type edit clears brand/page. Other filter changes
reset page; a page change retains the other selections. Original text remains
for ordinary filters/page, and resets to residual text when text/category/type
intent changes. Replacement does not itself write memory; a deliberate adapter
may remember its externally verified selection. Clear explicitly emits
`memory=remove`.

## Product identity, safe returns and future history

Existing `/products/${encodeURIComponent(sku)}` is preserved through the existing
validator: four uppercase alphanumeric prefix characters, underscore, restricted
nonempty suffix, maximum 160 characters. Bare MPN `ALD1212M`, four-digit numbers
and synthetic `pp-` IDs are not product routes. Text searches for either MPN or
SKU remain text searches until an explicit verified product choice. No supported
SKU cohort is widened. Product URL query variants are rejected in this slice;
browsing context is a separate history concern. A product identity never proves
fitment to the active vehicle.

`safeCatalogReturnPath` only accepts bare `/` or structurally valid root
catalog/search query paths and returns normalized local paths. It rejects
absolute/protocol-relative URLs, encoded path tricks, raw/encoded backslashes,
controls, fragments, malformed/unsupported queries and product-to-product
returns. Legitimate encoding inside query text is preserved. Do not repeatedly
decode its output or interpret query text as another destination.

`CatalogBackground` is a small version-1 **future** history payload containing a
safe local href, finite nonnegative x/y scroll, and an optional bounded focus
key (an adapter-owned identity, not an arbitrary selector). Its parser validates
shape and copies the payload. No history API is called. The current
`roysProductOverlay` flag and close behavior are unchanged. Later integration
must pair native product hrefs with this separate background, use Back only for
an actual overlay history entry, restore exact URL/filters/page/scroll/focus,
and handle direct/reloaded products without relying on a prior entry. Hydration
must not add duplicate history entries. This slice proves payload compatibility,
not browser behavior or renderer readiness.

## Proposed catalog paths — gated, docs only

Candidate grammar from the plan:

```text
/catalog/{year}/{verified-make-key}/{verified-model-key}
/catalog/{year}/{verified-make-key}/{verified-model-key}/engines/{engine-id}-{label}
/catalog/{year}/{verified-make-key}/{verified-model-key}/engines/{engine-id}-{label}/parts/{verified-type-key}
```

Useful parent routes may omit deeper segments. A merchandising category route
must be separately distinguished from a verified PCDB leaf; no mapping/grammar
for that distinction is activated here. IDs and labels must come from verified
reference identities; wrong decorative labels may redirect only after identity
resolution succeeds. No guessed engine ID, category-to-PCDB mapping, route
registry or alias table is supplied. Autrex's existing fourth-segment category
grammar is not changed or replaced.

Activation waits for verified vehicle/config and taxonomy/PCDB resolution,
bounded reference fixtures agreed with the API owners, App/tree/history adapters,
real Back/Forward/reload/clear and desktop/mobile acceptance, and later useful
server HTML plus packaged renderer/route handling. Index eligibility, coverage,
canonical redirects, hosting and public launch are separate gates. Current
noindex, fixed upstreams, CAD-only behavior and disabled checkout stay intact.

## Verification scope

Focused Node tests cover structure, normalization, six dimensions, precedence,
all-vehicles state, Clear/replacement/filter transitions, safe returns and future
background shape. They make no network calls and do not verify live reference
membership. VM511 runs the focused file and one required diff-aware pre-push.
No desktop 1440/mobile 390 visual check is applicable: no rendered component,
stylesheet or runtime wiring changes in this inactive slice. Integrated visual
and browser-history verification are required when an adapter activates it.
