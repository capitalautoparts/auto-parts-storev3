# D1492 — reuse the existing staging catalog gateway

The deployed RoysAuto function passed its activation gate, but Cloudflare's
free Bot Fight Mode challenged its direct ERP request. The exact Security Event
for Ray `a556f8af3d87c8c5` at November 4, 2026, 5:14:23 PM EST names
`botFight` / `bot_fight_mode` / `managed_challenge` on
`staging.autopartserp.com/api/v1/vehicles/years`. It shows the expected honest
RoysAuto User-Agent. This was not a missing Vercel flag or the custom curl rule.

Brian asked for another approach. The existing staging website already exposes
a restricted public catalog proxy. The candidate route is:

```
RoysAuto browser
  -> same-origin /api/catalog on Vercel
  -> https://staging.autrex.ca/api/erp/api/v1/<allowed catalog route>
  -> ERP staging
```

This reuses an intentionally public storefront API. It does not change
Cloudflare rules, connect directly to a database, expose an origin IP, or send
privileged credentials from RoysAuto. It keeps the existing single-page UI.

## Data source and boundary evidence

- The website deployment workflow uses the website Infisical project's staging
  `/runtime` configuration for its `main` deployment.
- A read of the single `ERP_API_URL` configuration key confirmed hostname
  `staging.autopartserp.com`, with no path, in that staging configuration. No
  other runtime credentials were requested or printed. This confirms the
  configured target; it is not a dump of the running container environment.
- capautov3's `src/lib/api/erp-browser-policy.ts` explicitly permits the vehicle,
  taxonomy and search GET paths used here. Its proxy chooses server-side API
  credentials and does not accept a caller-supplied upstream address.
- RoysAuto retains its own smaller route/query allowlist, GET-only handler,
  fixed destination, dropped caller credentials, redirect refusal, timeout,
  response size cap, and exact Vercel project/main activation gate. It rejects
  responses carrying the gateway's `X-ERP-Stub` development marker.
- This integration uses the catalog API only. It introduces no Shopify flow,
  checkout, accounts, orders, payments, database writes or production ERP target.

## Read-only route checks

From VM510 with the normal RoysAuto identifying UA, the years endpoint returned
HTTP 200 JSON with 52 years and no `X-ERP-Stub` header. The remaining finite
sequence passed: Toyota makes/models, Camry engines, brakes category, vehicle-
scoped brake pads, and exact SKU search. It returned 24 parts and
`DVNJ_ALD1212M` at CAD 28. The response counts and metadata are recorded in
[gateway-readonly.json](evidence/d1492-staging-gateway/gateway-readonly.json).

These are gateway/data-contract checks from VM510, not proof of Vercel egress
or a completed hosted browser flow. The previous hosted failure remains the
last result for the deployed RoysAuto main site until this candidate is released
and checked there.

## Operational tradeoff

RoysAuto testing now depends on the existing staging website proxy and its
deployment/configuration as well as ERP staging. The proxy caches vehicle
reference data and briefly caches anonymous searches; CAD prices remain test
estimates and availability must be rechecked for any future checkout. The
RoysAuto response itself remains no-store. This is a practical testing path,
not a claim of production readiness or guaranteed Vercel access.

## Deployment settings inventory

No Cloudflare or Vercel setting changes. No paid plan, static egress service,
DNS record, new credentials or environment variable. Keep the existing
`ROYS_CATALOG_PREVIEW_ENABLED=true` activation flag and platform identity
requirements. No staging website or ERP deployment is needed for this change.

## Smoke plan

1. Run the affected typecheck and contract/compiled-entrypoint checks on VM511
   through `agent-pre-push`. Record the actual result in the PR.
2. After approved promotion to main and a ready Vercel deployment, make one
   read-only request to the public RoysAuto years endpoint. Stop on a challenge,
   recording its Ray ID; do not try alternate headers or origins.
3. If years pass, check makes, models, engines, category, vehicle-scoped parts
   and exact SKU CAD price through RoysAuto, then the desktop/mobile vehicle,
   search and Quick Cart flow. Do not create an order or payment.
4. Record hosted results separately from the gateway-only evidence. Move D1492
   to Review / Verify only after the hosted flow passes.

Rollback is a reviewed revert of this adapter change to the direct ERP route
at main `b1139156fffb8422c8d76666caee56872a77c946`; that route is known to be
challenged from Vercel. Removing the existing activation flag and redeploying
also fails closed and remains an owner-managed setting action.
