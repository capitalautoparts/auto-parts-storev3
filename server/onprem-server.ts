import { createServer } from 'node:http';
import { createCatalogHandler } from './catalog-proxy.ts';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

export function resolveListenOptions(env: NodeJS.ProcessEnv): { host: string; port: number } {
  const host = env.HOST || '127.0.0.1';
  if (!LOOPBACK_HOSTS.has(host)) throw new Error('HOST must be a loopback address; nginx fronts this service.');
  const rawPort = env.PORT ?? '3200';
  const port = /^\d{1,5}$/.test(rawPort) ? Number(rawPort) : NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
  return { host, port };
}

export function createOnPremServer(handler: ReturnType<typeof createCatalogHandler>) {
  const server = createServer({ maxHeaderSize: 8192, headersTimeout: 10_000, requestTimeout: 20_000 }, (req, res) => {
    const path = (req.url ?? '').split('?')[0];
    if (path === '/healthz') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.statusCode = 405; return res.end('{"error":"Method not allowed."}'); }
      res.statusCode = 200;
      return res.end('{"status":"ok"}');
    }
    if (path === '/api/catalog') return void handler(req, res);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = 404;
    res.end('{"error":"Not found."}');
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 20_000;
  return server;
}
