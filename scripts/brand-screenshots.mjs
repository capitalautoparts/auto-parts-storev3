// Manual: brand visual check. Run on VM511 after `npx vite build`; serves dist via vite preview, no API interception.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { firefox } from '@playwright/test';
const out = process.env.BRAND_OUT || 'docs/evidence/roys-brand';
await mkdir(out, { recursive: true });
const port = 4391;
const p = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 3000));
const browser = await firefox.launch();
try {
  for (const [name, w, h] of [['desktop-1440', 1440, 900], ['mobile-390', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const len = await page.evaluate(() => document.body.innerText.length);
    console.log(name, 'bodyText', len, 'title', await page.title());
    await page.screenshot({ path: `${out}/${name}.png` });
    await page.close();
  }
} finally { await browser.close(); p.kill('SIGTERM'); }
