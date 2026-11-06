# WP-ROYS-COMPACT-NAV1 aa064791

Task branch: `feat/roys-compact-nav-aa064791`. Based on staging `5867b1e`,
then normally fast-forwarded to PR23 merge `0a57485f021a9f69b757123a8c2d87368b1dc532`
after parent confirmation. Required ancestry verified. No merge, deployment or settings change by this task.

## Scope and decisions

- Extend R1's existing visible tree and breadcrumb controls. These are honest
  in-page buttons; URL/history/native crawl links remain a separate adapter.
- One desktop header row, mobile brand/menu plus full-width search. Existing
  Logo, fonts, theme, search component and combobox behavior retained.
- Current vehicle and full available path remain visible. Secondary vehicle
  actions and routine retention help use native **Vehicle options** disclosure;
  Clear remains visible. Staging, Canada/CAD, checkout-disabled notice and
  conditional storage error/retry remain available.
- Header and breadcrumb **Part Catalog** share the deliberate search/filter/page
  reset exception, preserve active vehicle/saved lists, and focus the root after
  React commits. Mobile menu dispatch waits for Sheet close autofocus. Other
  ancestors only reveal/focus their own tree choices; no active scope, query,
  filters or storage change. New engine selection still uses #21's existing reset.
- Year opens makes, make opens models, model opens engines, engine opens
  categories; category/leaf focuses its actual control through known parent IDs.
  No invented taxonomy names or PCDB mappings.
- PR23 reserved cart strip, native trigger, ref/focus behavior remain intact.
  Parent reports its separate hosted six-width full action acceptance passed at
  `0a57485` (19 API responses, no errors/refusals). This task does not repeat that
  Add/wishlist/Details suite or claim a fresh hosted acceptance.

## References

Read `AGENTS.md`, `CLAUDE.md`, toolbox, R1 roadmap, design system, and prior reports:

- `/srv/dev/reports/roys-search-seo-plan-2026-11-06/PLAN.txt`
- `/srv/dev/reports/roys-vehicle-next-2026-11-06/STATUS.txt`
- Supplied RockAuto cropped navigation:
  `/tmp/herdr-clipboard-images-1001/client-24-clipboard-1793993363324527156-0.png`
- Supplied Roys header/context/tree:
  `/tmp/herdr-clipboard-images-1001/client-24-clipboard-1793993382845937661-0.png`
- Earlier full RockAuto results:
  `/tmp/herdr-clipboard-images-1001/client-24-clipboard-1793988452344384408-0.png`
- Parent's read-only RockAuto reference:
  <https://www.rockauto.com/en/catalog/chevrolet,2015,silverado+1500,5.3l+v8,3307665,suspension,ball+joint,10070>

All three supplied images were viewed. They establish spacing/navigation direction;
different crops do not establish full-page pixel-height differences. Historical
Roys mockups remain brand references. No fresh RockAuto mobile/keyboard/performance claims.

## Evidence ledger

Hypothesis: repeated top bands/context copy consume too much catalog area.
Command: queue first, then VM511 Firefox real fixed staging LAN run:
`dev-remote --service env ROYS_ONPREM=1 ROYS_CATALOG_PREVIEW_ENABLED=true node scripts/compact-navigation-check.mjs baseline`.
Result: matching empty/2020 Toyota Camry 2.5L Brake Pad states at 1440/390/900
passed, 21 API responses, zero page errors/refusals. Selected top chrome was
215/319/263 px; main available height 685/464/576 px respectively.
Decision: compact presentation without shrinking body text or clipping controls.

Baseline artifacts: `/srv/dev/reports/roys-compact-nav-aa064791/baseline/`.
Source runtime is Vite on VM511 using `ROYS_ONPREM=1`, fixed LAN upstream;
same shared stop-on-first-refusal monitor, no API interception or catalog fixtures.

Hypothesis: breadcrumb reveals can preserve active scope while opening the exact
requested choices. First candidate VM511 run confirmed all five controls at 1440
from fully collapsed branches, stock-filter preservation, exact active engine,
unchanged storage/lists, and zero extra parts requests. A separate text-search
state retained `q=brake`, brand `BHWL`, and page 2 across year/make/model/engine
browsing, with zero extra parts requests. Twelve API responses were 200; zero
page errors/refusals. The existing native disclosure aria/focus behavior was used.

The first candidate did not pass overall: its desktop header flex sizing wrapped
the hours too narrowly (107 px header). The presentation fix gives the flexible
search remaining space and prevents wordmark/utility shrink, without reducing
text size. The checker then incorrectly expected inline results to stay mounted
under a deliberately collapsed Brakes branch after Catalog reset. The root had
focused correctly and issued the expected category/engine/page-1 request with
no text/brand. The checker now verifies root focus/request first and reveals the
leaf before inspecting reset filters/page. This is a harness correction, not a
vehicle/storage change. A continuation resumes the failed root/header portion;
the passed 1440 ancestor groups are retained, rather than repeated.

First-candidate artifacts: `/srv/dev/reports/roys-compact-nav-aa064791/candidate/`.

The next continuation confirmed the final-source 1440 geometry: header 53 px,
selected top chrome 114 px versus baseline 215 px, main height 786 px versus 685 px,
search input width 478.18 px. The actual screenshot was inspected by this worker
and independently accepted by the parent. Wordmark, search, Account explanation,
hours and full available breadcrumb are intact. No zoom/body-font reduction or
control clipping was used. Artifacts:
`/srv/dev/reports/roys-compact-nav-aa064791/candidate-1440-root/`.
That continuation stopped on a checker-only variable-scope error before root
verification; the misplaced continuation-block brace was corrected. Final-source
geometry and earlier ancestor groups are retained; `1440-root-v2` resumes only
the unverified root/header section, followed by unrun mobile/intermediate groups.

The `candidate-1440-root-v2` continuation passed the unverified 1440 root/header
checks, all 390 ancestor/state/text-search/root/menu checks and 900 ancestor/state
checks. Thirty-one API responses were 200; zero page errors/refusals. The only
remaining assertion counted native input placeholder/text scrolling as control
clipping at 1024; the field-width >=240 px assertion had already passed. The
narrow `desktop-wrap` continuation bounds the field and checks label/explanation
clipping separately, without rerunning the accepted 1440/390/900 groups.

| Matching selected state | Baseline top chrome | Candidate top chrome | Baseline main height | Candidate main height | Candidate search width |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1440 × 900 | 215 px | 114 px | 685 px | 786 px | 478.18 px |
| 390 × 844 | 319 px | 210 px | 464 px | 573 px | 366 px |
| 900 × 900 | 263 px | 182 px | 576 px | 657 px | 744 px |

Main/strip boundaries were exactly 783/783 at 390 and 839/839 at 900; no overlap
or horizontal overflow. Default 1440/390 targets (<=145/<=210 px) are met for this
named vehicle/category, not guaranteed for every longer label or error state.
Expanded options intentionally use normal space: at 390 top chrome becomes
342 px with 441 px main remaining; controls/help are visible without clipping.
Worker inspected 1440, 390 selected/options-open, and 900 screenshots; parent
independently accepted those same views. No font/body shrink or zoom was used.

Explicit accepted behavior evidence (not just geometry):

- All five available ancestors reveal their own correct choices and focus from
  fully collapsed branches; engine active highlight/exact accessible name and
  storage/lists remain unchanged. Stock filter is retained. Zero parts requests
  during each bounded reveal group at 1440, 390 and 900.
- In committed text search, year/make/model/engine preserve `q=brake`, brand
  `BHWL` and page **2**, with no parts request, at 1440 and 390. Category remains
  available in category mode; it is not falsely shown as active during text search.
- Breadcrumb and Header Catalog deliberately reset search/brand/page while
  preserving saved state and active engine, issue only the expected scoped
  category/page-1 request, and settle focus at the visible root after commits.
- Disabled Account retains its associated explanation; combobox open/arrow/Escape
  retains input focus. At 390, Menu > Search, Escape return, Catalog close/root
  focus and native cart Escape/trigger focus pass. No full action suite repeated.
- Native Vehicle options Enter/Tab/Space and visible controls pass at 390/900;
  above-lg keyboard/geometry continuation is recorded below when complete.

Artifacts: `/srv/dev/reports/roys-compact-nav-aa064791/candidate-1440-root-v2/`.
One literal space separates the notice and All vehicles in the empty state; it
does not affect selected-state geometry or behavior. No rerun of accepted groups.

## Fresh hosted acceptance (post-deploy, not run by this task)

The owned checker supports `ROYS_COMPACT_BASE_URL` using PR23's known staging
origins (`http://192.168.88.250`, `https://roys-staging.autrex.ca`) or HTTP localhost.
It rejects credentials/path/query/hash and other origins, requires the same
on-prem activation env/refusal guards, and reports runtime mode/origin. No Vite
server starts in hosted mode. Hosted acceptance requires full `candidate` mode
with no positional continuation; local `desktop-wrap`/baseline/continuations are
rejected. Only syntax/static review was performed for this additive harness wiring;
it does not establish a hosted UI pass and did not trigger a repeated UI run.

After approved integration/deploy, infra may run the exact fresh command from
the task worktree (no third/continuation argument):

```sh
dev-remote --service env ROYS_ONPREM=1 ROYS_CATALOG_PREVIEW_ENABLED=true ROYS_COMPACT_BASE_URL=http://192.168.88.250 node scripts/compact-navigation-check.mjs candidate
```

## Above-lg continuation and final verification

`dev-remote --service env ROYS_ONPREM=1 ROYS_CATALOG_PREVIEW_ENABLED=true node scripts/compact-navigation-check.mjs desktop-wrap`
passed at 1024 and 1100 using one loaded vehicle/cache, resizing without another
full journey. Seven API responses were 200; no errors/refusals. Both widths have
53 px header, 114 px default selected top chrome, 786 px main height, and
323.95 px search input width. Field/control bounds fit the viewport; actual
labels and Account explanation are not clipped, and the explanation is visible
and accessibly associated. Native input text/placeholder scrolling is normal
within its field and is not misreported as control clipping. Native options
Enter/Tab/Space and all secondary controls are discoverable. Open options use
234 px top/666 px main at both widths, without horizontal overflow. Both actual
screenshots were inspected by the worker. Artifacts:
`/srv/dev/reports/roys-compact-nav-aa064791/desktop-wrap/`.

Final owned checker syntax: `node --check scripts/compact-navigation-check.mjs`
passed. `git diff --check` passed. No accepted UI groups were repeated for hosted
base wiring. Required diff-aware pre-push and PR results follow below.

Required pre-push: `AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push` passed
on VM511 (TypeScript + all 48 tests; `DEV_CHECK pass checks=typecheck,test`,
15 seconds). Queue was checked first. No separate broad build/test/browser suite
was run to duplicate CI. GitHub Catalog CI/build remains the merge gate.
