# WP-ROYS-SCROLL-NAV1 aa064791

Claimed in branch `agent/roys-scroll-navigation-aa064791`, worktree
`/srv/dev/wt/roys-scroll-navigation-aa064791`, base `b5e67c9` (current origin/staging).
Own App/Tree/catalog presentation/product navigation and focused checks only.
No renderer, server, build, mapping, catalog data or settings changes.

Hypothesis: default result reveal is re-applied while data/tree mount and product
history restore competes with dialog focus. Bounded hosted Firefox investigation
at 1440/390 precedes implementation; use saved Camry 2020 engine 17637 Brake Pad.

## Hosted reproduction

Served revision before/after: `b5e67c966f89`, unchanged. Firefox 1440/390,
real fixed staging GET calls; no Vite or cart/checkout action. Baseline1 stopped
on an ambiguous harness category selector. Baseline2 corrected it, recorded
successful desktop category/page/filter observations and stable pointer product
open, then stopped on harness readiness aimed at an inactive Fitments tab.
Baseline3 corrected readiness to the visible loaded product description, skipped
completed desktop listing groups, and completed outstanding desktop/mobile flows.
Reports/screens preserved on VM511 under `/tmp/roys-scroll-navigation-baseline{1,2,3}`;
reports copied to `/srv/dev/reports/roys-scroll-navigation-aa064791/` on VM510.

Confirmed cause: product Close/Back publishes an empty resolving listing. Results
unmount, main height shrinks, the browser clamps/anchors scroll, then results are
fetched and mounted again before final presentation restore. Desktop main scroll
4034 -> 3562 (results absent) -> 6234 -> 3861 (zero rows) -> 6270 -> 4034.
Mobile 6642 -> 3715 (absent) -> 8888 -> 4090 (zero rows) -> 8984 -> 6642.
Final restoration alone concealed these intermediate jumps. Product OPEN retained
all 24 rows and exact background scroll; document scroll remained zero throughout.

The existing category-reselect and Next handlers reveal the top of **new results**
(main 1844; results y=114 desktop/210 mobile), consistent with the navigation
contract. Stock filtering resets page 2 to page 1. These are distinct from the
unintended same-list product-return jumps. Baseline3 recorded 42 API responses,
all 200; no refusal/reference or page error. Native reload changed documents,
reported `reload`, retained history length and restored exact listing URL/scroll.

Proposed narrow repair: retain the already accepted listing and its request key
when a genuine overlay returns to its exact background history entry. Require
matching validated overlay/destination presentation href and equivalent complete
parsed listing state. Changed destinations, direct products, invalid URLs and
ordinary hydration continue through existing reference resolution. No query,
data, ranking, six-dimension, vehicle-memory or Catalog/Clear policy changes.

## Candidate validation

VM511 source identity `8ab60b3d2fb1`: affected controller fixtures passed 19/19.
New coverage observes every controller publication during two overlay roundtrips
with all six configuration dimensions, category, PCDB, brand, availability and
page. The listing object is retained and resolver count stays one. Different
page, direct product, missing/invalid overlay capture and mismatched destination
presentation all resolve normally. An obsolete deferred edit cannot overwrite
the restored listing or push a URL.

`/tmp/roys-scroll-navigation-source1/report.json` passed source-integrated Firefox
1440/390 against real fixed staging reads. It began with explicit page 2 + stock
filter and verified the new listing reveals the results start, then checked
pointer Details, title and image links from the last scrolled row without
pre-focusing. All six cycles retained identical main/results/row nodes and 24
rows through bounded mutation/frame observations; main stayed 4034 desktop and
6522 mobile, document stayed zero. Every Close restored the clicked control and
exact URL/page/filter; no cycle issued another search. Details Forward/Back also
remained continuous. Native reloads changed document identity, reported `reload`,
kept history length 2 -> 2 and restored exact URL and scroll. All 44 API responses
were 200; no refusal or page error. Every captured document-overflow flag was false.

Reports and selected screenshots were copied to
`/srv/dev/reports/roys-scroll-navigation-aa064791/`. Desktop Details return,
mobile image return and mobile loaded product screenshots were inspected;
compact header/context, readable product dialog and reserved mobile cart strip
remain intact. The parent independently reviewed the report and both return
screenshots before approving final validation. This proves the sampled same-list
overlay flow, not every possible product/category bug or standalone rendering.

## Reproducible final checker

Default candidate mode runs the same continuity assertions for source and hosted
origins. Only explicit `ROYS_SCROLL_OBSERVE=1` enables baseline observation and
labels the report `completed-observation`. Hosted runs start no Vite, require an
approved expected 12-character deployed revision before navigation and again
after the journey, reject continuation/positional arguments, and use fresh output.
The hosted bootstrap refinement received syntax/read review; no UI acceptance
is claimed for a deployment of this task before merge.

After integration/deployment approval, set `approved_revision` to that exact
approved deployed revision (paired with infra’s full `REVISION_FULL`), then run on VM511 after checking the queue:

```sh
dev-remote --service env -u ROYS_SCROLL_OBSERVE -u ROYS_SCROLL_CONTINUE_DESKTOP -u ROYS_SCROLL_OUTPUT -u VERCEL ROYS_ONPREM=1 ROYS_CATALOG_PREVIEW_ENABLED=true ROYS_SCROLL_BASE_URL=http://192.168.88.250 ROYS_SCROLL_EXPECTED_REVISION="$approved_revision" node scripts/scroll-navigation-check.mjs
```

The established refusal monitor stops the run on actual upstream refusal, with
no retries. API request observation permits only GET `/api/catalog`; the existing
proxy's resource/parameter allowlist is unchanged. No lists or commerce actions
are used. The existing new-result reveal behavior is recorded, not accepted as the final category/page UX. The deployed test host
still serves baseline `b5e67c966f89`; this branch has not been deployed or merged.

The first required pre-push reached VM511 after 4m10s in queue, then found
TS7022 in the new fixture’s assertion-narrowed counter (`const before =
resolutions`). An explicit `number` annotation fixes the fixture type inference;
application/browser source is unchanged. The corrected required gate is recorded
in the PR; no broken branch was pushed.

Brian subsequently identified category selection/page changes as the primary
trigger. The baseline category action reselected the already active Brake Pad;
it did not validate switching to another leaf. Recorded pagination does show row
removal, height clamp/anchoring and final result-start alignment. The parent
assigned actual different-leaf/page UX repair to a separate listing-scroll WP.
This branch remains limited to the confirmed same-list product-overlay repair;
its passing browser check does not close that primary listing-navigation work.

## Required final gate

Corrected `AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push` passed on VM511
source `15632cd109eb`: typecheck and 93/93 registered tests. It completed in
271 seconds including 4m12s in the existing queue. The existing result was read
after an external queue update; no duplicate job or browser run was launched.
Only documentation/PR/handoff recording changed after this gate.
