import { createServer } from 'node:http';
import { createCatalogHandler } from './catalog-proxy.ts';

export function createOnPremServer(handler: ReturnType<typeof createCatalogHandler>) {
  return createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://onprem.local').pathname;
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
}
