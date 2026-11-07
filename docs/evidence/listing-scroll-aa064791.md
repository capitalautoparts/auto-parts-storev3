# Listing transitions (WP-ROYS-LISTING-SCROLL1)

Recorded 2026-11-07, 7:13 AM EST. Base: `origin/staging` `b5e67c9`.
Source-integrated Firefox on VM511, fixed staging gateway, GET requests only.
No hosting, renderer, query semantics, ERP, cart, or payment changes.

## Cause and change

Replacing 24 rows with the short loading status shrank the scrolling catalog.
Firefox clamped/anchored its position, then App focused and revealed the results
after the response arrived. The selected tree category ended above the viewport.

App now keeps the last measured results height only during loading, with no old
products or product actions in that shell. One deliberate main-container scroll
reveals the real selected category before the next paint; global/search results
use their results section. A known inline category must mount before reveal.
Data settlement releases the measured space without another focus/scroll.
Native anchoring is suppressed only while loading/restoring. Successful history
restoration is also marked once per revision, so later Retry does not restore a
stale saved position. Node-attached measurement handles late inline-tree mounts.

## Evidence

Existing hosted baseline reports were reused, rather than repeated:
`/srv/dev/reports/roys-scroll-navigation-aa064791/baseline2.json` and
`baseline3.json`, hosted revision `b5e67c966f89`.

The real candidate journeys passed at 1440×900 and 390×844:

| Case | Desktop | Mobile |
| --- | --- | --- |
| Lower-list Next | 4097 → 1800 | 6665 → 1800 |
| Lower-list Previous | 4097 → 1800 | 6625 → 1800 |
| In-stock filter | 1800 → 1800 | 1800 → 1800 |
| Brake Pad → different Brake Rotors leaf | 4145 → 1828 | 6753 → 1828 |
| Back and native reload | exact 4145 | exact 6753 |
| Selected tree leaf viewport top | 114 px | 210 px |
| First new product viewport top | about 362 px | 470 px |

Each of the eight traced transitions made exactly one explicit main scroll.
Loading samples had zero product rows, retained measured space, and showed no
intermediate scroll clamp. Loading space was released in every settled snapshot.
The selected category remained above the first new products. No horizontal or
document overflow appeared; the mobile cart strip stayed outside the main view.
Bounded global `ALD1212M` search used the results fallback at both widths. A
desktop unmatched query showed the normal empty state and released the shell.

Evidence is preserved at
`/srv/dev/reports/roys-listing-scroll-aa064791/attempt1.json` and screenshots
`{1440,390}-{next-after,previous-after,filter-after,category-after}.png`.
VM511 originals: `/tmp/roys-listing-scroll-YYA0Ig/`.

The first run then failed only in isolated fault setup: the abort predicate
expected the unchecked request to omit `in_stock_only`, but the actual request
contains `in_stock_only=all`. The real journeys were not rerun. The corrected
fault-only continuation captured the exact initial real request URL and aborted
it once on Back. Error → Retry then used real staging, kept the current position
1720 → 1720 and exact URL, and released the loading shell. This separate report
passed: `/srv/dev/reports/roys-listing-scroll-aa064791/fault-only.json` (VM511
`/tmp/roys-listing-scroll-TKdyfn/`). Neither run reported page errors or a route
refusal. Fault injection is not visual proof of catalog data.

The three focused presentation fixtures passed on VM511. Required pre-push and
GitHub checks are recorded in the PR.

## Reproduction and integration gate

Check `dev-remote --queue` first. On VM511:

```sh
dev-remote --service env -u VERCEL -u ROYS_LISTING_SCROLL_FAULT_ONLY -u ROYS_LISTING_SCROLL_CONTINUE_DESKTOP -u ROYS_LISTING_SCROLL_OUTPUT ROYS_ONPREM=1 ROYS_CATALOG_PREVIEW_ENABLED=true node scripts/listing-scroll-check.mjs
```

`ROYS_LISTING_SCROLL_FAULT_ONLY=1` runs only the isolated fault case when the
real-data evidence has already passed. Every invocation creates a new report
directory and preserves earlier attempts.

For the later hosted candidate, add
`ROYS_LISTING_SCROLL_BASE_URL=http://192.168.88.250` and
`ROYS_LISTING_SCROLL_EXPECTED_REVISION=<exact-12-character-commit>` to the clean
environment command above. The only other accepted origin is
`https://roys-staging.autrex.ca`. Hosted mode starts no Vite server, requires the
full two-width real-data journey, rejects fault/continuation modes, and verifies
`/__revision` before and after it. Isolated fault injection runs only against
source integration. No hosted run was performed for this source evidence.

The sibling product-overlay return fix owns controller continuity and separate
evidence. This task did not change or claim to verify that fix. After both
changes land, an exact-revision combined desktop/mobile hosted smoke must cover
category/page transitions and overlay return together. The parent orchestrator
owns that gate; this source result is not a deployment or combined-hosted pass.
