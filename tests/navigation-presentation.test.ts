import test from 'node:test';
import assert from 'node:assert/strict';
import { revealCatalogListing, restoreCatalogPresentation } from '../src/features/catalog/navigation-presentation.ts';

function fixture() {
  const actions: unknown[] = [];
  let pending = false, mounted = true, hidden = false;
  const target = { focus: (options: unknown) => actions.push(['focus', options]),
    closest: () => hidden ? {} : null, getBoundingClientRect: () => ({ top: 180 }) } as unknown as HTMLElement;
  const main = { scrollTop: 1400, scrollLeft: 7, clientTop: 1,
    querySelector: () => pending ? {} : null, contains: (node: HTMLElement) => node === target,
    ownerDocument: { getElementById: () => mounted ? target : null },
    getBoundingClientRect: () => ({ top: 100 }),
    scrollTo: (...args: unknown[]) => actions.push(['scroll', ...args]) } as unknown as HTMLElement;
  return { main, target, actions, pending: (value: boolean) => { pending = value; },
    mounted: (value: boolean) => { mounted = value; }, hidden: (value: boolean) => { hidden = value; } };
}

test('new inline listing reveals its existing category with one main-only movement and no focus scroll', () => {
  const h = fixture();
  assert.equal(revealCatalogListing(h.main, null, 'selected-category'), true);
  assert.deepEqual(h.actions, [['focus', { preventScroll: true }], ['scroll', { top: 1479, left: 7, behavior: 'instant' }]]);
});

test('known inline category waits for mounted references instead of revealing fallback results', () => {
  const h = fixture();
  h.pending(true); assert.equal(revealCatalogListing(h.main, h.target, 'selected-category'), false);
  h.pending(false); h.mounted(false); assert.equal(revealCatalogListing(h.main, h.target, 'selected-category'), false);
  h.mounted(true); h.hidden(true); assert.equal(revealCatalogListing(h.main, h.target, 'selected-category'), false);
  assert.deepEqual(h.actions, []);
  h.hidden(false); assert.equal(revealCatalogListing(h.main, h.target, 'selected-category'), true);
});

test('global/search listings use mounted results, while historical restoration still waits for replacement rows', () => {
  const h = fixture();
  assert.equal(revealCatalogListing(h.main, h.target), true);
  assert.equal(revealCatalogListing(h.main, null), false);
  h.actions.length = 0;
  assert.equal(restoreCatalogPresentation(h.main, { version: 1, href: '/?scope=all&q=brakes', scroll: { x: 0, y: 900 } }, true, h.target), false);
  assert.deepEqual(h.actions, []);
});
