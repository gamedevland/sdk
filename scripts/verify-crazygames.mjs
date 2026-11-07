import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  stdin: { contents: `export { CrazyGamesPlatformAdapter } from './packages/engine/src/platforms/internal/crazygames/CrazyGamesPlatformAdapter.ts';
    export { PlatformManager } from './packages/engine/src/platforms/PlatformManager.ts';
    export { PlatformStorageAdapter } from './packages/engine/src/configs/services/PlatformStorageAdapter.ts';`,
  resolveDir: process.cwd(), loader: 'ts' },
  tsconfig: 'packages/engine/tsconfig.json', bundle: true, platform: 'node', format: 'esm', write: false,
  define: { 'import.meta.env.VITE_PLATFORM': '"crazygames"' },
});
const { CrazyGamesPlatformAdapter, PlatformManager, PlatformStorageAdapter } = await import(
  'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));

function fixture(environment = 'crazygames', initialize = async () => {}) {
  const calls = [], settings = { muteAudio: false }, listeners = new Set(), values = new Map();
  let callbacks;
  const sdk = { environment, init: async () => { calls.push('init'); await initialize(); },
    game: { settings, loadingStart: () => calls.push('loadingStart'), loadingStop: () => calls.push('loadingStop'),
      gameplayStart: () => calls.push('start'), gameplayStop: () => calls.push('stop'), happytime: () => calls.push('happy'),
      reportGameCompletedPercentage: value => calls.push(['completion', value]),
      setGameContext: value => calls.push(['context', value]), clearGameContext: () => calls.push('clearContext'),
      addSettingsChangeListener: fn => listeners.add(fn), removeSettingsChangeListener: fn => listeners.delete(fn) },
    user: { systemInfo: { locale: 'pt-BR' } },
    data: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    ad: { requestAd(type, value) { calls.push(['ad', type]); callbacks = value; } },
  };
  globalThis.window = { CrazyGames: { SDK: sdk } };
  const mute = [], pause = [];
  const adapter = new CrazyGamesPlatformAdapter();
  const platform = new PlatformManager({ adapter, runtimeHooks: { onAudioMuteChanged: value => mute.push(value) },
    adBreakHooks: { onAdBreakStart: () => pause.push(true), onAdBreakEnd: () => pause.push(false) } });
  return { sdk, adapter, platform, calls, mute, pause, values, listeners, callbacks: () => callbacks,
    settings(value) { settings.muteAudio = value; for (const fn of listeners) fn(settings); } };
}

try {
  let release;
  const f = fixture('crazygames', () => new Promise(resolve => { release = resolve; }));
  const initializing = f.platform.init();
  const again = f.platform.init();
  assert.deepEqual(f.calls, ['init']);
  assert.equal(f.platform.isAdvertisingAvailable(), false);
  release(); await Promise.all([initializing, again]);
  f.platform.loadingFinished(); f.platform.loadingFinished();
  assert.deepEqual(f.calls, ['init', 'loadingStart', 'loadingStop']);
  assert.equal(f.listeners.size, 1);
  assert.equal(f.platform.getPreferredLocale(), 'pt-BR');
  assert.equal(f.platform.shouldMuteAudioOnAdRequest(), false);
  f.platform.gameplayStart(); f.platform.gameplayStart(); f.platform.gameplayStop(); f.platform.gameplayStop();
  assert.deepEqual(f.calls.slice(-2), ['start', 'stop']);
  f.platform.reportGameCompletedPercentage(100); f.platform.setGameContext({ level: 3 }); f.platform.clearGameContext();
  assert.throws(() => f.platform.reportGameCompletedPercentage(101), RangeError);
  f.platform.happytime(); assert.equal(f.calls.at(-1), 'happy');

  // Platform data is authoritative: a cloud miss must never resurrect a browser save.
  globalThis.localStorage = { getItem() { throw Error('Browser fallback touched'); },
    setItem() { throw Error('Browser fallback touched'); }, removeItem() { throw Error('Browser fallback touched'); } };
  const storage = new PlatformStorageAdapter(f.platform);
  assert.equal(storage.getItem('campaign'), null);
  storage.setItem('campaign', 'cloud'); assert.equal(storage.getItem('campaign'), 'cloud');
  storage.removeItem('campaign'); assert.equal(storage.getItem('campaign'), null);
  f.sdk.data.setItem = () => { throw Error('dataModuleDisabled'); };
  assert.throws(() => storage.setItem('campaign', 'new'), /dataModuleDisabled/);

  const reward = f.platform.rewardedBreak();
  assert.deepEqual(f.pause, [true]); assert.equal(f.mute.at(-1), false, 'Auction must not mute music');
  const callback = f.callbacks();
  f.settings(true); callback.adStarted(); f.settings(false);
  assert.equal(f.mute.at(-1), true, 'Active ad must stay muted despite a settings change');
  const duplicate = f.platform.rewardedBreak(); assert.deepEqual(await duplicate, { success: false });
  callback.adFinished(); callback.adFinished();
  assert.deepEqual(await reward, { success: true });
  assert.equal(f.mute.at(-1), false); assert.equal(f.pause.at(-1), false);
  const failed = f.platform.rewardedBreak(); f.callbacks().adError({ code: 'noAdAvailable' });
  assert.deepEqual(await failed, { success: false });
  f.settings(true);
  const pending = f.platform.rewardedBreak(); const late = f.callbacks(); late.adStarted();
  late.adFinished(); assert.deepEqual(await pending, { success: true });
  assert.equal(f.mute.at(-1), true, 'Ad completion must preserve platform mute');
  const cancelled = f.platform.rewardedBreak(); const afterDispose = f.callbacks();
  f.platform.dispose(); f.platform.dispose();
  assert.deepEqual(await cancelled, { success: false }); afterDispose.adFinished();
  assert.equal(f.listeners.size, 0);

  for (const environment of ['local', 'disabled']) {
    const value = fixture(environment); await value.platform.init();
    assert.equal(value.platform.isAdvertisingAvailable(), environment === 'local');
    if (environment === 'disabled') {
      assert.deepEqual(await value.platform.rewardedBreak(), { success: false });
      assert.equal(value.platform.getDataStorageBackend(), null);
      assert.equal(value.listeners.size, 0);
    }
    value.platform.dispose();
  }
  const broken = fixture('crazygames', async () => { throw Error('blocked'); });
  await broken.platform.init(); assert.equal(broken.platform.isAdvertisingAvailable(), false); broken.platform.dispose();
  let finishInit;
  const disposed = fixture('crazygames', () => new Promise(resolve => { finishInit = resolve; }));
  const start = disposed.platform.init(); disposed.platform.dispose(); finishInit(); await start;
  assert.equal(disposed.listeners.size, 0); assert(!disposed.calls.includes('loadingStart'));

  delete globalThis.window;
  const missing = PlatformManager.createFromEnvironment(); await missing.init();
  assert.deepEqual(await missing.rewardedBreak(), { success: false }); missing.dispose();
  const browser = new Map();
  globalThis.localStorage = { getItem: key => browser.get(key) ?? null, setItem: (key, value) => browser.set(key, value), removeItem: key => browser.delete(key) };
  const fallback = new PlatformStorageAdapter(missing); fallback.setItem('web', 'save');
  assert.equal(fallback.getItem('web'), 'save'); fallback.removeItem('web'); assert.equal(browser.size, 0);
  console.log('CrazyGames: init/loading, disabled/missing SDK, gameplay, locale, context/completion, authoritative Data Module, auction/playback mute, rewards/errors/duplicates and disposal passed. Simulated SDK; no live portal ads used.');
} finally { delete globalThis.window; delete globalThis.localStorage; }
