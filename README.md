# RoysAuto / Capital Auto Parts catalog exploration

Agents (Claude and Codex): start with [AGENTS.md](AGENTS.md); detail is in [docs/agent-reference/](docs/agent-reference/README.md) and [docs/AGENT-TOOLBOX.md](docs/AGENT-TOOLBOX.md). `API_SPEC.md` and `SETUP.md` are legacy and do not describe the live catalog gateway.

The existing single-page design is preserved: original red header, expanding
vehicle tree, inline parts tables, product dialog and right-side Quick Cart.
The active catalog now reads ERP staging instead of the prototype fixtures.
Canada/CAD is enabled; future US/USD configuration remains explicit and disabled.

## Local development and validation

Use Node 22. On a development machine, install dependencies with npm ci and start
the Vite development server. The same read-only server adapter serves local Vite
and the Vercel API function. No database connection string or credentials are
needed. Requests use the fixed public catalog gateway at
https://staging.autrex.ca/api/erp and an honest application UA. That existing
gateway reads ERP staging; RoysAuto does not receive its server-side credentials.

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

## Deployment activation

Existing project: brian-barbers-projects/auto-parts-storev3.
Main alias: https://auto-parts-storev3.vercel.app.
Protected task preview:
https://auto-parts-storev3-git-fix-roysau-0e57df-brian-barbers-projects.vercel.app.

Brian requested main testing and reported setting ROYS_CATALOG_PREVIEW_ENABLED
in Vercel Production. The adapter now supports that existing test URL. It always
requires VERCEL=1 and ROYS_CATALOG_PREVIEW_ENABLED=true (exact lowercase text):

- Preview deployments keep their existing activation behavior and protection.
- Production is accepted only with VERCEL_PROJECT_ID equal to
  prj_MDoqEvUIZHzv65GCFYxLE03xVt2p and VERCEL_GIT_COMMIT_REF equal to main.
- Other environments, projects, branches and missing/false flags fail closed.

Vercel supplies project and branch identity as system environment variables.
The exception does not use caller-supplied headers or a configurable backend URL.
Vercel Production here reads ERP staging through the existing staging website's
restricted catalog gateway. It does not select the production ERP database.
Checkout stays disabled. See docs/staging-catalog-gateway.md for the route,
verified data source, cache behavior and hosted acceptance requirements.
This makes catalog data publicly readable on the existing main test alias when
the flag is enabled and that alias is public. Noindex is not access control.

Agents changed no Vercel settings and have no authorized Vercel account access.
Use the existing Production flag Brian already configured; no new credentials,
domains or settings are required by this patch. Do not manually override Vercel's
system identity variables. The normal Git deployment after promotion to main
picks up the configured flag. If disabled, the API returns JSON 503 with
CATALOG_FLAG_DISABLED; if the platform identity is not allowed, it returns
CATALOG_DEPLOYMENT_NOT_ALLOWED. Neither diagnostic exposes environment values.
Removing or setting the flag to false and redeploying disables ERP reads.

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
function and requires the normal Preview or approved-main activation variables.
