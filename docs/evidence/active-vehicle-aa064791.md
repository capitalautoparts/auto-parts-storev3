# One active vehicle — aa064791

Bounded R1/R7 correction based on staging `5b740399`. Reuses the 6 November
2026 search research and SEO plan; URL/history, SSR and product routes remain
separate work packages.

The current vehicle supplies search and breadcrumb context. Completing another
engine or category selection replaces it and resets dependent results. Opening
or closing disclosure branches only browses; native controls and multiple open
branches remain available. Change vehicle reveals choices while retaining the
current scope; Clear vehicle removes the scope and saved choice, resets results,
and focuses the catalog picker. Incomplete YMM search selection also clears the
saved choice so an earlier vehicle cannot reappear after refresh.

Storage uses the existing key and helpers. A repeated category choice under the
same vehicle does not rewrite it. When a vehicle write fails, a null tombstone
or guarded key removal clears an older choice where possible. If both writes
and removals fail, the UI still changes immediately and a persistent notice
explains that the old saved vehicle may return. The notice offers a retry;
clearing succeeds after storage becomes available again. Cart and wishlist keys
are never cleared. Engine ID 0 retains its existing unspecified-engine meaning.

Verification is recorded below after the focused VM511 run. The new browser
script uses the existing shared refusal latch and the fixed LAN staging upstream,
without API fixtures or retrying an access refusal. Its isolated storage faults
change only the browser storage methods in disposable contexts.

Evidence ledger:

- Hypothesis: incomplete vehicle search leaves a stale saved selection.
  Inspection: `vehicleSearch` previously set only the in-memory vehicle to null.
  Decision: clear persisted and dependent state in the same selection handler.
- Hypothesis: expanded branches imply multiple current vehicles.
  Inspection: disclosure sets are independent of selected scope, as accepted in
  PR18. Decision: retain them, label the current engine, explain browsing, and
  provide the explicit Clear vehicle control beside Change vehicle.
- Initial focused run: real reference/category/search requests returned HTTP
  200, with no refusal. The harness stopped on its cart/list preservation
  precondition because cart storage is `{ items: [...] }`, unlike wishlist's
  array. Corrected only that assertion before repeating the bounded journey.
- Desktop Firefox 1440: the bounded real-staging run passed category → text →
  return, A → B → reload → clear → reload, incomplete YMM → reload, set failure
  with removal, set+remove failure with truthful notice and recovery, populated
  cart/wishlist preservation, and engine-0 omission from real search requests.
  Report: `/srv/dev/reports/roys-active-vehicle-aa064791/second-harness-run/report.json`.
  The run then stopped during mobile test-list setup: an existing product Details
  link intercepted a pointer click on Add. This work does not modify PartsTable.
  Final mobile setup uses native keyboard activation of Add/wishlist; pointer
  usability of those existing controls remains outside this package.
- Parent candidate review: preserved the selected engine's exact accessible name
  by making its visual Current vehicle badge decorative (`aria-current` carries
  the accessible state). Changed the empty context to optional All vehicles copy
  so global MPN search does not imply that a vehicle is mandatory. Final checks
  explicitly assert exact role names after selection/reload and global MPN copy.
- Final affected run: **passed**, Firefox 1440/390, no page errors or access
  refusals. Desktop checked final copy, exact engine control names after reload,
  Clear focus and optional global MPN search; the current banner measured 56 px.
  Mobile completed all six vehicle-state groups above, using keyboard-only
  Add/wishlist setup. Exact selected/reloaded engine names passed. Screenshots
  show the full current context/actions above results without horizontal overflow.
  The 390 banner wraps actions/copy; Clear remains fully visible. Native
  category/text/return behavior remains accepted. No physical keyboard/touch
  acceptance is claimed.
  Report/screenshots: `/srv/dev/reports/roys-active-vehicle-aa064791/final/`.
- Separate mobile pointer finding: preserved the failed selector, product
  `FLPW_BCD2076`, viewport 390x844, original trace and exact harness source under
  `/srv/dev/reports/roys-active-vehicle-aa064791/second-harness-run/`.
  See `mobile-pointer-interception.txt`; no failure-instant screenshot exists.
  `final/390-current-b.png` shows the same product row after keyboard-only setup.
  Parent owns separate remediation; this is not mobile Add/touch acceptance.

Reproduction on VM511 (check `dev-remote --queue` first):

```sh
dev-remote --service env ROYS_ONPREM=1 ROYS_CATALOG_PREVIEW_ENABLED=true node scripts/active-vehicle-check.mjs
```

`ROYS_ACTIVE_LAYOUT_ONLY=1` limits checks to current-state layout/name/global-MPN
copy. `ROYS_ACTIVE_FINAL_BATCH=1` runs those final desktop checks and the full
mobile journey, reusing the previously passed desktop journey. `ROYS_ACTIVE_OUTPUT`
selects an evidence directory. All catalog responses remain real staging data.
Product overlay/navigation journeys are reused from prior accepted evidence;
no product route or overlay code changed in this package. URL/SSR, deployment,
activation, credentials, checkout and data changes are excluded.

Pre-push: `AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push` passed on VM511
on 6 November 2026 at approximately 2:10 PM EST: TypeScript and all 35 repository
tests passed. No duplicate build was run; GitHub CI owns the build gate. No merge,
deployment, production probe or business-data mutation was performed.
