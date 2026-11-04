# D1492 / WP-ROYS-1 — RoysAuto catalog exploration

- [x] Claimed by the catalog exploration session in Herdr ROYSAUTO w7:p2.
- [x] Canada / CAD first; future markets require explicit configuration.
- [x] Reuse ERP staging public GET APIs; no direct database or Shopify dependency.
- [x] Integrated vehicle selection, search, category navigation and saved test cart.
- [x] VM511 build, integrated desktop/mobile Firefox review, and final pre-push passed.
- [ ] PR to staging and protected Vercel preview verification.

Existing Vercel project: `brian-barbers-projects/auto-parts-storev3`.
Existing test alias: https://auto-parts-storev3.vercel.app (public, currently the old app).
Evidence: GitHub's Vercel status on baseline commit `2c461c2d8ffa077cd6dede062ad9cc593935aafd`
links to deployment `3n2gfBytQUZr4Eb4N3KM84Z4EdH5` in that project.

## Exact deployment settings proposed

Before enabling ERP reads, verify Vercel Authentication / Deployment Protection
protects the exact branch preview, including `/api/catalog`. Record an anonymous
request receiving the authentication challenge. Protection status is currently
unknown; robots directives are not access control. Infra confirmed agents have
no authorized Vercel access; these two settings steps belong to Brian.

Exact click paths for Brian: project → Settings → Deployment Protection →
Vercel Authentication (Preview coverage; attach screenshot); then project →
Settings → Environment Variables.

Only after that evidence, set the non-secret variable
`ROYS_CATALOG_PREVIEW_ENABLED=true`, scoped to **Preview** and this task branch,
in the existing project, and redeploy that preview. No Production variable,
domain, team, account, database URL, new credential or payment setting changes.
The server additionally requires `VERCEL_ENV=preview`; deployments fail closed
otherwise. Local development uses the fixed staging API without credentials.
No Vercel dashboard settings have been changed by this session.

## Boundaries and next phases

This is a read-only exploration. Saved cart contents stay in this browser;
there is no purchase, address capture, payment, order write or stock reservation.
Public ERP `purchasable` currently reflects another sales channel and is not a
RoysAuto checkout authorization. Prices/availability are indicative staging data.
Fitment application qualifiers must remain visible; a model-level result alone
does not establish an unconditional fit.

Production work remains: server-rendered product URLs and canonical market rules,
licensed catalog coverage, measured search latency, inventory/price revalidation,
tax/shipping/returns, independent sellability, and Helcim sandbox integration with
server-authoritative totals, idempotency and verified webhooks. Multi-company ERP
is explicitly outside this phase. Neither .ca nor .com is configured here.

## Integrated evidence (2026-11-04, Eastern)

The VM511 production build passed. Firefox exercised the complete application
against real ERP staging, without intercepted or mocked API responses: vehicle
selection (2020 Toyota Camry, 2.5L), brakes, application notes, ALD1212M search,
saved cart reload and quantity changes, stock filter, browser Back, and year
changes clearing dependent selections. All six scenarios passed. 26 catalog API
requests, zero browser exceptions, no horizontal overflow at 390px.

Screenshots reviewed at 1440×1000 and 390×844:

- [Desktop vehicle and parts](evidence/d1492/desktop.png)
- [Mobile vehicle and categories](evidence/d1492/mobile.png)
- [Mobile parts](evidence/d1492/mobile-parts.png)

Detailed local evidence: `/srv/dev/reports/roysauto-d1492/` (also includes the
application dialog, test-cart dialog and machine-readable smoke report).
Built assets: JS 196.54 kB (63.87 kB gzip); CSS 11.50 kB (3.15 kB gzip). These are
bundle measurements, not a load-test or Core Web Vitals claim. Hosted Vercel
acceptance remains pending the protection and branch activation steps above.

Final `agent-pre-push` passed at 11:37 AM EST: TypeScript and all six contract
tests passed on VM511. Required GitHub CI and protected hosted acceptance are
separate gates; their results belong in the PR.
