import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { catalogEnabled, createCatalogHandler } from './catalog-proxy.ts';

// On-prem staging runtime (roysauto-staging, VM 459). nginx serves the built
// SPA from dist/; this process only answers /api/catalog and /healthz on
// 127.0.0.1. The catalog proxy keeps its own activation gate and fixed upstream.

function readRevision(): string {
  try { return readFileSync(new URL('../REVISION', import.meta.url), 'utf8').trim(); }
  catch { return 'unknown'; }
}

export function createOnpremHandler(fetcher: typeof fetch = fetch, env: NodeJS.ProcessEnv = process.env,
  revision = readRevision()) {
  const catalog = createCatalogHandler(fetcher, env);
  return async (req: IncomingMessage, res: ServerResponse) => {
    const path = (req.url ?? '/').split('?')[0];
    if (path === '/api/catalog') return catalog(req, res);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (path === '/healthz' && (req.method === 'GET' || req.method === 'HEAD')) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, revision, catalogEnabled: catalogEnabled(env) }));
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found.' }));
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3201);
  const host = process.env.HOST ?? '127.0.0.1';
  const handler = createOnpremHandler();
  const server = createServer((req, res) => { void handler(req, res); });
  server.listen(port, host, () => console.log(`roysauto on-prem server on http://${host}:${port}`));
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}
