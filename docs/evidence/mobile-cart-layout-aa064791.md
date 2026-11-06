# WP-ROYS-MOBILE-CART-LAYOUT1 aa064791

Base: `5867b1e1e8e5e39fa054575446145643970c3462` (`origin/staging`, #20/#21/#22).
Owned scope: App presentation, existing mobile action checker, this evidence record.
Toolbox rungs 1 and 5: existing Sheet/Button styling/Badge and existing checker;
no dependencies or new UI components.

## Evidence and decision

- Reused the single hosted combined run at 5867b1e, without repeating its live
  baseline: `/srv/dev/reports/infra/roysauto-2026-11-06/verify-hosted-combined-5867b1e/actions/`.
  Its 390x844 screenshot/report show Details at x272–365, y779–811 covered by
  App's fixed bottom-right Quick Cart. Row actions themselves do not overlap.
  #21 passed 12/12 in that combined run; those state/storage tests are not repeated.
- Tail padding only helps the final scroll position. Reserve the cart's actual
  content height as a non-scrolling flex sibling below the main viewport at <lg.
  Remove the obsolete tail spacer; allow the catalog flex area to shrink with
  `min-h-0`. The strip adds only normal padding plus the bottom safe-area inset.
- Retain one mobile control, the existing Sheet/cart state, saved-line count
  (including zero), and `Open Quick Cart` accessible name. Visible text reads
  `Quick Cart` / `N saved`; the count still denotes saved lines, not quantity.
  Desktop retains its right panel. No state/storage/vehicle handlers or #20/#22
  behavior/classes changed; no checkout or business-data writes.
- Parent identified Header17's React18 trigger-ref compatibility evidence.
  App now uses native SheetTrigger styled with existing `buttonVariants`, like
  Header, so Radix owns its trigger ref and can restore focus. No shared Button
  or cart-close redesign.

## Checker

Extended `scripts/mobile-part-actions-check.mjs`, retaining its shared
`createProductSmokeMonitor` stop-on-first-refusal latch and on-prem environment
assertions. Conflicting Vercel mode is rejected. Optional
`ROYS_ACTIONS_BASE_URL` accepts only `http://192.168.88.250`,
`https://roys-staging.autrex.ca`, or HTTP localhost/127.0.0.1 origins (optional
local port), with no credentials, path, query or fragment. Runtime mode/origin
are reported honestly; hosted mode starts no Vite server. No text-substitution
bootstrap is needed for infra's post-release acceptance.

Candidate coverage uses one real 2020 Toyota Camry 2.5L > Brakes > Brake Pad
setup and resizes the same integrated page. It measures the known SKU
`FLPW_BCD2076` at the main viewport bottom, a real mid-list row at the bottom,
and the final results row at the bottom. It asserts distinct action centers hit
themselves, actions fit inside main, no horizontal overflow, and main ends
above the cart strip. Actual unforced Add/wishlist/Details remain the existing
action journey, with exact +1, independent local lists and same SKU/href checks.
Cart empty/populated reachability, disabled checkout and Escape focus return
are checked separately from the row actions.

## Verification

VM511 only; queue checked before browser validation. No API interception,
fixtures, forced clicks, refusal retries, production/config/DNS/ERP writes,
merge or deployment.

Initial harness attempt, 2026-11-06 2:25 PM EST: sheet opened, but the checker
incorrectly required visual visibility of its intentionally sr-only title.
Stopped before vehicle/row-action groups. Corrected to assert visible dialog
plus accessible name; no product change was needed. Report preserved at
`/srv/dev/reports/roys-mobile-cart-layout-aa064791/initial-harness/report.json`.

The next attempt passed empty/populated cart opening and Escape focus return,
the 390 SKU's exact +1/wishlist/Details actions, and SKU/mid-list geometry. Its
last-row harness incorrectly scrolled to the end of the entire vehicle tree,
past the last results row. Corrected to align the actual row. Evidence is in
`candidate-corrected/` under the same report root. No product code changed.

Bounded continuation (`ROYS_ACTIONS_SKIP_PASSED_390=1`, subsequently replaced
by `ROYS_ACTIONS_RESUME=390-final-row` in the final checker) skipped those
successful 390 groups. It passed the 390 final row, complete 320/600 groups,
and 900 SKU actions. A 900 mid-list measurement then hit the pre-existing
success toast; see the limitation below. Evidence is in `remaining/`.

Final bounded continuation (`ROYS_ACTIONS_RESUME=900-layouts`) runs only the
remaining 900 geometry and untested 1023/1440 groups. The normal candidate
command still checks every group; continuation is explicitly recorded in its
report. Checker geometry now waits for success toasts to expire naturally.
No toast is hidden, repositioned, dismissed, or made pointer-transparent.

Final remaining run started **2026-11-06 2:28:21 PM EST**, exited 0.
Aggregate coverage across the named reports (without repeating passed groups):

| Width | SKU bottom + actual actions | Mid-list bottom | Final results row |
|---|---|---|---|
| 390 | `candidate-corrected` pass | `candidate-corrected` pass | `remaining` pass |
| 320, 600 | `remaining` pass | `remaining` pass | `remaining` pass |
| 900 | `remaining` pass | `final-remaining` settled pass | `final-remaining` settled pass |
| 1023, 1440 | `final-remaining` pass | `final-remaining` settled pass | `final-remaining` settled pass |

All completed geometry cases have no row-action overlap or horizontal overflow,
and action centers hit their own controls. At 390, main is y319–783 and the
intrinsically sized strip is y783–844 (61 px, safe-area inset is zero in Firefox).
At 900/1023, main ends and the strip begins at y839. At 1440 the strip is hidden,
main ends at y900 and the desktop cart panel remains alongside it.

Real SKU: Bremsen BCD2076, $39.00 CAD / In Stock. Every width's unforced action
group passed exact +1 cart quantity, independent wishlist, same native
`/products/FLPW_BCD2076` link/overlay and unchanged lists for Details. The 390
cart empty/populated cases and Escape focus return passed. Total catalog
responses across the four bounded attempts: 35, all 200; no refusal/reference
or page errors. Only disposable browser-local lists changed.

Screenshots inspected include `candidate-corrected/390-{actions,details,mid-list-at-bottom,cart-populated}.png`,
`remaining/320-actions.png`, `remaining/600-final-row.png`,
`final-remaining/{1440,1023}-actions.png`, and
`final-remaining/900-mid-list-at-bottom.png`. Integrated 1440/390 pages retain
the current-context banner, ink/paper/burgundy design and CAD pricing. Compared
against the design-system desktop/mobile mockups; replacing their overlapping
mobile FAB with the reserved strip is this task's intended change. Desktop
retains the existing panel and disabled test checkout.

`git diff --check`: passed. One required
`AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push`: passed on VM511,
TypeScript plus all 48 existing contract tests, 15 seconds. Build is left to
authoritative GitHub CI. No successful check is repeated. Git/PR/CI and
available reviewer feedback are recorded at handoff; this evidence does not
claim CI or hosted acceptance ahead of those gates.

## Separate existing limitation

The pre-existing Sonner `Added to test cart` toast can temporarily cover
results/control areas after Add, independently of Quick Cart. At 900 px it
covered a mid-list Details center while main/strip remained disjoint at y839;
`remaining/900-mid-list-at-bottom.png` and `remaining/report.json` preserve
the failure. Parent was notified through `herdr agent prompt w7:p2` before
any scope expansion; this task leaves Toaster unchanged. Settled layout
measurements wait for the existing toast's natural expiry, which is not a
claim that actions under a live toast are unobstructed.

## Outstanding release gate

This task does not release a runtime. Parent owns independent review; infra
owns the new runtime release and one hosted actions acceptance run against its
exact revision using the supported base URL mode. No hosted pass is claimed
for this candidate until infra records that run.

Infra's VM511 command after queue inspection and exact runtime revision check:

```sh
dev-remote --service env -u ROYS_ACTIONS_RESUME -u ROYS_ACTIONS_SKIP_PASSED_390 \
  ROYS_ONPREM=1 ROYS_CATALOG_PREVIEW_ENABLED=true \
  ROYS_ACTIONS_BASE_URL=http://192.168.88.250 \
  ROYS_ACTIONS_OUTPUT=/tmp/roys-cart-hosted-EXACT-REVISION \
  node scripts/mobile-part-actions-check.mjs candidate
```

Use **default full candidate mode** for new hosted acceptance. Local
continuation is for the named local evidence only; the final checker rejects
it with any supplied base URL and rejects the legacy skip flag when `1`.
Record `/__revision` before/after, actual runtime mode/origin and any first
refusal/reference. No retries on refusal. This proves settled geometry and
the recorded unforced actions; it does not certify every overlay or immediate
availability of targets underneath a live toast.
