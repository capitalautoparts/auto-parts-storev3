# WP-ROYS-RP1-aa064791 evidence

Branch `agent/roys-rp1-navigation-aa064791`, base merged PR26
`2ab0501a0f9bfc27f85f38ad49749e314a43b883`. Parent w7:p2 owns integration.
No merge, deployment, upstream/configuration or commerce changes.

| Hypothesis / requirement | Command or source evidence | Decision/result |
| --- | --- | --- |
| Navigation contract was inactive | App previously held separate memory-only vehicle/category/text/filter/page state | Active controller/resolver adapter now drives requests and URLs |
| Leaf slug can resolve through self endpoint | Parent pinned ERP `4e3ed42e`, `TaxonomyController.ts:310–367`: full identity only for source_type=category; leaf self is 404 | Emit browser-only verified `category_parent`; validate roots plus one cached children lookup; cold parentless leaf is an explicit gap |
| Configuration syntax/facets prove membership | Current allowlist has no complete five-dimension or PCDB membership contract | Preserve unresolved narrowing constraints in URL/request, disclose and offer Clear; never produce full verified evidence |
| Global PCDB-only search works | Current search contract requires text/category/full YMM | Recover unsupported state before request; proxy unchanged |
| Product query keys are catalog state | Existing server supports pathname identity with ignored query | Keep query/fragment outside product identity/scope/return; emit query-free SKU links |
| Navigation transitions and restoration are wired | VM511 `node --experimental-strip-types --test tests/navigation-state.test.ts tests/navigation-controller.test.ts` | Earlier 20/20 checkpoint; coherent A–G batch 30/30 passed once; residual focus/pending-intent batch 33/33 passed once, including deferred races, category/request transport and presentation restoration |

The fixture batch uses synthetic references and isolated transport responses;
it makes no claim about real product membership or hosted acceptance. All
validation runs on VM511 after checking `dev-remote --queue`. Browser checks and
final pre-push remain pending at this checkpoint.
