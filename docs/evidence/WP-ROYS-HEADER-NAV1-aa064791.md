# WP-ROYS-HEADER-NAV1 aa064791

Claim: isolated Header navigation work, owned by branch
`fix/roys-header-navigation-aa064791`, based on `origin/staging` at
`94be7cd1f829955229ad95197ad6383b60c0ee03`. Parent `w7:p2` owns umbrella
tracking and R1/R7 integration after PR #14. This claim does not move that card.

Reuse rung 2: extend `Header` with the existing Button and Sheet primitives.
The focused script uses existing Vite and Playwright Firefox dependencies (rung
5); the full catalog smoke script remains owned by the parent journey.

In catalog preview, unavailable Help, Order Status, Promotions, Tools, VIN Lookup
and Need Help controls are hidden. Account is disabled with a visible, accessible
explanation. Search catalog names the existing shared vehicle-aware combobox
focus action. Menu > Search records a menu-local pending intent, consumes it in
Sheet `onCloseAutoFocus`, and focuses the combobox after dismissal. Ordinary
Close/Escape retain Radix's trigger focus return.
The menu uses SheetTrigger's native button with existing `buttonVariants` styles:
the React 18 Button wrapper does not forward the ref needed by Radix to return
focus. Shared UI primitives are unchanged.

The two header bars and current theme remain. Canada/CAD, staging reads and
disabled accounts/checkout remain. No search-mode change, application cart-close
fix, route, proxy, deployment or ERP change is included.

## Focused verification

Run on VM511 after checking `dev-remote --queue` and preparing dependencies with
`/home/bbarber/.local/bin/vm511-deps .`:

```sh
node node_modules/vite/bin/vite.js build
ROYS_ONPREM=1 ROYS_CATALOG_PREVIEW_ENABLED=true \
  ROYS_HEADER_OUTPUT=header-navigation-artifacts \
  node scripts/header-navigation-check.mjs
```

The integrated page uses the existing fixed LAN upstream and real ERP staging
responses, without interception or stub data. At 1440x900 and 390x844 the check
covers disabled Account and its explanation, absent unavailable destinations,
shared search focus, in-page Wishlist/Quick Cart, one real SKU text search and
Catalog reset. Mobile also covers touch and keyboard Menu > Search, then ordinary
Close/Escape focus return after the search intent has been consumed. It verifies
no horizontal overflow, page errors or account/checkout/order requests.

Evidence destination: `/srv/dev/reports/roys-aa064791-header-navigation/`.
Firefox passed at both widths on 2026-11-06 at 12:16 PM EST. Each viewport
received HTTP 200 for 52 real staging years and one SKU search result. No page
errors or account/checkout/order requests occurred. The report's Header SHA-256
matches the source: `72c0371035a6b0ce3fbf00bc630e541c09cee871ada508d111a0fb67c7aece47`.

Compared `1440-integrated.png`, `390-integrated.png` and `390-menu.png` with
the desktop/mobile mockups in `docs/agent-reference/design-system.md`: wordmark,
ink/charcoal bars, outlined desktop actions, white combobox, paper background
and mobile floating cart remain consistent. Unavailable links are intentionally
absent; Account's explanation is readable and the mobile menu fits. No
horizontal overflow was observed. Mockup sample rows/address forms are outside
this header check; real staging years are visible instead.

Artifacts: `report.json`, `1440-integrated.png`, `1440-wishlist.png`,
`1440-cart.png`, `390-integrated.png`, `390-menu.png`, `390-search-focus.png`,
`390-wishlist.png`, `390-cart.png`, all under the evidence destination above.
`AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push` passed on VM511:
TypeScript and all 27 repository tests passed. The Vite build also passed on
VM511 before the focused Firefox run. CI remains the authoritative merge gate.

## PR #17 verification remediation

Both P2 findings at `3b3904982c34b9a700834872f1073b463109cda3` were actionable.
Merged `origin/staging` at `68950d52b4faad8d970301061b0d2b477aba1689`, including
PR #14. Header runtime and accepted theme remain unchanged; App/Tree belong to
the R1/R7 executor.

Only the Account assertion block in `scripts/browser-smoke.mjs` changes: it
requires a disabled button and visible explanation linked by `aria-describedby`,
instead of clicking the disabled button. Existing password/mock-user and final
auth/checkout/order API safeguards remain.

Reuse rung 5: `header-navigation-check.mjs` uses the shared
`createProductSmokeMonitor` from `product-links-monitor.mjs`. A single refusal
latch observes every page and guards browser actions, assertions, screenshots
and subsequent viewport creation. It preserves non-secret references and closes
the requesting context for API/product-document refusals, including background
categories/suggestions. Selected years/search samples are separate from the
monitor's complete API response inventory.

`scripts/header-navigation-refusals.mjs` imports the actual guarded Header
journey. Seven isolated local fixtures cover background API 403, JSON refusal,
challenge and reference-header responses, plus mobile product-document 403,
document challenge and refusal without a reference. Each must preserve the
reference/fallback, close its requester, make only one refused request and stop
before journey completion or the next viewport. Fixtures produce no screenshots
and contact no ERP. Run on VM511 before the unstubbed integrated Header journey:

```sh
ROYS_HEADER_OUTPUT=/tmp/roys-aa064791-header-navigation-review \
  node scripts/header-navigation-refusals.mjs
```

Remediation artifacts are kept under
`/srv/dev/reports/roys-aa064791-header-navigation/review/`, separate from the
previously accepted screenshots. No full catalog/product journey is rerun.

On 2026-11-06 at 12:26 PM EST, all seven isolated wiring cases passed, followed
by the real-staging integrated Header journey at 1440x900 and 390x844. The shared
monitor recorded successful years, categories and search responses at both
widths; selected samples again contained 52 years and one SKU result. No
refusals, page errors, forbidden API calls or overflow occurred. `refusals.json`
is fixture-only proof; `report.json` and the eight PNGs are unstubbed evidence.
The Header SHA-256 remains identical to the independently accepted source.
The single mandatory remediation `agent-pre-push` passed on VM511: TypeScript
and all 35 repository tests passed on the integrated staging baseline.
