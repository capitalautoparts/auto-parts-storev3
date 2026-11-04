# RoysAuto by Autrex — catalog exploration

Canada/CAD first, with explicit market configuration for a future US/USD site.
This React/Vite preview focuses on vehicle selection, part search, category
navigation and application notes. Real catalog data comes from ERP staging.

## Run and validate

Node 22 is required. On a development machine: `npm ci`, then `npm run dev`.
The Vite server serves the UI and the same read-only `/api/catalog` handler used
by Vercel. No local environment file or database credential is needed. Upstream
is fixed to `https://staging.autopartserp.com/api/v1`; requests identify this app
honestly and forward neither user cookies nor authorization headers.

On VM510, do not install/build/test locally. Check `dev-remote --queue`, then use
`agent-pre-push` (typecheck and tests on VM511). Run `npm run build` through
`dev-remote --heavy`. Browser validation uses Firefox on VM511. The GitHub PR
workflow repeats the dependency install, contract tests and production build.

## Preview activation

Existing Vercel project: `brian-barbers-projects/auto-parts-storev3`.
Existing public test alias: https://auto-parts-storev3.vercel.app.
That alias still serves the previous app until a separately authorized release.
Task PRs target `staging`; they are not production releases.

Agents have no authorized Vercel account access. After the PR is open, Brian:

1. Open the project → **Settings → Deployment Protection**. Confirm **Vercel
   Authentication** covers **Preview** deployments, and attach a screenshot to
   D1492. Verify the exact preview root and `/api/catalog?resource=years` both
   challenge an anonymous request.
2. Open **Settings → Environment Variables**. Add the non-secret variable
   `ROYS_CATALOG_PREVIEW_ENABLED` with value `true`, environment **Preview**,
   branch **feat/roysauto-d1492-catalog** only. Redeploy that branch preview.

No new account/team/domain/credential is required. Do not configure Production
variables. The API returns 503 unless this flag and `VERCEL_ENV=preview` are
present on Vercel. The HTML and API are marked noindex; that is not authentication.
A protected preview and an authenticated browser smoke are still required after
activation. If staging returns 403, record the provided Cloudflare Ray ID and
stop; never spoof a browser User-Agent or introduce retry loops.

## Data and UX boundaries

- Vehicle options use ERP light-duty reference data. Year/make/model changes
  clear dependent selections; the vehicle persists in browser storage.
- Search supports keywords/part numbers, category, brand, part type, stock,
  engine and remaining vehicle dimensions. URL state supports Back/Forward.
- Application qualifiers stay visible. A model match is not a fitment guarantee.
- CAD prices are displayed only when supplied by ERP; missing prices do not
  become zero. Core charges and sellable-pack quantities remain separate.
- Test carts save identifiers and quantities locally, not stale totals or
  customer information. They create no orders, payments or reservations.
- No active Shopify, login, simulated checkout or card/address capture flow.
  Helcim checkout is a later, separately reviewed sandbox work package.
- Original prototype components remain in the repository for reference but are
  not mounted by this application. The old AWS API adapter is not used.

See [D1492 implementation scope](docs/catalog-exploration.md) for the settings
inventory and production gaps. SEO-ready server-rendered product pages, stable
market canonical URLs, measured load/latency targets, independent sellability,
shipping/tax and checkout remain future work; this preview is not a launch.
