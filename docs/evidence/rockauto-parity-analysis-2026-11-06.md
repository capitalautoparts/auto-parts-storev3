# WP-ROYS-PARITY2 evidence ledger

Prepared 2026-11-06 EST. This supports the [execution plan](../ROCKAUTO-PARITY-EXECUTION-PLAN.md); proposed behavior is not acceptance evidence. No runtime source, deployment, data, credentials, upstream or indexing setting changed in this planning package.

## Source and provenance

| Evidence | Baseline / location | Limit |
|---|---|---|
| Roys source | `467ac1c20330237cfb282253135271f7a018c3b2` | Current planning baseline, not all future staging commits |
| ERP source/PR ancestry | `4e3ed42eeb47de65eaf29d65796e9eaef8bc9131` | Source inclusion, not an independently inspected running release38 image |
| Autrex search comparison | Current `origin/staging` `3bd2dcb3a7ec516ab71ede4734f2f597a22289c6`; saved audit `03203a44eeffa7a28f24cc5e532c9d330b89303e` | Inspected helper blobs match; not a deployed-web SHA claim |
| Three read-only worker audits | `/srv/dev/reports/roys-parity-analysis-2026-11-06/{NAVIGATION,SEARCH-REUSE,WEB-STAGING-DELTA,SEO-PRODUCT}.md` | No new ERP/Autrex browser/API/DB probes, tests, builds or implementation |
| Prior research/planning | `/srv/dev/reports/roys-search-research-2026-11-06/REPORT.txt`; `/srv/dev/reports/roys-search-seo-plan-2026-11-06/PLAN.txt` | Older measurements labeled with their original baseline; not rerun |
| Latest supplied eight screenshots | Clipboard suffixes below, reviewed by navigation worker; selected reference captures inspected by parent | No verified screenshot SHA/zoom; not controlled pixel/performance measurements |

Worker reports retain detailed file:line chains. `WEB-STAGING-DELTA.md` supersedes conflicting Web branch/service-prefix statements in `SEARCH-REUSE.md`; the consolidated facts below use the correction.

## Findings that select the implementation

| Hypothesis / user observation | Evidence | Decision |
|---|---|---|
| ERP alias/punctuation work should help Roys | ERP [#8681](https://github.com/capitalautoparts/AutoProPartsERP/pull/8681), merge `c559e061e93f`, and [#8693](https://github.com/capitalautoparts/AutoProPartsERP/pull/8693), merge `914159b12390`, are ancestors of inspected ERP source. `vehicleSearchQuery.ts:45–71,109–162` handles aliases/model normalization and bounded relaxed vehicle matching | Reuse verified behavior; Roys must wire it through a compatible adapter. Endpoint does not return trusted engine/type/residual intent |
| Current Roys full phrase parser is incomplete | `src/lib/erp-api.ts:47–55`: year/make plus all trailing text as model; engine reference exists `:38–44`. `VehicleSearchBar.tsx:75–82,103–125`: current dispatch/selection | RP2/3 preserve original/residual phrase and explicitly resolve engines; no global identifier rewriting |
| Selecting model leaves next step out of view | `TreeSidebar.tsx:105–126` expands sets; existing mount-aware focus/reveal `:59–75` is not used. `App.tsx:96–104` clears intent on incomplete selection | Reuse reveal for search; distinguish draft candidate from committed vehicle |
| Brake Pad should behave consistently | `erp-api.ts:60–79` depends on history-loaded children; `:114–118` sends category slug for category, q without category for text. Supplied images7/8 show 38/39 matches | Resolve explicit canonical type independently of tree history; compare effective requests. Do not claim zero results, equivalent scope or wrong fit from counts |
| Catalog does not return to expected destination | `App.tsx:92–94` retains vehicle/category while resetting q/filters/page, per PR24 reviewed policy | New explicit destination contract in RP1, not a claimed PR24 regression. Parent recommendation differs from navigation worker's vehicle-preserving root proposal |
| SEO URL strategy absent at runtime | `navigation-state.ts` and `docs/catalog-navigation-contract.md` explicitly inactive; App has no catalog URL adapter. Product-only history exists | Activate existing contract, then supply actual catalog documents; no second parser/state owner |
| Product page is thin | `server/product-page.ts:31–41` emits identity article; `ProductRoute.tsx:20–23,40–52` removes it/refetches/opens modal; `main.tsx:8` createRoot | Full shared content, proper bootstrap and standalone presentation; changing hydration API alone is insufficient |
| Raw specs need more ERP data | ERP `products.ts:998–1018,1596–1607` already supplies mixed specifications plus named/unit-bearing `specs_list` and descriptions; Roys `product-data.ts:41,46,50` drops/collapses useful fields | RP5 maps existing richer data first; omit unsupported code meanings, do not invent warranty |
| Interchanges require a new endpoint | ERP `products.ts:1023–1032,1725–1728,2544–2554` supplies inline typed/note-bearing references, including Not Recommended | Verify/use inline contract first. Preserve qualifications; no universal substitution claim |
| Full SSR is only a component change | Current deploy packages server/dist/package.json without source/node_modules; nginx forwards products only, other paths SPA fallback | RP6 includes bundled runtime, escaped seed and deliberate route/status dispatch; infra install separately verified |
| Dense rows can be achieved only with padding | Desktop stacked Add/Details actions plus padding set a substantial row minimum; mobile width/cart-overlay bugs have accepted fixes | RP4 changes action structure and measures same data, preserving touch targets and conditions |

### ERP/Web reuse corrections

Autrex [#1612](https://github.com/capitalautoparts/capautov3/pull/1612), merge `b70f039a9950`, **is in current staging**. It concerns confirmed-zero fallback and request/error handling, not complete engine-aware vehicle intent. The local service-prefix commit `2859f8340ea1323490c19b8d4155e203b2f065c4` is **not** in either compared Web baseline; associated-PR lookup returned 422. No published/deployed status for that separate correction is established.

Autrex `vehicleIntent.ts` and `searchIntentRedirect.ts` already resolve catalog-backed YMM/residual text with explicit-URL precedence, but do not resolve engine IDs. Its existing helper may infer Silverado 1500 from a bare name; Roys must retain disclosed ambiguity. Existing Autrex first-page vehicle/category SSR supersedes an October “missing SSR” audit. Its category/subtype path segments cannot be repurposed for engine.

ERP's direct-MPN structured-intent guard (`services/catalog/partNumberSearch.ts`) is distinct from search's exact interchange lane. Do not claim the former protects every interchange/year-like input. ERP [#8832](https://github.com/capitalautoparts/AutoProPartsERP/pull/8832) addresses engine query work, not phrase resolution or demonstrated hosted latency.

## Fresh RockAuto reference browser observations

Parent used genuine Firefox on VM511 through the existing remote runner, extending `scripts/reference-review.mjs` in temporary research adapters. No purchases, account/cart changes, direct ERP calls, spoofed browser identity or challenge bypass. Raw local artifacts: `/srv/dev/reports/roys-parity-analysis-2026-11-06/rockauto/`; raw scraped text and third-party images are not committed to this repo.

| Observation | Artifact | Conclusion and limit |
|---|---|---|
| Desktop Chevy and Chevrolet Silverado phrases both offered 4.3/5.3/6.2 engine choices | `journeys/report.json`, `1440-alias.png`, `1440-ymm.png` | Confirms alias-to-engine chooser for these inputs, not universal slang support |
| F150 and F-150 offered matching engine labels | Same report, `1440-compact-model.png`, `1440-hyphen.png` | Supports equivalent model normalization for this example |
| YMM + `brake pad` offered engines; choosing 5.3L carried part intent into results | `1440-ymm-part.png`, `1440-engine-choice.png` | Whole journey is the useful reference; selection need not erase part words |
| Full vehicle + engine + part text offered Parts choices and a catalog leaf URL | `1440-engine-part.png`, `1440-part-choice.png` | Verified desktop type-choice pattern; reference IDs are not automatically ERP PCDB IDs |
| Direct product document returned 200 with substantial image/text/specification sections | `journeys/desktop-product.png`, product observation in report | Full-page reference, not permission to copy its prose/images/claims into Roys |
| ALD1212M had no suggestion visible at the observation point | `1440-exact-number.png` | Not proof of absent product or failed exact search; listing was not submitted for this case |
| Clicked top Part Catalog tab kept the current catalog URL/context | `followup/report.json`, `1440-after-root.png` | Do not equate tab switching with clearing vehicle/history |
| Separate breadcrumb-root attempt found only one exact text match and declined a guessed click | `root/report.json` | Breadcrumb-root semantics not conclusively observed; Roys proposed root policy is explicit, not attributed to RockAuto |
| At 390, suggestion DOM appeared but welcome overlay intercepted engine click; mobile-site link then redirected repeatedly | `journeys/390-ymm-part.png`, `followup/report.json` | No complete mobile reference-flow acceptance. No forced click/bypass or retry loop. Physical mobile verification remains open |

The initial discovery used `fill`, which did not trigger this site's legacy key behavior; subsequent queries used actual typing. Fixed 1800 ms observation waits are **not latency measurements**. Additional runs addressed selector/tab/mobile ambiguity, not a repeated Roys hosted smoke. Failed/limited evidence is retained.

Reference URLs: [catalog example](https://www.rockauto.com/en/catalog/chevrolet,2015,silverado+1500,5.3l+v8,3307665,brake+&+wheel+hub,brake+pad,1684), [supplied product example](https://www.rockauto.com/en/moreinfo.php?pk=5559897&cc=3307665&pt=10070&jsn=682). No inference about ranking, traffic, domain authority magnitude or conversion was measured.

## Supplied image ledger

Paths share `/tmp/herdr-clipboard-images-1001/client-24-clipboard-` and end `-0.png`:

| Image | Suffix | Visible fact |
|---|---|---|
| 1 | `1793996777463582417` | Roys Chevy input, no visible suggestions; source explains unsupported alias, image alone cannot establish settled response |
| 2 | `1793996840809636697` | Chevrolet prefix gives three model choices, not engines |
| 3 | `1793996888497254990` | Expanded year/make while next model/engine is below viewport |
| 4 | `1793996924471061071` | RockAuto vehicle-plus-part input and explicit engine choices |
| 5 | `1793996936845155691` | Dense RockAuto rows with application information and independent actions |
| 6 | `1793996980434749140` | Roys Catalog breadcrumb while current vehicle remains selected |
| 7 | `1793997084505219918` | Thin Roys modal, raw code specs; category background has 38 results |
| 8 | `1793997110412784748` | Roys literal brake-pad search has 39 results and tall rows |

## Official guidance checked

- [Ecommerce site structure](https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure): internal hierarchy and product links matter; search-box-only discovery is insufficient.
- [Ecommerce URL design](https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites): consistent stable URLs and deliberate parameter identity.
- [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics): useful initial rendering, links and status handling; not a claim that JavaScript is inherently unindexable.
- [Pagination](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading): unique page URLs and canonical handling for distinct pages.
- [Faceted navigation](https://developers.google.com/crawling/docs/faceted-navigation): constrain unnecessary URL expansion.
- [Product snippets](https://developers.google.com/search/docs/appearance/structured-data/product-snippet): required fields and truthful visible data govern eligibility; identity-only schema is not a rich-result guarantee.

## Reused hosted acceptance and remaining limits

Executor reported one fresh full #24/#25 hosted run at **3:35:34–3:36:33 PM EST**, after infra confirmed ERP staging release38 completion. Served revision before/after: `467ac1c20330`; 12/12 cases, 32/32 API 200, 14 searches, zero page errors/refusals, 15 layouts without overflow. Selected top chrome measured 114 px at 1440 and 210 px at 390; 1024/1100 wrapped controls remained usable. Evidence: `/srv/dev/reports/infra/roysauto-2026-11-06/verify-hosted-compact-467ac1c/`, exactly its 15 report-listed screenshots, plus `HOSTING-VERIFY.md`. Parent did not rerun it.

The earlier five-second expect timeout/client-aborted search and later 19 ms warm diagnostic remain separate facts, not performance acceptance. Prior #21/#23 hosted state/action checks are reused for unchanged behavior. Search, URL and product work in this plan needs new affected acceptance when implemented. No production probes or deployed Autrex/ERP SHA verification were added by this research task.
