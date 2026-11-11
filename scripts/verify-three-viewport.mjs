import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import * as THREE from 'three';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const temporary = mkdtempSync(resolve(root, '.viewport-check-'));
try {
  const consumer = resolve(temporary, 'consumer.ts');
  writeFileSync(consumer, `
    import { BaseComponent } from '../packages/engine/src/layouts';
    import { ThreeViewport } from '../packages/engine/src/renderers/hybrid';
    import { ThreeNode } from '../packages/engine/src/renderers/three';
    export class PreviewComponent extends BaseComponent<ThreeViewport> {
      protected readonly nodeType = ThreeViewport;
      protected override onReady(): void {
        const preview = this.node.engine.getRequiredActiveLayout().requireNode('preview', ThreeViewport);
        preview.world.requireNode('world.item', ThreeNode);
        preview.resize(400, 200);
        preview.invalidate();
      }
    }
  `);
  const configPath = resolve(root, 'packages/engine/tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve(root, 'packages/engine'));
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([consumer], parsed.options));
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => root, getCanonicalFileName: name => name, getNewLine: () => '\n',
  }));
  console.log('PASS strict TypeScript consumer can bind ThreeViewport components and typed node lookup');
  const paths = {
    ThreeViewport: 'renderers/hybrid/ThreeViewport',
    PixiThreeTextureRendererModule: 'renderers/hybrid/PixiThreeTextureRendererModule',
    LayoutBuilder: 'layouts/build/LayoutBuilder', SceneLayout: 'layouts/scene/SceneLayout',
    LayoutIntegrator: 'layouts/core/LayoutIntegrator',
    BuildContextFactory: 'layouts/build/BuildContextFactory',
    BaseComponent: 'layouts/components/BaseComponent', ThreeNode: 'renderers/three/ThreeNode',
    ModelAsset: 'renderers/three/ModelAsset',
    DiContainer: 'di/DiContainer', EngineDi: 'di/EngineDi', DiTokens: 'di/tokens',
    AssetManager: 'assets/AssetManager', EventBus: 'events/EventBus',
    RenderTokens: 'rendering/RenderTokens', PresentationScheduler: 'runtime/PresentationScheduler',
    PrefabManager: 'prefabs/PrefabManager',
  };
  const outfile = resolve(temporary, 'fixture.mjs');
  await build({
    stdin: {
      contents: Object.entries(paths).map(([name, path]) =>
        `export { ${name} } from './packages/engine/src/${path}';`).join('\n') + '\nexport { records } from "three";',
      resolveDir: root,
    },
    outfile, bundle: true, platform: 'node', format: 'esm',
    external: ['pixi.js', 'matter-js', '@spd789562/particle-emitter'],
    tsconfig: resolve(root, 'packages/engine/tsconfig.json'),
    plugins: [{ name: 'gpu-boundary', setup(builder) {
      builder.onResolve({ filter: /^three$/ }, args => args.namespace === 'gpu-stub'
        ? { path: 'three', external: true }
        : { path: 'three', namespace: 'gpu-stub' });
      builder.onLoad({ filter: /.*/, namespace: 'gpu-stub' }, () => ({ contents: `
        export * from 'three';
        export const records = [];
        export class WebGLRenderer {
          constructor() { this.domElement = { width: 1, height: 1 }; this.calls = []; records.push(this); }
          setClearColor() {}
          setPixelRatio() {}
          setSize(width, height) { this.domElement.width = width; this.domElement.height = height; }
          render(scene, camera) { this.calls.push({ scene, camera }); }
          dispose() { this.disposals = (this.disposals || 0) + 1; }
          forceContextLoss() { this.losses = (this.losses || 0) + 1; }
        }
      ` }));
    }}],
  });
  const m = await import(pathToFileURL(outfile).href);
  const preview = JSON.parse(readFileSync(resolve(root, 'examples/three-viewport/preview.json'), 'utf8'));
  const layoutJson = JSON.parse(readFileSync(resolve(root, 'examples/three-viewport/layout.json'), 'utf8'));
  const layoutId = layoutJson.itemPreview.props.sceneLayout;
  const viewport = (props = {}) => ({ ...layoutJson.itemPreview, props: { ...layoutJson.itemPreview.props, ...props } });
  const mesh = preview.world.children.item;
  const check = async (name, run) => { await run(); console.log('PASS', name); };
  function setup(json = preview) {
    const assets = new m.AssetManager();
    assets.getJson = async id => {
      if (id !== layoutId) throw new Error('Missing JSON: ' + id);
      return json;
    };
    const container = new m.DiContainer();
    new m.PixiThreeTextureRendererModule().register(container, assets, {});
    const screen = {
      getOrientation: () => 'land', getViewportSize: () => ({ width: 800, height: 600 }),
      getVirtualSize: () => ({ width: 800, height: 600 }), getScale: () => 1,
    };
    let active;
    const engine = {
      assets, di: new m.EngineDi(container), screen, config: {}, events: new m.EventBus(),
      rendering: container.get(m.RenderTokens.Runtime), presentation: new m.PresentationScheduler(),
      tweens: { kill() {} }, scenes: { getCurrentSceneScopeVersion: () => 1 },
      getRequiredActiveLayout: () => { assert.ok(active); return active; },
    };
    const ctx = new m.BuildContextFactory().create(assets, { container, screen });
    ctx.engine = engine;
    return { engine, ctx, container, activate: layout => { active = layout; layout.activate(); } };
  }

  await check('JSON example builds isolated Three graphs and camera before outer component readiness', async () => {
    const s = setup();
    let ready = 0, updates = 0, detaches = 0;
    class Counter extends m.BaseComponent {
      nodeType = m.ThreeNode;
      onReady() { ready++; }
      onUpdate() { updates++; }
      onDetach() { detaches++; return super.onDetach(); }
    }
    s.container.register({ token: m.DiTokens.component('Counter'), useFactory: () => new Counter() });
    preview.world.children.item.components = { counter: { type: 'Counter' } };
    let outerReady = 0;
    class Observer extends m.BaseComponent {
      nodeType = m.ThreeViewport;
      onReady() { this.node.world.requireNode('world.camera', m.ThreeNode); outerReady++; }
    }
    s.ctx.components.register('Observer', () => new Observer());
    const start = m.records.length;
    const built = await new m.LayoutBuilder(s.ctx).build({
      first: { ...viewport(), components: { observer: { type: 'Observer' } } }, second: viewport(),
    });
    const layout = m.SceneLayout.fromBuildResult(s.engine, built);
    const a = layout.requireNode('first', m.ThreeViewport), b = layout.requireNode('second', m.ThreeViewport);
    assert.notEqual(a.world.getNode('world.item'), b.world.getNode('world.item'));
    assert.equal(layout.findNode('world.item'), undefined);
    assert.equal(a.view.texture.width, 400);
    assert.equal(a.view.width, 400);
    assert.equal(ready, 0);
    s.activate(layout);
    assert.equal(ready, 2); assert.equal(outerReady, 1);
    layout.update(0.016); assert.equal(updates, 2);
    s.engine.presentation.tick(0.016, layout);
    assert.equal(m.records[start].calls.length, 1);
    a.invalidate(); a.invalidate(); s.engine.presentation.tick(0.016, layout);
    assert.equal(m.records[start].calls.length, 2);
    assert.equal(m.records[start + 1].calls.length, 1);
    a.invalidate(); s.engine.presentation.tick(0.016, {});
    assert.equal(m.records[start].calls.length, 2);
    a.setScale(2);
    a.resize(600, 300, 1.5);
    assert.equal(a.view.scale.x, 2); assert.equal(a.view.scale.y, 2);
    const camera = a.world.requireNode('world.camera', m.ThreeNode).view;
    assert.equal(camera.aspect, 2);
    assert.equal(a.view.texture.source.pixelWidth, 900);
    assert.throws(() => a.resize(100, 100, 3));
    assert.equal(a.view.texture.source.pixelWidth, 900);
    s.engine.presentation.tick(0.016, layout);
    assert.equal(m.records[start].calls.length, 3);
    const item = a.world.requireNode('world.item', m.ThreeNode).view;
    let geometryDisposals = 0;
    item.geometry.addEventListener('dispose', () => geometryDisposals++);
    await layout.destroy(); await layout.destroy();
    assert.equal(detaches, 2); assert.equal(geometryDisposals, 1);
    assert.equal(m.records[start].disposals, 1); assert.equal(m.records[start + 1].disposals, 1);
    assert.equal(a.view.destroyed, true);
    assert.throws(() => a.world, /not prepared/);
    assert.throws(() => a.invalidate());
    s.engine.presentation.tick(0.016, layout);
    assert.equal(m.records[start].calls.length, 3);
    delete preview.world.children.item.components;
  });

  await check('always mode renders each active presentation; orthographic resize updates projection', async () => {
    const json = structuredClone(preview);
    json.world.children.camera = { type: 'OrthographicCamera', props: {
      position: { x: 0, y: 0, z: 5 }, lookAt: { x: 0, y: 0, z: 0 }, near: 0.1, far: 100, height: 4,
    } };
    const s = setup(json), start = m.records.length;
    const built = await new m.LayoutBuilder(s.ctx).build({ preview: viewport({ renderMode: 'always' }) });
    const layout = m.SceneLayout.fromBuildResult(s.engine, built);
    s.activate(layout);
    const node = layout.requireNode('preview', m.ThreeViewport);
    node.resize(800, 400);
    const camera = node.world.requireNode('world.camera', m.ThreeNode).view;
    assert.equal(camera.left, -4); assert.equal(camera.right, 4);
    assert.equal(camera.top, 2); assert.equal(camera.bottom, -2);
    s.engine.presentation.tick(0.016, layout); s.engine.presentation.tick(0.016, layout);
    assert.equal(m.records[start].calls.length, 3);
    await layout.destroy();
  });

  await check('failed preparation rolls back prior viewports and model leases', async () => {
    const model = new m.ModelAsset(new THREE.Group());
    const json = structuredClone(preview);
    json.world.children.item = { type: 'Model', props: { asset: 'model' } };
    const s = setup(json), start = m.records.length;
    const getRequired = s.engine.assets.getRequired.bind(s.engine.assets);
    s.engine.assets.getRequired = id => id === 'model' ? model : getRequired(id);
    await assert.rejects(new m.LayoutBuilder(s.ctx).build({
      good: viewport(), bad: viewport({ camera: 'world.item' }),
    }), /camera must name/);
    assert.equal(m.records[start].disposals, 1); assert.equal(m.records[start + 1].disposals, 1);
    model.dispose();
  });

  await check('invalid configuration, foreign graph nodes and missing assets fail with cleanup', async () => {
    const s = setup();
    for (const props of [{ width: 0 }, { resolution: 3 }, { renderMode: 'typo' }, { camera: '' }, { asset: 'image' }]) {
      await assert.rejects(new m.LayoutBuilder(s.ctx).build({ preview: viewport(props) }));
    }
    for (const props of [{ camera: 'missing' }, { sceneLayout: 'missing' }]) {
      const start = m.records.length;
      await assert.rejects(new m.LayoutBuilder(s.ctx).build({ preview: viewport(props) }));
      assert.equal(m.records[start].disposals, 1);
    }
    const foreign = setup({ item: { type: 'Sprite' } }), start = m.records.length;
    await assert.rejects(new m.LayoutBuilder(foreign.ctx).build({ preview: viewport() }), /Unexpected node type/);
    assert.equal(m.records[start].disposals, 1);
    await assert.rejects(new m.LayoutBuilder(s.ctx).build({
      preview: { ...viewport(), children: { illegal: mesh } },
    }), /children require/);
  });

  await check('ThreeViewport preparation also runs for dynamically spawned Pixi prefabs', async () => {
    const s = setup();
    const built = await new m.LayoutBuilder(s.ctx).build({ panel: { type: 'Container' } });
    const layout = m.SceneLayout.fromBuildResult(s.engine, built); s.activate(layout);
    const parent = layout.getNode('panel');
    const manager = new m.PrefabManager(s.engine, { getElement: async () => viewport() });
    const spawned = await manager.spawnToContainer({ parent, localId: 'preview', prefabId: 'preview' });
    assert.ok(spawned.node instanceof m.ThreeViewport);
    spawned.node.world.requireNode('world.item', m.ThreeNode);
    await spawned.dispose(); await layout.destroy();
  });

  await check('late nested layout completion releases its graph after owner destruction', async () => {
    const s = setup(), start = m.records.length;
    let resolveJson;
    s.engine.assets.getJson = () => new Promise(resolve => { resolveJson = resolve; });
    let detaches = 0;
    class Observer extends m.BaseComponent {
      nodeType = m.ThreeNode;
      onDetach() { detaches++; return super.onDetach(); }
    }
    s.container.register({ token: m.DiTokens.component('LateObserver'), useFactory: () => new Observer() });
    const config = structuredClone(preview);
    config.world.children.item.components = { observer: { type: 'LateObserver' } };
    const created = m.ThreeViewport.factory()('preview', viewport(), {});
    created.object.id = 'preview'; created.object.engine = s.engine;
    const preparation = created.prepare();
    const rejection = assert.rejects(preparation, /disposed during preparation/);
    await created.object.destroy();
    resolveJson(config);
    await rejection;
    assert.equal(detaches, 1);
    assert.equal(m.records[start].disposals, 1);
    assert.equal(m.records[start].calls.length, 0);
  });

  await check('embedded layouts retain regular include and inheritance resolution', async () => {
    const s = setup();
    s.engine.assets.getJson = async id => {
      if (id === layoutId) return { $include: 'included-preview' };
      if (id === 'included-preview') return { ...preview, copy: { type: 'Group', extends: 'world' } };
      throw new Error('Unexpected JSON: ' + id);
    };
    const built = await new m.LayoutBuilder(s.ctx).build({ preview: viewport() });
    const node = built.elements.get('preview').object;
    assert.ok(node.world.requireNode('world.item', m.ThreeNode));
    assert.ok(node.world.requireNode('copy.item', m.ThreeNode));
    await built.root.destroy();
  });
  console.log('ThreeViewport integration passed using real Pixi textures and Three graphs; GPU renderer substituted.');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
