import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const entries = Object.fromEntries(Object.entries(pkg.exports).map(([key, value]) => [
  value.import.replace('./dist/', '').replace('.js', ''), resolve(root, key === '.' ? 'src/index.ts' : `src/${key.slice(2)}/index.ts`),
]));
const result = await build({
  entryPoints: entries, outdir: resolve(root, 'dist'), absWorkingDir: root,
  tsconfig: resolve(root, 'tsconfig.json'), bundle: true, splitting: true, format: 'esm',
  platform: 'browser', target: 'es2022', minify: false, metafile: true,
  external: Object.keys(pkg.peerDependencies),
  define: {'import.meta.env.VITE_PLATFORM': 'import.meta.env.VITE_PLATFORM'},
});
await writeFile(resolve(root, 'dist/build-meta.json'), JSON.stringify(result.metafile, null, 2));
