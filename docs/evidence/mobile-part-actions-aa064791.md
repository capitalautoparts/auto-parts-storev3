# WP-ROYS-MOBILE-ACTIONS1 aa064791

Task base: `origin/staging` / `5b740399e3c9184cbfb051a1006505921a413b94`.
Scope: `PartsTable.tsx`, the dedicated check script, and this evidence record.

## Cause and smallest correction

The mobile horizontal action group gave the nonshrinking Details anchor `w-full`.
That consumed the entire available width and collapsed its Add/wishlist sibling
to zero width; the sibling's children still painted underneath Details.
Change only Details to `w-auto md:w-full`: content width on mobile, existing full
width in the desktop column. No action handler, primitive, product anchor,
price/availability logic, disabled condition, theme or desktop breakpoint changed.
Native modified-click handling remains the existing `followProduct` implementation.

## Baseline evidence

Original failure: `/srv/dev/reports/roys-active-vehicle-aa064791/second-harness-run/mobile-pointer-interception.txt`
and `report.json`. Exact original caller:
`second-harness-run/active-vehicle-check.mjs:95` (unforced Add click).
Firefox 390x844, real 2020 Toyota Camry > 2.5L 4-Cyl L > Brakes > Brake Pad,
SKU `FLPW_BCD2076` (Bremsen BCD2076). Details intercepted Add for 45 seconds.
The older `final/390-current-b.png` is subsequent keyboard setup, not a
failure-instant screenshot or evidence of tapping.

One narrow baseline check on VM511 at **2026-11-06 2:12 PM EST**:

```sh
dev-remote --queue
dev-remote --service env ROYS_ONPREM=1 ROYS_CATALOG_PREVIEW_ENABLED=true node scripts/mobile-part-actions-check.mjs baseline
```

Result: expected overlap reproduced with bounding rectangles and
`document.elementFromPoint`, without forced clicks. Seven catalog reads, all 200;
no refusal/Ray or page errors. New screenshot records this measured failure state:
`/srv/dev/reports/roys-mobile-actions-aa064791/baseline/390-actions.png`.
Raw measurements: sibling `clientWidth=0`; Details `flex-shrink=0`.

| Action | Baseline x / width (px) | Baseline center hit | Candidate x / width (px) | Candidate center hit |
|---|---|---|---|---|
| Add | 61 / 71.80 | Details | 61 / 163.27 | Add |
| Wishlist | 136.80 / 36 | Details | 228.27 / 36 | Wishlist |
| Details | 69 / 304 | Details | 272.27 / 92.73 | Details |

## Candidate verification

VM511 Firefox integrated Vite page, **2026-11-06 2:13 PM EST**:

```sh
dev-remote --queue
dev-remote --service env ROYS_ONPREM=1 ROYS_CATALOG_PREVIEW_ENABLED=true node scripts/mobile-part-actions-check.mjs candidate
```

One real vehicle/category setup, then resize the same page; no broad journey,
fixtures or API interception. Fixed approved LAN staging gateway only. Shared
`createProductSmokeMonitor` stops on first refusal/reference without retrying.

All **390, 320, 600 and 1440 px** cases passed:

- All three bounds separate, inside viewport, and each center hits its own action.
- Actual unforced taps at mobile widths and click at desktop add exactly one
  `FLPW_BCD2076` to browser-local cart; no Details navigation or wishlist change.
- Wishlist independently adds/removes that SKU, leaves cart and URL untouched.
- Details retains native `/products/FLPW_BCD2076` href and opens the
  **Bremsen BCD2076** overlay; both local lists remain unchanged.
- No document/body/table/action-container horizontal overflow; no page errors.
- 15 catalog responses, all 200; no refusal/reference. Only disposable local
  cart/wishlist changes; no business-data writes or checkout activity.

Screenshots inspected: all eight candidate `*-actions.png` / `*-details.png`
under `/srv/dev/reports/roys-mobile-actions-aa064791/candidate/`. Compared integrated
1440/390 pages with the reference desktop/mobile mockups in
`/srv/dev/reports/infra/roysauto-2026-11-06/`: existing ink/paper/burgundy theme,
compact rows, readable $39.00 CAD and real in-stock availability retained;
desktop keeps Add/wishlist above full-width Details. At 320 px all actions fit.
Original unavailable-price `disabled={part.price === null}` remains unchanged;
the selected real row has a price, so this run does not claim a null-price fixture.
Modified-click code and native anchors are unchanged; no extra product-tab journey
was run for this layout-only correction.

Machine-readable evidence: `baseline/report.json` and `candidate/report.json`
in `/srv/dev/reports/roys-mobile-actions-aa064791/`.

## Required validation and handoff

`git diff --check`: passed. Required
`AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push`: passed on VM511 (typecheck
and all 35 existing contract tests; 12 seconds). Existing product-history contract
also confirms ordinary versus native modified link handling. Build belongs to CI.
CI/review and exact pushed head are recorded in the PR and watcher handoff.
No merge, deployment, activation, credentials or hosting settings change.
