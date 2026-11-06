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

## Integrated Node and nginx source

The task branch merged `origin/staging` through d7f9530, including PR9's fixed
LAN adapter, PR10's guidance, PR11's deployment files, PR13's mobile/search/fitment
fixes, and PR12's approved brand theme (036bc23). No unmerged code was copied.

- `readCatalog` selects `catalogGateway(env)` and passes that fixed gateway to
  `upstreamUrl`. The Vercel/on-prem conflict is rejected even in local mode.
- `server/onprem-server.ts` routes `/products/` alongside `/api/catalog` and
  `/healthz`. Loopback-only binding, validated PORT (default 3200), raw API path
  matching, GET-only handling and timeouts are retained. Product paths reject
  normalization/traversal before an ERP read.
- `server/onprem.ts` constructs the product handler with
  `readFile(new URL('../dist/index.html', import.meta.url), 'utf8')` and normal
  deployment gates, with no development bypass.
- `deploy/onprem/nginx-roysauto-staging.conf` adds `/products/` forwarding with
  unchanged path/query, the existing forwarding headers and 30-second timeout.
  Server noindex/robots headers, static assets and catalog method restrictions
  remain intact. **Infra owns installing/reloading this reviewed config.**
- Brand wordmark, favicon, index title and ink/paper/burgundy tokens are retained;
  PR13's compact mobile-grid rows use the brand's charcoal section band.

Candidate acceptance runs on VM511, not the hosted staging site. Hosted product
acceptance remains gated on independent review, approved merge/deployment and
infra installation of the nginx product location. Vercel remains design-only;
no Vercel product rewrite/function or production canonical domain is added.

## Packaged runtime verification

The deploy workflow copies only `server/`, `dist/` and `package.json`.
`ROYS_LINKS_PACKAGED=1` makes the product smoke copy exactly those entries into
an isolated release directory on VM511 and start its real `server/onprem.ts`
from that directory with Node 22 type stripping. Neither `src/`, `node_modules/`
nor the task worktree is present in that package. The external type import in
`product-data.ts` is erased by Node; the HTML template resolves by `import.meta.url`.

Vite supplies built static assets and forwards product/API requests to this
packaged Node process, exercising the normal activation gate and fixed staging
LAN reads. This models nginx dispatch without installing live config. The report
records the retained package path and exact root entries for independent review.

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

For candidate acceptance, on VM511 only:

1. Check `dev-remote --queue`, then the smallest affected tests and one
   `AGENT_PRE_PUSH_BASE=origin/staging agent-pre-push` before pushing.
2. Build with `dev-remote --heavy npx vite build` (pre-push already typechecks).
3. Run `ROYS_LINKS_PACKAGED=1 node scripts/product-links-smoke.mjs` on VM511
   through `dev-remote --service`, with `ROYS_ONPREM=1` and
   `ROYS_CATALOG_PREVIEW_ENABLED=true`.
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
preview flag and approved on-prem LAN target. The nginx source location must be
installed by infra after review. Checkout/payments remain disabled.
