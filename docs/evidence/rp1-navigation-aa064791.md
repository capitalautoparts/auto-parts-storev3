# WP-ROYS-RP1-aa064791 evidence

Branch `agent/roys-rp1-navigation-aa064791`, base merged PR26
`2ab0501a0f9bfc27f85f38ad49749e314a43b883`. Parent w7:p2 owns integration.
No merge, deployment, upstream/configuration or commerce changes.

| Hypothesis / requirement | Command or source evidence | Decision/result |
| --- | --- | --- |
| Navigation contract was inactive | App previously held separate memory-only vehicle/category/text/filter/page state | Active controller/resolver adapter now drives requests and URLs |
| Leaf slug can resolve through self endpoint | Parent pinned ERP `4e3ed42e`, `TaxonomyController.ts:310–367`: full identity only for source_type=category; leaf self is 404 | Emit browser-only verified `category_parent`; validate roots plus one cached children lookup; cold parentless leaf is an explicit gap |
| Configuration syntax/facets prove membership | Current allowlist has no complete five-dimension or PCDB membership contract | Preserve unresolved narrowing constraints in URL/request, disclose and offer Clear; never produce full verified evidence |
| Global PCDB-only search works | Current search contract requires text/category/full YMM | Recover unsupported state before request; proxy unchanged |
| Product query keys are catalog state | Existing server supports pathname identity with ignored query | Keep query/fragment outside product identity/scope/return; emit query-free SKU links |
| Navigation transitions and restoration are wired | VM511 `node --experimental-strip-types --test tests/navigation-state.test.ts tests/navigation-controller.test.ts` | Earlier 20/20 checkpoint; coherent A–G batch 30/30 passed once; residual focus/pending-intent batch 33/33 passed once, including deferred races, category/request transport and presentation restoration |

The fixture batch uses synthetic references and isolated transport responses;
it makes no claim about real product membership or hosted acceptance. All
validation runs on VM511 after checking `dev-remote --queue`. Browser checks and
final pre-push remain pending at this checkpoint.


Integrated source base: normal merge `f36bec5db70cb114bf2aa4daed326af6b3583f1d`
contains approved staging PR27 `463d1d6a630278c738e176623d8b75b89187f29d`
and mapper `ae715b9e`; ancestry checked with `git merge-base --is-ancestor`.
No conflict; the task diff in `tests/product.test.ts` remains the released
history block only. Browser attempt1 uses source identity `4e284adb752f`,
explicit 30-second real-data assertions and the existing refusal monitor.

Attempt1 stopped at desktop Forward → explicit-all reload → Back: no parts
section mounted within 30 seconds. The failure DOM showed all-vehicles UI and
the prior branch disclosures. The saved report lacks failure URL/history state,
so it does not establish the cause. No retry, mobile run or pre-push followed.
Earlier steps reached real page 2, then Catalog → Back restored matching row
identities and main scroll. These are partial checks, not overall acceptance.

Evidence preserved at `/srv/dev/reports/roys-rp1-aa064791/attempt1/` (VM510 copy)
and `/tmp/roys-rp1-aa064791/attempt1/` (VM511): `report.json`,
`1440-page2.png`, `1440-explicit-all.png`. Both screenshots inspected; compact
header preserved, no horizontal overflow; main heights 786 and 822 pixels.
No mobile visual result yet.

18 recorded API responses were 200; no refusal/reference or page errors.
Actual page-2 search: year 2020, make Toyota, model Camry, engine_base_id 17637,
category `brakes-brake-pads`, page 2, limit 24, in_stock_only all,
sort relevance/asc, facets and vehicle dimensions enabled. Browser-only
`category_parent=brakes` was not forwarded to search. No fitment or configuration
membership assurance is inferred from these results.

The single bounded `history-diagnostic1` isolated the failure: the Playwright
protocol `page.reload()` operation produced a new document with navigation type
`navigate` and history length 2 → 3 before any additional app push. Back reached
the previous all-vehicles document; URL and UI agreed. One Catalog app push was
recorded, with correct initial Back/Forward popstate handling. This supports a
harness-operation classification, not an application pageshow workaround or a
claim about the underlying browser implementation. Its full events/snapshots
and failure screenshot remain preserved separately.

One native confirmation (`native-reload1`) then passed: arm navigation listener,
invoke `window.location.reload()`, assert changed document, navigation type
`reload`, unchanged history 2 → 2 and exact URL. Back restored the recorded
Camry/Brake Pad page-2 scope, 24 rows and main scroll 1844. 15 API responses were
200, no refusal/page errors. Runtime remained unchanged. The owned default
checker now shares this native helper; continuation skips already successful
desktop groups and runs outstanding desktop plus previously unrun mobile.

## Integrated acceptance

`continuation1/report.json` passed on VM511 source identity `890a6e882871`, with
the same runtime as merged `f36bec5`. Desktop retained successful earlier groups;
outstanding 1440 and previously unrun 390 groups passed. Native reload assertions
proved changed documents, `reload` type, unchanged history lengths and exact URLs
for desktop page 2 and mobile explicit-all/page 2. No runtime edit was needed.

Accepted: real page-2 scope and row identity restoration; Catalog/Back/Forward;
explicit all suppressing memory; reload/clean-browser copy; incomplete vehicle
draft/reveal/cancel without committing; invalid URL recovery without fallback;
Clear forgetting memory while historical URLs remain usable; keyboard Details
overlay return with exact main scroll and Details control focus; Control-click
native SKU tab and direct close to explicit all. Browser lists were observed
unchanged; this is not a rerun of cart/wishlist product-action suites.

76 API responses in continuation were 200; no refusals or page errors. Search
requests retained the recorded YMM/engine/category, page, availability all,
24-item limit and facet/dimension flags. `category_parent` remained browser-only.
The other five dimensions and PCDB constraint transport are verified by isolated
fixtures, not by live membership probes or a product sample. No performance,
hosted-deployment, standalone-PDP or full RP2/3 search acceptance is claimed.

All six continuation screenshots were inspected and compared against the
established compact header/theme and mobile reserved-strip contract:

- `1440-overlay-return.png`, `1440-invalid-url.png`
- `390-page2.png`, `390-explicit-all.png`, `390-overlay-return.png`, `390-invalid-url.png`

Files: `/srv/dev/reports/roys-rp1-aa064791/continuation1/` on VM510,
`/tmp/roys-rp1-aa064791/continuation1/` on VM511. No document/main horizontal
overflow. Mobile main ends at y=783, exactly where the cart strip begins;
scoped main height 573 px, explicit-all 653 px. Desktop scoped main height
786 px. No PartsTable layout or cart/Sheet geometry change was made.

## Reproducible checker

The default owned checker runs a fresh full 1440/390 journey and uses native
reload assertions. Its optional hosted bootstrap starts **no Vite server**,
accepts only the established staging origins or HTTP localhost, refuses
continuation/custom-width modes and uses a fresh output directory. This bootstrap
change received syntax inspection only; there was no UI rerun just for wiring.

After independent approved integration, the exact hosted smoke command on
VM511 (check queue first) is:

```sh
dev-remote --service env ROYS_ONPREM=1 ROYS_CATALOG_PREVIEW_ENABLED=true ROYS_RP1_BASE_URL=http://192.168.88.250 node scripts/rp1-navigation-check.mjs
```

It preserves the existing refusal monitor and stops without retry on refusal.
Running this later against the served revision is the integration owner's gate;
the present task neither deploys nor claims hosted acceptance.


Hosted compatibility review removed SecureContext-gated `crypto.randomUUID()`
from both diagnostic markers. The marker now uses Date/Math randomness solely
for document identity, with no security purpose. A focused VM511 fixture runs
the real native-reload helper in browser-like contexts without randomUUID;
no application change or UI rerun is needed for this bootstrap correction.

The HTTP helper fixture passed 1/1 on VM511 with randomUUID unavailable. The
already-running pre-push finished with a TypeScript-only test-ledger narrowing
error (TS2345 after asserting an event array equals an empty array). The empty
check now uses array length; application runtime is unchanged. The corrected
final-source mandatory gate is recorded below after completion.


## Final required gate

`AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push` passed on corrected final
source identity `796193349da5`, on VM511 catalogue lane: typecheck and all 81
registered tests (including approved RP5 mapper fixtures, the released legacy
history block, navigation and HTTP helper fixtures). The prior failed gate is
accounted for above. Build is covered by required GitHub CI; no broad duplicate
build or hosted UI run was added. Final source differs from accepted UI runtime
only in checker/docs/fixtures, including the HTTP-safe diagnostic marker.
