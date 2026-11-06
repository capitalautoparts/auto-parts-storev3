# On-prem staging runtime (D1575)

Cloudflare Bot Fight Mode blocks Vercel's server-side calls to staging.autrex.ca, so the
catalog-connected test site runs on our staging VM (VM 459 `roysauto-staging`, proposed host
`roys-staging.autrex.ca`) and reads the ERP staging catalog over the LAN.

## Architecture

- Browser -> nginx on VM 459 (serves `dist/`, proxies `/products/`, `/api/catalog` and `/healthz` to the Node process).
- `server/onprem.ts` (node:http) serves `GET /api/catalog` via `createCatalogHandler()` and `GET /healthz`.
  Product documents under `/products/<ERP SKU>` use the same gated read path and
  `dist/index.html`, resolved relative to the server module in the deployed release.
  Everything else returns 404; non-GET returns 405. It does not serve static files.
- Upstream: the single fixed `http://192.168.88.233/api/erp` (VM 453 nginx; plain HTTP, no Host header,
  no credentials). Selected only by `ROYS_ONPREM=1`; no fallback, retry to another route, or env-supplied URL.
- Same `/api/erp` gateway contract as before; transport change only. User-Agent, `redirect: 'error'`,
  15 s timeout, 2 MB cap and `X-ERP-Stub` rejection are unchanged.
- Vercel deployments never use the LAN upstream: `VERCEL=1` with `ROYS_ONPREM=1` is denied
  (`CATALOG_DEPLOYMENT_NOT_ALLOWED`).

Transport note: plain HTTP over the LAN to VM 453 is accepted per D1575 (internal network,
read-only public catalog data, no credentials). The Node process listens on loopback only; nginx is the
only network-facing component.

## Environment (all non-secret)

| Variable | Value | Purpose |
| --- | --- | --- |
| `ROYS_ONPREM` | `1` | Selects the LAN upstream; required to start |
| `ROYS_CATALOG_PREVIEW_ENABLED` | `true` | Activation flag |
| `HOST` | unset or loopback (`127.0.0.1`, `::1`, `localhost`) | Bind address; any non-loopback value is refused at start |
| `PORT` | integer 1-65535, default `3200` | Bind port; invalid values are refused at start |

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
