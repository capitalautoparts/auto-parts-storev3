import { spawnSync } from 'node:child_process';
// dev-check supplies --run; node:test already runs once without a watch mode.
if (process.argv.slice(2).some(arg => arg !== '--run')) throw new Error('Only --run is supported');
const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', 'tests/catalog.test.ts', 'tests/function-entrypoint.test.mjs'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
