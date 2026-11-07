import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const scratch = await mkdtemp(path.join(tmpdir(), 'gamedevland template integration '));
const npmEntry = process.env.npm_execpath;
const npm = (cwd, args, capture = false) => execFileSync(npmEntry ? process.execPath : 'npm',
  npmEntry ? [npmEntry, ...args] : args, { cwd, encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
try {
  const engine = JSON.parse(npm(workspace, ['pack', '--workspace', '@gamedevland/engine', '--pack-destination', scratch, '--json'], true))[0];
  const tooling = JSON.parse(npm(workspace, ['pack', '--workspace', '@gamedevland/vite', '--pack-destination', scratch, '--json'], true))[0];
  const project = path.join(scratch, 'project');
  execFileSync(process.execPath, [path.join(workspace, 'packages/vite/dist/cli/entry.js'), 'create', project, '--no-install'], { stdio: 'inherit' });
  const file = path.join(project, 'package.json');
  const pkg = JSON.parse(await readFile(file, 'utf8'));
  pkg.dependencies['@gamedevland/engine'] = 'file:' + path.join(scratch, engine.filename);
  pkg.devDependencies['@gamedevland/vite'] = 'file:' + path.join(scratch, tooling.filename);
  await writeFile(file, JSON.stringify(pkg));
  npm(project, ['install', '--no-audit', '--no-fund']);
  for (const task of ['typecheck', 'lint', 'build', 'build:crazygames']) npm(project, ['run', task]);
  const web = await readFile(path.join(project, 'dist/index.html'), 'utf8');
  const crazy = await readFile(path.join(project, 'dist/crazygames/index.html'), 'utf8');
  assert(!web.includes('crazygames-sdk'));
  assert.equal((crazy.match(/crazygames-sdk-v3\.js/g) ?? []).length, 1);
  assert.match(crazy, /\.\/assets\//);
  // Verify template lookup from the actually installed npm archive as well.
  execFileSync(process.execPath, [path.join(project, 'node_modules/@gamedevland/vite/dist/cli/entry.js'),
    'create', 'from-package', '--no-install'], { cwd: scratch, stdio: 'inherit' });
  assert.equal(JSON.parse(await readFile(path.join(scratch, 'from-package/package.json'), 'utf8')).name, 'from-package');
  console.log('Packed project template: install, typecheck, lint, web/CrazyGames builds and installed CLI template lookup passed.');
} finally { await rm(scratch, { recursive: true, force: true }); }
