import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundle = await build({
  stdin: {
    contents: `
      export { PlaygamaPlatformAdapter } from './PlaygamaPlatformAdapter';
      export { PlaygamaPlatformDataStorageBackend } from './PlaygamaPlatformDataStorageBackend';
      export { PlatformManager } from '../../PlatformManager';
    `,
    resolveDir: `${root}/packages/engine/src/platforms/internal/playgama`,
    loader: 'ts',
  },
  tsconfig: `${root}/packages/engine/tsconfig.json`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  define: { 'import.meta.env.VITE_PLATFORM': '"playgama"' },
});
const { PlaygamaPlatformAdapter, PlaygamaPlatformDataStorageBackend, PlatformManager } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

function emitter() {
  const listeners = new Map();
  return {
    on(event, listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(listener);
    },
    off(event, listener) { listeners.get(event)?.delete(listener); },
    emit(event, state) { for (const listener of [...listeners.get(event) ?? []]) listener(state); },
    count() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); },
  };
}

function fixture(t, raw = null) {
  const messages = [];
  const writes = [];
  const requests = [];
  const platform = {
    ...emitter(), language: 'pt-BR', isAudioEnabled: false, isPaused: true,
    async sendMessage(message) { messages.push(message); },
  };
  const advertisement = {
    ...emitter(), isInterstitialSupported: true, isRewardedSupported: true,
    interstitialState: 'closed', rewardedState: 'closed',
    showInterstitial() { requests.push('interstitial'); },
    showRewarded() { requests.push('rewarded'); },
  };
  const sdk = {
    initializeCalls: 0,
    async initialize() { this.initializeCalls++; },
    platform, advertisement,
    storage: {
      async get() { return raw; },
      async set(key, value) { writes.push({ key, value }); },
    },
  };
  const previous = globalThis.window;
  globalThis.window = { bridge: sdk };
  t.after(() => {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  });
  const adapter = new PlaygamaPlatformAdapter();
  t.after(() => adapter.dispose());
  return { adapter, sdk, platform, advertisement, messages, writes, requests };
}

async function drain() {
  await new Promise(resolve => setImmediate(resolve));
}

test('environment selects Playgama and init is single-flight, with deferred one-time game_ready', async t => {
  const f = fixture(t);
  const manager = PlatformManager.createFromEnvironment();
  assert.equal(manager.getId(), 'playgama');
  manager.dispose();
  f.adapter.loadingFinished();
  assert.deepEqual(f.messages, []);
  await Promise.all([f.adapter.init(), f.adapter.init()]);
  f.adapter.loadingFinished();
  assert.equal(f.sdk.initializeCalls, 1);
  assert.equal(f.adapter.isInitialized(), true);
  assert.equal(f.adapter.getPreferredLocale(), 'pt-BR');
  f.adapter.gameplayStart(); f.adapter.gameplayStop(); f.adapter.happytime();
  assert.deepEqual(f.messages, ['game_ready', 'gameplay_started', 'gameplay_stopped', 'player_got_achievement']);
  await f.adapter.prerollBreak();
  assert.deepEqual(f.requests, []);
});

test('initial audio/pause state, replacement hooks and disposal use the real host subscriptions', async t => {
  const f = fixture(t);
  const states = [];
  const hooks = {
    onAudioMuteChanged: muted => states.push(['mute', muted]),
    onPauseRequested: () => states.push(['pause', true]),
    onResumeRequested: () => states.push(['pause', false]),
  };
  f.adapter.setRuntimeHooks(hooks);
  await f.adapter.init();
  assert.deepEqual(states, [['mute', true], ['pause', true]]);
  f.platform.isAudioEnabled = true; f.platform.isPaused = false;
  f.platform.emit('audio_state_changed', true);
  f.platform.emit('pause_state_changed', false);
  assert.deepEqual(states.slice(-2), [['mute', false], ['pause', false]]);
  f.adapter.setRuntimeHooks(hooks);
  assert.deepEqual(states.slice(-2), [['mute', false], ['pause', false]]);
  assert.equal(f.platform.count(), 2);
  f.adapter.dispose(); f.adapter.dispose();
  assert.equal(f.platform.count(), 0);
  const count = states.length;
  f.platform.emit('pause_state_changed', true);
  assert.equal(states.length, count);
});

test('missing/rejected SDK and disposal during initialization stay inert', async t => {
  const f = fixture(t);
  delete globalThis.window.bridge;
  await f.adapter.init();
  assert.equal(f.adapter.isInitialized(), true);
  assert.deepEqual(await f.adapter.rewardedBreak(), { success: false });
  assert.equal(f.adapter.getDataStorageBackend(), null);

  globalThis.window.bridge = f.sdk;
  f.sdk.initialize = async () => { throw Error('offline'); };
  const rejected = new PlaygamaPlatformAdapter();
  await rejected.init();
  rejected.loadingFinished();
  assert.equal(rejected.isAdvertisingAvailable(), false);
  rejected.dispose();

  let ready;
  f.sdk.initialize = () => new Promise(resolve => { ready = resolve; });
  const disposed = new PlaygamaPlatformAdapter();
  const initializing = disposed.init();
  disposed.dispose(); ready(); await initializing;
  assert.equal(f.platform.count(), 0);
  assert.equal(disposed.getDataStorageBackend(), null);
  assert.equal(disposed.isInitialized(), false);
});

test('reward confirmation waits for close, concurrent requests cannot share a reward', async t => {
  const f = fixture(t); await f.adapter.init();
  const ad = f.adapter.rewardedBreak();
  let settled = false; ad.then(() => { settled = true; });
  assert.deepEqual(await f.adapter.rewardedBreak(), { success: false });
  assert.deepEqual(f.requests, ['rewarded']);
  f.advertisement.emit('rewarded_state_changed', 'opened');
  f.advertisement.emit('rewarded_state_changed', 'rewarded');
  await drain(); assert.equal(settled, false);
  f.advertisement.emit('rewarded_state_changed', 'closed');
  assert.deepEqual(await ad, { success: true });
  assert.equal(f.advertisement.count(), 0);
  const cancelled = f.adapter.rewardedBreak();
  f.advertisement.emit('rewarded_state_changed', 'closed');
  assert.deepEqual(await cancelled, { success: false });
});

test('manager retains the break until close while host runtime events own audio mute', async t => {
  const f = fixture(t);
  const events = [];
  const manager = new PlatformManager({
    adapter: f.adapter,
    adBreakHooks: {
      onAdBreakStart: () => events.push('break-start'),
      onAdBreakEnd: () => events.push('break-end'),
    },
    runtimeHooks: { onAudioMuteChanged: muted => events.push(`mute:${muted}`) },
  });
  await manager.init();
  assert.equal(manager.shouldMuteAudioOnAdRequest(), false);
  assert.equal(manager.isAdvertisingAvailable(), true);
  events.length = 0;
  const request = manager.rewardedBreak();
  assert.deepEqual(events, ['break-start']);
  f.platform.emit('audio_state_changed', false);
  f.advertisement.emit('rewarded_state_changed', 'rewarded');
  await drain();
  assert.deepEqual(events, ['break-start', 'mute:true']);
  f.advertisement.emit('rewarded_state_changed', 'closed');
  f.platform.emit('audio_state_changed', true);
  assert.deepEqual(await request, { success: true });
  assert.deepEqual(events, ['break-start', 'mute:true', 'mute:false', 'break-end']);
});

test('storage failure preserves platform APIs, and late storage completion cannot revive a disposed adapter', async t => {
  const f = fixture(t);
  f.sdk.storage.get = async () => { throw Error('unavailable'); };
  await f.adapter.init();
  assert.equal(f.adapter.getDataStorageBackend(), null);
  assert.equal(f.adapter.isAdvertisingAvailable(), true);
  f.adapter.loadingFinished();
  assert.deepEqual(f.messages, ['game_ready']);
  f.adapter.dispose();

  let finishLoad;
  f.sdk.storage.get = () => new Promise(resolve => { finishLoad = resolve; });
  const disposed = new PlaygamaPlatformAdapter();
  const initializing = disposed.init();
  await drain();
  assert.equal(f.platform.count(), 2);
  disposed.dispose(); finishLoad(null); await initializing;
  assert.equal(disposed.getDataStorageBackend(), null);
  assert.equal(f.platform.count(), 0);
});

test('rejected and synchronous lifecycle messages cannot break gameplay', async t => {
  const f = fixture(t); await f.adapter.init();
  f.platform.sendMessage = async () => { throw Error('unsupported'); };
  f.adapter.loadingFinished(); f.adapter.gameplayStart();
  await drain();
  f.platform.sendMessage = () => { throw Error('host error'); };
  assert.doesNotThrow(() => f.adapter.gameplayStop());
  assert.doesNotThrow(() => f.adapter.happytime());
});

test('interstitial close, unsupported formats, errors and disposal release ad requests', async t => {
  const f = fixture(t); await f.adapter.init();
  const commercial = f.adapter.commercialBreak();
  f.advertisement.emit('interstitial_state_changed', 'opened');
  f.advertisement.emit('interstitial_state_changed', 'closed');
  await commercial;
  const failed = f.adapter.rewardedBreak();
  f.advertisement.emit('rewarded_state_changed', 'failed');
  assert.deepEqual(await failed, { success: false });
  f.advertisement.showRewarded = () => { throw Error('host error'); };
  assert.deepEqual(await f.adapter.rewardedBreak(), { success: false });
  f.advertisement.isRewardedSupported = false;
  assert.deepEqual(await f.adapter.rewardedBreak(), { success: false });
  f.advertisement.isInterstitialSupported = false;
  assert.equal(f.adapter.isAdvertisingAvailable(), false);
  f.advertisement.isRewardedSupported = true;
  f.advertisement.showRewarded = () => {};
  const pending = f.adapter.rewardedBreak();
  f.adapter.dispose();
  assert.deepEqual(await pending, { success: false });
  assert.equal(f.advertisement.count(), 0);
});

test('loading watchdog releases silent requests but never ends an opened ad', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t); await f.adapter.init();
  const silent = f.adapter.rewardedBreak();
  t.mock.timers.tick(90000);
  assert.deepEqual(await silent, { success: false });
  assert.equal(f.advertisement.count(), 0);
  const playing = f.adapter.rewardedBreak();
  let settled = false; playing.then(() => { settled = true; });
  f.advertisement.emit('rewarded_state_changed', 'opened');
  t.mock.timers.tick(180000); await drain();
  assert.equal(settled, false);
  f.advertisement.emit('rewarded_state_changed', 'rewarded');
  f.advertisement.emit('rewarded_state_changed', 'closed');
  assert.deepEqual(await playing, { success: true });
});

test('storage restores before sync reads, preserves namespaces and persists removal/restart', async t => {
  const f = fixture(t, { 'game:level': '4', 'other:coins': '7', language: 'ru' });
  await f.adapter.init();
  const storage = f.adapter.getDataStorageBackend();
  assert.equal(storage.getItem('language'), 'ru');
  assert.deepEqual([...await storage.bootstrap('game:')], [['game:level', '4']]);
  storage.setItem('game:level', '5');
  storage.setItem('game:zero', '0');
  storage.removeItem('other:coins');
  assert.equal(storage.getItem('game:level'), '5');
  await drain();
  assert.equal(f.writes.length, 3);
  const saved = f.writes.at(-1);
  assert.deepEqual(saved.value, { 'game:level': '5', 'game:zero': '0', language: 'ru' });
  const restarted = new PlaygamaPlatformDataStorageBackend({ async get() { return saved.value; } });
  await restarted.bootstrap('');
  assert.equal(restarted.getItem('game:level'), '5');
  assert.equal(restarted.getItem('other:coins'), null);
});

test('storage validates unknown data, prevents overwrite after failed load and serializes retries', async () => {
  for (const raw of [[], 'broken', { level: 123 }]) {
    const storage = new PlaygamaPlatformDataStorageBackend({ async get() { return raw; } });
    await assert.rejects(storage.bootstrap(''));
    assert.throws(() => storage.setItem('level', '1'), /bootstrapped/);
  }
  let finishWrite;
  let calls = 0;
  const saves = [];
  const storage = new PlaygamaPlatformDataStorageBackend({
    async get() { return null; },
    async set(_key, value) {
      saves.push(value); calls++;
      if (calls === 1) await new Promise(resolve => { finishWrite = resolve; });
      if (calls === 2) throw Error('temporary failure');
    },
  });
  await storage.bootstrap('');
  storage.setItem('level', '1'); storage.setItem('level', '2'); storage.setItem('level', '3');
  await drain(); assert.equal(calls, 1);
  finishWrite(); await drain();
  assert.deepEqual(saves.map(value => value.level), ['1', '2', '3']);
  assert.equal(storage.getItem('level'), '3');
});


test('host-owned ads block engine requests until the host finishes', async t => {
  const f = fixture(t); await f.adapter.init();
  for (const [kind, state] of [
    ['interstitialState', 'loading'], ['interstitialState', 'opened'],
    ['rewardedState', 'loading'], ['rewardedState', 'opened'], ['rewardedState', 'rewarded'],
  ]) {
    f.advertisement[kind] = state;
    assert.deepEqual(await f.adapter.rewardedBreak(), { success: false });
    await f.adapter.commercialBreak();
    f.advertisement[kind] = 'closed';
  }
  assert.deepEqual(f.requests, []);
  const request = f.adapter.rewardedBreak();
  f.advertisement.emit('rewarded_state_changed', 'rewarded');
  f.advertisement.emit('rewarded_state_changed', 'closed');
  assert.deepEqual(await request, { success: true });
});

test('nested manager requests keep runtime paused until the first ad closes', async t => {
  const f = fixture(t);
  let active = 0;
  const manager = new PlatformManager({ adapter: f.adapter, adBreakHooks: {
    onAdBreakStart: () => { active++; }, onAdBreakEnd: () => { active--; },
  } });
  await manager.init();
  const first = manager.rewardedBreak();
  assert.equal(active, 1);
  assert.deepEqual(await manager.rewardedBreak(), { success: false });
  await manager.commercialBreak();
  assert.equal(active, 1);
  f.advertisement.emit('rewarded_state_changed', 'opened');
  f.advertisement.emit('rewarded_state_changed', 'rewarded');
  f.advertisement.emit('rewarded_state_changed', 'closed');
  assert.deepEqual(await first, { success: true });
  assert.equal(active, 0);
  f.adapter.dispose();
  await f.adapter.init();
  f.adapter.loadingFinished(); f.adapter.gameplayStart(); f.adapter.happytime();
  assert.deepEqual(await f.adapter.rewardedBreak(), { success: false });
  assert.deepEqual(f.messages, []);
  assert.equal(f.sdk.initializeCalls, 1);
});

test('failed ad subscription and cleanup still release requests', async t => {
  const f = fixture(t); await f.adapter.init();
  const subscribe = f.advertisement.on;
  f.advertisement.on = () => { throw Error('subscribe failed'); };
  assert.deepEqual(await f.adapter.rewardedBreak(), { success: false });
  f.advertisement.on = subscribe;
  const unsubscribe = f.advertisement.off;
  f.advertisement.off = (...args) => { unsubscribe(...args); throw Error('cleanup failed'); };
  const request = f.adapter.rewardedBreak();
  f.advertisement.emit('rewarded_state_changed', 'failed');
  assert.deepEqual(await request, { success: false });
  assert.equal(f.advertisement.count(), 0);
  const pending = f.adapter.rewardedBreak();
  f.adapter.dispose();
  assert.deepEqual(await pending, { success: false });
});
