import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function emitVercelEntrypoint(outDir) {
  const configPath = join(repoRoot, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined, 'repository tsconfig.json should be readable');

  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, repoRoot, {
    noEmit: false,
    noEmitOnError: false,
    emitDeclarationOnly: false,
    incremental: false,
    composite: false,
    rootDir: repoRoot,
    outDir,
  }, configPath);
  const program = ts.createProgram({
    rootNames: [join(repoRoot, 'api/catalog.ts'), join(repoRoot, 'server/catalog-proxy.ts')],
    options: parsed.options,
  });
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: name => name,
    getCurrentDirectory: () => repoRoot,
    getNewLine: () => '\n',
  }));
  const emitted = program.emit();
  assert.equal(emitted.emitSkipped, false, 'Vercel-style TypeScript emit should produce the function');

  // The emitted .js files follow Node ESM rules, like Vercel's Node function output.
  await writeFile(join(outDir, 'package.json'), JSON.stringify({ type: 'module' }));
}

async function withFunctionResponse(handler, run) {
  const server = createServer(handler).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    return await run(`http://127.0.0.1:${address.port}/?resource=years`);
  } finally {
    server.close();
    server.closeAllConnections();
  }
}

function setEnvironment(values) {
  const keys = ['VERCEL', 'VERCEL_ENV', 'ROYS_CATALOG_PREVIEW_ENABLED'];
  const original = new Map(keys.map(key => [key, process.env[key]]));
  for (const key of keys) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  return () => {
    for (const key of keys) {
      const value = original.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

test('emitted Vercel catalog entrypoint loads and enforces preview access at runtime', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'roys-catalog-function-'));
  const originalFetch = globalThis.fetch;
  const upstreamRequests = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin === 'https://staging.autopartserp.com') {
      upstreamRequests.push({ url, init });
      return Response.json({ years: [2020, 2021] });
    }
    return originalFetch(input, init);
  };

  try {
    await emitVercelEntrypoint(tempDir);
    const entrypointPath = join(tempDir, 'api/catalog.js');
    assert.ok(await readFile(entrypointPath, 'utf8'), 'TypeScript should emit api/catalog.js');
    const { default: handler } = await import(pathToFileURL(entrypointPath).href);

    const restoreDisabledEnv = setEnvironment({ VERCEL: '1', VERCEL_ENV: 'preview' });
    try {
      const response = await withFunctionResponse(handler, url => originalFetch(url));
      assert.equal(response.status, 503);
      assert.match(response.headers.get('content-type') ?? '', /application\/json/i);
      assert.match((await response.json()).error, /not been enabled/i);
      assert.equal(upstreamRequests.length, 0, 'disabled preview must not call ERP');
    } finally { restoreDisabledEnv(); }

    const restoreEnabledEnv = setEnvironment({
      VERCEL: '1',
      VERCEL_ENV: 'preview',
      ROYS_CATALOG_PREVIEW_ENABLED: 'true',
    });
    try {
      const response = await withFunctionResponse(handler, url => originalFetch(url));
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') ?? '', /application\/json/i);
      assert.deepEqual(await response.json(), { years: [2020, 2021] });
      assert.equal(upstreamRequests.length, 1);
      assert.equal(upstreamRequests[0].url.origin, 'https://staging.autopartserp.com');
    } finally { restoreEnabledEnv(); }

    const restoreProductionEnv = setEnvironment({
      VERCEL: '1',
      VERCEL_ENV: 'production',
      ROYS_CATALOG_PREVIEW_ENABLED: 'true',
    });
    try {
      const response = await withFunctionResponse(handler, url => originalFetch(url));
      assert.equal(response.status, 503);
      assert.match(response.headers.get('content-type') ?? '', /application\/json/i);
      assert.match((await response.json()).error, /not been enabled/i);
      assert.equal(upstreamRequests.length, 1, 'production must not call ERP');
    } finally { restoreProductionEnv(); }
  } finally {
    globalThis.fetch = originalFetch;
    await rm(tempDir, { recursive: true, force: true });
  }
});
