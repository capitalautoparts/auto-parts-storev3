import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';
import { nativeReload } from '../scripts/rp1-browser-history.mjs';

test('native reload document marker works on HTTP without SecureContext randomUUID', async () => {
  let context;
  let resolveNavigation;
  const newDocument = type => {
    const location = { pathname: '/', search: '?scope=all', hash: '', reload: () => {
      newDocument('reload'); resolveNavigation();
    } };
    context = createContext({ window: { location }, location, history: { length: 2 },
      crypto: {}, // randomUUID is unavailable on a non-trustworthy HTTP origin.
      performance: { getEntriesByType: () => [{ type }] } });
  };
  newDocument('navigate');
  const page = {
    evaluate: callback => Promise.resolve(runInContext(`(${callback.toString()})()`, context)),
    waitForNavigation: () => new Promise(resolve => { resolveNavigation = resolve; }),
  };
  const report = {};
  await nativeReload(page, action => Promise.resolve().then(action), report, 'HTTP LAN');
  const { before, after } = report.nativeReloads[0];
  assert.equal(before.historyLength, 2); assert.equal(after.historyLength, 2);
  assert.equal(after.navigationType, 'reload'); assert.notEqual(before.documentId, after.documentId);
  assert.equal(typeof before.documentId, 'string'); assert.ok(before.documentId.length > 5);
});
