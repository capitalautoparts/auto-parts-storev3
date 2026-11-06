# Roys search, navigation and product-page execution plan

Prepared 2026-11-06, Eastern time (EST). Work package: **WP-ROYS-PARITY2**, umbrella `aa064791-d1dd-44fd-8460-553ae6dd66a8`.

This is the consolidated implementation backlog following Brian's eight screenshots and request for an in-depth RockAuto comparison. It extends R1/R3/R5/R6/R7 and the earlier SEO plan; it does not establish another competing navigation owner. The umbrella remains open. The accompanying [evidence ledger](evidence/rockauto-parity-analysis-2026-11-06.md) distinguishes inspected source, observed behavior, reported acceptance and proposals.

**The next deliverable is a complete search-to-product journey.** Compact header fixes are delivered, but the search resolver, catalog URL adapter, substantive document rendering and full product page are not. Existing ERP and Autrex work supplies useful building blocks. Rewriting their search systems, adding a coverage database or changing frameworks is not the starting point.

This document changes no running behavior. Each implementation package below gets its own current-staging worktree, owner, review and PR. Roys staging is the first consumer. Autrex default behavior and ERP existing contracts remain protected. Production promotion, public indexing, domain changes and transactions are separate decisions.

## 1. Current delivery boundary

Roys source baseline: `467ac1c20330237cfb282253135271f7a018c3b2`. ERP source inspected: `4e3ed42eeb47de65eaf29d65796e9eaef8bc9131`. Autrex current staging comparison: `3bd2dcb3a7ec516ab71ede4734f2f597a22289c6`; the previously audited `03203a44` has identical inspected search-helper blobs. Source inclusion alone does not prove deployment.

| Area | Delivered / accepted | Still needed |
|---|---|---|
| Product links, #14 | Supported SKU URLs, native links, small server identity article and metadata; hosted acceptance recorded | Substantive server product content, hydration, standalone direct page; existing browser route opens a modal |
| Header/search dismissal, #17/#19 | Honest controls, mobile focus handoff, dismissal and stale-result protections | Vehicle/engine/part intent and explicit identifier choices |
| Vehicle state, #18/#21 | One active vehicle, persistence, explicit clear, storage-error handling | URL-driven state, staged search choices, exact history restoration |
| URL contract, #20 | Pure parser/serializer/transition tests | **Inactive**: App does not consume it; no catalog URL routing or HTML |
| Mobile actions/cart, #22/#23 | Action width correction and reserved mobile cart strip; full #23 hosted acceptance | Preserve these protections during row changes; transient notification overlap remains separate |
| Compact navigation, #24/#25 | Hosted 12/12 bounded cases at 1440/390/900 plus 1024/1100; stable served revision above | Search-selection reveal, new Catalog destination policy, compact product rows and meaningful URLs |
| Autrex SEO | Existing first-page vehicle/category SSR and shared query seed; substantive PDP pattern | Engine-aware permanent state and optional new search adoption, without changing its existing route grammar |

The #24/#25 pass verifies its stated behavior. It does not accept unfinished search/SEO requirements. The supplied Roys screenshots show 38 category results and 39 text results; they do not establish a zero-result search or wrong fitment. Those requests have different scope.

## 2. Shopper journey and interaction contract

The first integrated demonstration uses one verified vehicle family, initially the audited Silverado example, and actual supported products:

1. Type `2015 Chevy Silverado 1500 brake pad`. Keep the original input; compare vehicle aliases against reference data without rewriting product identifiers.
2. Offer explicit engine choices. Retain `brake pad` while the shopper chooses a verified engine. If text supplies an ambiguous or invalid engine, show that unresolved choice rather than guessing or discarding it.
3. Resolve a verified Brake Pad part type, or offer clear part-type versus literal-text choices. Selecting it commits one vehicle, engine and part intent together. Reveal the selected branch/results in the catalog scroll container.
4. Show the effective scope in a compact linked path. Publish a restorable URL. Reload, copy to a clean browser, and Back/Forward reproduce the same scope, filters and page.
5. A product link has one stable identity. Ordinary in-catalog selection can open a quick view; a direct URL/new tab/reload renders a full page. Close/Back restores the exact background URL, scroll and focus.
6. Part Catalog returns to an explicit all-vehicles catalog destination. Browser Back returns to the previous scoped results. Cart and wishlist survive both actions.

### Proposed destination semantics

These are deliberate Roys policy changes for RP1, not a claim about every RockAuto control. The reference browser inspection established top-tab behavior but did not conclusively exercise its separate breadcrumb root.

| Action | Intended result | Vehicle memory / history |
|---|---|---|
| Header or breadcrumb **Part Catalog** | Clean root; no active vehicle, category/type, text, result filters or page | Explicit `scope=all` initially. Preserve one remembered choice as inactive convenience; never silently apply it on this URL. Push a deliberate navigation entry |
| **Clear vehicle** | Same explicit all-vehicles state | Also forget remembered vehicle; report storage failure. This does not erase historical explicit URLs |
| Year / make / model / engine ancestor | Reveal the corresponding choices and focus the real control | Preserve current result scope until an explicit selection commits; no hidden storage write or new parts request |
| Choose another vehicle/engine | Atomically commit the new validated scope and its new pending part intent | Clear incompatible old filters/configuration/category/page; persist only committed vehicle |
| Open/cancel an incomplete search draft | Show choices, keeping the prior committed vehicle distinguishable | Cancellation leaves the committed context intact; an abandoned partial choice must not save a new vehicle |
| Browser Back/Forward | Restore the historical URL's accepted scope | No duplicate pushes during hydration/popstate. Explicit URL wins over memory, even after Clear |
| Bare `/` with no explicit state | May restore the single remembered vehicle under the existing convenience policy | Invalid explicit input never falls back to memory. Explicit all never restores it |

This changes PR24's root behavior, which resets text/filters/page but retains vehicle **and category**. Tests and labels must change together. It also deliberately replaces PR21's immediate clearing on an incomplete autocomplete selection with a distinct draft/commit flow. There remains exactly one committed vehicle, not two active contexts.

### Search choices and identity

- Group vehicle/engine, part-type and exact-product choices. Keep an explicit literal-text action. Enter must have a visible predictable action; it cannot silently guess the first engine or drop trailing words.
- Canonical YMM, all six confirmed configuration IDs, original text, residual text, verified PCDB type and exact product identity are different fields. Taxonomy `Category.id` is not proven to be a PCDB ID. Engine `0` means unspecified and is omitted upstream.
- Reuse ERP aliases/model punctuation and Autrex's catalog-backed intent logic through a bounded adapter. Do not import Next server/auth plumbing or invent a third competing parser. Preserve ambiguity where an existing Autrex heuristic defaults a bare model name.
- Exact MPN, SKU and interchange are separate retrieval cases. Preserve original identifier spelling and ranking; no silent all-vehicle fallback or fitment promise. Four-digit identifier-like input needs an explicit interpretation, not an unconditional year rule.
- Roys uses explicit availability `all`; Autrex defaults to purchasable. Keep those differences, all six dimensions and market/locale in request/cache identity. Missing applications mean unverified fit, not universal fit.

## 3. URL, HTML and SEO contract

One route/state contract is shared by search, tree, server loader, breadcrumbs, browser history and product presentation. Extend the inactive `navigation-state.ts`; do not create a parallel state framework. Parsed IDs remain unverified until resolved against authoritative references.

The exact pretty-path codec is finalized and fixture-tested in RP1. The following is schematic, not an implemented URL or a verified ID mapping:

```text
/catalog/{year}/{verified-make-key}/{verified-model-key}
/catalog/{year}/{verified-make-key}/{verified-model-key}/engine/{verified-engine-key}
/catalog/{year}/{verified-make-key}/{verified-model-key}/engine/{verified-engine-key}/parts/{verified-part-type-key}
/products/{encoded-existing-supported-SKU}
```

Stable verified identity controls resolution; labels are decorative. Parent hubs remain useful when an engine is not selected. Existing root query URLs remain supported state aliases. Other configuration dimensions, brand, stock filter and pagination survive explicit query state even when not index eligible. Unknown keys currently return recoverable unsupported input; RP1 must explicitly reconcile known tracking-only keys, product query handling and fitment pagination before public launch. Never strip meaningful filters as “canonicalization.”

Existing product URLs stay valid. The initial product cohort uses the existing four-character uppercase brand-prefix SKU validator; synthetic `pp-` IDs require a separate proven mapping/security extension. Human-readable product slugs are optional and not a prerequisite. Product canonical identity is independent of the browsing vehicle or overlay presentation.

Useful HTML must include headings, linked hierarchy and real product links, not only metadata or a JavaScript search box. This follows Google's guidance on [discoverable ecommerce structure](https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure) and [stable URLs](https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites).

| Route/result | Proposed response and discovery policy |
|---|---|
| Verified substantive vehicle/engine/type or product document | 200, self-consistent canonical/visible content; only candidate eligibility until public launch |
| Valid empty search/listing | Useful 200 noindex, honest empty state; excluded from eligible cohort |
| Invalid syntax / verified unknown identity or impossible combination | Clear 400 / real 404 respectively; no home redirect masking failure |
| Activation failure, refused/malformed upstream, rate limit | Preserve current 503 / 502 / 429 distinctions; no outage represented as empty stock or missing product |
| Old decorative label for verified same identity | One permanent redirect after successful resolution; never redirect on lookup outage |
| Pagination | Distinct URL and page-specific products with real links. Index-eligible pages self-canonical; don't canonical every different product page to page 1 |
| Free text, arbitrary facets/sort/session variants | Explicit noindex/discovery limits; no generated sitemap fanout. Canonical only to an actually equivalent document |

Pagination and facets need separate policies: [Google pagination guidance](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading) and [faceted navigation guidance](https://developers.google.com/crawling/docs/faceted-navigation). JavaScript enhancement remains useful; server content improves the initial experience and crawl reliability without claiming Google cannot render JavaScript. See [JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

All staging noindex headers, HTML and robots protections remain. These packages prepare index readiness, not index activation. A later public release must coordinate robots access and readable noindex directives; robots blocking is not a substitute for removal/indexing control. Absolute public canonicals must use a fixed approved origin, not request Host headers. No production domain is selected here.

## 4. Work packages and delivery sequence

All packages start **planned/unclaimed** in this document. Claim one owner in a fresh task before editing. Ranges are rough engineer-day estimates excluding external contracts, CI/release waiting and review; they are not delivery promises. Split a package if it cannot stay reviewable, but preserve its integrated acceptance milestone.

| ID | Deliverable / existing roadmap | Primary owner | Depends on | Estimate |
|---|---|---|---|---|
| RP1 | Active URL/history and explicit destinations; R1 + SEO1A activation | Roys navigation | Existing #20 contract | 2–3 days |
| RP2 | Reuse vehicle/identifier intent and verified type discovery; R3/SEO2 | Roys search, ERP contract review | RP1 accepted interfaces; ERP-C only if proven necessary | 1–3 days |
| RP3 | Guided search, engine choice and reliable reveal; R1/R3 | Same Roys search/navigation lane | RP1 + RP2 | 2–3 days |
| RP4 | Dense tree/rows with independent actions; R5 | Roys presentation | RP3 geometry stable | 1–2 days |
| RP5 | Shared factual product read model; R6 | Roys product | Existing product contract | 1–2 days |
| RP6 | Narrow HTML renderer/bootstrap and packaged runtime; SEO3 | Roys rendering | RP1 + RP5 interfaces | 2–3 days |
| RP7 | Full PDP and same-URL quick view; R6/SEO4 | Roys product | RP1 + RP5 + RP6 | 2–3 days |
| RP8 | Finite catalog HTML and native pagination; R1/SEO5 | Roys catalog/rendering | RP1–3 + RP6 + RP7 links | 2–4 days |
| RP9 | Measured request/performance improvements; R1/R3 | Roys search/performance | RP3; instrument budgets during RP2/3 | 1–2 days |
| RP10 | Content/crawl/schema readiness; SEO6 | Roys SEO/integration | RP7 + RP8 | 1–2 days |
| RP11 | Integrated acceptance and release inventory | Independent reviewer + infra/executor | Milestone packages below | 0.5–1 day per milestone |
| RP12 | Optional Autrex adoption and compatibility | Separate Autrex owner | Proven Roys RP3/RP9; explicit scoped task | 2–3 days |
| ERP-C | Conditional missing bounded discovery contract | Separate ERP owner | Concrete RP2 contract gap | Estimate only after evidence |

**Milestone A — usable shopping:** RP1–3 plus RP4 and the relevant RP9 improvements. Accept the whole phrase → engine → part → visible results → URL/history journey, not only individual controls. **Milestone B — useful destination pages:** RP5–8 plus RP10's status/content gates, joined to A; accept one substantive catalog route and its full products with no JavaScript and with enhancement. RP11 runs once per coordinated release milestone. **Milestone C — measured expansion:** eligible cohort growth and optional RP12 after evidence, not before.

### RP1 — Activate navigation state, history and destinations

**Files:** `src/features/catalog/navigation-state.ts`, `model.ts`, `App.tsx`, `TreeSidebar.tsx`, `product-navigation.ts`, focused state/history fixtures. Add a small route adapter only where existing helpers do not fit. Own App/Tree exclusively during this package.

**Work:** wire validated root-query state into App; finalize the shared pretty-path contract and route resolution interface; distinguish draft from committed intent; implement the destination table above. URL contains accepted catalog state; `history.state` contains only presentation/background/scroll/focus. Record the scrolling main element, not window alone. Resolve stale dependent filters on vehicle/engine replacement. Reconcile product query grammar and intentional tracking-only handling with the server rather than weakening unknown-key rejection globally.

**Acceptance:** explicit URL/all beats saved vehicle; invalid explicit state never restores a different vehicle; one vehicle only; A → B → Back/Forward and page 2 reload restore matching context/request/highlight. Catalog clears result scope without deleting cart/wishlist, refresh stays all, Back restores prior results. Clear forgets memory with existing storage-failure recovery. Native anchors/modified clicks work; hydration/popstate do not push duplicate history. Close quick view restores the exact background, including collapsed branches and focus when the target still exists; otherwise use a defined safe ancestor. No external return URLs. URL parsing alone never manufactures verified vehicle/PCDB evidence.

**Boundary:** RP1 emits only working root-query and existing product URLs. It may define the pretty-path codec, but must not emit pretty catalog links until RP8 supplies their server documents and reviewed nginx dispatch. Query-state activation is not catalog HTML/SEO completion.

### RP2 — Reuse intent logic and prove discovery contracts

**Files:** Roys `erp-api.ts`, `api.ts`, narrow catalog intent adapter/fixtures; `catalog-proxy.ts` and its tests only if an existing ERP resource must be newly allowlisted. ERP and Autrex source are references, not edit targets in this PR.

**Work:** adapt the existing catalog-backed Autrex resolver and ERP alias/punctuation behavior; preserve consumed versus residual spans and original identifiers. Resolve engines from the existing exact-YMM engine reference. Verify what available taxonomy APIs can supply for canonical PCDB names/prefixes; distinguish merchandising categories from part types. Scope candidate keys by market, vehicle/configuration and eligibility. Remove dependence on which tree children were previously loaded. A global type candidate may be labeled as reference taxonomy; it must not claim vehicle product availability without listing evidence.

**Acceptance corpus:** Chevy/Chev/Chevrolet, F150/F-150, multiword models, punctuation/Unicode, ambiguous Silverado variants, duplicate engine labels with different IDs, valid and invalid `5.3L V8`, `brake pad`/plural/`ball j`, reordered phrase, known exact MPN/SKU/interchange, four-digit MPN/year ambiguity, literal plus signs, two years, no match, timeout/refusal, stale response, explicit conflicting URL and all six configuration dimensions. Use verified fixture identities; no claim that an example SKU fits the selected Silverado. Known original exact candidates keep precedence; fallback runs only after a genuine zero and preserves scope.

**Boundary:** ERP taxonomy search returns vehicle suggestions, not a trusted full-phrase/engine/type resolver. Do not infer consumed text from a relaxed match. If bounded PCDB discovery is absent, open ERP-C with a precise request/response gap; do not scan every category or fetch full listing/facets per keystroke. Preserve ERP ranking and Autrex availability defaults.

### RP3 — Guided search and selection reveal

**Files:** `VehicleSearchBar.tsx`, `App.tsx`, `TreeSidebar.tsx`, search adapters from RP2, owned focused checker. Serialize with RP1 and any Header edits.

**Work:** present grouped choices and an explicit text action; hold pending part intent through engine selection; expose confirmed vehicle/engine compactly outside the editable remainder where helpful. Reuse the existing mount-aware focus/reveal mechanism when autocomplete expands a model/engine; supersede obsolete reveal requests. Resolve and commit once, then reveal matching results. Retain #19 dismissal, composition, Tab/Arrow/Enter and mobile Header focus behavior.

**Acceptance:** fresh `2015 Chevy Silverado 1500 brake pad` reaches explicit engine selection, then a verified type or disclosed ambiguity and matching outgoing scope. The full phrase and an already selected vehicle + chosen type yield the same IDs/eligibility; deliberately broad text search is separately labeled and may have different totals. Fresh versus previously browsed tree has identical candidates. Choice is visible without manual hunting through preceding years. Escape/cancel preserves committed context; rapid A/B responses never commit stale A. Dropdown is bounded to available viewport and scrolls; selected option is visible, focus/active-descendant valid, keyboard and pointer actions agree. Verify real 1440/390 integration; physical mobile keyboard occlusion remains a separate device check, not inferred from desktop Firefox emulation.

### RP4 — Tree and product-row density

**Files:** `TreeSidebar.tsx` presentation, `PartsTable.tsx`, narrow layout tokens if necessary; own density/action checker. No request/ranking or fitment change.

**Work:** reduce redundant headings and whitespace; use compact branch indentation and clear selected path. Desktop row: brand + native MPN/details link, concise description and real application conditions, bounded thumbnail, price/unit, quantity/action and wishlist in a compact arrangement. Remove the two stacked full-width action controls as the row-height floor. On mobile keep readable wrapping and distinct touch actions. Preserve the reserved cart strip and native trigger/focus contract.

**Acceptance:** compare identical dataset/viewport/zoom before and after, report row heights and visible product count. A roughly 50–70 px simple desktop row is a design target, not a forced height for long conditions. Demonstrate materially more usable products without tiny text, clipped qualifiers or hidden price basis. Check 1440/390, 320/600 and the 1023/1024 boundary where affected; 200% zoom; independent hit tests plus real Add/Wishlist/Details actions at mid-list bottom and final row. Do not recreate fabricated quality tiers or warranties just because RockAuto has them. Record toast overlap independently of settled geometry.

### RP5 — Preserve useful product facts

**Files:** `server/product-data.ts`, `src/lib/api.ts`, relevant `erp-api.ts` mapping and focused fixtures. One product data owner; coordinate adapter ownership with RP2.

**Work:** build one browser/server read model from verified product detail. Prefer ordered `specs_list` names/values/units and retain meaningful repeated rows. Keep short and useful long descriptions, website-approved image gallery/media, supplied application conditions, pack/core/basis and current CAD semantics. Map existing inline interchanges with type and notes, including `NR / Not Recommended`, before proposing another endpoint. Treat listing snapshots as summaries, not complete detail.

**Acceptance:** same facts reach HTML, full page and quick view; unknown/internal codes are absent from shopper specs/schema. HTS is not a Canadian duty or mechanical claim; CTO needs a sourced country interpretation; LIF is not decoded by guess; a WS1 template example is not a catalog-wide seller warranty. Missing data stays missing. Preserve source language, safe rendering and approved asset URLs; distinguish missing/empty/malformed secondary data. Interchanges are references with qualifications, not universal replacement guarantees. No invented reviews, stock, discounts, shipping/returns or copy padding.

### RP6 — Useful HTML, bootstrap and release artifact

**Files:** existing product/on-prem handlers, narrow shared public view/loader, `src/main.tsx` entry integration, Vite server bundle/build manifest and packaged-runtime checker. Coordinate ProductRoute with RP7; infra owns installed nginx changes.

**Work:** render a small shared public-content subtree; hydrate the same validated and safely escaped bootstrap data. Keep browser-only cart/storage outside server rendering. The current deployed package has no source tree or node_modules: bundle the renderer and required dependencies explicitly. Preserve the useful article until the identical client content takes over; do not switch createRoot to hydrateRoot over unrelated markup. Centralize title/canonical/schema lifecycle across navigation and failures.

**Acceptance:** packaged Node 22 release works using only shipped artifacts; no-JS content is useful; no initial blank/refetch flash or duplicate fetch merely to rebuild verified seed. Test identity mismatch, injection strings, payload/time caps, missing versus outage and documented HTTP statuses, GET/HEAD parity if enabled. All requests use existing fixed catalog reader/gates/refusal handling. Prepare narrowly scoped `/catalog/` nginx dispatch with real status handling; source preparation is not hosted installation. Keep current price/search no-store policy.

### RP7 — Standalone full product page and same-URL quick view

**Files:** `ProductRoute.tsx`, `ProductDetailModal.tsx`, shared ProductContent, metadata and product history adapter; serialize renderer and App overlaps.

**Work:** direct/new-tab/reload shows a full document with meaningful H1, identity, gallery, factual description/specs/conditions, current supplied offer/basis, qualified interchanges/media and bounded fitment section. Core content is readable without opening JS-only tabs. Ordinary listing click may use the same content in a quick view; include a native full-details destination and meaningful return navigation.

**Acceptance:** one supported product URL/canonical/schema identity across presentations; no mixed-product metadata while switching. Close/Back restores precise catalog state. Fitment pagination labels total/range and uses supported native URLs; secondary failure does not erase verified identity. Existing fitment rows lack engine data: do not fill it from selected vehicle or promise engine fit. Desktop full page uses useful space; overlay width is set deliberately at its breakpoint rather than defeated by `sm:max-w-lg`; mobile has reachable close, sensible scroll and no nested short specification viewport. Verify long content, intermediate widths, 200% zoom and focus; keep checkout disabled.

### RP8 — Curated catalog documents and browser parity

**Files:** shared route registry/resolver, server catalog loader/view, App/tree/breadcrumb/native pagination integration and reviewed nginx source. Navigation/rendering owners coordinate one writer per file.

**Work:** start with one verified vehicle family and a small explicit engine/type cohort. Render useful parent choices and a bounded real listing under the exact same request contract as the browser. Reuse current reference/listing endpoints and validated hydration data. Preserve all six dimensions even for non-indexable filtered views. Native links connect parent hubs, selected type, products and additional result pages.

**Acceptance:** pasted URL works in a clean browser and without JavaScript, headings/links/first rows agree with hydrated state, page 2 serves page 2, explicit scope beats garage. Validated engine/type selection is distinct from product-backed coverage and fitment assurance. Unknown combination is a real 404; valid zero is honest noindex; outage is not zero. Initial caps are **at most 20 curated catalog documents and 50 supported product identities**, not targets to fill with thin pages. The first milestone may be only one leaf and a handful of useful products. D1587/global eligibility projection is not assumed or authorized.

### RP9 — Measure and remove avoidable work

**Files:** existing adapters/cache/hooks and owned timing instrumentation; no speculative ERP SQL/cache change.

**Work:** record last-keystroke-to-visible choices, request start/end, payload bytes, ERP call counts and hydration duplication separately. Reuse cached reference lookups; debounce/cancel superseded independent requests without cancelling a shared in-flight reference lookup needed elsewhere. Avoid full parts/facets/dimensions requests on every keystroke. Reuse identical accepted requests within the existing freshness contract only; do not introduce long-lived price/stock caching.

**Acceptance:** same canonical input has bounded calls/results; dismissed/stale work stays dismissed; reference warm and first-use measurements are labeled. Capture sample size and environment; no p95 from a few observations, no 19 ms warm diagnostic presented as cold performance. Establish measured suggestion/render budgets before enforcing them. When an upstream operation dominates, file a separate evidenced ERP performance task rather than conceal it with a longer UX spinner. Loading, empty, refused and failed remain distinguishable.

### RP10 — Crawl/content readiness and finite expansion

**Files:** central metadata/index policy, explicit eligible route registry, bounded sitemap generator/fixtures and launch record. No public enablement in this package.

**Work:** gate each candidate on verified identity, useful supplied content and real listing eligibility under the chosen storefront mode. A reference vehicle, global category count or vehicle-category sitemap feed alone is insufficient. ERP product sitemap Shopify-live gating differs from PDP visibility/sourceability; record and reconcile rather than blindly copying the feed. Use real content lastmod or omit it, stable sharding and last-good/single-flight behavior before broad generation.

**Acceptance:** internal links, canonical, schema and candidate sitemap loc agree; only successful substantive eligible canonical documents enter XML. Exclude zero/ambiguous/outage/unsupported IDs and arbitrary filter variants. Product schema describes visible true facts; identity-only Product does not establish rich-result eligibility, and missing offers/reviews must not be fabricated. Validate against [Google's Product snippet requirements](https://developers.google.com/search/docs/appearance/structured-data/product-snippet). Preserve staging protections. Later public launch needs an approved host/brand/market, source-data authority, coordinated robots/noindex/sitemap policy and separately authorized deployment/Search Console work.

Distinct Roys and Autrex stores need truthful seller/service content, not duplicated invented intros. Do not cross-domain canonical independent stores indiscriminately or use hreflang to link different brands. Preserve Autrex existing locale routes; CA/US or .com migration is not part of this plan.

### RP11 — Integrated review and acceptance

**Owner:** independent reviewer for each exact PR head; infra for pinned merge/deploy; one executor for the coordinated hosted run. No duplicate workers test the same release.

**Acceptance:** the end-to-end journey in section 2 passes at 1440 and 390 with real staging data, keyboard/pointer and recorded effective requests. Validate native/new-tab/no-JS routes, empty/error cases, focus/history, no overflow and supported product content. A physical mobile keyboard check is recorded separately. Confirm served revision before/after and report page errors/refusals without retrying a blocked gateway. Reuse previous unchanged acceptance; only affected cases plus milestone integration run. UI readiness, CI, deployed revision, hosted behavior and future public index readiness are separate statuses.

**Release inventory:** exact included commits, upstream contract changes, renderer artifacts, nginx/settings delta, rollback point and smoke command. Staging remains CAD/Canada/test lists with checkout disabled. A docs-only plan PR requires no new hosted storefront acceptance.

### RP12 — Optional Autrex adoption

**Files:** separate capautov3 branch/owner; its intent/resolution/suggestion/request adapters and dropdown presentation only as demonstrated necessary.

**Acceptance:** opt-in candidate first; reuse the existing 75-case search corpus and add engine/type/URL/alias/exact-interchange controls. Keep purchasable defaults, six dimensions, explicit URL priority, existing en-ca/en-us/fr-ca grammar, tire/wheel redirects and ERP ordering. Autrex already SSRs default vehicle/category listings: do not rebuild that as “missing.” Do not repurpose its fourth path segment as engine. Fix bounded dropdown height where independently accepted. No default flip, production promotion or market migration bundled with Roys.

### ERP-C — Conditional additive contract only

Trigger only when RP2 demonstrates an unavailable bounded capability, such as prefix part-type discovery with explicit identity and residual/ambiguity semantics. First document existing endpoint inputs, limits and exact missing output. If needed, propose an opt-in grouped response/endpoint with caps, stable IDs, complete scope keys and declared reference-versus-eligible status; legacy responses/default ordering remain unchanged. Use existing reference and listing logic, bounded query/cache safety and targeted contract tests. No new data projection, database population, global coverage promise or direct DB workaround. This task can block broad search claims while a finite verified pilot proceeds honestly.

## 5. Ownership, cost and validation discipline

- One smaller-model worker per bounded implementation PR. Parent owns contract decisions and integration review. The three completed audits are reused; do not commission the same investigations again.
- RP1–3 serialize App/Tree/search ownership. RP5 can proceed independently only with `erp-api.ts` mapping ownership explicitly separated. RP6–8 serialize ProductRoute/entry/server integration. RP4 never lands against stale cart-strip geometry.
- Show a concrete candidate diff before broad presentation changes. Prefer existing Radix/native controls, catalog helpers and scripts; no runtime LLM per keystroke, framework migration or paid SEO tool dependency.
- Validation ladder: inspect diff → smallest meaningful affected remote checks → one diff-aware `agent-pre-push`, after `dev-remote --queue`. VM511 owns builds/tests/Firefox. No duplicate broad suite during CI or repeated passing browser groups without relevant changes.
- Every PR has a Smoke plan, exact settings inventory, evidence/limits and available-review disposition. Independent exact-head review and green required CI precede infra merge. Pending CI is a handoff state, not a reason for polling loops or a completion claim.
- Keep the umbrella open until the shopping and destination-page milestones are accepted. Optional recent-vehicle garage, comparison tooling, full interchange browsing and commerce remain separate roadmap tasks; they do not delay the core search/PDP journey.

**Next implementation task:** claim RP1 against current staging with the destination table and inactive #20 contract; define its interface for RP2 before another owner edits search. In parallel, RP5 may be assigned a disjoint product-mapping slice. This planning PR itself enables no runtime, upstream, indexing or deployment setting.
