// WP-ROYS-HEADER-NAV1 aa064791. VM511 only, after a Vite build.
// Focused integrated-header checks; no interception and no full catalog journey.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { firefox, expect } from '@playwright/test';
import { preview } from 'vite';
import { pathToFileURL } from 'node:url';
import { createProductSmokeMonitor } from './product-links-monitor.mjs';

export async function runHeaderJourney(browser, origin, report, output, { screenshots = true, widths = [1440, 390] } = {}) {
  const monitor = createProductSmokeMonitor(report);
  const run = action => monitor.run(action);
  for (const width of widths) {
    const context = await run(() => browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 }, hasTouch: width === 390 }));
    const page = await run(() => context.newPage());
    page.setDefaultTimeout(20_000);
    monitor.observe(page);
    page.on('request', request => {
      if (/\/api\/(auth|checkout|orders)(?:\/|\?|$)/.test(request.url())) report.forbiddenRequests.push(request.url());
    });
    const screenshot = async name => {
      if (!screenshots) return;
      const file = `${width}-${name}.png`;
      await run(() => page.screenshot({ path: `${output}/${file}` }));
      report.screenshots.push(file);
    };
    const [years] = await run(() => Promise.all([
      page.waitForResponse(response => new URL(response.url()).searchParams.get('resource') === 'years'),
      page.goto(origin),
    ]));
    const yearsPayload = await run(() => years.json());
    assert.equal(years.status(), 200);
    assert.ok(yearsPayload.years.length > 0, 'Real staging years must render.');
    report.samples.push({ width, resource: 'years', status: years.status(), count: yearsPayload.years.length });
    await run(() => expect(page.getByTestId('vehicle-tree').getByRole('button', { name: String(yearsPayload.years[0]), exact: true })).toBeVisible());
    const header = page.locator('header');
    const search = header.getByRole('combobox');
    const menu = page.getByRole('dialog', { name: 'Menu', exact: true });
    const trigger = header.getByRole('button', { name: 'Open menu', exact: true });
    const checkUnavailable = async scope => {
      for (const name of ['Help', 'Order Status', 'Promotions', 'Tools', 'VIN Lookup', 'Need Help?', 'Part Number Search']) {
        await run(() => expect(scope.getByRole('button', { name, exact: true })).toHaveCount(0));
      }
      const account = scope.getByRole('button', { name: 'Account', exact: true });
      await run(() => expect(account).toBeDisabled());
      await run(() => expect(account).toHaveAccessibleDescription('Accounts are not enabled during catalog testing.'));
      await run(() => expect(scope.getByText('Accounts are not enabled during catalog testing.', { exact: true })).toBeVisible());
    };
    if (width === 1440) {
      await run(() => checkUnavailable(header));
      await run(() => header.getByRole('button', { name: 'Search catalog', exact: true }).filter({ hasText: 'Search catalog' }).click());
      await run(() => expect(search).toBeFocused());
      // Existing WishlistPanel has an icon-only trigger; keep this WP in Header.
      await run(() => header.locator('button').filter({ has: page.locator('svg.lucide-heart') }).click());
    } else {
      await run(() => trigger.tap());
      await run(() => checkUnavailable(menu));
      await run(() => screenshot('menu'));
      await run(() => menu.getByRole('button', { name: 'Search catalog', exact: true }).tap());
      await run(() => expect(menu).toHaveCount(0));
      await run(() => expect(search).toBeFocused());
      await run(() => screenshot('search-focus'));
      // Real keyboard activation, including focus trap and post-close return.
      await run(() => trigger.focus());
      await run(() => page.keyboard.press('Enter'));
      await run(() => expect(menu.getByRole('button', { name: 'Part Catalog', exact: true })).toBeFocused());
      await run(() => page.keyboard.press('Tab'));
      await run(() => expect(menu.getByRole('button', { name: 'Search catalog', exact: true })).toBeFocused());
      await run(() => page.keyboard.press('Enter'));
      await run(() => expect(menu).toHaveCount(0));
      await run(() => expect(search).toBeFocused());
      for (const close of ['Escape', 'Close']) {
        await run(() => trigger.focus());
        await run(() => page.keyboard.press('Enter'));
        await run(() => expect(menu).toBeVisible());
        if (close === 'Escape') await run(() => page.keyboard.press('Escape'));
        else await run(() => menu.getByRole('button', { name: 'Close', exact: true }).tap());
        await run(() => expect(menu).toHaveCount(0));
        await run(() => expect(trigger).toBeFocused());
      }
      await run(() => trigger.tap());
      await run(() => menu.getByRole('button', { name: 'Wishlist', exact: true }).tap());
    }
    const wishlist = page.getByRole('dialog', { name: /^My Wishlist/ });
    await run(() => expect(wishlist.getByText('Your wishlist is empty', { exact: true })).toBeVisible());
    await run(() => screenshot('wishlist'));
    await run(() => wishlist.getByRole('button', { name: 'Close', exact: true }).click());
    await run(() => expect(wishlist).toHaveCount(0));
    await run(() => page.getByRole('button', { name: 'Open Quick Cart', exact: true }).click());
    const cart = page.getByRole('dialog', { name: 'Quick Cart', exact: true });
    await run(() => expect(cart).toBeVisible());
    await run(() => expect(cart.getByRole('button', { name: 'Checkout disabled for testing', exact: true })).toBeDisabled());
    await run(() => screenshot('cart'));
    await run(() => page.keyboard.press('Escape'));
    await run(() => expect(cart).toHaveCount(0));

    // One real text search proves the shared combobox and Catalog reset are wired.
    // No vehicle traversal, global/exact mode, cart mutation or product journey.
    await run(() => search.fill('DVNJ_ALD1212M'));
    const [results] = await run(() => Promise.all([
      page.waitForResponse(response => {
        const url = new URL(response.url());
        return url.searchParams.get('resource') === 'search' && url.searchParams.get('q') === 'DVNJ_ALD1212M';
      }),
      search.press('Enter'),
    ]));
    const payload = await run(() => results.json());
    assert.equal(results.status(), 200);
    assert.ok(payload.results.length > 0, 'Real staging search must return parts.');
    report.samples.push({ width, resource: 'search', status: results.status(), count: payload.results.length });
    await run(() => expect(page.locator('[data-testid="inline-parts"][aria-busy="false"] [data-part-id]').first()).toBeVisible());
    await run(() => page.evaluate(() => window.scrollTo(0, 0)));
    if (width === 390) {
      await run(() => trigger.tap());
      await run(() => menu.getByRole('button', { name: 'Part Catalog', exact: true }).tap());
      await run(() => expect(menu).toHaveCount(0));
    } else await run(() => header.getByRole('button', { name: 'Part Catalog', exact: true }).click());
    await run(() => expect(search).toHaveValue(''));
    await run(() => expect(page.getByTestId('inline-parts')).toHaveCount(0));
    await run(() => screenshot('integrated'));
    assert.ok(await run(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)), 'No horizontal overflow.');
    report.cases.push({ width, result: 'passed', checks: ['unavailable controls absent', 'Account disabled with explanation', 'Search focus', ...(width === 390 ? ['tap and keyboard Menu > Search', 'Escape and Close return trigger focus after search intent consumed'] : []), 'Wishlist opens in-page', 'Quick Cart opens in-page', 'real shared search and Catalog reset', 'no horizontal overflow'] });
    await run(() => context.close());
  }
}

// Importing the journey for isolated refusal wiring does not launch a preview.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.equal(process.env.ROYS_ONPREM, '1', 'Use the existing fixed LAN staging upstream.');
  assert.equal(process.env.ROYS_CATALOG_PREVIEW_ENABLED, 'true');
  const output = process.env.ROYS_HEADER_OUTPUT || '/tmp/roys-aa064791-header-navigation';
  await mkdir(output, { recursive: true });
  const report = {
    workPackage: 'WP-ROYS-HEADER-NAV1 aa064791',
    checkedAtEastern: new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', timeZoneName: 'short' }),
    headerSha256: createHash('sha256').update(await readFile('src/components/Header.tsx')).digest('hex'),
    cases: [], samples: [], apiResponses: [], pageErrors: [], forbiddenRequests: [], screenshots: [],
  };
  const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: true } });
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  let browser;
  try {
    browser = await firefox.launch({ headless: true });
    await runHeaderJourney(browser, origin, report, output);
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
}
