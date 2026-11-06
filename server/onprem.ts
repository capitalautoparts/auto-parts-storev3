import { createCatalogHandler } from './catalog-proxy.ts';
import { createOnPremServer } from './onprem-server.ts';

if (process.env.ROYS_ONPREM !== '1') {
  console.error('Refusing to start: ROYS_ONPREM=1 is required.');
  process.exit(1);
}

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3200);
createOnPremServer(createCatalogHandler(fetch, process.env)).listen(port, host, () => console.log(`roysauto on-prem API listening on ${host}:${port}`));
