import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { unzipSync } from 'fflate';

import { PokiArchive } from '../dist/poki/PokiArchive.js';
import { PokiCredentials } from '../dist/poki/PokiCredentials.js';
import { PokiProcess } from '../dist/poki/PokiProcess.js';
import { PokiProject } from '../dist/poki/PokiProject.js';
import { PokiUpload } from '../dist/poki/PokiUpload.js';

const gameId = '11111111-2222-4333-8444-555555555555';
const otherId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const versionId = '99999999-8888-4777-8666-555555555555';
const secret = 'fixture-only-upload-secret';
const html = '<html><head><script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script></head><body><script src="./assets/game.js"></script></body></html>';
const success = id => `Version uploaded successfully\nInspector: https://inspector.poki.dev/?game=poki-${versionId}\nPreview: https://poki.com/en/preview/${id}/${versionId}\n`;

async function fixture(t, config = {}, pkg = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'poki tool fixture '));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'poki.json'), JSON.stringify({ game_id: gameId, build_dir: 'output/client', ...config }));
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: '@test/another-game', type: 'module', scripts: {}, ...pkg }));
  const project = PokiProject.load(root);
  await mkdir(path.join(project.buildDir, 'assets'), { recursive: true });
  await writeFile(path.join(project.buildDir, 'index.html'), html);
  await writeFile(path.join(project.buildDir, 'assets/game.js'), 'console.log("game");');
  return project;
}

function environment(t, values) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  t.after(() => { for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
}

test('installed CLI help works without a project or credentials', () => {
  const cli = fileURLToPath(new URL('../dist/cli/entry.js', import.meta.url));
  const result = spawnSync(process.execPath, [cli, '--help'], { cwd: tmpdir(), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /poki <pack\|upload>/);
});

test('two game layouts package deterministically, allow PNG/WAV/SVG and need no Rubik font', async t => {
  for (const config of [{}, { game_id: otherId, build_dir: 'dist', tooling: { archive: 'releases/latest.zip', checks: [] } }]) {
    const project = await fixture(t, config);
    for (const name of ['fish.png', 'click.wav', 'icon.svg']) await writeFile(path.join(project.buildDir, 'assets', name), name);
    const packed = await PokiArchive.pack(project);
    const first = await readFile(project.archive);
    const files = unzipSync(first);
    assert.ok(files['index.html']); assert.ok(files['assets/fish.png']);
    assert.equal(packed.files, 5);
    assert.equal((await PokiArchive.pack(project)).sha256, packed.sha256);
    assert.deepEqual(await readFile(project.archive), first);
  }
});

test('configuration rejects invalid IDs, escaping paths and archives inside the build', async t => {
  const project = await fixture(t);
  for (const config of [{ game_id: 'wrong', build_dir: 'dist' }, { game_id: gameId, build_dir: '../other' },
    { game_id: gameId, build_dir: 'dist', tooling: { archive: 'dist/game.zip' } },
    { game_id: gameId, build_dir: 'dist', tooling: { checks: [123] } }]) {
    await writeFile(path.join(project.root, 'poki.json'), JSON.stringify(config));
    assert.throws(() => PokiProject.load(project.root));
  }
});

test('pack rejects invalid HTML and never creates an archive for it', async t => {
  const project = await fixture(t);
  for (const invalid of [html.replace('poki-sdk.js', 'fake.js'), html + html,
    html.replace('./assets/game.js', '/assets/game.js'), html.replace('./assets/game.js', './missing.js'),
    html.replace('./assets/game.js', 'http://localhost:5173/main.js')]) {
    await writeFile(path.join(project.buildDir, 'index.html'), invalid);
    await assert.rejects(PokiArchive.pack(project));
  }
  await assert.rejects(readFile(project.archive));
});

test('pack rejects source maps, private files, token contents and symlinks', async t => {
  const project = await fixture(t);
  for (const name of ['.env', 'bundle.js.map', 'secret.key', 'nested.zip']) {
    const file = path.join(project.buildDir, name);
    await writeFile(file, 'private');
    await assert.rejects(PokiArchive.pack(project)); await rm(file);
  }
  const file = path.join(project.buildDir, 'assets/game.js');
  await writeFile(file, secret); await assert.rejects(PokiArchive.pack(project, secret), /token/);
  await writeFile(file, 'safe');
  await symlink(file, path.join(project.buildDir, 'assets/link.js'));
  await assert.rejects(PokiArchive.pack(project), /Symlink/);
});

test('private credentials are per game, environment wins, checks lose all authentication', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'poki credentials '));
  t.after(() => rm(dir, { recursive: true, force: true }));
  environment(t, { XDG_CONFIG_HOME: dir, POKI_UPLOAD_TOKEN: undefined,
    POKI_ACCESS_TOKEN: undefined, API_PATH: undefined });
  const folder = path.join(dir, 'poki/game-upload-tokens'); await mkdir(folder, { recursive: true });
  const file = path.join(folder, gameId); await writeFile(file, secret, { mode: 0o600 });
  assert.equal(PokiCredentials.resolve(gameId), secret);
  assert.throws(() => PokiCredentials.resolve(otherId));
  await chmod(file, 0o644); if (process.platform !== 'win32') assert.throws(() => PokiCredentials.resolve(gameId), /0600/);
  Object.assign(process.env, { POKI_UPLOAD_TOKEN: 'environment-token', POKI_ACCESS_TOKEN: 'old-token', API_PATH: '/override' });
  assert.equal(PokiCredentials.resolve(otherId), 'environment-token');
  const clean = PokiCredentials.withoutSecrets();
  assert.equal(clean.POKI_UPLOAD_TOKEN, undefined); assert.equal(clean.POKI_ACCESS_TOKEN, undefined); assert.equal(clean.API_PATH, undefined);
});

test('upload builds fresh without secrets, passes explicit game/build args, validates API success and saves receipt', async t => {
  environment(t, { POKI_UPLOAD_TOKEN: secret });
  const project = await fixture(t, { tooling: { checks: ['check'], buildScript: 'compile' } }, {
    scripts: { check: 'node check.mjs', compile: 'node build.mjs' },
  });
  await writeFile(path.join(project.root, 'check.mjs'), 'if(process.env.POKI_UPLOAD_TOKEN)process.exit(9);');
  await writeFile(path.join(project.root, 'build.mjs'), `import fs from 'node:fs'; if(process.env.POKI_UPLOAD_TOKEN)process.exit(9); fs.writeFileSync('output/client/assets/game.js','fresh build');`);
  const original = PokiProcess.capture;
  let uploads = 0;
  t.mock.method(PokiProcess, 'capture', async (command, args, cwd, env, ...rest) => {
    if (!args.includes('upload')) return original(command, args, cwd, env, ...rest);
    uploads++; assert.equal(env.POKI_UPLOAD_TOKEN, secret); assert.equal(env.API_PATH, undefined);
    assert.equal(args[args.indexOf('--game') + 1], gameId);
    assert.equal(args[args.indexOf('--build-dir') + 1], project.buildDir);
    assert.notEqual(cwd, project.root); assert.ok(args.includes('--disable-image-compression'));
    return success(gameId);
  });
  await PokiUpload.run(project, { name: 'fixture version with spaces' });
  assert.equal(uploads, 1);
  assert.equal(Buffer.from(unzipSync(await readFile(project.archive))['assets/game.js']).toString(), 'fresh build');
  const receipt = JSON.parse(await readFile(path.join(path.dirname(project.archive), 'poki-upload.json'), 'utf8'));
  assert.equal(receipt.versionId, versionId); assert.equal(receipt.gameId, gameId);
  assert.equal(JSON.stringify(receipt).includes(secret), false);
});

test('API error with exit 0 or mismatched success URLs is a failed upload without a receipt', async t => {
  environment(t, { POKI_UPLOAD_TOKEN: secret });
  const project = await fixture(t, { tooling: { checks: [], buildScript: 'compile' } }, { scripts: { compile: 'node -e ""' } });
  let reply = 'Error: HTTP 403';
  t.mock.method(PokiProcess, 'capture', async (_command, args) => args.includes('upload') ? reply : '');
  await assert.rejects(PokiUpload.run(project, {}), /not confirmed/);
  reply = success(otherId);
  await assert.rejects(PokiUpload.run(project, {}), /does not match/);
  await assert.rejects(readFile(path.join(path.dirname(project.archive), 'poki-upload.json')));
});

test('failed preflight and failed checks stop before any upload', async t => {
  environment(t, { POKI_UPLOAD_TOKEN: secret });
  const missing = await fixture(t);
  await assert.rejects(PokiUpload.run(missing, {}), /Missing/);
  const project = await fixture(t, { tooling: { checks: ['check'], buildScript: 'compile' } }, {
    scripts: { check: 'node -e "process.exit(7)"', compile: 'node -e ""' },
  });
  await assert.rejects(PokiUpload.run(project, {}), /status 7/);
  await assert.rejects(readFile(project.archive));
});

test('process wrapper treats nonzero exits as failure and masks secrets in captured output', async () => {
  const output = await PokiProcess.capture(process.execPath, ['-e', `console.log('${secret}')`], tmpdir(), {}, false, secret);
  assert.equal(output.includes(secret), false); assert.match(output, /REDACTED/);
  await assert.rejects(PokiProcess.capture(process.execPath, ['-e', 'process.exit(5)'], tmpdir(), {}), /status 5/);
});
