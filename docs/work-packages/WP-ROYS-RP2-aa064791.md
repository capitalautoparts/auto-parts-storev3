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
Parent review additionally approved narrow `VehicleEngine.details` typing and
the `getEngines` details mapper in `src/lib/api.ts` and `src/lib/erp-api.ts`.
No ERP/Autrex, proxy, navigation/UI, product-mapper, renderer or build edits.

## Reused source

- Autrex `vehicleIntent.ts`: vehicle-only NFKD fold, token windows, nearest make
  anchor and longest model comparison. Retain ambiguity instead of its bare
  Silverado-to-1500 default; do not strip unverified submodel text.
- Autrex `search/query-parser.ts` and ERP `vehicleSearchQuery.ts`: canonical make
  aliases, including Chevy/Chev, VW/Vdub and Mercedes variants. Canonical names
  must occur in year-specific references; identifiers are never folded globally.
- Roys `vehicleApi`: existing 5-minute/150-entry/in-flight reference cache and
  exact-YMM engine call; omit synthetic engine zero. ERP
  `server/src/routes/public-api/v1/vehicles.ts` engine rows include
  `details.{liter,cylinders,block_type,cc,cid}`. Preserve validated optional fields;
  derive typed displacement/block/cylinder equivalence only from those fields.
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

## ERP-C request: bounded PCDB prefix discovery

Inspected source only; no live probes or deployment claim:

| Existing route / Roys resource | Inputs and output | Missing for prefix discovery |
| --- | --- | --- |
| `/taxonomy/categories` / `categories` | No Roys parameters; merchandising category ID, display name, slug and counts | No prefix, PCDB identity, YMM/configuration, eligibility or cap |
| `/taxonomy/categories/{slug}` / `category` | One slug; subcategory display IDs/slugs and `mapped_part_type_count` | Counts do not identify PCDB types; no prefix/scope search |
| `/taxonomy/search` / not allowlisted | Vehicle query, at most ten YMM suggestions; relaxed trailing-token matching | No trusted original consumed spans, engines or type identities |
| `/taxonomy/autrex/subcategories/{slug}` / not allowlisted | Exact existing subcategory slug; `pcdb_mappings` with `pcdb_part_type_id`, `pcdb_part_type_name`, confidence | Genuine identity mapping exists, but caller already needs the subcategory; no scoped prefix, result cap or eligibility declaration |
| `/taxonomy/autrex/map/{id}` / not allowlisted | Known PCDB ID; first mapping | Reverse lookup does not discover a partial name |
| `/search` / `search` | Existing listing filters, 24-product cap, optional `facets.part_types` | Full listing/facet work; prefix completeness and canonical singular/plural interpretation are not declared |

Evidence: Roys `server/catalog-proxy.ts` route allowlist; ERP
`server/src/controllers/TaxonomyController.ts` category/detail/search and
Autrex subcategory/map methods. Upstream may expose additional contracts; this
inspection proves only the inspected/currently consumable gap. No proxy changes
are proposed here. An exact known subcategory mapping could support a separately
reviewed finite pilot; it does not justify guessing `brake-pads` from an arbitrary
phrase or recursively scanning all categories.

ERP-C requested capability (proposal, not an implemented endpoint): bounded
prefix input (`brake pad`, `brake pads`, `ball j`), maximum ten results, original
query echo and explicit truncation/ambiguity. Return canonical PCDB ID/name with
matching semantics and reference-versus-eligible status. Scope identity must echo
CA/CAD/en-CA, explicit all/vehicle, exact YMM and all six supplied configuration
IDs, availability `all`/`true`; do not silently relax any supplied dimension.
Either declare candidates reference-only or substantiate eligibility using
existing listing logic. A zero, failure/refusal and unsupported scope need distinct
outputs. Preserve legacy ranking/defaults. No coverage projection or data writes.

The adapter returns `partTypes.status = 'contract-gap'` with
`PCDB_PREFIX_UNAVAILABLE` for now. It cannot mint `VerifiedPcdbPartType` from
category shape. Full type discovery is blocked on ERP-C or a reviewed finite
authoritative mapping; literal search remains an explicit RP3 action.

## RP3 typed integration contract

`searchIntentApi.interpret({original, context, signal})` returns a draft with
the unchanged literal query and a cloned `ListingNavigationState`. It never
commits, persists, broadens scope, runs a generic listing, or retries spelling.
It waits at most 2 seconds by default (caller cap 5 seconds), performs at most
four sequential reference calls, and uses only the existing reference cache.
Cancelling a draft stops its wait while shared cache work may finish normally.
RP3 must abort superseded/dismissed drafts and only display the current draft.

`vehicles` are choices with catalog year/make/model identity, original UTF-16
consumed/residual spans, pending engine status and an explicit scope conflict.
When multiple YMM candidates exist, select one before calling
`searchIntentApi.engines(candidate, options)`; it retrieves only that exact
YMM's engines. `chooseIntentEngine(candidate, id)` requires positive reference
membership and returns another draft. It consumes typed engine spans only when
that chosen ID matched those spans. Duplicate labels stay separate IDs;
`5.3L V8` matches `5.3L 8-Cyl V` only when exact-YMM structured reference fields
confirm 5.3 liters, eight cylinders and V block. Absent required fields, malformed
details or conflicting supplied fields do not establish that equivalence.
Exact-label fallback remains available with non-conflicting source data.
Meaningful separators such as `5.3L / V8` are never swallowed as equivalent.
Unmatched engine and trim text remains residual. Connectives such as `for` and `with` also remain
visible; RP3 must not silently discard them when presenting an interpretation.

The prior URL/active vehicle and all six IDs remain in `draft.context`; a new
candidate is not evidence that old non-engine dimensions apply to it. RP3 owns
an explicit atomic commit through RP1, including dimension revalidation/reset.
Candidate `conflictsWithContext` compares explicit all/YMM scope;
`engineConflict` separately reports a known same-YMM engine conflict, same engine,
unverified choice, or not applicable. Neither proves other configuration
compatibility. All returned vehicles/engines are
reference choices, never product coverage or fitment assertions.

Exact evidence is optional, and must be supplied by a future authoritative
exact-SKU/MPN/interchange lane. It carries original-query/context association,
source kind, supported SKU identities and the unchanged matched input. Valid
evidence retains source product ordering and wins before vehicle interpretation.
No current generic suggestion is upgraded to exact evidence. With no evidence,
the adapter says `identifierLookup = 'not-requested'`; unknown four-digit input
remains a literal year-or-identifier choice with no reference fetch. No result
here proves no-stock, no-products or compatibility.

## Verification ledger

- Parent independently reviewed the staged implementation and accepted the
  corrected structured-engine/conflict/span batch before validation.
- `git diff --cached --check`: passed.
- `dev-remote --queue`: coding/general capacity available; service lane untouched.
- `dev-remote --heavy node --experimental-strip-types --test tests/search-intent.test.ts`:
  **11/11 passed** on VM511, including the actual-shaped engine-details adapter.
- First final diff-aware `AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push`:
  typecheck passed, 91/92 tests passed. Branch-caused adapter regression: absent
  details added an own `details: undefined` property, breaking the existing exact
  engine shape contract. Fixed mapper to omit absent details entirely; supplied
  usable/malformed detail evidence remains explicit. Final gate rerun justified
  by this correction; no CI rerun or unrelated validation.
- Named existing engine request check after correction: **1/1 passed** on VM511.
- Final `AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push`: **passed**, VM511
  typecheck and **92/92 tests**; elapsed 17 seconds including queue/sync.
- Desktop/mobile: not applicable to inactive additive adapter. No current UI
  labels, IDs or selection behavior change. RP3 owns guided activation and its
  integrated desktop/mobile acceptance; RP1/RP5 journeys were not repeated.
- Limits: synthetic fixture IDs establish interpretation contract only. No live
  probes, full PCDB prefix capability, exact-identifier endpoint, product fitment,
  eligible vehicle coverage or latency benchmark is claimed.
