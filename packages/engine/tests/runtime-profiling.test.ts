import test from 'node:test';
import assert from 'node:assert/strict';
import { RuntimeExecutionEngine } from '../src/runtime/RuntimeExecutionEngine';
import { RuntimeSchedulerProfilingMonitor } from '../src/runtime/RuntimeSchedulerProfilingMonitor';
import type { PhysicsRuntime } from '../src/core/ports/PhysicsRuntime';
import type { RuntimeSystem, RuntimeUpdateContext } from '../src/runtime/types';

class ProfilingMonitor extends RuntimeSchedulerProfilingMonitor {
  readonly durations: number[] = [];

  constructor(private readonly profilingEnabled = true) { super(); }

  override isEnabled(): boolean { return this.profilingEnabled; }

  override onFrameEnd(durationMs: number): void {
    this.durations.push(durationMs);
    super.onFrameEnd(durationMs);
  }
}

class UnusedRuntime implements PhysicsRuntime {
  private unused(): never { throw new Error('This test must not use engine services'); }
  get rendering(): never { return this.unused(); }
  get frames(): never { return this.unused(); }
  get activity(): never { return this.unused(); }
  get audio(): never { return this.unused(); }
  get assets(): never { return this.unused(); }
  get scenes(): never { return this.unused(); }
  get commands(): never { return this.unused(); }
  get events(): never { return this.unused(); }
  get screen(): never { return this.unused(); }
  get tweens(): never { return this.unused(); }
  get input(): never { return this.unused(); }
  get inputChannel(): never { return this.unused(); }
  get prefabs(): never { return this.unused(); }
  get platform(): never { return this.unused(); }
  get di(): never { return this.unused(); }
  getSceneRenderRoot(): never { return this.unused(); }
  getActiveLayout(): never { return this.unused(); }
  getRequiredActiveLayout(): never { return this.unused(); }
  setActiveLayout(): never { return this.unused(); }
  clearActiveLayout(): never { return this.unused(); }
  setActiveSceneFSM(): never { return this.unused(); }
  clearActiveSceneFSM(): never { return this.unused(); }
  getCurrentSceneFSM(): never { return this.unused(); }
  bootstrapConfigBundles(): never { return this.unused(); }
  getActiveSceneDi(): never { return this.unused(); }
  getRequiredActiveSceneDi(): never { return this.unused(); }
  setActiveSceneDi(): never { return this.unused(); }
  clearActiveSceneDi(): never { return this.unused(); }
}

const context: Omit<RuntimeUpdateContext, 'frame'> = {
  engine: new UnusedRuntime(),
  activeScene: null,
};

test('slow systems do not consume the scheduler overhead budget', t => {
  let now = 0;
  t.mock.method(performance, 'now', () => { now += 0.01; return now; });
  const warn = t.mock.method(console, 'warn', () => {});
  const monitor = new ProfilingMonitor();
  const execution = new RuntimeExecutionEngine(monitor);
  const calls: string[] = [];
  const systems: RuntimeSystem[] = [
    { key: 'layout', phase: 'layout', update(dt, ctx) {
      assert.equal(dt, 1 / 60);
      calls.push(`layout:${ctx.frame}`);
      now += 20;
    } },
    { key: 'physics', phase: 'physics', update(_dt, ctx) {
      calls.push(`physics:${ctx.frame}`);
      now += 40;
    } },
  ];
  for (let frame = 1; frame <= 120; frame++) execution.tickAll(1 / 60, context, systems);
  assert.equal(calls.length, 240);
  assert.deepEqual(calls.slice(0, 4), ['layout:1', 'physics:1', 'layout:2', 'physics:2']);
  assert.equal(monitor.durations.length, 120);
  for (const duration of monitor.durations) assert.ok(Math.abs(duration - 0.03) < 1e-8);
  assert.equal(warn.mock.callCount(), 0);
});

test('single-system warmup ticks also exclude system work', t => {
  let now = 0;
  t.mock.method(performance, 'now', () => { now += 0.01; return now; });
  const monitor = new ProfilingMonitor();
  const execution = new RuntimeExecutionEngine(monitor);
  execution.tickSystem(1 / 60, context, {
    key: 'physics', phase: 'physics', update() { now += 100; },
  });
  assert.equal(monitor.durations.length, 1);
  assert.ok(Math.abs((monitor.durations[0] ?? Infinity) - 0.02) < 1e-8);
});

test('actual dispatch overhead still triggers the unchanged DEV budget', t => {
  let now = 0;
  t.mock.method(performance, 'now', () => { now += 3; return now; });
  const warn = t.mock.method(console, 'warn', () => {});
  const execution = new RuntimeExecutionEngine(new ProfilingMonitor());
  for (let frame = 0; frame < 120; frame++) execution.tickAll(0, context, []);
  assert.deepEqual(warn.mock.calls[0]?.arguments, [
    'Runtime scheduler overhead exceeded DEV budget',
    { avgDurationMs: 3, maxDurationMs: 3, budgetMs: 2.5, windowFrames: 120 },
  ]);
});

test('profiling windows reset and use the average rather than isolated spikes', t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const monitor = new RuntimeSchedulerProfilingMonitor();
  for (let frame = 0; frame < 119; frame++) monitor.onFrameEnd(3);
  assert.equal(warn.mock.callCount(), 0);
  monitor.onFrameEnd(9);
  assert.deepEqual(warn.mock.calls[0]?.arguments[1], {
    avgDurationMs: 3.05, maxDurationMs: 9, budgetMs: 2.5, windowFrames: 120,
  });
  monitor.onFrameEnd(10);
  for (let frame = 0; frame < 119; frame++) monitor.onFrameEnd(0);
  assert.equal(warn.mock.callCount(), 1);
  for (let frame = 0; frame < 120; frame++) monitor.onFrameEnd(2.5);
  assert.equal(warn.mock.callCount(), 1);
});

test('disabled profiling performs no clock reads and preserves system updates', t => {
  const clock = t.mock.method(performance, 'now', () => { throw new Error('Unexpected clock read'); });
  const monitor = new ProfilingMonitor(false);
  const execution = new RuntimeExecutionEngine(monitor);
  let updates = 0;
  const system: RuntimeSystem = { key: 'physics', phase: 'physics', update() { updates++; } };
  execution.tickAll(0, context, [system]);
  execution.tickSystem(0, context, system);
  assert.equal(updates, 2);
  assert.equal(clock.mock.callCount(), 0);
  assert.deepEqual(monitor.durations, []);
});
