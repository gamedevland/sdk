import { RuntimeSystemPhaseOrder } from '../src/runtime/RuntimeSystemPhase';
import { EngineBootPipeline } from '../src/core/boot/EngineBootPipeline';
import { PlatformManager } from '../src/platforms/PlatformManager';
import type { PlatformAdapter } from '../src/platforms/types';
import test from 'node:test';
import assert from 'node:assert/strict';
import { AssetManager } from '../src/assets/AssetManager';
import { DisposalScope } from '../src/lifecycle/DisposalScope';
import { DiContainer } from '../src/di/DiContainer';
import { PresentationScheduler } from '../src/runtime/PresentationScheduler';
import { RuntimeDiagnostics } from '../src/diagnostics/RuntimeDiagnostics';
import { PersistentStorageCoordinator } from '../src/configs/services/PersistentStorageCoordinator';
import { PersistentStorageAdapter } from '../src/configs/services/PersistentStorageAdapter';
import type { PlatformDataStorageBackend } from '../src/platforms/types';

test('resource scope releases in reverse order, survives errors and releases late ownership immediately', () => {
  const scope = new DisposalScope();
  const calls: number[] = [];
  const release = scope.own(() => {
    calls.push(1);
  });
  scope.own(() => {
    calls.push(2);
    throw new Error('cleanup failed');
  });
  scope.own(() => {
    calls.push(3);
  });
  release();
  release();
  assert.throws(() => scope.dispose(), AggregateError);
  assert.deepEqual(calls, [1, 3, 2]);
  assert.equal(scope.signal.aborted, true);
  scope.dispose();
  scope.own(() => {
    calls.push(4);
  });
  assert.deepEqual(calls, [1, 3, 2, 4]);
});

test('DI reports a factory dependency cycle and recovers the resolution stack after failure', () => {
  const di = new DiContainer();
  di.register({ token: 'a', useFactory: (c) => c.get('b') });
  di.register({ token: 'b', useFactory: (c) => c.get('a') });
  assert.throws(() => di.get('a'), /a -> b -> a/);
  di.register({ token: 'b', useValue: 42, override: true });
  assert.equal(di.get('a'), 42);
});

test('presentation is camera/world/UI ordered, skips removed callbacks and clears owner subscriptions', () => {
  const scheduler = new PresentationScheduler();
  const owner = new AbortController();
  const calls: string[] = [];
  scheduler.subscribe(
    () => {
      calls.push('ui');
    },
    { phase: 'ui' },
  );
  scheduler.subscribe(
    () => {
      calls.push('world');
    },
    { signal: owner.signal },
  );
  scheduler.subscribe(
    () => {
      calls.push('camera');
      owner.abort();
    },
    { phase: 'camera' },
  );
  scheduler.tick(1 / 60);
  assert.deepEqual(calls, ['camera', 'ui']);
  scheduler.clear();
  scheduler.tick(1 / 60);
  assert.equal(calls.length, 2);
  assert.throws(() => scheduler.subscribe(() => {}, { order: NaN }), /finite/);
});

test('diagnostic observers cannot break delivery and unsubscribing does not retain samples', () => {
  const diagnostics = new RuntimeDiagnostics();
  let records = 0;
  const first = diagnostics.subscribe(() => {
    throw new Error('observer');
  });
  const second = diagnostics.subscribe(() => {
    records++;
  });
  diagnostics.report({ kind: 'frame', rawDelta: 1, simulationDelta: 0.1 });
  assert.equal(records, 1);
  first();
  second();
  assert.equal(diagnostics.observed, false);
});

test('required asset loads retain loader cause; optional loads and retries remain available', async () => {
  const assets = new AssetManager({ retry: { retries: 0 } });
  const cause = new Error('invalid model payload');
  assets.registerBundles({ name: 'models', assets: [{ id: 'model', type: 'model', url: 'model.glb' }] });
  assets.registerLoader('model', {
    load: async () => {
      throw cause;
    },
  });
  await assets.load('model');
  await assert.rejects(assets.loadRequiredBundle('models'), (error) => {
    assert.ok(error instanceof AggregateError);
    const failure: unknown = error.errors[0];
    assert.ok(failure instanceof Error);
    assert.equal(failure.cause, cause);
    assert.match(failure.message, /model/);
    return true;
  });
  await assets.destroy();
});

test('concurrent callers share single-flight requests and a global concurrency limit', async () => {
  const assets = new AssetManager({ concurrency: { maxParallel: 1 }, retry: { retries: 0 } });
  assets.registerBundles({
    name: 'data',
    assets: ['a', 'b', 'c'].map((id) => ({ id, type: 'json', url: id })),
  });
  let active = 0,
    peak = 0,
    loads = 0;
  assets.registerLoader('json', {
    load: async (descriptor) => {
      loads++;
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return descriptor.id;
    },
  });
  await Promise.all([assets.loadRequired(['a', 'b']), assets.loadRequired(['a', 'c'])]);
  assert.equal(loads, 3);
  assert.equal(peak, 1);
  assets.unload('a');
  assert.equal(assets.has('a'), false);
  await assets.loadRequired('a');
  assert.equal(loads, 4);
  await assets.destroy();
});

test('cancelling one waiter preserves the other caller and releases a timed-out late resource', async () => {
  const assets = new AssetManager({ retry: { retries: 0, timeoutMs: 10 } });
  assets.registerBundles({ name: 'data', assets: [{ id: 'a', type: 'json', url: 'a' }] });
  let release: ((value: object) => void) | undefined;
  let disposals = 0;
  assets.registerLoader('json', {
    load: () =>
      new Promise<object>((resolve) => {
        release = resolve;
      }),
    dispose: () => {
      disposals++;
    },
  });
  const controller = new AbortController();
  const waiter = assets.loadRequired('a', { signal: controller.signal });
  const other = assets.loadRequired('a');
  const cancelled = assert.rejects(waiter, { name: 'AbortError' });
  const timedOut = assert.rejects(other, AggregateError);
  controller.abort();
  await Promise.all([cancelled, timedOut]);
  release?.({});
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(disposals, 1);
  assert.equal(assets.has('a'), false);
  await assets.destroy();
});

test('asset disposal aborts active work and invalid policy fails before starting the queue', async () => {
  assert.throws(() => new AssetManager({ concurrency: { maxParallel: 0 } }), /maxParallel/);
  assert.throws(() => new AssetManager({ retry: { retries: -1 } }), /retries/);
  const assets = new AssetManager({ retry: { retries: 10, timeoutMs: 100000 } });
  assets.registerBundles({ name: 'data', assets: [{ id: 'a', type: 'json', url: 'a' }] });
  let aborted = false;
  assets.registerLoader('json', {
    load: (_descriptor, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            aborted = true;
            reject(signal.reason);
          },
          { once: true },
        );
      }),
  });
  const pending = assets.loadRequired('a');
  const rejection = assert.rejects(pending, AggregateError);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await assets.destroy();
  await rejection;
  assert.equal(aborted, true);
});

test('separate engine persistence coordinators cannot redirect each other or fall back from platform identity', async () => {
  const maps = [new Map<string, string>(), new Map<string, string>()];
  const adapters = maps.map((map) => {
    const backend: PlatformDataStorageBackend = {
      bootstrap: async () => new Map(map),
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => {
        map.set(key, value);
      },
      removeItem: (key) => {
        map.delete(key);
      },
    };
    const coordinator = new PersistentStorageCoordinator();
    coordinator.configure({
      databaseName: 'test',
      namespace: 'game',
      policy: 'platform-exclusive',
      browserStorage: { localStorage: true, indexedDB: true },
      platformDataStorageBackend: backend,
    });
    return { coordinator, adapter: new PersistentStorageAdapter(coordinator) };
  });
  await Promise.all(adapters.map((value) => value.coordinator.bootstrap()));
  const first = adapters[0],
    second = adapters[1];
  assert.ok(first && second);
  first.adapter.setItem('game:progress', 'first');
  assert.equal(second.adapter.getItem('game:progress'), null);
  second.adapter.setItem('game:progress', 'second');
  assert.equal(first.adapter.getItem('game:progress'), 'first');
});

test('boot cancellation observes a late task without starting the next task', async () => {
  const controller = new AbortController();
  let release: (() => void) | undefined;
  let second = false;
  const pipeline = new EngineBootPipeline([
    {
      run: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    },
    {
      run: async () => {
        second = true;
      },
    },
  ]);
  const pending = pipeline.run(controller.signal);
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  controller.abort();
  await rejected;
  release?.();
  await Promise.resolve();
  assert.equal(second, false);
});

test('platform initialization completing after disposal releases late listeners and cannot restart gameplay', async () => {
  let release: (() => void) | undefined;
  let listeners = 0;
  const adapter: PlatformAdapter = {
    id: 'test',
    init: async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      listeners++;
    },
    dispose: () => {
      listeners = 0;
    },
    isInitialized: () => listeners > 0,
    setRuntimeHooks() {},
    loadingFinished() {},
    gameplayStart() {},
    gameplayStop() {},
    happytime() {},
    getDataStorageBackend: () => null,
    getPreferredLocale: () => null,
    prerollBreak: async () => {},
    commercialBreak: async () => {},
    rewardedBreak: async () => ({ success: false }),
  };
  const platform = new PlatformManager({ adapter });
  const pending = platform.init();
  platform.dispose();
  platform.dispose();
  release?.();
  await pending;
  assert.equal(listeners, 0);
  assert.equal(platform.isInitialized(), false);
  assert.throws(() => platform.gameplayStart(), /disposed/);
});

test('failed asset eviction retains cache ownership until the resource lease can be released', async () => {
  const assets = new AssetManager({ retry: { retries: 0 } });
  assets.registerBundles({ name: 'models', assets: [{ id: 'model', type: 'model', url: 'model.glb' }] });
  let leased = true;
  assets.registerLoader('model', {
    load: async () => ({}),
    dispose: () => {
      if (leased) throw new Error('Model is leased');
    },
  });
  await assets.loadRequired('model');
  assert.throws(() => assets.unload('model'), /leased/);
  assert.equal(assets.has('model'), true);
  leased = false;
  assets.unload('model');
  assert.equal(assets.has('model'), false);
  await assets.destroy();
});

test('persistence retries failed bootstrap and a stale snapshot cannot overwrite concurrent writes', async () => {
  const values = new Map<string, string>();
  let attempts = 0;
  let release: ((snapshot: ReadonlyMap<string, string>) => void) | undefined;
  const backend: PlatformDataStorageBackend = {
    bootstrap: async () => {
      if (++attempts === 1) throw new Error('offline');
      return new Promise((resolve) => {
        release = resolve;
      });
    },
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  const coordinator = new PersistentStorageCoordinator();
  coordinator.configure({
    databaseName: 'retry',
    namespace: 'game',
    policy: 'platform-exclusive',
    browserStorage: { localStorage: false, indexedDB: false },
    platformDataStorageBackend: backend,
  });
  await assert.rejects(coordinator.bootstrap(), /offline/);
  const pending = coordinator.bootstrap();
  coordinator.setItem('game:progress', 'new');
  release?.(new Map([['game:progress', 'old']]));
  await pending;
  assert.equal(coordinator.getItem('game:progress'), 'new');
});

test('runtime phases reject inherited object keys at the registration boundary', () => {
  assert.equal(RuntimeSystemPhaseOrder.isValid('toString'), false);
  assert.equal(RuntimeSystemPhaseOrder.isValid('__proto__'), false);
  assert.equal(RuntimeSystemPhaseOrder.isValid('presentation'), true);
});
