import assert from 'node:assert/strict';
import console from 'node:console';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const temporary = mkdtempSync(resolve(root, '.texture-check-'));
try {
  const output = resolve(temporary, 'surface.mjs');
  await build({
    entryPoints: [resolve(root, 'packages/engine/src/renderers/hybrid/ThreeTextureSurface.ts')],
    outfile: output, bundle: true, platform: 'node', format: 'esm', external: ['pixi.js'],
    tsconfig: resolve(root, 'packages/engine/tsconfig.json'),
    plugins: [{ name: 'gpu-boundary', setup(builder) {
      builder.onResolve({ filter: /^three$/ }, () => ({ path: 'three', namespace: 'fake-three' }));
      builder.onLoad({ filter: /.*/, namespace: 'fake-three' }, () => ({ contents: `
        export const ACESFilmicToneMapping = 4;
        export const records = [];
        export class WebGLRenderer {
          constructor(options) {
            this.options = options; this.domElement = { width: 1, height: 1 };
            this.calls = []; records.push(this);
          }
          setClearColor(color, alpha) { this.alpha = alpha; }
          setPixelRatio(ratio) { this.ratio = ratio; }
          setSize(width, height) { this.domElement.width = width; this.domElement.height = height; }
          render(scene, camera) { this.calls.push({ scene, camera }); }
          dispose() { this.disposals = (this.disposals || 0) + 1; }
          forceContextLoss() { this.losses = (this.losses || 0) + 1; }
        }
      ` }));
    }}],
    footer: { js: 'export { records } from "three";' },
  });
  // Export the renderer records from the bundled fake, without introducing runtime test hooks.
  const { readFileSync } = await import('node:fs');
  let source = readFileSync(output, 'utf8');
  source = source.replace('export { records } from "three";', 'export { records };');
  // The source bundle only retains a variable if referenced: expose its stub-owned records explicitly.
  writeFileSync(output, source);
  const { ThreeTextureSurface, records } = await import(pathToFileURL(output).href);
  const surface = new ThreeTextureSurface({ width: 540, height: 610, resolution: 1.25 });
  const renderer = records[0];
  assert.equal(renderer.options.alpha, true);
  assert.equal(renderer.options.preserveDrawingBuffer, true);
  assert.equal(renderer.alpha, 0);
  assert.equal(surface.texture.source.pixelWidth, 675);
  assert.equal(surface.texture.width, 540);
  assert.equal(renderer.domElement.width, 675);
  let uploads = 0;
  surface.texture.source.on('update', () => uploads++);
  surface.render({}, {});
  assert.equal(renderer.calls.length, 1);
  assert.equal(uploads, 1);
  surface.resize(781, 443, 1.5);
  assert.equal(renderer.domElement.width, 1172);
  assert.equal(renderer.domElement.height, 665);
  assert.equal(surface.texture.source.pixelWidth, 1172);
  assert.equal(surface.texture.source.pixelHeight, 665);
  assert.ok(Math.abs(surface.texture.width - 781) < 1);
  surface.resize(781, 443, 1.5);
  assert.equal(uploads, 1);
  assert.throws(() => surface.resize(0, 1), /./);
  surface.dispose(); surface.dispose();
  assert.equal(renderer.disposals, 1);
  assert.equal(renderer.losses, 1);
  assert.equal(surface.texture.destroyed, true);
  assert.throws(() => surface.render({}, {}), /disposed/);
  assert.throws(() => surface.resize(1, 1), /disposed/);
  console.log('Three texture integration passed: real Pixi texture sizing, alpha, explicit updates, resize, idempotent disposal. GPU rendering substituted.');
} finally { rmSync(temporary, { recursive: true, force: true }); }
