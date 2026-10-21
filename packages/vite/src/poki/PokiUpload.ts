import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { PokiArchive } from './PokiArchive';
import { PokiCredentials } from './PokiCredentials';
import { PokiProcess } from './PokiProcess';

import type { PokiProject } from './PokiProject';

/** Executes a fresh checked build and accepts only an API-confirmed upload. */
export class PokiUpload {
  static async run(project: PokiProject, options: { readonly name?: string; readonly notes?: string }): Promise<void> {
    project.validateScripts();
    const secret = PokiCredentials.resolve(project.gameId);
    const revision = PokiUpload.git(project.root, ['rev-parse', '--short', 'HEAD']);
    const dirty = PokiUpload.git(project.root, ['status', '--porcelain']);
    const name = options.name ?? `${revision || 'build'}-${new Date().toISOString().replace(/[-:.]/g, '')}`;
    const notes = options.notes ?? (PokiUpload.git(project.root, ['log', '-1', '--pretty=%s']) || 'Automated game build');
    if (!name.trim()) throw new Error('[poki] Version name must not be empty');
    for (const task of [...project.checks, project.buildScript]) await PokiProcess.script(project.root, task);
    const archive = await PokiArchive.pack(project, secret);
    const scratch = await mkdtemp(path.join(tmpdir(), 'gamedevland-poki-'));
    let output: string;
    try {
      const cli = createRequire(import.meta.url).resolve('@poki/cli/bin/index.js');
      output = await PokiProcess.capture(process.execPath, [cli, 'upload', '--game', project.gameId,
        '--build-dir', project.buildDir, '--name', name, '--notes', notes, '--disable-image-compression'],
      scratch, { ...PokiCredentials.withoutSecrets(), POKI_UPLOAD_TOKEN: secret }, false, secret);
    } finally { await rm(scratch, { recursive: true, force: true }); }
    // @poki/cli 0.1.19 also exits 0 on API errors; require its success response.
    if (!output.includes('Version uploaded successfully')) throw new Error('[poki] Upload not confirmed by Poki');
    const preview = output.match(/Preview: (https:\/\/poki\.com\/en\/preview\/[^\s]+)/)?.[1];
    const inspector = output.match(/Inspector: (https:\/\/inspector\.poki\.dev\/[^\s]+)/)?.[1];
    const prefix = `https://poki.com/en/preview/${project.gameId}/`;
    const versionId = preview?.startsWith(prefix) ? preview.slice(prefix.length) : '';
    if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(versionId) || inspector !== `https://inspector.poki.dev/?game=poki-${versionId}`) {
      throw new Error('[poki] Upload response does not match the configured game/version');
    }
    const receipt = path.join(path.dirname(project.archive), 'poki-upload.json');
    await writeFile(receipt, JSON.stringify({ gameId: project.gameId, versionId, name, revision,
      dirty: Boolean(dirty), uploadedAt: new Date().toISOString(), archive: project.archive,
      archiveSha256: archive.sha256, bytes: archive.bytes, files: archive.files, preview, inspector }, null, 2) + '\n');
    process.stdout.write(`[poki] Receipt: ${receipt}\n`);
  }

  private static git(root: string, args: string[]): string {
    try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: PokiCredentials.withoutSecrets() }).trim(); }
    catch { return ''; }
  }
}
