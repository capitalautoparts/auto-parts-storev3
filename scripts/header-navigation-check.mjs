// WP-ROYS-HEADER-NAV1 aa064791. VM511 only, after a Vite build.
// Focused integrated-header checks; no interception and no full catalog journey.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { firefox, expect } from '@playwright/test';
import { preview } from 'vite';

assert.equal(process.env.ROYS_ONPREM, '1', 'Use the existing fixed LAN staging upstream.');
assert.equal(process.env.ROYS_CATALOG_PREVIEW_ENABLED, 'true');
const output = process.env.ROYS_HEADER_OUTPUT || '/tmp/roys-aa064791-header-navigation';
await mkdir(output, { recursive: true });
const report = {
  workPackage: 'WP-ROYS-HEADER-NAV1 aa064791',
  checkedAtEastern: new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', timeZoneName: 'short' }),
  headerSha256: createHash('sha256').update(await readFile('src/components/Header.tsx')).digest('hex'),
  cases: [], apiResponses: [], pageErrors: [], forbiddenRequests: [], screenshots: [],
};
const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: true } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
let browser;
try {
  browser = await firefox.launch({ headless: true });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 }, hasTouch: width === 390 });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    page.on('pageerror', error => report.pageErrors.push(error.message));
    page.on('request', request => {
      if (/\/api\/(auth|checkout|orders)(?:\/|\?|$)/.test(request.url())) report.forbiddenRequests.push(request.url());
    });
    const screenshot = async name => {
      const file = `${width}-${name}.png`;
      await page.screenshot({ path: `${output}/${file}` });
      report.screenshots.push(file);
    };
    const yearsResponse = page.waitForResponse(response => new URL(response.url()).searchParams.get('resource') === 'years');
    await page.goto(origin);
    const years = await yearsResponse;
    const yearsPayload = await years.json();
    assert.equal(years.status(), 200);
    assert.ok(yearsPayload.years.length > 0, 'Real staging years must render.');
    report.apiResponses.push({ width, resource: 'years', status: years.status(), count: yearsPayload.years.length });
    await expect(page.getByTestId('vehicle-tree').getByRole('button', { name: String(yearsPayload.years[0]), exact: true })).toBeVisible();
    const header = page.locator('header');
    const search = header.getByRole('combobox');
    const menu = page.getByRole('dialog', { name: 'Menu', exact: true });
    const trigger = header.getByRole('button', { name: 'Open menu', exact: true });
    const checkUnavailable = async scope => {
      for (const name of ['Help', 'Order Status', 'Promotions', 'Tools', 'VIN Lookup', 'Need Help?', 'Part Number Search']) {
        await expect(scope.getByRole('button', { name, exact: true })).toHaveCount(0);
      }
      const account = scope.getByRole('button', { name: 'Account', exact: true });
      await expect(account).toBeDisabled();
      await expect(account).toHaveAccessibleDescription('Accounts are not enabled during catalog testing.');
      await expect(scope.getByText('Accounts are not enabled during catalog testing.', { exact: true })).toBeVisible();
    };
    if (width === 1440) {
      await checkUnavailable(header);
      await header.getByRole('button', { name: 'Search catalog', exact: true }).filter({ hasText: 'Search catalog' }).click();
      await expect(search).toBeFocused();
      // Existing WishlistPanel has an icon-only trigger; keep this WP in Header.
      await header.locator('button').filter({ has: page.locator('svg.lucide-heart') }).click();
    } else {
      await trigger.tap();
      await checkUnavailable(menu);
      await screenshot('menu');
      await menu.getByRole('button', { name: 'Search catalog', exact: true }).tap();
      await expect(menu).toHaveCount(0);
      await expect(search).toBeFocused();
      await screenshot('search-focus');
      // Real keyboard activation, including focus trap and post-close return.
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(menu.getByRole('button', { name: 'Part Catalog', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(menu.getByRole('button', { name: 'Search catalog', exact: true })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(menu).toHaveCount(0);
      await expect(search).toBeFocused();
      for (const close of ['Escape', 'Close']) {
        await trigger.focus();
        await page.keyboard.press('Enter');
        await expect(menu).toBeVisible();
        if (close === 'Escape') await page.keyboard.press('Escape');
        else await menu.getByRole('button', { name: 'Close', exact: true }).tap();
        await expect(menu).toHaveCount(0);
        await expect(trigger).toBeFocused();
      }
      await trigger.tap();
      await menu.getByRole('button', { name: 'Wishlist', exact: true }).tap();
    }
    const wishlist = page.getByRole('dialog', { name: /^My Wishlist/ });
    await expect(wishlist.getByText('Your wishlist is empty', { exact: true })).toBeVisible();
    await screenshot('wishlist');
    await wishlist.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(wishlist).toHaveCount(0);
    await page.getByRole('button', { name: 'Open Quick Cart', exact: true }).click();
    const cart = page.getByRole('dialog', { name: 'Quick Cart', exact: true });
    await expect(cart).toBeVisible();
    await expect(cart.getByRole('button', { name: 'Checkout disabled for testing', exact: true })).toBeDisabled();
    await screenshot('cart');
    await page.keyboard.press('Escape');
    await expect(cart).toHaveCount(0);

    // One real text search proves the shared combobox and Catalog reset are wired.
    // No vehicle traversal, global/exact mode, cart mutation or product journey.
    const searchResponse = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.searchParams.get('resource') === 'search' && url.searchParams.get('q') === 'DVNJ_ALD1212M';
    });
    await search.fill('DVNJ_ALD1212M');
    await search.press('Enter');
    const results = await searchResponse;
    const payload = await results.json();
    assert.equal(results.status(), 200);
    assert.ok(payload.results.length > 0, 'Real staging search must return parts.');
    report.apiResponses.push({ width, resource: 'search', status: results.status(), count: payload.results.length });
    await expect(page.locator('[data-testid="inline-parts"][aria-busy="false"] [data-part-id]').first()).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    if (width === 390) {
      await trigger.tap();
      await menu.getByRole('button', { name: 'Part Catalog', exact: true }).tap();
      await expect(menu).toHaveCount(0);
    } else await header.getByRole('button', { name: 'Part Catalog', exact: true }).click();
    await expect(search).toHaveValue('');
    await expect(page.getByTestId('inline-parts')).toHaveCount(0);
    await screenshot('integrated');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow.');
    report.cases.push({ width, result: 'passed', checks: ['unavailable controls absent', 'Account disabled with explanation', 'Search focus', ...(width === 390 ? ['tap and keyboard Menu > Search', 'Escape and Close return trigger focus after search intent consumed'] : []), 'Wishlist opens in-page', 'Quick Cart opens in-page', 'real shared search and Catalog reset', 'no horizontal overflow'] });
    await context.close();
  }
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.forbiddenRequests, []);
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.error = error.stack;
  throw error;
} finally {
  await writeFile(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
  console.log(`Header navigation evidence: ${output}/report.json`);
}
