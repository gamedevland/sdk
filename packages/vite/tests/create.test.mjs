import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, mkdir, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ProjectCreator } from '../dist/project/ProjectCreator.js';

test('create produces a blank portable project from packaged templates', async t => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'gamedevland create '));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const root = await ProjectCreator.create({ cwd, directory: 'my-game', install: false });
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const tooling = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.name, 'my-game');
  assert.equal(pkg.dependencies['@gamedevland/engine'], tooling.peerDependencies['@gamedevland/engine']);
  assert.equal(pkg.devDependencies['@gamedevland/vite'], tooling.version);
  assert.match(await readFile(path.join(root, '.gitignore'), 'utf8'), /node_modules/);
  assert.match(await readFile(path.join(root, '.env.crazygames'), 'utf8'), /VITE_PLATFORM=crazygames/);
  const layout = JSON.parse(await readFile(path.join(root, 'game/assets/json/layouts/scenes/main/layout.json'), 'utf8'));
  assert.deepEqual(layout, { root: { type: 'Container', children: {} } });
  assert.deepEqual(JSON.parse(await readFile(path.join(root, 'game/assets/json/configs/audio/sounds-volumes.json'), 'utf8')),
    { 'channel.music': 1, 'channel.sfx': 1 });
  await assert.rejects(ProjectCreator.create({ cwd, directory: 'my-game', install: false }), /never overwritten/);
  assert.deepEqual(JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')), pkg);
});

test('create accepts an empty directory, rejects names and symlinks without touching files', async t => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'gamedevland create '));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await assert.rejects(ProjectCreator.create({ cwd, directory: 'bad', name: 'bad;command', install: false }));
  assert.deepEqual(await readdir(cwd), []);
  await mkdir(path.join(cwd, 'empty')); await ProjectCreator.create({ cwd, directory: 'empty', install: false });
  await symlink(path.join(cwd, 'empty'), path.join(cwd, 'link'));
  await assert.rejects(ProjectCreator.create({ cwd, directory: 'link', install: false }), /never overwritten/);
  await writeFile(path.join(cwd, 'file'), 'keep');
  await assert.rejects(ProjectCreator.create({ cwd, directory: 'file', install: false }), /never overwritten/);
  assert.equal(await readFile(path.join(cwd, 'file'), 'utf8'), 'keep');
});

test('installed CLI creates in a path with spaces without a shell', async t => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'gamedevland cli '));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const cli = fileURLToPath(new URL('../dist/cli/entry.js', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'create', 'space game', '--name', 'space-game', '--no-install'], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(await readFile(path.join(cwd, 'space game/package.json'), 'utf8')).name, 'space-game');
});
