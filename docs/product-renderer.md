# Product document foundation (WP-ROYS-RP6-aa064791)

RP6 adds a small direct-entry product document, using the existing catalog reader
and RP5 ProductFacts. It renders supplied descriptions, ordered public specs,
application conditions and current CAD/pack/core/availability state. Gallery,
cross-reference and paginated fitment presentation remain RP7. Catalog documents
and `/catalog/` dispatch remain RP8. This does not establish public SEO readiness.

## One verified model and one public tree

`server/product-document.ts` projects the mapped product into a strict versioned
public model. Both Node and browser render `ProductDocument.tsx` with this exact
data. The JSON script escapes HTML delimiters and Unicode line separators; the
serialized seed is limited to 2 MB including escaping. The browser validates
nested fields, permitted URLs, numeric values and the requested pathname/SKU
before hydration. It never fetches the initial product again. The model carries
only consumed public fields, not raw upstream payloads or browser list state.

Invalid, duplicate, missing or mismatched seeds retain the readable server tree
and show recovery text. Script failures also leave the server tree and native
catalog link available. Validation detects malformed/tampered shapes and identity
mismatch; it is not an authenticity guarantee against arbitrary same-origin
script execution. React text rendering, JSON escaping and URL validation are the
injection boundaries.

Direct server documents hydrate independently of the catalog App. The first
browser render matches the server; only afterward does a separate control island
load existing `cartApi` and `WishlistProvider`. List storage is never read during
SSR. Add retains current price/purchasable disabling and writes the existing
browser test cart; checkout remains disabled. The catalog's existing product
overlay and navigation stay intact. An explicit Additional product details button
loads the existing detail modal and its bounded fitment data on demand, preserving
access to existing specifications/cross-references/applications without an initial
product re-fetch. Optional detail/fitment failures leave the verified document
and metadata intact; local close/Escape restores the details trigger. Native Browse performs a document navigation;
if a popstate changes the direct document's pathname, the current entry reloads
to prevent stale product content. Query/fragment changes retain product identity.

Vercel design-only static product paths have no server tree/seed and keep the
existing browser App route. Vite dev explicitly uses `ssrLoadModule`; preview and
on-prem use the built artifact. No activation bypass was added to on-prem.

## Packaged runtime

`npm run build` builds the static app, then a dedicated Vite SSR bundle at
`dist/server/product-renderer.js`. `ssr.noExternal: true` includes React and
ReactDOM server dependencies. The Node adapter dynamically resolves this artifact
relative to its own release directory. It never imports React from an unbundled
runtime source file or assumes the current working directory contains a checkout.

The final build step runs `scripts/check-product-release.mjs` on Node 22. It copies
only `server/`, `dist/` and `package.json` to an isolated temporary release, imports
the shipped handler with its default renderer, and checks useful escaped HTML,
strict bootstrap, one identity schema/canonical, referenced assets, refusal,
identity mismatch, 400/404/429/502/503 and GET-only semantics without `src/` or
`node_modules/`. Source HTTP tests inject a fixture renderer because CI runs tests
before build; that fixture is never the artifact proof.

GET-only is preserved: HEAD and other methods remain 405 with `Allow: GET`; no
HEAD parity is claimed. Missing identity is 404, malformed path 400, rate limit
429, malformed/refused/upstream outage 502 and inactive deployment 503. Template
or renderer failure returns a plain recoverable 503. Every response retains
no-store, noindex and nosniff. Price remains visible data only: identity JSON-LD
contains no Offer or price. Existing fixed upstream/time/body limits are unchanged.

No nginx, environment, settings, secret, indexing or installed infrastructure
change is required for existing `/products/` routing. No deploy is performed here.

## Source verification and remaining activation

Recorded 2026-11-06 19:42 EST. Source checks ran on VM511, Node 22:

- Focused product/document/on-prem fixtures: 27/27 passed.
- Final runtime build after merging staging PR29 (`b5e67c9`): typecheck, static
  build, bundled renderer and isolated release smoke passed (snapshot
  `bf0907fc38e5`; renderer 688.84 kB). No source/node_modules runtime dependency.
- Firefox real staging product `DVNJ_ALD1212M`: no-JS useful content; 1440/390
  matching identity, no initial product API fetch, primary image loaded, no
  horizontal overflow, optional existing detail/fitment access and Escape/focus;
  disposable direct Add exactly +1 and wishlist; separate malformed/missing/
  mismatched bootstrap and blocked-script preservation cases passed.
- Attempt 1 also recorded a real uncaught dynamic catalog-entry import error;
  its exact cancellation cause was unproven. Restoring the baseline static
  catalog import removed that unnecessary failure surface. Attempt 2 then found
  a checker-only exact-root expectation inconsistent with RP1's accepted
  `/?scope=all`. Final entry/navigation continuation passed after checking that
  explicit scope and mounted catalog; fast navigation/close had no page errors,
  with expected cancelled asset requests recorded by phase. Passed groups were
  not repeated for the checker-only correction.

Attempt evidence (including failures) is under
`/srv/dev/reports/roys-rp6-renderer-aa064791/attempt-{1,2,3}/`. Parent reviewed
the 1440/390 source images and accepted the foundational layout. The supplied
description mixes AGNA/Autologix text and repeated paragraphs. Those are source
quality/curation limitations; no business data was rewritten and this product is
not declared eligible for public indexing. RP7 owns full PDP refinement.

After infra deploys the reviewed revision, run one **fresh full** hosted check
on VM511 (queue first):

```sh
dev-remote --service env ROYS_ONPREM=1 ROYS_CATALOG_PREVIEW_ENABLED=true ROYS_RENDERER_BASE_URL=https://roys-staging.autrex.ca node scripts/product-renderer-smoke.mjs
```

Hosted mode starts no Vite server and permits only the known staging origins
or HTTP localhost, with no URL credentials/path/query/fragment. It rejects scope,
resume and continuation flags and creates fresh evidence. Source continuation
reports are not hosted acceptance. The hosted run and served revision remain an
infra activation gate; this branch performs no deploy or indexing change.
