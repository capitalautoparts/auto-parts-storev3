# D1492 / WP-ROYS-1 — connect ERP to the original catalog

Brian corrected the scope after the first preview: keep the existing design and
single-page navigation from auto-parts-storev3.vercel.app. The replacement layout
was removed. Header, TreeSidebar, PartsTable, ProductDetailModal and RightCartPanel
are the active existing components again; src/index.css matches origin/main.

## Ownership and scope

- [x] Catalog exploration session owns feat/roysauto-d1492-catalog in its isolated worktree.
- [x] Restore original layout and styling; replace runtime mock catalog with ERP staging reads.
- [x] Test the original hosted site and RockAuto in real Firefox on VM511.
- [x] Adapt full vehicle context, stable ERP IDs, application notes, cart persistence and errors.
- [x] Final desktop/mobile visual verification and agent-pre-push passed; new-head orchestrator review follows.
- [ ] Brian requested promotion to main; release inventory and hosting gate remain required.

## Reference navigation checked

On 2026-11-04 (Eastern), Firefox navigated the existing site through 2010 → Hyundai
→ Elantra → 2.0L L4 → Brake & Wheel Hub → Brake Pad. Its URL stayed on one page;
parts appeared within the expanded tree and Quick Cart remained alongside it.

Firefox also navigated RockAuto through Toyota → 2020 → Camry → 2.5L L4 → Brake &
Wheel Hub → Brake Pad and waited for product listings. It verified the expanding
catalog, dense listing rows, application qualifiers and right-side Quick Cart.
No checkout, account creation or order submission was performed.
Reference: https://www.rockauto.com/en/catalog/toyota,2020,camry,2.5l+l4,3445372,brake+&+wheel+hub,brake+pad,1684
Local reference evidence: /srv/dev/reports/roysauto-d1492-correction/reference/.

## Integration details

The existing UI contract is adapted in src/lib/erp-api.ts. No direct database
access, staff tokens or Shopify checkout is involved. Vehicle/model queries use
the exact year and make; engine queries use year/make/model. Tree expansion keys
include the whole vehicle path so shared reference IDs do not cross-select cars.
Categories fetch mapped children on expansion. Search is bounded and paginated;
old responses cannot overwrite the newest selection.

Prices can be unavailable, quality tiers can be unspecified, and application
conditions remain visible. A year/model match alone is not an unconditional fit.
The test cart stores stable ERP IDs and quantities with public display snapshots.
It does not reserve inventory or establish payable totals. Accounts, card/address
capture, shipping/tax estimates and simulated order confirmation are inactive.

## Existing Vercel project and exact pending settings

Project: brian-barbers-projects/auto-parts-storev3.
Original public test alias: https://auto-parts-storev3.vercel.app.
Task preview: https://auto-parts-storev3-git-feat-roysa-b611e6-brian-barbers-projects.vercel.app.
GitHub's bot confirms project prj_MDoqEvUIZHzv65GCFYxLE03xVt2p.
Anonymous root and API probes returned 302 to Vercel SSO on the initial preview.

Agents have no authorized Vercel access. Brian was asked once on D1492:
1. Project → Settings → Deployment Protection: confirm Vercel Authentication
   covers Preview and attach a screenshot.
2. Settings → Environment Variables: ROYS_CATALOG_PREVIEW_ENABLED=true, Preview,
   branch feat/roysauto-d1492-catalog only, then redeploy that preview.

No dashboard settings, credentials, domains or Production variables changed.
The API still refuses Vercel Production even if the flag is present. Brian's new
request to merge main does not itself configure that environment. Protected
hosted acceptance and any wider environment configuration must be recorded before
claiming main is a working ERP-connected test catalog.

## PR #1 validation

TypeScript, production build and ten contract tests passed on VM511. The final
integrated Firefox check passed six scenarios with 19 real ERP API requests and
zero browser exceptions: original tree/inline listings, application dialog and
persisted Quick Cart, exact part search and stock filter, two model years sharing
reference IDs without cross-selection, mobile tree/table/cart, and disabled account access. It also
asserts cleared stale search text, disabled checkout/no card fields, compact
mobile rows, no document overflow and an opaque cart sheet.

The original header and Quick Cart stay in view while the catalog scrolls. The
original CSS file is unchanged; targeted sizing/background corrections make the
existing components usable with the full catalog and mobile dialog overlays.
The specific layout differences Brian should review are:

- App.tsx adds a small Canada/CAD, staging and checkout-disabled banner.
- Its h-dvh shell keeps the original header and desktop Quick Cart visible;
  the central catalog scrolls within the viewport.
- PartsTable retains its columns with a 900px minimum width and a local
  horizontal scroller on mobile; details have a minimum width and the first
  application note is clamped to two lines, with all notes in Details.
- The existing mobile cart sheet has an opaque white background; product images
  and the existing detail dialog fit small screens.

Screenshots reviewed at 1440×1000 and 390×844:

- [Original design with ERP parts](evidence/d1492/desktop.png)
- [Mobile catalog](evidence/d1492/mobile.png)
- [Mobile parts table](evidence/d1492/mobile-parts.png)
- [Mobile Quick Cart](evidence/d1492/mobile-cart.png)

Local evidence: /srv/dev/reports/roysauto-d1492-correction/review-verified/.
Source fitment spot-check: BRX2076 returned by the selected 2.5L Camry query has
both 2.5L and 3.5L applications in ERP. All conditions are retained in Details;
showing a result does not convert every application into an unconditional fit.

## Review corrections after 8d86a64

Both the table and detail dialog use ERP availability status. Only an explicit
out_of_stock result says Out of Stock. Unconfirmed status stays unconfirmed even
if a quantity or ERP default lead time is present. Explicit special-order and
backorder lead times are labelled as estimates, not delivery guarantees.
Untracked `available` means “Available to order”; it does not expose the search
API's default lead time as an ETA. Low stock remains distinct from in stock.

Removed unused mock-data.ts, CheckoutPage, OrderConfirmationPage and the three
components/checkout files. No remaining source imports them. AuthContext and
AuthModal do not import api.ts or call fetch/axios; their interfaces still type
check. The mounted AuthProvider is disabled and Header prevents opening the
modal. The browser check exercises Account without creating a mock user or
opening a password form. RightCartPanel always receives catalogPreview=true,
which excludes its legacy shipping/payment fields and disables checkout.

Cart additions now normalize quantities before both new-line and existing-line
updates, and reject non-finite inputs. The duplicate price-formatting ternary is
removed. Availability and cart regression contracts cover these review findings.

## Orchestrated staging acceptance follow-up

PR #1 merged into staging at 62e7395. The next work package is isolated in
fix/roysauto-d1492-staging-acceptance. Two smaller Codex executors have separate
ownership: availability semantics/contracts, and vehicle/pricing browser checks;
the orchestrator owns integration, remote validation and release review.

Read-only samples on 2026-11-04 (Eastern) returned HTTP 200 throughout:

| Vehicle | Make ID | Model ID | Engine options |
| --- | --- | --- | --- |
| 2020 Toyota Camry | 76 | 1011 | 2 |
| 2021 Ford F-150 | 54 | 666 | 6 |
| 2019 Honda Civic | 59 | 752 | 3 |

The years endpoint returned 52 entries from 1976 through 2027. This is sampled
contract evidence, not a claim that all vehicles have complete parts coverage.
Public staging search returned ALD1212M at CAD 28, BRX1212 at CAD 38, and a starter
with a CAD 50 core charge at the time checked. Prices may change; browser checks
must derive their expected cart subtotal from the current response.

ERP publicStockTier.ts defines `available` as untracked but orderable. The earlier
catalog labelled it Special order; the follow-up fixes that distinction and tests
positive/default, absent and zero lead times. Prices come from the ERP search
route's published pricing logic; no mock catalog or Shopify price lookup is used.

Anonymous requests to the supplied preview root and catalog API still redirect
to Vercel sign-in. No account-owner confirmation of the existing activation
request is recorded on D1492. Protected hosted acceptance remains outstanding;
these direct API and VM511 checks must not be described as a hosted preview pass.
Main remains on hold and no deployment settings or credentials have changed.

## Future work

Helcim sandbox checkout, shipping/tax, independent sales eligibility, SSR product
SEO, canonical .ca/.com rules, measured load/latency and catalog coverage remain
separate work packages. Multi-company ERP is outside scope. The existing Tools,
VIN, order-status and promotions placeholders are not connected by this change.

## Follow-up validation

VM511 agent-pre-push passed TypeScript and all ten contract tests. The final
build and eight integrated Firefox scenarios passed with 44 real ERP responses
and zero browser exceptions. Ford F-150 (3.5L, engine 2146) and Honda Civic
(1.5L, engine 2118) both rendered brake-pad results before and after reload,
with fresh full-context searches. The saved cart subtotal used the live CAD
price for exact SKU DVNJ_ALD1212M, not a fixed total or ambiguous part number.

Reviewed desktop (1440×1000), mobile parts and mobile cart (390×844):

- [Desktop](evidence/d1492-acceptance/desktop.png)
- [Mobile parts](evidence/d1492-acceptance/mobile-parts.png)
- [Mobile cart](evidence/d1492-acceptance/mobile-cart.png)
- [Sanitized response/context report](evidence/d1492-acceptance/report.json)

Local evidence: /srv/dev/reports/roysauto-d1492-acceptance/. A browser-only
invocation moved to a fresh runner lane without built assets; the missing dist
was confirmed, then build plus browser smoke in one job passed. No ERP 403 was
observed. Hosted Vercel acceptance is still unverified behind sign-in.

## Packaged function failure and repair — 2026-11-04

Brian's follow-up preview displayed `Unexpected token 'A'` instead of vehicle
years. This is a plain-text platform response being parsed as JSON. The proxy's
own error paths return JSON, so source-only Vite acceptance was insufficient.

The failure was reproduced on VM511 using pinned `@vercel/node@29.0.1`,
`@vercel/build-utils@15.2.1`, repository TypeScript 5.9.3 and Node 22.23.1:

- Original config: the packaged `api/catalog.js` retained its import of
  `../server/catalog-proxy.ts`, but the package contained only
  `server/catalog-proxy.js`. Loading it failed with `ERR_MODULE_NOT_FOUND`.
- With `rewriteRelativeImportExtensions: true`: the import becomes `.js`, the
  packaged function loads and returns the expected JSON 503 with activation
  unset, without calling ERP.

This demonstrates a concrete packaging defect and repair. It does not identify
the private deployment's exact builder/runtime version or replace its logs.
The pinned builder defaulted its output metadata to `nodejs26.x`; the emitted
code was executed with Node 22.23.1 on VM511, not on Vercel.

The existing test runner now emits the API into an isolated directory containing
only JavaScript and checks the default export over HTTP. Disabled Preview and
Production return JSON 503 without ERP calls; enabled Preview returns a test
upstream response. That test uses synthetic data and makes no staging requests.
The client separately handles plain-text/HTML/invalid-JSON platform errors with
a retry message, retains JSON gate/Cloudflare diagnostics, and caps response
reads at the proxy's existing 2 MB limit.

`agent-pre-push` passed TypeScript and 19 tests on VM511. The browser smoke now
supports the actual packaged JavaScript entrypoint, using built frontend assets
and the normal Preview gate rather than Vite's source adapter.

At 1:09 PM EST, the packaged-function Firefox run passed all eight scenarios:
44 real staging responses, 52 years, Toyota/Ford/Honda engine and category
navigation plus reload, live SKU price CAD 28 and quantity-two subtotal CAD 56,
and zero browser exceptions. Desktop and 390px mobile screenshots were reviewed;
the mobile parts table continues to scroll inside its panel. No API interception,
account calls, checkout calls or Cloudflare refusals occurred.

- [Packaged function baseline/fix evidence](evidence/d1492-runtime/package-repro.json)
- [Sanitized browser report](evidence/d1492-runtime/report.json)
- [Desktop](evidence/d1492-runtime/desktop.png)
- [Mobile parts](evidence/d1492-runtime/mobile-parts.png)
- [Mobile cart](evidence/d1492-runtime/mobile-cart.png)

Reproduction script and complete screenshots are retained under
`/srv/dev/reports/roysauto-d1492-runtime/`. This validates emitted code against
staging on VM511; authenticated Vercel acceptance still needs the owner check.

### Current preview settings inventory and owner action

Project: `brian-barbers-projects/auto-parts-storev3` (existing project).
Branch: `fix/roysauto-d1492-staging-acceptance`.
URL: https://auto-parts-storev3-git-fix-roysau-0e57df-brian-barbers-projects.vercel.app/

No settings were changed by agents. Anonymous root and API requests returned
302 to Vercel SSO; authenticated hosted verification remains outstanding.
The earlier owner request named `feat/roysauto-d1492-catalog`; its branch-scoped
flag does not cover this branch. For the current preview, Brian must:

1. Settings → Deployment Protection: confirm Vercel Authentication covers
   Preview deployments and attach a screenshot to D1492.
2. Settings → Environment Variables: confirm or add
   `ROYS_CATALOG_PREVIEW_ENABLED=true`, environment **Preview**, Git branch
   **fix/roysauto-d1492-staging-acceptance only**. Redeploy that branch after
   saving, then check `/api/catalog?resource=years` while signed in.

Do not create a duplicate variable if the correct scope already exists. Do not
set it for all branches or Production. The original branch's setting is not
changed by this request. If the API still returns plain text, capture its status
and short response/error code plus the function log; do not expose cookies or
tokens. If it returns the JSON activation message, verify this exact branch
scope and redeployment. If it includes a Cloudflare reference, stop and pass the
Ray ID to Brian. Main remains on hold under D1493.
