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

## Troubleshooting

Start with the HTTP status and JSON `error`, plus `code` or `reference` when present. On the runtime
host, `curl -sS -i 'http://127.0.0.1:3200/api/catalog?resource=years'` keeps the error body visible
(adjust the loopback address/port to the existing listener). These are diagnostic checks, not
instructions to change activation settings. The mappings below follow
[`server/catalog-proxy.ts`](../server/catalog-proxy.ts) (`catalogGateway`, `catalogEnabled`,
`upstreamUrl`, `createCatalogHandler`) and
[`server/onprem-server.ts`](../server/onprem-server.ts) (`createOnPremServer`, `resolveListenOptions`).

### Method and activation errors

| Status / response | Cause | First thing to check |
| --- | --- | --- |
| 405 — `The catalog accepts read-only requests.` (`Allow: GET`) | `/api/catalog` received a method other than GET, including HEAD or OPTIONS. | Inspect the caller's method; use GET for catalog reads. |
| 503 — `CATALOG_FLAG_DISABLED` | The activation check is in force and `ROYS_CATALOG_PREVIEW_ENABLED` is not exactly `true`. | Check that non-secret flag in the running process's deployment configuration, including spelling and case. |
| 503 — `CATALOG_DEPLOYMENT_NOT_ALLOWED` | `ROYS_ONPREM=1` conflicts with `VERCEL=1`; otherwise the flag is `true` but the deployment fails the identity gate. | On-prem expects `ROYS_ONPREM=1` and `VERCEL` not `1`. Without on-prem mode, the gate requires `VERCEL=1` and either `VERCEL_ENV=preview`, or `VERCEL_ENV=production` with project `prj_MDoqEvUIZHzv65GCFYxLE03xVt2p` and branch `main`. Inspect the actual deployment identity; do not override platform identity variables. Vercel remains design-only under D1575. |

Both 503 codes have `error: "ERP staging catalog access has not been enabled for this deployment."`.
The handler checks the method, the Vercel/on-prem conflict, activation, then URL validation, in that
order: a conflicting target returns `CATALOG_DEPLOYMENT_NOT_ALLOWED` even if the flag is absent,
and an inactive deployment can mask a bad query with 503. The handler's `localDevelopment` option
skips activation but never permits the Vercel/on-prem conflict.

### 400 validation errors

These return `{ "error": "<message>" }` before any upstream fetch. Compare the request with the
resource/parameter table in [the proxy contract](agent-reference/architecture.md#catalog-proxy-contract).
The first failing validation wins; fixing one field may expose another error.

| `error` message | Cause | First thing to check |
| --- | --- | --- |
| `Unsupported catalog request URL.` (or a URL-parser error) | The URL cannot be parsed, lacks a single leading `/`, changes origin, has a path other than `/` or `/api/catalog`, or has a fragment. | Inspect the raw request target. Use `/api/catalog?resource=...`; the on-prem router only forwards the exact `/api/catalog` path (see below). |
| `Unknown catalog resource.` | `resource` is missing or is not an own entry in the route allowlist. | Use exactly one of `years`, `makes`, `models`, `engines`, `categories`, `category`, `search`. |
| `Unsupported catalog parameter.` | A key is repeated (including `resource`), or is not allowed for the chosen resource. | Inspect all query keys and remove duplicates or keys outside that resource's allowlist. |
| `Invalid catalog parameter.` | A decoded value is empty/whitespace-only, exceeds 120 characters, or contains U+0000–U+001F. | Inspect decoded values and their lengths, not just the URL-encoded text. |
| `Invalid numeric parameter.` | `year`, `page`, `limit`, `part_type`, or an allowed `*_id` does not match `^[1-9]\d{0,8}$`. | Check for zero, leading zeroes, signs, decimals, whitespace or more than nine digits. |
| `Missing year.`, `Missing make.`, `Missing model.`, `Missing slug.` | A required key is absent: makes needs year; models needs year/make; engines needs year/make/model; category needs slug. | Check the required keys for that resource. A present but empty value fails the earlier value check instead. |
| `Invalid year.` | A numeric year is outside 1900–2100. | Check the year range. |
| `Page limit exceeded.` | `page` is greater than 100. | Check the requested page. |
| `Page size exceeded.` | `limit` is greater than 24. | Check the requested page size. |
| `Invalid filter.` | `include_facets` or `include_vehicle_dimensions` is neither `0` nor `1`. | Check both flag values; `true`/`false` are not accepted here. |
| `Invalid stock filter.` | `in_stock_only` is neither `all` nor `true`. | Check that value; `false` is not accepted. |
| `Invalid sort.` | `sort` is not `price`, `availability`, or `relevance`. | Check the sort name and case. |
| `Invalid sort order.` | `sort_order` is neither `asc` nor `desc`. | Check the direction and case. |
| `Enter at least two characters.` | A supplied search `q` has fewer than two characters after trimming. | Check `q` even when a category or full vehicle is also supplied. Empty/whitespace-only values fail the earlier value check. |
| `Choose a vehicle, category, or search term.` | Search has no `q`, no `category`, and no complete year/make/model selection. | Supply one of those search contexts; a year alone is insufficient. |
| `Complete the vehicle selection.` | Search includes make, model, or any allowed `*_id` without all of year/make/model. | Check the full vehicle selection even if `q` or `category` is present. |
| `Invalid category.` | The `category` resource's `slug` fails `^[a-z0-9]+(?:-[a-z0-9]+)*$`. | Check for lowercase letters/digits separated by single hyphens. This slug check does not apply to search's `category` parameter. |

### Upstream errors

The browser response does not uniquely identify every upstream failure. Inspect the corresponding
gateway/runtime evidence before choosing a cause; do not treat a generic 502 as proof of a network outage.
The proxy uses only the fixed LAN gateway on-prem or the fixed public gateway on Vercel, with no
alternate-route retry.

| Status / `error` message | Cause | First thing to check |
| --- | --- | --- |
| 429 — `The staging catalog is temporarily unavailable.` | The upstream returned 429 without the stub marker. The proxy has no local rate limiter and does not forward `Retry-After`. | Check the gateway's rate-limit response and the caller's request frequency; avoid a tight retry loop. |
| 502 — `The staging catalog is temporarily unavailable.` (stub) | The upstream response has `x-erp-stub: 1`, regardless of HTTP status; this check precedes the non-2xx check. | Check that header at the gateway. A development stub is rejected even with status 200 (or 429); verify the gateway is serving real staging data. |
| 502 — `Staging refused the catalog request. Share this reference with support.` | The upstream returned 403 without the stub marker. `reference` is included only when its `cf-ray` header is nonempty. | Check the gateway's 403 and any returned reference. A missing reference does not rule out a refusal; the message alone does not identify which upstream hop refused it. |
| 502 — `The staging catalog is temporarily unavailable.` (other non-2xx) | The upstream returned another unsuccessful status, excluding the special 403/429 cases above. | Check the original upstream status at the gateway; the client sees 502 rather than that status. Redirects normally take the fetch-error path below. |
| 502 — `The staging catalog could not be reached. Please try again.` (redirect) | Fetch rejects a redirect because it uses `redirect: 'error'`; it does not follow the destination. | Check for a redirect from the fixed upstream and its `Location`, such as a login/canonical-URL redirect. Do not add a fallback URL or enable redirect following. |
| 502 — `The staging catalog could not be reached. Please try again.` (fetch/read failure) | Fetch or body reading throws, including connection failures or the 15-second abort timeout. | Check reachability and response time from the runtime to its fixed gateway, then the gateway's upstream. |
| 502 — `The staging catalog could not be reached. Please try again.` (invalid response) | An otherwise successful response lacks a content type containing `application/json`, has no body, exceeds 2,000,000 streamed bytes, or cannot be parsed as JSON. | Check the upstream content type, body size and JSON validity. An HTML error/challenge page can cause this even with HTTP 200. |

### On-prem routing and listener checks

`GET /healthz` returns `{"status":"ok"}` without calling the catalog handler or checking activation
or upstream connectivity. A healthy response therefore does not prove that catalog reads work.
Non-GET `/healthz` returns 405 with `Method not allowed.` and `Allow: GET`.
Only the exact `/api/catalog` path (optionally with a query) reaches the proxy; `/`, `/api/catalog/`
and all other paths return 404 with `Not found.`, regardless of method. Check nginx's forwarded path
first if a catalog request returns that 404. An nginx-generated error is outside the proxy mappings above.

If the Node listener is unavailable, check its startup error and configured loopback address/port:
`resolveListenOptions` accepts only `127.0.0.1`, `::1` or `localhost` (default `127.0.0.1`), and a
one-to-five-digit `PORT` in 1–65535 (default `3200`). Invalid values throw before a usable listener
is configured; they are not catalog JSON 503 responses.
