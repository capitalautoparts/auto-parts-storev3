# WP-ROYS-RP2-aa064791 — search interpretation foundation

Claimed 2026-11-06 (EST) on `agent/roys-rp2-intent-aa064791`, based on
`origin/staging` at `9554abdd`. Owner: RP2 intent worker; parent owns independent review.

## Boundary

Adapt Autrex `src/lib/search/vehicleIntent.ts` catalog-backed comparison/window
matching through Roys' cached same-origin vehicle references. Preserve original
input, residual spans, ambiguous choices and explicit committed scope including all
six dimensions. Engine identity requires exact-YMM reference membership.
RP3 owns guided UI activation; current UI defaults remain unchanged.

Owned files: narrow `src/features/catalog/search-intent*.ts`, focused
`tests/search-intent.test.ts`, this document, `scripts/test.mjs` registration.
No ERP/Autrex, proxy, navigation/UI, mapper, renderer or build edits.

## Reused source

- Autrex `vehicleIntent.ts`: vehicle-only NFKD fold, token windows, nearest make
  anchor and longest model comparison. Retain ambiguity instead of its bare
  Silverado-to-1500 default; do not strip unverified submodel text.
- Autrex `search/query-parser.ts` and ERP `vehicleSearchQuery.ts`: canonical make
  aliases, including Chevy/Chev, VW/Vdub and Mercedes variants. Canonical names
  must occur in year-specific references; identifiers are never folded globally.
- Roys `vehicleApi`: existing 5-minute/150-entry/in-flight reference cache and
  exact-YMM engine call; omit synthetic engine zero.
- RP1 `ListingNavigationState`: draft retains original state without mutation;
  no competing navigation grammar or automatic vehicle replacement.

## Initial contract evidence / gaps

`server/catalog-proxy.ts` allows years, makes(year), models(year,make),
engines(year,make,model), categories, category(slug), search, product(sku) and
product-fitments(sku,page,limit). Category resources have no prefix or scope
parameters. A category ID/name is not evidence of PCDB identity or vehicle product
coverage. Search facets are full-listing work, not a bounded prefix endpoint.
PCDB discovery must explicitly report a contract gap; no recursive category walk.
Exact product retrieval requires a known SKU; generic search does not declare
exact MPN/interchange provenance. Preserve original literal query and accept
verified exact evidence explicitly; no speculative keypress lookup/fallback.

## Acceptance and checks

Prepare fixture identities for aliases/punctuation/multiword and reordered
phrases, ambiguity, exact-YMM engines/duplicate labels, invalid engines, original
identifier precedence, four-digit ambiguity, plus signs, two years, outages,
stale responses and scope/six-dimension preservation. Fixtures establish contract
behavior, not live membership/fitment/coverage. Review concrete diff before remote
validation; targeted fixtures once, then one final diff-aware pre-push.

Desktop/mobile: no UI activation in RP2; RP3 owns integrated guided journey.
Validation results, API gap request and handoff will be recorded here.
