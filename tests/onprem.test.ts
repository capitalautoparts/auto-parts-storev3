import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createCatalogHandler } from '../server/catalog-proxy.ts';
import { createOnPremServer } from '../server/onprem-server.ts';

test('on-prem server serves /healthz, rejects other paths and methods, and proxies only /api/catalog', async () => {
  const calls: string[] = [];
  const env = { ROYS_ONPREM: '1', ROYS_CATALOG_PREVIEW_ENABLED: 'true' };
  const server = createOnPremServer(createCatalogHandler(async input => { calls.push(String(input)); return Response.json({ years: [2020] }); }, env)).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const health = await fetch(`${base}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    assert.equal((await fetch(`${base}/healthz`, { method: 'POST' })).status, 405);
    assert.equal((await fetch(`${base}/other`)).status, 404);
    assert.equal((await fetch(`${base}/api/catalog?resource=years`, { method: 'POST' })).status, 405);
    assert.equal(calls.length, 0);
    const years = await fetch(`${base}/api/catalog?resource=years`);
    assert.equal(years.status, 200);
    assert.deepEqual(calls, ['http://192.168.88.233/api/erp/api/v1/vehicles/years?vehicleType=light-duty']);
  } finally { server.close(); server.closeAllConnections(); }
});
