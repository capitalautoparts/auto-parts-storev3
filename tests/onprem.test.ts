import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createCatalogHandler } from '../server/catalog-proxy.ts';
import { createOnPremServer, resolveListenOptions } from '../server/onprem-server.ts';

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

test('listen options are loopback-only with a validated port', () => {
  assert.deepEqual(resolveListenOptions({}), { host: '127.0.0.1', port: 3200 });
  assert.deepEqual(resolveListenOptions({ HOST: '::1', PORT: '65535' }), { host: '::1', port: 65535 });
  for (const HOST of ['0.0.0.0', '192.168.88.10', '::', 'example.com']) assert.throws(() => resolveListenOptions({ HOST }));
  for (const PORT of ['0', '65536', '-1', '3.5', 'abc', '1e3', '99999999']) assert.throws(() => resolveListenOptions({ PORT }));
});

test('on-prem server rejects HEAD/OPTIONS, traversal and double-slash paths, and upstream stub/redirect responses', async () => {
  let mode: 'stub' | 'redirect' = 'stub';
  const calls: string[] = [];
  const env = { ROYS_ONPREM: '1', ROYS_CATALOG_PREVIEW_ENABLED: 'true' };
  const server = createOnPremServer(createCatalogHandler((async (input: RequestInfo | URL) => {
    calls.push(String(input));
    if (mode === 'redirect') throw new TypeError('redirect mode is set to error');
    return new Response('{}', { headers: { 'content-type': 'application/json', 'x-erp-stub': '1' } });
  }) as typeof fetch, env)).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    for (const path of ['/healthz', '/api/catalog?resource=years']) {
      for (const method of ['HEAD', 'OPTIONS']) assert.equal((await fetch(`${base}${path}`, { method })).status, 405, `${method} ${path}`);
    }
    assert.equal(calls.length, 0);
    // Raw request targets (fetch would normalise these), sent over a socket.
    const raw = async (target: string) => {
      const { request } = await import('node:http');
      return new Promise<number>((resolve, reject) => {
        const req = request({ host: '127.0.0.1', port: address.port, path: target, method: 'GET' }, res => { res.resume(); resolve(res.statusCode ?? 0); });
        req.on('error', reject); req.end();
      });
    };
    for (const target of ['//evil', '//evil/api/catalog?resource=years', '/api/catalog/../x', '/api/catalog/', '/api/catalog\\x', '/x/../api/catalog?resource=years']) {
      assert.equal(await raw(target), 404, target);
    }
    assert.equal(calls.length, 0);
    assert.equal((await fetch(`${base}/api/catalog?resource=years`)).status, 502);
    mode = 'redirect';
    assert.equal((await fetch(`${base}/api/catalog?resource=years`)).status, 502);
    assert.equal(calls.length, 2);
    assert.ok(calls.every(url => url.startsWith('http://192.168.88.233/api/erp/')));
  } finally { server.close(); server.closeAllConnections(); }
});
