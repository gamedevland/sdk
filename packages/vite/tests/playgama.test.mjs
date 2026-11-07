import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { build } from 'vite';
import { PlatformCatalog } from '@gamedevland/engine/platforms';
import { BuildPlatformEnvResolver } from '../dist/BuildPlatformEnvResolver.js';
import { BuildPlatformSdkCatalog } from '../dist/BuildPlatformSdkCatalog.js';
import { BuildPlatformSdkInjectPluginFactory } from '../dist/BuildPlatformSdkInjectPluginFactory.js';

test('Playgama environment is supported and injects only the Bridge v2 script', async t => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'playgama-build-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, '.env.production'), 'VITE_PLATFORM=playgama\n');
  const previous = process.env.VITE_PLATFORM;
  delete process.env.VITE_PLATFORM;
  t.after(() => {
    if (previous === undefined) delete process.env.VITE_PLATFORM;
    else process.env.VITE_PLATFORM = previous;
  });
  assert.equal(BuildPlatformEnvResolver.resolve('production', root), 'playgama');
  assert.equal(PlatformCatalog.isSupported('playgama'), true);
  assert.ok(PlatformCatalog.getSupportedList().includes('playgama'));
  const tags = BuildPlatformSdkCatalog.resolveHeadTags('playgama');
  assert.equal(tags.length, 1);
  assert.equal(tags[0].attrs.src, 'https://bridge.playgama.com/v2/stable/playgama-bridge.js');

  await mkdir(path.join(root, 'public'));
  await writeFile(path.join(root, 'public/playgama-bridge-config.json'), '{}');
  await writeFile(path.join(root, 'index.html'), '<html><head></head><body><script type="module" src="./main.js"></script></body></html>');
  await writeFile(path.join(root, 'main.js'), 'console.log("fixture");');
  await build({
    configFile: false, root, base: './', logLevel: 'silent',
    plugins: [BuildPlatformSdkInjectPluginFactory.create('playgama')],
    build: { outDir: 'output' },
  });
  const html = await readFile(path.join(root, 'output/index.html'), 'utf8');
  assert.equal((html.match(/playgama-bridge\.js/g) ?? []).length, 1);
  assert.ok(html.indexOf('playgama-bridge.js') < html.indexOf('type="module"'));
  assert.equal(await readFile(path.join(root, 'output/playgama-bridge-config.json'), 'utf8'), '{}');
  for (const id of ['web', 'poki', 'crazygames', 'yandex', 'gamedistribution']) {
    const existing = BuildPlatformSdkCatalog.resolveHeadTags(id, { gameDistributionGameId: 'fixture-id' });
    assert.equal(existing.some(tag => tag.attrs?.src?.includes('playgama')), false);
  }
});
