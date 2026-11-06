// VM511 only. Isolated refusal wiring proof; no ERP or visual acceptance.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { firefox } from '@playwright/test';
import { runHeaderJourney } from './header-navigation-check.mjs';

const output = process.env.ROYS_HEADER_OUTPUT || '/tmp/roys-aa064791-header-navigation-review';
await mkdir(output, { recursive: true });
const proof = { fixtureOnly: true, hostedAcceptance: false, cases: [] };
let fault;
let attempts;
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://fixture').pathname;
  if (request.url === fault.path) {
    attempts++;
    response.writeHead(fault.status, { 'content-type': fault.document ? 'text/html' : 'application/json', ...fault.headers });
    response.end(fault.document ? '<h1>Isolated document refusal</h1>' : JSON.stringify(fault.body ?? {}));
  } else if (path === '/api/catalog') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ years: [2020] }));
  } else {
    response.writeHead(200, { 'content-type': 'text/html' });
    // A normal years response does not authorize continuing after a background
    // categories/suggestion refusal or a refused product document navigation.
    response.end(`<main data-testid="vehicle-tree"><button>2020</button></main>
      <script>fetch('/api/catalog?resource=years').then(() => {
        ${fault.document ? `location.assign(${JSON.stringify(fault.path)})` : `fetch(${JSON.stringify(fault.path)})`};
      });</script>`);
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await firefox.launch({ headless: true });
try {
  for (fault of [
    { name: 'background categories 403', path: '/api/catalog?resource=categories', status: 403, headers: { 'cf-ray': 'categories-ray' }, reference: 'categories-ray' },
    { name: 'background suggestion JSON refusal', path: '/api/catalog?resource=makes&year=2020', status: 502, body: { code: 'CATALOG_UPSTREAM_REFUSED', reference: 'suggestion-reference' }, reference: 'suggestion-reference' },
    { name: 'background API challenge', path: '/api/auth/session', status: 200, headers: { 'cf-mitigated': 'challenge', 'cf-ray': 'api-challenge-ray' }, reference: 'api-challenge-ray' },
    { name: 'background API reference header', path: '/api/catalog?resource=categories', status: 503, headers: { 'x-roys-catalog-reference': 'api-header-reference' }, reference: 'api-header-reference' },
    { name: 'mobile document 403', width: 390, document: true, path: '/products/ISOLATED_FIXTURE', status: 403, headers: { 'cf-ray': 'document-ray' }, reference: 'document-ray' },
    { name: 'document challenge', document: true, path: '/products/ISOLATED_FIXTURE', status: 200, headers: { 'cf-mitigated': 'challenge', 'cf-ray': 'document-challenge-ray' }, reference: 'document-challenge-ray' },
    { name: 'document refusal without reference', document: true, path: '/products/ISOLATED_FIXTURE', status: 502, headers: { 'x-roys-catalog-refused': '1' }, reference: 'no Ray/reference supplied' },
  ]) {
    attempts = 0;
    const widths = [];
    let closed;
    const journeyBrowser = {
      async newContext(options) {
        widths.push(options.viewport.width);
        const context = await browser.newContext(options);
        closed = new Promise(resolve => context.once('close', resolve));
        return context;
      },
    };
    const report = { cases: [], samples: [], apiResponses: [], pageErrors: [], forbiddenRequests: [], screenshots: [] };
    const firstWidth = fault.width || 1440;
    await assert.rejects(runHeaderJourney(journeyBrowser, origin, report, output, {
      screenshots: false, widths: [firstWidth, firstWidth === 390 ? 1440 : 390],
    }), /Staging route refused/);
    await closed;
    assert.equal(report.reference, fault.reference, fault.name);
    assert.equal(report.refusal.path, fault.path);
    assert.equal(report.refusal.status, fault.status);
    assert.equal(attempts, 1, 'Refused request is never retried.');
    assert.deepEqual(widths, [firstWidth], 'Refusal prevents the later viewport.');
    assert.deepEqual(report.cases, [], 'Refusal prevents journey completion.');
    assert.deepEqual(report.screenshots, [], 'Fault fixtures are never visual proof.');
    assert.equal(browser.contexts().length, 0, 'Requesting context was closed.');
    proof.cases.push({ name: fault.name, reference: report.reference, result: 'passed' });
  }
  proof.result = 'passed';
} catch (error) {
  proof.result = 'failed';
  proof.error = error.stack;
  throw error;
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  await writeFile(`${output}/refusals.json`, `${JSON.stringify(proof, null, 2)}\n`);
  console.log(`Isolated Header refusal wiring: ${output}/refusals.json`);
}
