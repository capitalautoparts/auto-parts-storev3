import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { once } from 'node:events';

// Mirror the published release, outside the worktree and its node_modules.
const release = await mkdtemp(join(tmpdir(), 'roys-product-release-'));
assert.equal(process.versions.node.split('.')[0], '22', 'Release runtime contract requires Node 22');
let server;
try {
  for (const entry of ['server', 'dist', 'package.json']) await cp(entry, join(release, entry), { recursive: true });
  await assert.rejects(access(join(release, 'src')));
  await assert.rejects(access(join(release, 'node_modules')));
  const { createProductPageHandler } = await import(pathToFileURL(join(release, 'server/product-page.ts')).href);
  const { createOnPremServer } = await import(pathToFileURL(join(release, 'server/onprem-server.ts')).href);
  const { createCatalogHandler } = await import(pathToFileURL(join(release, 'server/catalog-proxy.ts')).href);
  const { parseProductDocument } = await import(pathToFileURL(join(release, 'server/product-document.ts')).href);
  const template = () => readFile(join(release, 'dist/index.html'), 'utf8');
  const env = { ROYS_ONPREM: '1', ROYS_CATALOG_PREVIEW_ENABLED: 'true' };
  let calls = 0, upstreamStatus = 200, mismatch = false;
  const hostile = '</script><script>alert("injected")</script>&';
  const fetcher = async input => {
    calls++;
    assert.equal(new URL(input).origin, 'http://192.168.88.233');
    return Response.json({ product: { sku: mismatch ? 'ABCD_OTHER' : 'ABCD_TEST', name: 'Brake pad', brand_name: 'Brand',
      part_number: 'TEST', description_long: hostile, pricing: { currency: 'CAD', msrp: 19.5 },
      specs_list: [{ name: 'Length', value: '4', unit: 'mm' }], fitment_notes: ['Front axle only'],
    } }, { status: upstreamStatus });
  };
  server = createOnPremServer(createCatalogHandler(fetcher, env), createProductPageHandler(template, fetcher, env)).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${origin}/products/ABCD_TEST`), html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.match(html, /Supplied specifications/); assert.match(html, /Front axle only/); assert.match(html, /CAD \$19\.50/);
  assert.match(html, /&lt;\/script&gt;/); assert.doesNotMatch(html, /<script>alert/);
  assert.equal((html.match(/id="product-schema"/g) ?? []).length, 1);
  assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1);
  const json = /<script id="product-bootstrap" type="application\/json">([^]*?)<\/script>/.exec(html)?.[1];
  assert.ok(json); const document = parseProductDocument(json, '/products/ABCD_TEST');
  assert.equal(document?.product.descriptions[0].text, hostile);
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)) await access(join(release, 'dist', match[1]));
  for (const [method, expected] of [['HEAD', 405], ['POST', 405]]) assert.equal((await fetch(`${origin}/products/ABCD_TEST`, { method })).status, expected);
  assert.equal(calls, 1);
  assert.equal((await fetch(`${origin}/products/invalid`)).status, 400); assert.equal(calls, 1);
  mismatch = true; assert.equal((await fetch(`${origin}/products/ABCD_TEST`)).status, 502); mismatch = false;
  for (const status of [404, 429, 503, 403]) {
    upstreamStatus = status;
    const result = await fetch(`${origin}/products/ABCD_TEST`), body = await result.text();
    assert.equal(result.status, status === 403 || status === 503 ? 502 : status);
    assert.doesNotMatch(body, /id="product-schema"|rel="canonical"/);
    if (status === 403) assert.equal(result.headers.get('x-roys-catalog-refused'), '1');
  }
  env.ROYS_CATALOG_PREVIEW_ENABLED = 'false';
  const previous = calls;
  assert.equal((await fetch(`${origin}/products/ABCD_TEST`)).status, 503); assert.equal(calls, previous);
  console.log('Product release check passed: isolated shipped artifacts, real bundled renderer, escaped seed, identity/status/gates and assets.');
} finally {
  server?.close(); server?.closeAllConnections();
  await rm(release, { recursive: true, force: true });
}
