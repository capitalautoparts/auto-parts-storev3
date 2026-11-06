# WP-ROYS-RP1-aa064791 — active catalog navigation

Claimed 2026-11-06 EST by the RP1 implementation lane, parent w7:p2.
Branch `agent/roys-rp1-navigation-aa064791`, starting at merged PR26
`2ab0501a0f9bfc27f85f38ad49749e314a43b883` (`origin/staging`).

Scope: activate root-query state, bounded reference resolution, one committed
vehicle, draft/reveal separation, explicit Catalog/Clear destinations, and
history/main-scroll/focus restoration including existing product overlays.
URL wins over memory; invalid input never falls back. Hydration/popstate do not
save vehicles or push entries. Preserve six configuration constraints without
claiming verification from numeric syntax or search facets.

Owned files: `src/App.tsx`, `src/components/TreeSidebar.tsx`,
`src/features/catalog/navigation-state.ts`, `model.ts`, `product-navigation.ts`,
narrow new catalog navigation controller/resolver and focused fixtures,
`docs/catalog-navigation-contract.md`, this claim and task evidence.
`Header.tsx`/`ProductRoute.tsx` only as necessary for native navigation/history;
`erp-api.ts` only for reference/request transport, never product mapping.
`scripts/test.mjs` for registration. A task-specific integrated browser fixture
may be added; shared smoke scripts remain owned elsewhere.

Excluded: RP2/3 aliases and compound intent parsing, product data/mapping,
ProductDetailModal, PartsTable, renderer/deployment, parent execution board,
pretty catalog links, ERP changes and live probes. Fixed staging gateways,
Canada/CAD, noindex and disabled checkout remain unchanged.

Verification: real transition/resolution/history fixtures remotely on VM511,
one diff-aware pre-push, coordinated integrated Firefox 1440/390 journey using
the existing refusal monitor; actual request/screenshot evidence. Reviewable
staging PR, available review feedback, agent-pr-finish, ready handoff; no merge.

Parent-approved review expansions: browser-only `category_parent` identifies a
verified root for one bounded children lookup; no leaf self lookup/proxy change.
`PartsTable.tsx` adds only three `data-catalog-focus` attributes for exact return
control identity, with no layout changes. `navigation-presentation.ts` owns the
narrow mount-aware restoration helper. After RP5's commit/release, RP1 owns only
the pre-existing product-history test block in `tests/product.test.ts` on this
branch; mapping tests remain untouched.

Earlier 20/20 pure/controller fixtures passed on VM511. After coherent A–G
review changes, the smallest affected remote navigation batch passed 30/30.
The residual header-focus and cumulative category/clear fixes passed 33/33.
Browser, final pre-push and PR evidence are recorded in the task evidence file.
