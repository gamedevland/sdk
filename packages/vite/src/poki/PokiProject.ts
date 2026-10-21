import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

import { SchemaDecoder } from '@gamedevland/engine/validation';

/** Decodes project-local configuration without game-specific defaults. */
export class PokiProject {
  private static readonly TOOLING = SchemaDecoder.object({
    buildScript: SchemaDecoder.optional(SchemaDecoder.string({ nonEmpty: true })),
    checks: SchemaDecoder.optional(SchemaDecoder.array(SchemaDecoder.string({ nonEmpty: true }))),
    archive: SchemaDecoder.optional(SchemaDecoder.string({ nonEmpty: true })),
  });
  private static readonly CONFIG = SchemaDecoder.object({
    game_id: SchemaDecoder.string({ nonEmpty: true }),
    build_dir: SchemaDecoder.string({ nonEmpty: true }),
    tooling: SchemaDecoder.optional(PokiProject.TOOLING),
  });
  private static readonly PACKAGE = SchemaDecoder.object({
    name: SchemaDecoder.string({ nonEmpty: true }),
    scripts: SchemaDecoder.record(),
  });

  private constructor(
    readonly root: string,
    readonly gameId: string,
    readonly buildDir: string,
    readonly archive: string,
    readonly buildScript: string,
    readonly checks: readonly string[],
    private readonly scripts: Readonly<Record<string, string>>,
  ) {}

  static load(root: string): PokiProject {
    root = realpathSync(root);
    const config = SchemaDecoder.decode(PokiProject.json(path.join(root, 'poki.json')), PokiProject.CONFIG, 'poki.json');
    const pkg = SchemaDecoder.decode(PokiProject.json(path.join(root, 'package.json')), PokiProject.PACKAGE, 'package.json');
    const scripts = Object.fromEntries(Object.entries(pkg.scripts).map(([key, value]) =>
      [key, SchemaDecoder.decode(value, SchemaDecoder.string(), 'package.json', `$.scripts.${key}`)]));
    if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(config.game_id)) {
      throw new Error('[poki] game_id must be a UUID');
    }
    const buildDir = PokiProject.projectPath(root, config.build_dir);
    const slug = pkg.name.replace(/^@/, '').replace(/[^\w.-]+/g, '-');
    const archive = PokiProject.projectPath(root, config.tooling?.archive ?? `artifacts/poki/${slug}.zip`);
    if (!path.relative(buildDir, archive).startsWith(`..${path.sep}`)) {
      throw new Error('[poki] Archive must be outside build_dir');
    }
    if (!archive.endsWith('.zip')) throw new Error('[poki] Archive must end with .zip');
    return new PokiProject(root, config.game_id, buildDir, archive,
      config.tooling?.buildScript ?? 'build:poki', config.tooling?.checks ?? ['typecheck', 'lint'], scripts);
  }

  validateScripts(): void {
    for (const name of [...this.checks, this.buildScript]) {
      if (!/^[\w:.-]+$/.test(name) || !this.scripts[name]) {
        throw new Error(`[poki] Missing or invalid package.json script: ${name}`);
      }
      if (/\bgamedevland\s+poki\s+upload\b/.test(this.scripts[name])) {
        throw new Error(`[poki] Recursive upload script: ${name}`);
      }
    }
  }

  private static json(file: string): unknown {
    try { return JSON.parse(readFileSync(file, 'utf8')); }
    catch { throw new Error(`[poki] Cannot read valid JSON: ${file}`); }
  }

  private static projectPath(root: string, input: string): string {
    const result = path.resolve(root, input);
    const relative = path.relative(root, result);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error('[poki] Build/archive paths must stay inside the project');
    }
    return result;
  }
}
