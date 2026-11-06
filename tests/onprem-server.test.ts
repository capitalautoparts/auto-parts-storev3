import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createOnpremHandler } from '../server/onprem-server.ts';

async function withServer(handler: ReturnType<typeof createOnpremHandler>, run: (base: string) => Promise<void>) {
  const server = createServer((req, res) => { void handler(req, res); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); }
  finally { server.close(); }
}

test('on-prem healthz reports the revision and whether the catalog gate is open', async () => {
  await withServer(createOnpremHandler(fetch, {}, 'abc123def456'), async base => {
    const response = await fetch(`${base}/healthz`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { ok: true, revision: 'abc123def456', catalogEnabled: false });
  });
});

test('on-prem server delegates /api/catalog to the proxy, which fails closed without its flag', async () => {
  let upstreamCalls = 0;
  const fetcher = (async () => { upstreamCalls += 1; return new Response('{}'); }) as typeof fetch;
  await withServer(createOnpremHandler(fetcher, {}, 'r'), async base => {
    const response = await fetch(`${base}/api/catalog?resource=years`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'CATALOG_FLAG_DISABLED');
    assert.equal(upstreamCalls, 0);
  });
});

test('on-prem server answers 404 for anything nginx should have served', async () => {
  await withServer(createOnpremHandler(fetch, {}, 'r'), async base => {
    assert.equal((await fetch(`${base}/index.html`)).status, 404);
    assert.equal((await fetch(`${base}/healthz`, { method: 'POST' })).status, 404);
  });
});
