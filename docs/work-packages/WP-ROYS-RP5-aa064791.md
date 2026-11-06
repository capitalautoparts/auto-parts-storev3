# WP-ROYS-RP5-aa064791 — shared product facts

Owner: RP5 worker; parent w7:p2. Claimed 2026-11-06 (EST).
Base: 2ab0501a0f9bfc27f85f38ad49749e314a43b883, merged plan PR26.

Scope: preserve existing product detail response facts in the shared mapper with additive product-only types and a safe legacy display projection. Ordered specifications retain units and repeated names; descriptions retain language and short/long text; website media and inline interchange type/notes survive; application conditions stay separate. Identity, current CAD pricing, pack/core, availability and fitment engine honesty remain unchanged.

Owned code: server/product-data.ts, product-only interfaces in src/lib/api.ts, existing tests/product.test.ts. This scope/evidence document is owned. No shared runner registration required. No navigation, transport, renderer, modal, ERP, endpoint, deployment or allowlist changes. RP6/7 consume the additive model; this is not full PDP/SSR completion.

Reuse evidence: /srv/dev/reports/roys-parity-analysis-2026-11-06/SEO-PRODUCT.md; ERP source pinned 4e3ed42eeb47de65eaf29d65796e9eaef8bc9131. No repeated audit. No warranty/code interpretation, inferred fitment, generated marketing or commerce activation.

Review gates: send exact field shapes/file list before broad edits; send concrete diff before remote validation; parent delta review before one push. Remote smallest affected test then one staged diff-aware agent-pre-push; queue check first. Conditional bounded real staging Firefox 1440/390 for current modal impact; reuse unchanged navigation acceptance. PR base staging with Smoke plan/settings inventory. No self-merge/deploy.

## Mapping contract and source evidence

`Part.productFacts` is optional so listing snapshots remain compatible. Verified detail supplies ordered `specsList`, `descriptions`, public `media` URL arrays, typed `interchanges`, `interchangeCount`, application qualifiers and source-section health. RP6/7 must consume these facts explicitly; this package does not expand the current HTML article or full-page presentation.

Pinned ERP `server/src/routes/public-api/v1/products.ts`: 985–1018 separates provenance and ordered name/value/unit attributes from mixed extended-info `specifications`; 1025–1032 supplies inline interchange type/type_name/notes; 1374–1382 supplies coded typed language-bearing descriptions; 1596–1607 supplies separate short/long language fields and specs; 1624–1629 supplies application conditions; 1710–1728 supplies website-filtered media and inline reference count/items. Reused SEO-PRODUCT evidence supports omitting HTS/CTO/LIF/WS1 interpretation; no warranty dictionary is introduced.

- Specs prefer ordered names, preserve differing value/unit rows, and deduplicate only exact rows. Named fallback fills names absent from the ordered list. Reject numeric/snake-case/Unknown labels, sourced internal provenance and unresolved trade/warranty/lifecycle codes. Sourced code exclusions also include MSR/WT1/WD1/HAC/WD2/WT2 from pinned lineTemplates.ts:313,365–370. Acronyms such as ABS/SAE, and supplied No/0/NA/None remain factual text. No guessed expansions.
- The legacy map groups repeated values with units using semicolons. Application qualifiers remain separate. `Object.fromEntries` avoids prototype setters; raw prototype-like names are excluded.
- Descriptions preserve independent short/long kind and associated language, plus coded typed source rows. Only exact coded rows deduplicate; differing language/type/code survives. Legacy `descriptionText` retains short preference; downstream renderers must treat all text as text, never trusted HTML.
- Media is only existing website-filtered response arrays. Accept complete URLs with an explicit HTTPS:// prefix without credentials/control characters/backslashes and within 2,000 characters; reject invalid/overlong values whole. First safe gallery image feeds legacy `imageUrl`. No document is relabeled PDF and no captions/titles/MIME are invented; legacy `assets` stays unset.
- References retain exact supplied part numbers and source type/typeName/notes; invalid identifier whitespace/control data is rejected rather than normalized into another part. Missing/null brand labels remain empty rather than inferred, while supplied optional brand ID is retained; structurally malformed brand metadata is rejected. Valid source count is retained separately from accepted rows. Legacy Notes visibly concatenates type/typeName/source notes, with an unconditional Not Recommended warning for NR even if typeName is missing or contradictory. No recommendation or replacement assurance is generated.
- Source states: missing/null optional section = absent; explicit empty container = empty; structurally invalid container/all invalid rows = malformed; mixed valid/invalid, policy omissions or inconsistent reference counts = partial; otherwise available. Source states remain independent: valid fallback never hides malformed specs_list. `sections.descriptions` reports the coded source array, not the separate short/long fields. Website array states are per media array.

## Verification ledger

| Hypothesis | Command/result | Decision |
|---|---|---|
| Useful facts already exist in the allowed response | Reused saved audit; bounded pinned source snippets above | No endpoint, allowlist, transport or ERP changes |
| Current Notes cell can preserve qualifications | Inspected existing ProductDetailModal.tsx Notes rendering; parent confirmed | No consumer scope expansion |
| Rich facts preserve invariants and reject unsafe secondary data | VM511 targeted `node --experimental-strip-types --test tests/product.test.ts`: 17/17 pass, 0 fail | Mapper fixture layer passed; browser/full validation await parent diff review |

Existing product-history test is frozen unchanged; RP1 owns any dependent navigation compatibility changes on its own branch.

Parent coherent review addressed before browser: extended sourced code exclusions; reject malformed present description code/type/language metadata with per-source partial/malformed state; retain null-brand references and optional brand ID; require explicit HTTPS URL prefix. Affected VM511 product fixtures rerun after these changes: 19/19 pass, 0 fail. Prior 17/17 result is retained only as the earlier checkpoint, not the final fixture count. Parent accepted corrected diff and cleared the first bounded browser slot; existing history assertions remain unchanged.

## Bounded real staging browser result

VM511 source-integrated Firefox with fixed on-prem staging reader, 2026-11-06 16:26 EST: direct `DVNJ_ALD1212M` checked at 1440x900 and 390x844. Shared product refusal monitor, no mocks, interception, forced clicks, environment conflict bypass or catalog rerun. Final continuation: 10 API responses, all 200; no refusal/page error. Prior unchanged product route/focus/history acceptance is reused, not rerun.

- Actual SKU supplied one safe image, zero ordered shopper specs and zero inline references (supplied count 0); videos/documents explicitly empty. Mixed `specifications` contained policy omissions, reported partial rather than empty success. Coded descriptions and application qualifiers available. NR/repeated specs/rich gallery/malformed-secondary guarantees are fixture evidence only, not claimed live rows.
- First mapped image source/currentSrc and successful load verified at both widths (390 natural width 494). Dialog: desktop x464 y187 width512 height526; mobile x16 y87.5 width358 height669. Actual tab/table scroll containers and dialog had no horizontal overflow; document fits viewport. Close/tabs, image, description and empty states readable in inspected screenshots. Existing modal width/design is retained for RP7.
- Historical brand references in design-system.md inspected: ink/charcoal/burgundy and wordmark retained; those mockups do not contain a PDP/modal, and their older floating cart/spacing is not a target for this facts-only change.
- Two early geometry assertions were harness false positives: all-descendant measurement, then intentionally clipped 1px `sr-only` accessibility spans. No runtime/style changes were made. Corrected measurement excludes existing accessibility-only nodes and targets real scroll containers. Separate setup-only invocation lacked Vite dependency links in a new source-identity workspace; existing VM511 dependency helper restored links before any browser requests.
- Exact checker and preserved attempt1/attempt2/attempt3 reports/screenshots: `/srv/dev/reports/roys-rp5-product-facts-aa064791/`. Desktop specs screenshot: `attempt2/1440-specifications.png`; desktop interchanges and mobile specs/interchanges: `attempt3/`. No failed artifacts overwritten. Browser slot released to parent after screenshot inspection.

Final staged diff-aware `AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push` passed on VM511: TypeScript typecheck and 60/60 repository tests, 0 failures, 15 seconds wrapper elapsed. No repeat pre-push or broad local suite. Build remains the authoritative GitHub CI check; source-integrated Firefox did not require a duplicate pre-CI build.
