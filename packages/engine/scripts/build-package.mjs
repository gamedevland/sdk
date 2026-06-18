import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

await build({
  configFile: false,
  root: packageRoot,
  resolve: {
    alias: [
      { find: /^@engine$/, replacement: resolve(packageRoot, 'src/index.ts') },
      { find: /^@engine\/(.+)$/, replacement: `${resolve(packageRoot, 'src')}/$1` },
    ],
  },
  build: {
    emptyOutDir: false,
    minify: 'esbuild',
    sourcemap: false,
    target: 'es2022',
    outDir: 'dist',
    lib: {
      entry: resolve(packageRoot, 'src/index.ts'),
      formats: ['es'],
    },
    rollupOptions: {
      external: (id) => {
        return id.startsWith('node:');
      },
      output: {
        entryFileNames: 'sdk.js',
        exports: 'named',
        codeSplitting: false,
      },
      treeshake: {
        moduleSideEffects: false,
      },
    },
  },
});
