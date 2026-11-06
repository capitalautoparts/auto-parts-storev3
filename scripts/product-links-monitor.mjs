// Shared by real-data smoke and isolated fault contracts. No network/retry here.
export function createProductSmokeMonitor(report) {
  let failure;
  let rejectFailure;
  const failed = new Promise((_, reject) => { rejectFailure = reject; });
  failed.catch(() => {});

  async function inspect(page, response) {
    if (failure) return;
    const url = new URL(response.url());
    const api = url.pathname.startsWith('/api/');
    const document = url.pathname.startsWith('/products/') && response.request().resourceType() === 'document';
    if (!api && !document) return;
    const headers = response.headers();
    const body = api && headers['cf-mitigated'] !== 'challenge'
      ? await response.json().catch(() => null) : null;
    if (failure) return;
    if (api) report.apiResponses.push({ resource: url.searchParams.get('resource'), status: response.status() });
    if (document) (report.productDocuments ??= []).push({ path: url.pathname, status: response.status() });
    const refused = response.status() === 403 || headers['cf-mitigated'] === 'challenge'
      || headers['x-roys-catalog-refused'] === '1' || body?.code === 'CATALOG_UPSTREAM_REFUSED'
      || typeof body?.reference === 'string' || typeof headers['x-roys-catalog-reference'] === 'string';
    if (!refused && (!api || url.pathname === '/api/catalog')) return;
    const reference = headers['x-roys-catalog-reference'] || body?.reference || headers['cf-ray'] || 'no Ray/reference supplied';
    if (refused) {
      report.reference = reference;
      report.refusal = { path: `${url.pathname}${url.search}`, status: response.status() };
    }
    failure = new Error(refused ? `Staging route refused: ${reference}. Stopped without retrying.` : `Unexpected API route: ${url.pathname}`);
    rejectFailure(failure);
    // Close the requester, including mobile and JS-disabled crawler contexts.
    await page.context().close().catch(() => {});
  }

  return {
    observe(page) {
      page.on('pageerror', error => report.pageErrors.push(error.message));
      page.on('response', response => { void inspect(page, response); });
    },
    async run(action) {
      if (failure) throw failure;
      const value = await Promise.race([Promise.resolve().then(() => { if (failure) throw failure; return action(); }), failed]);
      if (failure) throw failure;
      return value;
    },
  };
}
