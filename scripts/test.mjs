import { spawnSync } from 'node:child_process';
// dev-check supplies --run; node:test already runs once without a watch mode.
if (process.argv.slice(2).some(arg => arg !== '--run')) throw new Error('Only --run is supported');
const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', 'tests/catalog.test.ts', 'tests/navigation-state.test.ts', 'tests/navigation-controller.test.ts', 'tests/search-intent.test.ts', 'tests/browser-history.test.mjs', 'tests/product.test.ts', 'tests/product-document.test.ts', 'tests/function-entrypoint.test.mjs', 'tests/onprem.test.ts'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
