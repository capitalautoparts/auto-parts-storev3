# D1492 — main catalog activation

The existing test URL is https://auto-parts-storev3.vercel.app/. Brian reported
adding `ROYS_CATALOG_PREVIEW_ENABLED=true` to Vercel Production, then asked to
fix the remaining blocker and continue. The old code explicitly required
`VERCEL_ENV=preview`, so no Production flag value could enable the main URL.

The approved test-site exception is deliberately narrow:

| Runtime condition | Required value |
| --- | --- |
| Vercel runtime | `VERCEL=1` |
| Activation flag | `ROYS_CATALOG_PREVIEW_ENABLED=true` |
| Deployment environment | `production` |
| Project | `prj_MDoqEvUIZHzv65GCFYxLE03xVt2p` |
| Git branch | `main` |

All five conditions must match for Production. Existing enabled Preview
deployments continue to work. Missing/false flags and any other Production
project or branch remain disabled. Identity comes from Vercel's runtime
variables, not request headers; do not manually override platform variables.

The backend now uses the existing public gateway at
`https://staging.autrex.ca/api/erp`, whose staging configuration points to
`https://staging.autopartserp.com`. Its public catalog routes provide years,
makes, models, engines, taxonomy and search/CAD prices. Only GET is accepted,
caller credentials are never forwarded, redirects
are rejected, and existing query limits/timeouts/body limits remain in force.
No ERP production reads, staff/customer endpoints, database writes, account
login, checkout, orders or payments are introduced.

The November 5 gateway follow-up and its separate hosted acceptance requirements
are documented in [staging-catalog-gateway.md](staging-catalog-gateway.md).
The pre-release browser evidence below belongs to the earlier direct-ERP route.

## Deployment settings inventory

Existing project: `brian-barbers-projects/auto-parts-storev3`.
No settings changes are made by agents. Brian already reports configuring the
existing flag for Production. This change consumes that flag after the normal
Git-triggered main deployment. No new credentials, domains, Vercel team/project,
or changes to deployment protection are needed or included. The existing main
alias is public, so enabling this path makes the allowed staging catalog reads
available to visitors; it does not expose a privileged ERP session.

## Verification and diagnostics

The VM511 pre-push check passed TypeScript and all 20 tests, including emitted
JavaScript entrypoint checks for allowed main and denied deployments. The
independent read-only review found no blocking issue. The original UI and
checkout-disabled state are unchanged.

The actual Vercel-packaged function, executed on VM511 with the approved
Production/main identity, passed all eight Firefox scenarios with 44 real ERP
staging responses, 52 vehicle years, and zero browser exceptions. Toyota/Ford/
Honda selections and reload passed. The live SKU price was CAD 28 and its
quantity-two subtotal CAD 56. Desktop and mobile screenshots were reviewed.
This is pre-release evidence, not a claim that the public deployment is fixed.

- [Browser report](evidence/d1492-main-access/report.json)
- [Package and execution metadata](evidence/d1492-main-access/package.json)
- [Desktop](evidence/d1492-main-access/desktop.png)
- [Mobile parts](evidence/d1492-main-access/mobile-parts.png)
- [Mobile cart](evidence/d1492-main-access/mobile-cart.png)

Full screenshots and the packaging harness are retained at
`/srv/dev/reports/roysauto-aa064791-main-access/`.

On a disabled deployment the API returns HTTP 503 JSON with a safe code:

- `CATALOG_FLAG_DISABLED`: the flag is missing or not exactly `true`.
- `CATALOG_DEPLOYMENT_NOT_ALLOWED`: the flag is enabled but runtime identity is
  outside the allowed environments/project/branch.

No environment values are returned. ERP HTTP 403 still produces a diagnostic
reference; stop and report that Ray ID rather than retrying or changing identity.

## Smoke plan

Before release: run the existing Firefox flow against the Vercel-packaged
function with the exact allowed Production/main identity and real ERP staging
responses on VM511. Check year/make/model/engine/category selection, search,
live CAD subtotal, reload and desktop/mobile cart behavior.

After promotion: confirm the exact main commit and ready Vercel deployment;
perform one deliberate read-only flow on the public test URL, starting with
`/api/catalog?resource=years`, then selected vehicle and search requests. Expect
HTTP 200 JSON with real data rather than the activation refusal. Do not create
orders or payments. Record actual hosted results separately from VM511 evidence.

Rollback point: main `707dd3e21158548e73393bb4e66f234bd098fa4f` (Preview-only
gate). Use a reviewed revert if necessary. Setting/removing the activation flag
and redeploying also disables ERP reads; agents do not change Vercel settings.
