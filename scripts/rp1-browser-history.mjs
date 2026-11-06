// Native reload semantics shared by the RP1 checker and bounded diagnostic.
import assert from 'node:assert/strict';
export async function nativeReload(page, run, report, label) {
  const identity = () => page.evaluate(() => ({
    documentId: window.__rp1DocumentId ??= `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    href: location.pathname + location.search + location.hash,
    historyLength: history.length,
    navigationType: performance.getEntriesByType('navigation')[0]?.type,
  }));
  const before = await run(identity);
  // Arm before invoking the browser's native API. The Firefox protocol reload
  // operation was observed to create a navigate entry in this environment.
  await run(() => Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.evaluate(() => window.location.reload()),
  ]));
  const after = await run(identity);
  (report.nativeReloads ??= []).push({ label, before, after });
  assert.notEqual(after.documentId, before.documentId, 'Native reload must create a document');
  assert.equal(after.navigationType, 'reload', 'Native browser reload must report reload semantics');
  assert.equal(after.historyLength, before.historyLength, 'Reload must not add a history entry');
  assert.equal(after.href, before.href, 'Reload preserves exact URL');
}
