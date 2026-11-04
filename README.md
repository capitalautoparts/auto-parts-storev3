# RoysAuto / Capital Auto Parts catalog exploration

The existing single-page design is preserved: original red header, expanding
vehicle tree, inline parts tables, product dialog and right-side Quick Cart.
The active catalog now reads ERP staging instead of the prototype fixtures.
Canada/CAD is enabled; future US/USD configuration remains explicit and disabled.

## Local development and validation

Use Node 22. On a development machine, install dependencies with npm ci and start
the Vite development server. The same read-only server adapter serves local Vite
and the Vercel API function. No database connection string or credentials are
needed. Requests use the fixed staging public API and an honest application UA.

VM510 is orchestration only. Check dev-remote --queue before validation and use
agent-pre-push for TypeScript and contract tests on VM511. Production builds and
the scripts/browser-smoke.mjs Firefox check also run on VM511. The browser check
uses real ERP data; it does not intercept or mock catalog responses.

## What is connected

- The original Year → Make → Model → Engine tree uses light-duty ERP references.
- Categories load their mapped children only when expanded. Results render inline
  beneath the chosen category, with pagination, brand and stock filters.
- The header searches vehicles by year/make/model and parts by part number or
  keyword. Enter submits a real server search; it does not just filter one page.
- Full vehicle context and compound tree keys isolate different model years that
  share an ERP model or engine ID. Late responses cannot replace newer results.
- ERP string IDs, prices, availability, core charges, packs and application notes
  reach the existing components. Missing prices/quality tiers are not fabricated.
- Quick Cart and wishlist are browser-local test lists. Cart quantities persist
  across reloads. Saved prices are estimates, not a checkout quote.
- Account creation, payment/address capture, shipping/tax simulation and order
  placement are disabled in the active catalog. Helcim is a later work package.

The unused mock catalog and standalone checkout pages have been removed.
There is no silent mock fallback after an API error.
Tools, VIN lookup, order status and promotions are existing unconnected navigation
placeholders; they are not claimed as implemented integrations.

## Deployment gate

Existing project: brian-barbers-projects/auto-parts-storev3.
Main alias: https://auto-parts-storev3.vercel.app.
Protected task preview:
https://auto-parts-storev3-git-fix-roysau-0e57df-brian-barbers-projects.vercel.app.

Anonymous root and API requests to the task preview redirect to Vercel SSO.
Agents have no authorized Vercel account access. Brian must confirm Preview
Authentication in Settings → Deployment Protection (attach screenshot), then
add ROYS_CATALOG_PREVIEW_ENABLED=true in Settings → Environment Variables,
scoped to Preview and branch fix/roysauto-d1492-staging-acceptance only if absent,
and redeploy that branch. The earlier D1492 request named the original
feat/roysauto-d1492-catalog branch; that scope does not enable this follow-up.
Check the current D1492 owner-action note before repeating a request. Do not
create credentials or enable the flag for all branches or Production.

The adapter requires VERCEL=1, VERCEL_ENV=preview and that flag. It stays disabled
on Vercel Production, including main's public test alias. A main merge alone
cannot activate ERP reads there. Changing the hosting scope requires an explicit
configuration inventory and protection verification; no automatic public
activation is included. HTML/API noindex directives are not access control.

See docs/catalog-exploration.md for current evidence and remaining work.

## Staging acceptance follow-up

PR #1 merged into staging at 62e7395. Account-owner activation of the original
protected branch preview has not been confirmed; a staging-branch merge does not
change its branch-specific environment settings.

The follow-up corrects untracked ERP availability to “Available to order” without
turning the search API's default lead time into an ETA. Browser acceptance reads
the current ERP price when checking the saved cart, and exercises multiple makes
with complete vehicle context. No direct database credentials are required:
vehicles, parts and CAD prices are read through the existing ERP staging API.

The TypeScript configuration rewrites relative `.ts` imports to `.js` for Vercel's
emitted Node function. `npm test` includes an isolated emitted-entrypoint test;
source-only Vite tests cannot establish that the packaged function starts.
For manual VM511 browser acceptance, `ROYS_SMOKE_FUNCTION_ENTRYPOINT` can point
to the packaged `api/catalog.js`; the smoke then serves built assets with that
function and requires the normal Preview activation variables.
