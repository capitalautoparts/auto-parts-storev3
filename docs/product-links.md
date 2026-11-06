# Permanent product links (WP-ROYS-LINKS1, aa064791)

The existing catalog remains a single React page. Product images, part names and
Details are real anchors to `/products/<encoded ERP SKU>`. An ordinary click
pushes a history entry and opens the existing dialog; Back, Forward and closing
the dialog preserve the mounted catalog and its search/tree state. Modified
clicks retain native browser behavior. A fresh tab or refresh reads the product
by SKU, independently of search rows, local storage and the part snapshot cache.

SKUs require the ERP brand-qualified identity (four uppercase alphanumeric
characters, underscore, part number; at most 160 characters). Part-number
punctuation such as spaces, parentheses and plus signs is encoded. Separators,
percent escapes inside decoded IDs, query/fragment delimiters and control
characters are rejected. No slugs or ambiguous bare part-number resolution.
An ERP response whose SKU/id differs from the requested SKU fails verification.

## ERP contracts and price evidence

The same-origin GET allowlist adds only:

| Resource | Parameters | Fixed upstream suffix |
| --- | --- | --- |
| `product` | required `sku` | `/api/v1/products/<sku>` |
| `product-fitments` | required `sku`, optional `page`, `limit` | `/api/v1/products/<sku>/fitments` |

Pagination keeps the existing maximum of 24 rows and 100 pages. GET-only,
activation gates, upstream selection, honest User-Agent, stub rejection,
redirect rejection, timeout and response-size limits remain shared with the
catalog proxy. Product-specific 404s remain 404; transport failures remain
unavailable. No new upstream, fallback route, credentials or business writes.

Read-only source evidence in `AutoProPartsERP/server/src/routes/public-api/v1/products.ts`
(inspected 2026-11-06 EST):

- Around lines 1244 and 1631–1657, the handler resolves `salePrice`, emits active
  OPEN sale windows in `sale_price`, uses `sale_price` for compare-at discounts,
  and otherwise emits the resolved retail `salePrice` in `msrp`.
- Around lines 166–168, its final-sale listing consumes
  `sale_price ?? msrp` whenever `basis !== 'none'`.
- Around lines 1784–1804, stock-policy pricing can carry `basis: last_known` or
  `none`. This storefront conservatively shows Price unavailable for either,
  unknown future bases, malformed/negative/non-finite prices or non-CAD data.
- No manufacturer MSRP, discount or savings claim is inferred. CAD display uses
  `sale_price ?? msrp` only under the verified contract above. No offers or price
  metadata is generated.

Read-only LAN samples returned `DVNJ_ALD1212M`, CAD 28, and 57 applications. The
sample is evidence of shape, not an enduring price guarantee. Fitment responses
supply year ranges, make, model, submodel and position, but no engine. The dialog
labels that limitation and paginates; it never turns the selected tree vehicle
or a sampled product summary into confirmed fitments. Missing/failed fitment
data is displayed separately from the product and has its own Retry action.

## Crawlable HTML and limits

`server/product-page.ts` reads through the same fail-closed catalog function and
inserts escaped title, description, a path-relative canonical, identity-only
Product JSON-LD and a visible product article into the existing Vite HTML shell.
No JavaScript is required to read the name, part number, ERP SKU or description.
The browser takes over the existing product dialog after mounting. Upstream SEO
HTML, canonical domains and prebuilt schema are not trusted or copied.

HTTP HTML and browser navigation use the same escaped identity-only schema
builder. JavaScript retains the matching server schema during direct-entry
loading, updates one node from the verified product, and removes stale identity
on catalog/error navigation. The smoke checks schema state through Back/Forward.

Product HTML exposes non-secret `X-Roys-Catalog-Refused: 1` and a validated
`X-Roys-Catalog-Reference` for upstream refusals/challenges. The shared smoke
monitor observes these document responses as well as catalog JSON and raw
Cloudflare 403/challenge responses. It latches the first failure, closes the
requesting page's context (desktop, mobile or crawler), and guards subsequent
journeys against continuing or retrying that route.

Staging remains `noindex, nofollow` in both HTML and HTTP headers. Missing
products return HTTP 404, invalid SKU paths 400, activation failures 503 and
unavailable/mismatched ERP data 502. Canonicals omit query parameters; no public
production domain is invented. The schema intentionally has no Offer/price.
This is product HTML plumbing, not a claim of complete SPA SEO: catalog search,
vehicle pages, sitemaps, indexing policy and a production canonical origin are
outside this work package.

## Integration gate: PR9 and PR11 are not yet on staging

This branch starts at `origin/staging` c7159f8. PR9 owns the fixed on-prem LAN
upstream and Node server; PR11 owns nginx and the release workflow. Their
unmerged implementation has not been copied here. The product HTML handler is
mounted in Vite dev/preview, and accepts a template callback so it can be added
to the existing Node process after those dependencies land.

Exact remaining glue, to apply after merging `origin/staging`:

1. In `server/onprem-server.ts`, add a product handler parameter alongside the
   existing catalog handler and route `/products/` requests to it before the
   catch-all 404. Preserve `/healthz`, `/api/catalog`, loopback binding, method
   restrictions and server timeouts.
2. In `server/onprem.ts`, construct `createProductPageHandler` with
   `() => readFile(new URL('../dist/index.html', import.meta.url), 'utf8')` and
   pass it to that server. Use the default fetch/environment/gates, with no
   local-development bypass. `server/` and `dist/` are already release inputs.
   `product-data.ts` has only an erased type import outside `server/`; no new
   runtime package or release copy is needed.
3. In `deploy/onprem/nginx-roysauto-staging.conf`, add `location /products/`
   forwarding unchanged paths and queries to `http://127.0.0.1:3200`, using
   the existing catalog proxy's forwarding headers and 30-second timeout.
   Keep the server-level noindex headers and static `/assets/` behavior. Infra
   owns installation/reload of the reviewed nginx file; this executor does not
   change live infrastructure or deploy.
4. Reconcile the shared proxy with PR9: `readCatalog` must pass its deployment
   environment into PR9's `upstreamUrl(input, env)`; retain that PR's exact
   fixed LAN selection and Vercel-conflict denial.
5. Preserve PR12 theme and PR13 compact mobile rows, scoped fitment notes,
   search and retry fixes when they merge. The existing browser smoke now
   targets the Details anchor instead of a button.

Until that glue and VM511 real-staging Firefox checks pass, this work is an
isolated, dependency-blocked candidate, not accepted on-prem functionality.
Vercel remains design-preview-only; no Vercel rewrite or product HTML function
is installed by this PR.

Evidence ledger (2026-11-06 10:58 EST):

| Hypothesis | Command / result | Decision |
| --- | --- | --- |
| Detail URLs can identify products independently of search | VM511 `node --experimental-strip-types --test tests/product.test.ts`: six focused contracts passed | Keep the SKU read and HTML handler in the existing stack |
| The isolated change preserves types and current API contracts | VM511 `AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push`: typecheck and all 27 tests passed, including history handling and emitted Vercel gates | Commit and open a dependency-blocked draft PR |
| Current staging can accept the full on-prem journey | PR9/11 remain unmerged; Node/nginx entrypoints are absent on this branch | Do not claim integrated browser/visual or on-prem acceptance; apply the glue above after dependencies land |

## Validation and acceptance

`tests/product.test.ts` exercises SKU/path rejection, ERP mapping, CAD price
safety, fitment ranges and pagination, missing products, fail-closed activation,
stub rejection, hostile metadata escaping, no-JavaScript response identity and
noindex. It runs in the existing Node test command on VM511/CI.

`node --experimental-strip-types scripts/product-links-faults.mjs` is a separate
VM511 Firefox contract check using isolated fixtures only. It covers JS direct
entry, SKU changes, Back/Forward and error schema state, plus mobile/crawler/API
refusals, HTTP 200 challenge headers and missing-Ray cases. It checks the correct
context closes and subsequent journeys/retries never execute. It makes no ERP
requests and creates no screenshots; its success is not real-staging acceptance.

After dependencies/glue are integrated, on VM511 only:

1. Check `dev-remote --queue`, then the smallest affected tests and one
   `AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push` before pushing.
2. Build with `dev-remote --heavy npx vite build` (pre-push already typechecks).
3. Run `node scripts/product-links-smoke.mjs` on VM511 through `dev-remote
   --service`, using the approved on-prem activation variables after PR9.
   It uses real ERP staging, no mocked API responses. It covers direct entry,
   reload, a separate browser context, in-page open/close, Back/Forward,
   paginated fitments, missing and hostile SKU paths, no-JavaScript HTML,
   and 1440×900 / 390×844 screenshots. A challenge/403 records its reference
   and stops that route. Price 28 and application count 57 are explicit sample
   assertions; update only with fresh read-only ERP evidence if the sample changes.
4. Run the existing integrated catalog journey for PR13 preservation. Record
   isolated test results separately from integrated acceptance and deployment.

Deployment inventory: no settings changed; no new env variables, credentials,
domains, Cloudflare/DNS or deployment-protection changes. Existing Vercel
project/main exception is unchanged. Activation still requires the existing
preview flag; on-prem LAN activation awaits PR9. Checkout/payments remain disabled.
