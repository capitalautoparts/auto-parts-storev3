# Catalog navigation contract — active root-query adapter

WP-ROYS-RP1-aa064791, 6 November 2026 (EST), extends the pure WP-SEO1A
contract. App now consumes it through `use-catalog-navigation.ts`,
`navigation-controller.ts` and `navigation-resolver.ts`. Only root-query and
existing SKU paths are emitted. No catalog pretty path, renderer, deployment
setting or indexing activation is included.

The saved research and merged execution plan remain the rationale; RP1 does not
repeat research or claim RP2/3 compound vehicle/engine/part interpretation.
Existing `model.ts` query keys and six dimensions, cached reference calls, and
`server/product-data.ts` SKU grammar remain the shared contracts.

## Parsed shape versus verified identity

`parseNavigationUrl` returns `absent`, `invalid` with recoverable issues, or
`parsed` with discriminated `catalog`, `search` or `product` state.
**Parsed always means unresolved.** It is safe to inspect/recover syntax; it is
not proof of entity existence, compatible engine/configuration membership,
fitment, eligible stock, useful content or indexability. It is not an API request
builder. The active resolver checks exact year/make/model membership, and
selected nonzero engine membership using the existing bounded reference walk.
Unknown membership blocks activation; failed lookups are retryable unavailable
references, rather than unknown vehicles. Neither case restores memory.

Category roots use the categories reference. Leaf URLs include browser-only
`category_parent=<verified root slug>` next to `category=<leaf slug>`. The resolver
validates the parent against roots, then checks exact child slug/id/name and
membership through **one** existing `getChildren(parent)` call. Existing reference
caching reuses the children already loaded by an ordinary tree selection.
The URL parent is a lookup hint, never evidence or an ERP search parameter.
Wrong parents/children recover as unknown; lookup failures recover as unavailable.
A cold legacy leaf-only URL has an explicit missing-parent contract gap. No
category tree crawl or guessed identity occurs. ERP source pinned by parent
review (`4e3ed42e`, `TaxonomyController.ts:310–367`) supplies category self identity
only for source_type=category; a leaf self lookup is 404, so RP1 does not issue it.
No category ID is converted into a PCDB part type.

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
own PCDB reference and any requested category relationship checked before any
future **verified** type can be produced. `Category.id`
is never substituted for PCDB `part_type`. Ambiguous, unknown, mismatched and
unavailable reference lookups must leave state unresolved or recoverable; an
outage is not proof an entity is missing. Synthetic fixture numbers assert none
of these real-world relationships.

RP1's `ListingResolution` is deliberately separate from
`ResolvedNavigationState`: ready means the request may run, not verified fitment.
The five non-engine dimensions and PCDB ID have request transport support but no
complete membership reference in the current allowlist. Brian's parent-approved
policy preserves them as unresolved constraints in URL **and request**, with a
concise recoverable notice and explicit clear-filter action. Numeric shape,
page-scoped facets and product samples never produce membership evidence.
The server remains responsible for applying the constraints; invalid/unsupported
upstream requests retain normal error handling. This gap remains for ERP-C/RP2.

## Query URLs and structural rules

Only `/` query URLs and the existing `/products/<encoded SKU>` path are parsed.
Proposed catalog path grammar below is documentation only and is rejected by
this parser. URL-only keys in this contract are `scope`, `original_q`, and
`market`, and `category_parent`; current query names are retained for everything else. These new keys
are not proxy parameters and must never be blindly forwarded to the API.

| Field | Contract |
| --- | --- |
| `scope` | `all` or `vehicle`. Full YMM implies vehicle when omitted; no vehicle keys implies all. `scope=all` plus any vehicle input is invalid. |
| `year`, `make`, `model` | Complete together; year 1900–2100. Partial explicit input is recoverable, never dropped or interpreted as unscoped text. |
| Six dimensions; `part_type` | Positive decimal IDs, 1–999999999, matching the current proxy. No leading zeros/signs/decimal/exponent aliases. Engine `0` alone is the existing unspecified sentinel: accepted only with full YMM, then omitted. Other IDs reject zero. |
| `q`, `original_q` | `q` is residual part text, at least two trimmed characters if present; original text defaults to `q`. `original_q` preserves the entered full phrase when external interpretation consumed some/all of it. No vehicle/engine/alias parsing or MPN inference occurs here. Original-only catalog state is allowed after full consumption. |
| `category`, `category_parent` | Lowercase hyphenated slugs. Parent is optional for roots and required for cold leaf restoration; resolved through roots plus one child reference, never forwarded to search. |
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
There is no tracking allowlist in RP1: adapters must disclose recovery
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
   selection, under the active adapter's control. A successful bare `/` convenience restore
   replaces that entry with its explicit query URL (never pushes), freezing its
   accepted scope before later memory changes.
5. Explicit Clear removes the remembered vehicle and resets to the empty
   unscoped catalog: empty original/residual text, no category/type/config/brand,
   availability all, default sort/order, page 1. Its URL must be `/?scope=all`,
   not bare `/`. Search-the-same-term-across-all-vehicles is a distinct future
   action; Clear does not perform it.

This is Roys policy. A later Autrex adapter must preserve that storefront's
existing explicit-route-over-saved layering and commerce defaults. It must not
use this contract to introduce fallback from an invalid explicit URL.

Header/breadcrumb **Part Catalog** is a deliberate `catalog-root` action:
clear active vehicle, category/type, text, all filters and page; navigate to
`/?scope=all`; preserve the remembered vehicle inactive and preserve lists.
**Clear vehicle** does the same and also forgets memory with existing storage
failure notice/retry. Historical explicit URLs remain usable after Clear.

`transitionNavigation` defines pure deliberate-action results, consumed by the
active controller. `replace-vehicle` takes one complete new selection and clears old result
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
intent changes. Replacement does not itself write memory; the active controller remembers only
a successfully resolved deliberate vehicle selection. Clear explicitly emits
`memory=remove`.

## Product identity, safe returns and future history

Existing `/products/${encodeURIComponent(sku)}` is preserved through the existing
validator: four uppercase alphanumeric prefix characters, underscore, restricted
nonempty suffix, maximum 160 characters. Bare MPN `ALD1212M`, four-digit numbers
and synthetic `pp-` IDs are not product routes. Text searches for either MPN or
SKU remain text searches until an explicit verified product choice. No supported
SKU cohort is widened. Product paths retain their existing identity even with non-identity query keys
or fragment. Those fields never become catalog scope, return URLs or fitment
pagination. Serialization/canonicals/links remain query-free. Browsing context
is a separate history concern. A product identity never proves
fitment to the active vehicle.

`safeCatalogReturnPath` only accepts bare `/` or structurally valid root
catalog/search query paths and returns normalized local paths. It rejects
absolute/protocol-relative URLs, encoded path tricks, raw/encoded backslashes,
controls, fragments, malformed/unsupported queries and product-to-product
returns. Legitimate encoding inside query text is preserved. Do not repeatedly
decode its output or interpret query text as another destination.

`CatalogBackground` is a version-1 presentation payload: exact safe local href,
finite nonnegative main-container scroll, optional adapter-owned focus key/control discriminator and
bounded tree disclosure arrays. `parseCatalogBackground` validates and copies
it; validation does not canonicalize away the exact background URL. History
contains presentation only; accepted scope comes from the URL.

The active controller saves presentation before deliberate navigation and
product overlay pushes. It uses one push for a changed deliberate destination,
no push for duplicates, hydration or popstate, and no storage writes during
URL restoration. Cumulative edits compose against pending intended state; vehicle replacements
clear incompatible intent and popstate supersedes pending work. Superseded
resolutions cannot save vehicles or push URLs.
Back/Forward resolves the historical scope, restores disclosures and waits for
references/results to mount before restoring main scroll/focus. Missing former
controls use the focusable main container as safe ancestor. Ordinary actions
reveal results or the catalog root; ancestor buttons only reveal real controls.
Incomplete autocomplete is an explicit cancellable draft, not a new committed
vehicle or storage write. Alias/compound parsing remains RP2/3.

`followProduct` preserves modified/native clicks, captures presentation before
pushing an overlay, and retains the original SKU URL. Overlay Close uses Back;
a direct product's Return uses explicit `/?scope=all`, avoiding memory restore.
No background query is added to product identity. The substantive standalone
product page remains RP7.

Product pathname compatibility matches the existing server's ignored-query
behavior, including `q=ignored` and ordinary tracking/fragment variants. Root
catalog query keys remain strict, including tracking keys. Future PDP fitment
pagination remains an explicit RP6/RP8 contract task, rather than interpreting
an arbitrary product `page` value today.

A global PCDB-only URL is structurally parsed but recoverable as unsupported by
the current search contract, which needs text, category or full YMM. RP1 does
not expand the proxy or present this state as ready/empty. Text+PCDB and
vehicle+PCDB remain honest unresolved narrowing constraints.

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
