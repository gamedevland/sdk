import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = await mkdtemp(resolve('.tmp-stability-'));
const entries = {
  NodeComponents: 'layouts/nodes/internal/NodeComponents',
  NodeActions: 'layouts/nodes/internal/NodeActions',
  BaseComponent: 'layouts/components/BaseComponent',
  BaseAction: 'layouts/actions/BaseAction',
  SceneServiceHost: 'scenes/SceneServiceHost',
  DiContainer: 'di/DiContainer', EventBus: 'events/EventBus',
  FrameDriver: 'rendering/FrameDriver', EngineLifecycleManager: 'core/EngineLifecycleManager',
};
await build({
  stdin: { contents: Object.entries(entries).map(([name, path]) => `export {${name}} from './packages/engine/src/${path}';`).join('\n'), resolveDir: process.cwd() },
  outfile: resolve(directory, 'fixture.mjs'), bundle: true, platform: 'node', format: 'esm',
  packages: 'external', tsconfig: 'packages/engine/tsconfig.json',
});
const m = await import(pathToFileURL(resolve(directory, 'fixture.mjs')));
try {
  await test('component cleanup completes every hook and reports failures', async () => {
    const calls = [];
    class Component extends m.BaseComponent {
      constructor(id) { super(); this.id = id; }
      onDisable() { calls.push('disable:' + this.id); if (this.id === 'a') throw new Error('disable failed'); }
      onDetach() { calls.push('detach:' + this.id); super.onDetach(); }
    }
    const components = new m.NodeComponents();
    components.addComponent('a', new Component('a'));
    components.addComponent('b', new Component('b'));
    components.enableComponent('a'); components.enableComponent('b');
    await assert.rejects(components.destroy(), /cleanup|disposal/i);
    assert.deepEqual(calls, ['disable:a', 'disable:b', 'detach:a', 'detach:b']);
  });
  await test('action cleanup reports a failed hook and still detaches peers', async () => {
    const calls = [];
    class Action extends m.BaseAction {
      constructor(id) { super(); this.id = id; }
      onDetach() { super.onDetach(); calls.push(this.id); if (this.id === 'a') throw new Error('detach failed'); }
    }
    const actions = new m.NodeActions();
    actions.addAction('a', new Action('a')); actions.addAction('b', new Action('b'));
    await assert.rejects(actions.destroy(), /cleanup|disposal/i);
    assert.deepEqual(calls, ['a', 'b']);
  });
  await test('failed service entry rolls back partial and completed entries in reverse order', async () => {
    const calls = [];
    const services = {
      a: { onSceneEnter() { calls.push('enter:a'); }, onSceneExit() { calls.push('exit:a'); } },
      b: { onSceneEnter() { calls.push('enter:b'); throw new Error('entry failed'); }, onSceneExit() { calls.push('exit:b'); } },
      c: { onSceneEnter() { calls.push('enter:c'); }, onSceneExit() { calls.push('exit:c'); } },
    };
    const host = new m.SceneServiceHost('test', ['a', 'b', 'c'], { get: token => services[token] });
    await assert.rejects(host.init({}), /lifecycle|entry/);
    assert.deepEqual(calls, ['enter:a', 'enter:b', 'exit:b', 'exit:a']);
    await host.dispose({});
    assert.equal(calls.length, 4);
  });
  await test('disposing during service entry waits for it and never resumes initialization', async () => {
    const calls = [];
    let release;
    const entered = new Promise(resolve => { release = resolve; });
    const host = new m.SceneServiceHost('test', ['a', 'b'], {get: token => token === 'a'
      ? {async onSceneEnter() { calls.push('enter:a'); await entered; }, onSceneExit() { calls.push('exit:a'); }}
      : {onSceneEnter() { calls.push('enter:b'); }}});
    const pending = host.init({});
    const rejection = assert.rejects(pending, /disposed|cancel/i);
    const disposal = host.dispose({});
    release();
    await Promise.all([rejection, disposal]);
    assert.deepEqual(calls, ['enter:a', 'exit:a']);
  });
  await test('singleton override invalidates only its owning scope cache', () => {
    const parent = new m.DiContainer();
    parent.register({token: 'value', useValue: 1, lifetime: 'singleton'});
    assert.equal(parent.get('value'), 1);
    parent.register({token: 'value', useValue: 2, lifetime: 'singleton', override: true});
    assert.equal(parent.get('value'), 2);
    const child = parent.createScope();
    child.register({token: 'value', useValue: 3, lifetime: 'singleton', override: true});
    assert.equal(child.get('value'), 3); assert.equal(parent.get('value'), 2);
  });
  await test('async event rejection is observed without blocking other listeners', async () => {
    const errors = [], calls = [];
    const bus = new m.EventBus(error => errors.push(error));
    bus.on('test', async () => { throw new Error('async failure'); });
    bus.on('test', () => calls.push('peer'));
    bus.emit({type: 'test'});
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls, ['peer']); assert.equal(errors.length, 1);
  });
  await test('stopping the frame driver inside an update prevents rendering disposed resources', () => {
    const saved = ['requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
    let tick, renders = 0;
    globalThis.requestAnimationFrame = callback => { tick = callback; return 1; };
    globalThis.cancelAnimationFrame = () => {};
    try {
      const frames = new m.FrameDriver(() => renders++);
      frames.subscribe(() => frames.stop()); frames.start(); tick(0);
      assert.equal(renders, 0);
    } finally {
      for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    }
  });
  await test('concurrent engine initialization cannot create two renderers', async () => {
    let release, count = 0;
    const lifecycle = new m.EngineLifecycleManager({initializeRenderer: () => { count++; return new Promise(resolve => {release = resolve;}); }});
    const first = lifecycle.init();
    await assert.rejects(lifecycle.init(), /lifecycle state/);
    release(); await first; assert.equal(count, 1);
  });
} finally {
  await rm(directory, {recursive: true, force: true});
}
