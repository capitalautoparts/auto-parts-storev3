import type { IncomingMessage, ServerResponse } from 'node:http';

const GATEWAY = new URL('https://staging.autrex.ca/api/erp');
// D1575: single fixed LAN upstream (VM 453 nginx) for the on-prem staging runtime.
// Chosen only by the non-secret deploy-target constant ROYS_ONPREM=1; never by request or env URL.
const ONPREM_GATEWAY = new URL('http://192.168.88.233/api/erp');
const CATALOG_PATHS = new Set(['/', '/api/catalog']);
const USER_AGENT = 'RoysAuto-Catalog-Preview/1.0 (+Autrex; staging read-only)';
const MAIN_TEST_PROJECT_ID = 'prj_MDoqEvUIZHzv65GCFYxLE03xVt2p';
const vehicleKeys = ['year', 'make', 'model'];
const searchKeys = ['q', ...vehicleKeys, 'engine_base_id', 'sub_model_id', 'drive_type_id',
  'body_style_config_id', 'transmission_id', 'region_id', 'category', 'part_type', 'brand',
  'in_stock_only', 'sort', 'sort_order', 'page', 'limit', 'include_facets', 'include_vehicle_dimensions'];
const routes: Record<string, { path: string; keys: string[]; required?: string[] }> = {
  years: { path: '/vehicles/years', keys: [] },
  makes: { path: '/vehicles/makes', keys: ['year'], required: ['year'] },
  models: { path: '/vehicles/models', keys: ['year', 'make'], required: ['year', 'make'] },
  engines: { path: '/vehicles/engines', keys: vehicleKeys, required: vehicleKeys },
  categories: { path: '/taxonomy/categories', keys: [] },
  category: { path: '/taxonomy/categories', keys: ['slug'], required: ['slug'] },
  search: { path: '/search', keys: searchKeys },
};

export function catalogGateway(env: NodeJS.ProcessEnv = {}): URL {
  if (env.ROYS_ONPREM !== '1') return GATEWAY;
  // A Vercel deployment must never reach the LAN upstream, even in local-development mode.
  if (env.VERCEL === '1') throw new Error('CATALOG_DEPLOYMENT_NOT_ALLOWED');
  return ONPREM_GATEWAY;
}

export function upstreamUrl(input: string, base: URL = GATEWAY): URL {
  const requestUrl = new URL(input, 'http://catalog.local');
  if (!input.startsWith('/') || input.startsWith('//') || requestUrl.origin !== 'http://catalog.local'
    || !CATALOG_PATHS.has(requestUrl.pathname) || requestUrl.hash) {
    throw new Error('Unsupported catalog request URL.');
  }
  const params = requestUrl.searchParams;
  const resource = params.get('resource') ?? '';
  if (!Object.hasOwn(routes, resource)) throw new Error('Unknown catalog resource.');
  const route = routes[resource];
  for (const [key, value] of params) {
    if (params.getAll(key).length !== 1 || (key !== 'resource' && !route.keys.includes(key))) {
      throw new Error('Unsupported catalog parameter.');
    }
    if (!value.trim() || value.length > 120 || /[\u0000-\u001f]/.test(value)) throw new Error('Invalid catalog parameter.');
    if (['year', 'page', 'limit', 'part_type', ...searchKeys.filter(k => k.endsWith('_id'))].includes(key)
      && !/^[1-9]\d{0,8}$/.test(value)) throw new Error('Invalid numeric parameter.');
  }
  for (const key of route.required ?? []) if (!params.has(key)) throw new Error(`Missing ${key}.`);
  if (params.has('year') && (+params.get('year')! < 1900 || +params.get('year')! > 2100)) throw new Error('Invalid year.');
  if (params.has('page') && +params.get('page')! > 100) throw new Error('Page limit exceeded.');
  if (params.has('limit') && +params.get('limit')! > 24) throw new Error('Page size exceeded.');
  for (const key of ['include_facets', 'include_vehicle_dimensions']) {
    if (params.has(key) && !['0', '1'].includes(params.get(key)!)) throw new Error('Invalid filter.');
  }
  if (params.has('in_stock_only') && !['all', 'true'].includes(params.get('in_stock_only')!)) throw new Error('Invalid stock filter.');
  if (params.has('sort') && !['price', 'availability', 'relevance'].includes(params.get('sort')!)) throw new Error('Invalid sort.');
  if (params.has('sort_order') && !['asc', 'desc'].includes(params.get('sort_order')!)) throw new Error('Invalid sort order.');
  if (resource === 'search') {
    if (params.has('q') && params.get('q')!.trim().length < 2) throw new Error('Enter at least two characters.');
    if (!params.has('q') && !params.has('category') && !vehicleKeys.every(k => params.has(k))) {
      throw new Error('Choose a vehicle, category, or search term.');
    }
    const hasVehicleFilter = params.has('make') || params.has('model') || searchKeys.some(k => k.endsWith('_id') && params.has(k));
    if (hasVehicleFilter && !vehicleKeys.every(k => params.has(k))) throw new Error('Complete the vehicle selection.');
  }
  const url = new URL(base);
  url.pathname += `/api/v1${route.path}`;
  if (resource === 'category') {
    const slug = params.get('slug')!;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Invalid category.');
    url.pathname += `/${slug}`;
  } else {
    for (const key of route.keys) if (params.has(key)) url.searchParams.set(key, params.get(key)!);
  }
  if (['years', 'makes', 'models'].includes(resource)) url.searchParams.set('vehicleType', 'light-duty');
  if (resource === 'search' && !params.has('limit')) url.searchParams.set('limit', '24');
  if (resource === 'search' && !params.has('in_stock_only')) url.searchParams.set('in_stock_only', 'all');
  return url;
}

export function catalogEnabled(env: NodeJS.ProcessEnv): boolean {
  // On-prem runtime: never on Vercel, always needs the explicit non-secret flag.
  if (env.ROYS_ONPREM === '1') return env.VERCEL !== '1' && env.ROYS_CATALOG_PREVIEW_ENABLED === 'true';
  if (env.VERCEL !== '1' || env.ROYS_CATALOG_PREVIEW_ENABLED !== 'true') return false;
  if (env.VERCEL_ENV === 'preview') return true;
  // Main is a staging-data test site, even though Vercel labels it Production.
  // Use platform identity, never request headers, to constrain this exception.
  return env.VERCEL_ENV === 'production'
    && env.VERCEL_PROJECT_ID === MAIN_TEST_PROJECT_ID
    && env.VERCEL_GIT_COMMIT_REF === 'main';
}

export function createCatalogHandler(fetcher: typeof fetch = fetch, env: NodeJS.ProcessEnv = process.env, localDevelopment = false) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const send = (status: number, body: unknown) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return send(405, { error: 'The catalog accepts read-only requests.' });
    }
    let gateway: URL;
    try { gateway = catalogGateway(env); }
    catch {
      return send(503, { error: 'ERP staging catalog access has not been enabled for this deployment.', code: 'CATALOG_DEPLOYMENT_NOT_ALLOWED' });
    }
    if (!localDevelopment && !catalogEnabled(env)) return send(503, {
      error: 'ERP staging catalog access has not been enabled for this deployment.',
      code: env.ROYS_CATALOG_PREVIEW_ENABLED === 'true' ? 'CATALOG_DEPLOYMENT_NOT_ALLOWED' : 'CATALOG_FLAG_DISABLED',
    });
    let url: URL;
    try { url = upstreamUrl(req.url ?? '', gateway); }
    catch (error) { return send(400, { error: (error as Error).message }); }
    try {
      const response = await fetcher(url, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(15_000), redirect: 'error',
      });
      if (response.headers.get('x-erp-stub') === '1') {
        await response.body?.cancel();
        return send(502, { error: 'The staging catalog is temporarily unavailable.' });
      }
      if (!response.ok) {
        const rayId = response.headers.get('cf-ray');
        await response.body?.cancel();
        return send(response.status === 429 ? 429 : 502, {
          error: response.status === 403 ? 'Staging refused the catalog request. Share this reference with support.' : 'The staging catalog is temporarily unavailable.',
          ...(response.status === 403 && rayId ? { reference: rayId } : {}),
        });
      }
      if (!response.headers.get('content-type')?.includes('application/json') || !response.body) throw new Error('Invalid response');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 2_000_000) throw new Error('Response too large');
          chunks.push(value);
        }
      } finally { await reader.cancel(); }
      const payload: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      return send(200, payload);
    } catch {
      return send(502, { error: 'The staging catalog could not be reached. Please try again.' });
    }
  };
}

export default createCatalogHandler();
