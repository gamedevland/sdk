import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { zipSync } from 'fflate';

import { BuildPlatformSdkCatalog } from '../BuildPlatformSdkCatalog';

import type { PokiProject } from './PokiProject';
import type { Zippable } from 'fflate';

/** Validates and packages a platform build, preserving arbitrary game asset formats. */
export class PokiArchive {
  static async pack(project: PokiProject, secret?: string): Promise<{ readonly sha256: string; readonly bytes: number; readonly files: number }> {
    if (await realpath(project.buildDir) !== project.buildDir) throw new Error('[poki] Symlinked build directory is not supported');
    const files = await PokiArchive.collect(project.buildDir);
    if (!files.includes('index.html')) throw new Error('[poki] index.html must be at the archive root');
    const zip: Zippable = {};
    for (const file of files) {
      const content = await readFile(path.join(project.buildDir, file));
      if (secret && content.includes(Buffer.from(secret))) throw new Error('[poki] Upload token found in build output');
      Object.defineProperty(zip, file, { value: [content, { mtime: new Date(2000, 0, 1) }], enumerable: true });
    }
    const html = await readFile(path.join(project.buildDir, 'index.html'), 'utf8');
    const sdkUrl = BuildPlatformSdkCatalog.resolveHeadTags('poki')[0]?.attrs?.src;
    const sources = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(match => match[1]);
    if (typeof sdkUrl !== 'string' || sources.filter(src => src === sdkUrl).length !== 1) {
      throw new Error('[poki] Expected exactly one official Poki SDK script');
    }
    for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
      const url = match[1];
      if (!url || url.startsWith('#') || /^(?:https?:|data:|blob:|\/\/)/i.test(url)) continue;
      if (url.startsWith('/')) throw new Error(`[poki] Root-relative HTML dependency: ${url}`);
      const file = path.posix.normalize(decodeURIComponent(url.split(/[?#]/)[0] ?? ''));
      if (!files.includes(file)) throw new Error(`[poki] Missing HTML dependency: ${url}`);
    }
    if (/https?:\/\/(?:localhost|127\.0\.0\.1)(?=[:/"'])|\/src\/main\.ts/i.test(html)) {
      throw new Error('[poki] Development entry or localhost URL in HTML');
    }
    const archive = zipSync(zip, { level: 9 });
    await mkdir(path.dirname(project.archive), { recursive: true });
    await writeFile(project.archive, archive);
    return { sha256: createHash('sha256').update(archive).digest('hex'), bytes: archive.length, files: files.length };
  }

  private static async collect(root: string, prefix = ''): Promise<string[]> {
    const result: string[] = [];
    for (const name of (await readdir(path.join(root, prefix))).sort()) {
      const file = prefix ? `${prefix}/${name}` : name;
      if (name.startsWith('.') || /\.(?:map|ts|tsx|tgz|pem|key|zip)$/i.test(name)) {
        throw new Error(`[poki] Source, private or nested archive file in build: ${file}`);
      }
      const stat = await lstat(path.join(root, file));
      if (stat.isSymbolicLink()) throw new Error(`[poki] Symlink in build: ${file}`);
      if (stat.isDirectory()) result.push(...await PokiArchive.collect(root, file));
      else if (stat.isFile()) result.push(file);
      else throw new Error(`[poki] Unsupported build entry: ${file}`);
    }
    return result;
  }
}
