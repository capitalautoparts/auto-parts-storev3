# On-prem staging runtime (D1575)

Cloudflare Bot Fight Mode blocks Vercel's server-side calls to staging.autrex.ca, so the
catalog-connected test site runs on our staging VM (VM 459 `roysauto-staging`, proposed host
`roys-staging.autrex.ca`) and reads the ERP staging catalog over the LAN.

## Architecture

- Browser -> nginx on VM 459 (serves `dist/`, proxies `/api/catalog` and `/healthz` to the Node process).
- `server/onprem.ts` (node:http) serves `GET /api/catalog` via `createCatalogHandler()` and `GET /healthz`.
  Everything else returns 404; non-GET returns 405. It does not serve static files.
- Upstream: the single fixed `http://192.168.88.233/api/erp` (VM 453 nginx; plain HTTP, no Host header,
  no credentials). Selected only by `ROYS_ONPREM=1`; no fallback, retry to another route, or env-supplied URL.
- Same `/api/erp` gateway contract as before; transport change only. User-Agent, `redirect: 'error'`,
  15 s timeout, 2 MB cap and `X-ERP-Stub` rejection are unchanged.
- Vercel deployments never use the LAN upstream: `VERCEL=1` with `ROYS_ONPREM=1` is denied
  (`CATALOG_DEPLOYMENT_NOT_ALLOWED`).

## Environment (all non-secret)

| Variable | Value | Purpose |
| --- | --- | --- |
| `ROYS_ONPREM` | `1` | Selects the LAN upstream; required to start |
| `ROYS_CATALOG_PREVIEW_ENABLED` | `true` | Activation flag |
| `HOST` | default `127.0.0.1` | Bind address |
| `PORT` | default `3200` | Bind port |

## Run

```
ROYS_ONPREM=1 ROYS_CATALOG_PREVIEW_ENABLED=true npm run start:onprem
```

Build the SPA separately (`vite build`) and let nginx serve `dist/` with SPA fallback to `index.html`.

## Smoke

```
curl -fsS http://127.0.0.1:3200/healthz
curl -fsS 'http://127.0.0.1:3200/api/catalog?resource=years'
```

Expect `{"status":"ok"}` and a JSON years list. Checkout remains disabled; no credentials, payment
processing or business-data mutations are involved.
