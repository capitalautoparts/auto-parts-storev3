import { createCatalogHandler } from './catalog-proxy.ts';
import { createOnPremServer, resolveListenOptions } from './onprem-server.ts';
import { createProductPageHandler } from './product-page.ts';
import { readFile } from 'node:fs/promises';

function fail(message: string): never {
  console.error(`Refusing to start: ${message}`);
  process.exit(1);
}

if (process.env.ROYS_ONPREM !== '1') fail('ROYS_ONPREM=1 is required.');
if (process.env.VERCEL === '1') fail('the on-prem runtime must not run on Vercel.');
let options: { host: string; port: number };
try { options = resolveListenOptions(process.env); }
catch (error) { fail((error as Error).message); }

const server = createOnPremServer(createCatalogHandler(fetch, process.env),
  createProductPageHandler(() => readFile(new URL('../dist/index.html', import.meta.url), 'utf8')));
server.on('error', error => {
  console.error(`On-prem API failed to listen on ${options.host}:${options.port}: ${(error as NodeJS.ErrnoException).code ?? error.message}`);
  process.exit(1);
});
server.listen(options.port, options.host, () => console.log(`roysauto on-prem API listening on ${options.host}:${options.port}`));
