import { spawn } from 'node:child_process';
import { lstat, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SchemaDecoder as S } from '@gamedevland/engine/validation';

interface CreateProjectOptions {
  readonly cwd: string;
  readonly directory: string;
  readonly name?: string;
  readonly install: boolean;
}

/** Creates a blank consumer project without overwriting existing files. */
export class ProjectCreator {
  static async create(options: CreateProjectOptions): Promise<string> {
    const root = path.resolve(options.cwd, options.directory);
    const name = options.name ?? path.basename(root);
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(name) || name.length > 214) {
      throw new Error('[create] Use a lowercase npm project name (letters, digits, dots, hyphens).');
    }
    const info = await lstat(root).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
      return undefined;
    });
    if (info && (!info.isDirectory() || info.isSymbolicLink() || (await readdir(root)).length > 0)) {
      throw new Error('[create] Destination must be a new or empty directory. Existing files are never overwritten.');
    }
    const pkg = S.decode(JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')),
      S.object({ version: S.string({ nonEmpty: true }), dependencies: S.object({
        '@gamedevland/engine': S.string({ nonEmpty: true }),
      }) }), 'tooling/package.json');
    const replacements = new Map([
      ['__PROJECT_NAME__', name], ['__ENGINE_VERSION__', pkg.dependencies['@gamedevland/engine']],
      ['__TOOLING_VERSION__', pkg.version],
    ]);
    await mkdir(root, { recursive: true });
    await this.copy(fileURLToPath(new URL('../../templates/empty/', import.meta.url)), root, replacements);
    if (options.install) await this.install(root);
    process.stdout.write(`[create] Created ${root}\nNext: cd ${JSON.stringify(options.directory)}${options.install ? '' : ' && npm install'} && npm run dev\n`);
    return root;
  }

  private static async copy(source: string, target: string, replacements: ReadonlyMap<string, string>): Promise<void> {
    for (const entry of await readdir(source, { withFileTypes: true })) {
      const destination = path.join(target, entry.name === 'gitignore' ? '.gitignore' : entry.name);
      if (entry.isDirectory()) {
        await mkdir(destination);
        await this.copy(path.join(source, entry.name), destination, replacements);
      } else if (entry.isFile()) {
        let content = await readFile(path.join(source, entry.name), 'utf8');
        for (const [token, value] of replacements) content = content.replaceAll(token, value);
        await writeFile(destination, content, { flag: 'wx' });
      } else throw new Error('[create] Invalid template entry');
    }
  }

  private static async install(root: string): Promise<void> {
    const npmEntry = process.env.npm_execpath;
    const command = npmEntry ? process.execPath : 'npm';
    const args = npmEntry ? [npmEntry, 'install'] : ['install'];
    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, { cwd: root, stdio: 'inherit',
        shell: process.platform === 'win32' && !npmEntry });
      child.once('error', reject);
      child.once('close', (code) => code === 0 ? resolve()
        : reject(new Error('[create] Dependency installation failed; retry npm install in the generated directory.')));
    });
  }
}
