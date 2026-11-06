# aa064791 — first bounded R1/R7 vehicle context batch

Execution owner: task `aa064791`, branch `feat/roys-r1-r7-vehicle-context-aa064791`,
worktree `/srv/dev/wt/roys-r1-r7-vehicle-context-aa064791`.
Parent `w7:p2` owns integration, independent review and the umbrella roadmap.
Base: `origin/staging` `68950d52b4faad8d970301061b0d2b477aba1689` (includes PR14).
This claims only this bounded R1/R7 work package; neither roadmap item is complete.

## Decision and evidence ledger

| Hypothesis / check | Evidence | Decision |
| --- | --- | --- |
| A category under an already-open engine can disagree with saved vehicle | Before this diff, `selectPartType` updated selected fitment only; storage was written exclusively by `expandVehicle`. Tree only emitted that callback on engine expansion. | Persist the vehicle on every engine/category activation in App; use App selection to derive TreeSidebar highlighting. |
| Disclosure should not choose another vehicle | Before this diff, opening a closed engine implicitly activated it; clicking an open one only collapsed it. | Split native chevron disclosure from engine-name activation; selecting an already-open engine works in one action. |
| Selected context disappears mid-table | Before this diff, engine/category only appeared above inline results; the persistent strip showed year/make/model only. | Reuse breadcrumb/buttons in the strip above the scrolling catalog. Return actions reopen ancestors and focus native buttons after reference data renders. |
| Reuse ladder | Rungs 1–3: breadcrumb/button primitives, TreeSidebar/App, `PartSelection`, `VehicleExpansion`, `savedVehicle`, `safeStorage`/`saveStorage`; rung 5 shared `createProductSmokeMonitor`. | No dependency, new UI component, pure helper file, endpoint or storage format. Narrow script extends the existing browser verification approach; shared browser smoke remains untouched. |

## Candidate review batch

Parent read-only review findings were collected before the first push:

| Finding | Classification / response |
| --- | --- |
| Category breadcrumb remains visible during cross-category text search | Actionable. Breadcrumb uses `scopedCategory`; `selectedFitment` separately retains return context. The focused journey now asserts visible category omission and `q`/category/engine/page request scope, followed by category restoration on return, at both widths. |
| Extra engine row wrapper breaks established smoke parent scope | Actionable. Engine-name and disclosure buttons are direct children of a two-column engine grid; categories span both columns. The focused journey scopes A categories using the original `engineButton.locator('..')` contract. Shared browser smoke and Header17 stay untouched. |
| Original optional Next check did not demonstrate page 2 | Actionable verification gap. Supplemental real page-2 proof is retained; final focused script now requires Next enabled, observes actual page 2, and asserts the first leaf/engine request returns to page 1. No optional skip. |

The originally queued pre-push was allowed to finish once and passed typecheck +
35 tests. A final required pass follows the changed candidate; no overlapping
heavy jobs or pre-review push.

## Validation

Evidence: `/srv/dev/reports/roys-aa064791-r1-r7-context` (`COMMANDS.md`,
`report.json`, `page-reset-report.json` and four screenshots).

- 2026-11-06 12:23 EST: Vite build and the focused real-staging Firefox journey
  passed on VM511. Seven scoped cases; 29 API responses, all HTTP 200; no page
  errors or refusals. A = 2020 Toyota Camry 2.5L 4-Cyl L (engine 17637), B =
  same-model 3.5L 6-Cyl V (engine 2091). A Brake Pad → B → still-open A Brake Pad
  → reload reopens and highlights A. Category is intentionally not restored.
- Integrated 1440×900 and 390×844 screenshots were inspected against the existing
  mockups: ink/charcoal header, paper background, burgundy actions, compact inline
  table and mobile bottom padding retained. Persistent engine/category strip and
  wrapping return controls remain visible mid-table without page/main horizontal
  overflow. Native focus assertions pass for each return action, including
  collapsed ancestors and keyboard activation.
- The real brand-filtered sample had no second page, so a narrow supplemental
  page-reset check reused the same already-built assets (no repeated build or
  entire visual journey). At 2026-11-06 12:26 EST it passed: real Brakes page 2 →
  Brake Pad requests page 1; Brakes page 2 → B engine emits no stale leaf request,
  then B Brake Pad starts at page 1. Twelve additional API responses, all 200;
  no page errors or refusals. Script and exact requests are in the report folder.
- The primary journey also verifies brand reset, pure engine disclosure,
  already-open engine selection, saved engine ID 0 and nonfatal storage writes.
  The ID 0 case checks the local storage sentinel only, not product coverage.
- Initial pre-push passed typecheck and all 35 tests at 2026-11-06 12:27 EST. Final changed-candidate pass and affected Firefox evidence are pending below before push.
Build, Firefox and required pre-push run on VM511 with Node 22 and
`/home/bbarber/.local/bin/vm511-deps .`; VM510 is read/edit/orchestration only.
The focused script uses real staging through the existing fixed on-prem upstream,
reuses the shared refusal latch, and stops on 403/challenge with its Ray/reference.
There are no catalog mocks, endpoint changes, retries after refusal, business-data
writes or product-backed vehicle promises. Categories remain global/reference.

## Scope and remaining acceptance

Included: selected/saved engine agreement on engine/category activation; pure
engine disclosure; already-open engine selection; dependent filters/page reset;
persistent selected year/make/model/engine/category breadcrumb; Categories,
Change engine and Change vehicle native focus; coherent selection after collapse.
Inline single-page results, theme/density, mobile bottom padding and PR14 product
route/history/metadata code are retained.

Remaining R1: URL query path and full reload/Back/Forward hydration (including
category restoration), exact-level deep links, cache headers/prefetch/reference
performance budgets and warm-tree p95 measurements. Breadcrumb return actions in
this batch reveal the existing year/model/engine/category choices in-page.

Remaining R7: five recent guest vehicles, picker/dropdown/full-width mobile list,
clear/remove controls, and broader garage corruption/disabled-storage coverage.
The existing single saved vehicle format remains unchanged. Account garage is
still gated. Mobile Quick Cart close is an independent follow-up. Full R1/R7
completion is explicitly not claimed.

## Smoke plan

1. Required `AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push` on VM511.
2. One focused integrated Firefox journey at 1440×900 and 390×844 using
   `scripts/vehicle-context-smoke.mjs`: real A Brake Pad → B engine → still-open A
   Brake Pad → reload; mid-table context; focused return actions; collapsed
   ancestors; already-open selection; filter/page reset; safe storage failure.
   Engine ID 0 is a local saved-state sentinel check, not staging coverage proof.
3. After an independently approved promotion, repeat this bounded navigation
   journey on the catalog-connected on-prem staging host. No deployment is part
   of this task; protected Vercel previews remain design-only.
