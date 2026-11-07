# @gamedevland/engine

Open-source TypeScript HTML5 game engine SDK for Gamedev Land projects.

The npm package intentionally ships a compact public distribution:

- `dist/sdk.js` - bundled and minified ESM runtime
- `dist/sdk.d.ts` - bundled TypeScript declarations
- `README.md`, `LICENSE`, and `package.json`

Source files are available in [the SDK repository](https://github.com/gamedevland/sdk/tree/main/packages/engine/src); the npm archive contains the compiled distribution.

## Changelog

**0.0.12 — 2026-11-07**

- Add Playgama Bridge v2: lifecycle, ads, language, host pause/audio and saved progress.
- Keep existing platform APIs; select the adapter with `VITE_PLATFORM=playgama`.

[Full engine changelog](https://github.com/gamedevland/sdk/blob/main/packages/engine/CHANGELOG.md).

## Install

```bash
npm install @gamedevland/engine
```

## Usage

```ts
import { Engine } from '@gamedevland/engine';
import type { GameConfig } from '@gamedevland/engine';

const config = {
  // Game configuration goes here.
} satisfies GameConfig;

await Engine.run('#app', config);
```

Subsystem entry points are available for organization-friendly imports:

```ts
import { AssetManager } from '@gamedevland/engine/assets';
import { SchemaDecoder } from '@gamedevland/engine/validation';
```

All public entry points resolve to the same compiled SDK bundle, so consumers can choose the import style
that reads best in their project.

For `dragend` input events, `InputEventBase.dragEndReason` distinguishes a normal pointer release
(`pointerup`) from a system cancellation (`pointercancel`).

Layout nodes expose `getLocalBounds()` for renderer-independent local geometry queries.

## CrazyGames v3

Build with `VITE_PLATFORM=crazygames` through `@gamedevland/vite`. The official v3
script is injected before the game module. The engine awaits SDK initialization,
handles supported/disabled environments, and cleans up listeners and pending ads.

Use `system.boot.autoLoadingFinished: false` for a separate loading scene and call
`engine.platform.loadingFinished()` when required assets are ready. Report
`gameplayStart()`/`gameplayStop()` for playable states and menus, not page focus events.
`happytime()`, `reportGameCompletedPercentage(0..100)`, `setGameContext({...})` and
`clearGameContext()` forward supported signals; unsupported adapters are no-ops.
`getPreferredLocale()` returns the platform system locale when available.

Use `new PlatformStorageAdapter(engine.platform)` from the configs barrel for campaign,
settings and other synchronous key/value saves. Create/use it after platform initialization.
When CrazyGames data is available, all reads/writes/removes use that module exclusively;
neither missing cloud keys nor write errors fall back to browser saves. On web, the
adapter lazily uses localStorage. The platform owns cloud synchronization, guest data,
and account-change reloads. Enable **Yes, using the Data Module from the CrazyGames SDK**
in the Developer Portal. The module's 1 MB limit and debounce still apply.

Ads pause runtime/input from request until a terminal callback. CrazyGames audio remains
audible during the auction and mutes only on `adStarted`; portal mute settings remain
authoritative afterward. Reward success requires `adFinished`. Concurrent requests,
SDK errors and disposal cannot grant duplicate rewards. The request watchdog ends on
`adStarted` so a long real ad is not resumed prematurely. `isAdvertisingAvailable()`
describes SDK availability, not portal monetization approval; games must hide video
placements in Basic Launch, where ads are disabled.

References: [SDK initialization](https://docs.crazygames.com/sdk/intro/),
[game signals](https://docs.crazygames.com/sdk/game/),
[Data Module](https://docs.crazygames.com/sdk/data/),
[ad requirements](https://docs.crazygames.com/requirements/ads/).

Run `npm run test:crazygames` for deterministic adapter checks. These use a simulated
SDK and do not replace the CrazyGames Developer Portal QA tool or real devices.

## Playgama Bridge v2

Build with `VITE_PLATFORM=playgama` using `@gamedevland/vite`. Put
`playgama-bridge-config.json` in `game/public/` (minimal config: `{}`). The Bridge
script is injected automatically and detects the host portal.

Use `engine.platform` for `loadingFinished()`, `gameplayStart()`/`gameplayStop()`,
`happytime()`, `commercialBreak()` and `rewardedBreak()`. Reward success requires
`rewarded` then `closed`. Host events control pause and audio; startup ads are
host-owned. For a loading scene, set `system.boot.autoLoadingFinished: false` and
signal readiness when the game is playable.

Bridge saves are loaded before platform initialization completes. Configure
`system.persistence.namespace` and disable `system.persistence.localStorage.enabled`
and `system.persistence.indexedDB.enabled` to keep progress in Bridge storage.
Other synchronous save consumers can use `new PlatformStorageAdapter(engine.platform)`
after initialization. Writes are serialized; failed writes retain the memory cache
and the next mutation retries. A failed initial read does not overwrite cloud data.

See [Bridge setup](https://wiki.playgama.com/playgama/bridge-sdk/setup) and
[storage requirements](https://wiki.playgama.com/playgama/bridge-sdk/api/storage).
`npm run test:playgama` checks simulated lifecycle, ads, storage and cleanup;
real portal/device QA remains separate.

## Screen resolution

Logical landscape and portrait profiles define the game's coordinate system.
Set `system.screen.dpr: 'native'` to scale the backing canvas to the physical
pixels of the viewport, including when the game is embedded in an iframe.
For this mode, `maxDpr` caps the display density relative to CSS pixels.
Existing numeric `dpr` values and `'auto'` still multiply the logical canvas size.

Set `system.screen.render.maxCanvasPixels` to a positive integer to limit the
backing canvas area. The engine scales both axes together and preserves the
logical layout and pointer coordinates. Extremely small budgets may be exceeded
when required to keep both axes at least one pixel. This option caps the main
canvas independently of the optional `render.scaleFactor` pass.

## TypeScript

### Platform packaging and boot (0.0.8)

The packaged runtime preserves `import.meta.env.VITE_PLATFORM` for the consuming
game's Vite build. Loading completion is reported after the initial scene and its
assets are ready. Consumers remain responsible for gameplay start/stop signals.

For an initial loading scene, set `system.boot.autoLoadingFinished: false`.
Call `engine.platform.loadingFinished()` after the gameplay scene and all required
assets are ready. The default remains automatic completion after the initial scene.

`assets.loadRequiredBundle(name)` loads with the usual cache/retries and rejects
if any resource remains unavailable. Use it for mandatory loading-screen bundles;
the existing `loadBundle(name)` behavior is unchanged.

`particles.hasEmitter(handle)` reports whether scene cleanup has already released
a handle. `ParticleEmitterComponent` tolerates prior subtree cleanup on disable/detach
and recreates a removed emitter when enabled again; invalid direct manager calls still fail fast.

### Resource cleanup (0.0.8)

Audio handles release their end/stop/playerror subscriptions on every terminal path,
including explicit stop, channel stop, source unload and disposal. Loop boundaries
and pause keep subscriptions until playback actually terminates.
Displacement components destroy their owned filters on disable/detach while keeping
asset-owned textures and shared shader programs alive. No consumer API changes are required.

### Runtime activity and pointer metadata (0.0.6)

Version 0.0.7 makes spawned prefab disposal idempotent and removes the logical
child registration as well as the rendered node. Disposed local IDs can be reused
without retaining dead nodes in their parent's registry.

`SceneRuntime.activity.getSnapshot()` exposes `pageInactive`, `effectivePaused` and
the current immutable pause `reasons`. `activity.subscribe(listener)` returns a
disposer and fires whenever the reason set changes, even while the scene ticker
is paused. Read the initial snapshot explicitly after subscribing. The callback
runs before the effective pause state is applied, allowing synchronous saves.
The facade does not pause menus; consumers can pause their world simulation while
leaving panel input active. Native pointer events expose optional `button`,
`buttons`, and `isPrimary`; synthetic/wheel events may omit them.

The package provides `dist/sdk.d.ts` and is designed for TypeScript consumers using modern ESM tooling.

Recommended compiler settings:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

`skipLibCheck` is recommended because the SDK exposes Pixi.js-facing types and Pixi's transitive WebGPU
type declarations may conflict with newer TypeScript DOM library declarations in strict dependency checks.

## License

MIT. See [LICENSE](./LICENSE). Source code and contributions: [gamedevland/sdk](https://github.com/gamedevland/sdk).

Earlier npm releases retain the license included in their respective archives. Third-party dependencies retain their own licenses.

## Language preferences

`LocaleCatalog` recognizes `en`, `ru`, `es`, `pt-BR`, `de`, `fr`, `it`, `tr`,
`zh-CN`, `ja`, and `ko`, including regional browser codes. Games opt into their
own subset with `LocalesService.initialize({ supportedLocales, defaultLocale,
deviceLocale, storageKey })`. Existing games retain their English/Russian subset.
The priority is a saved manual choice, a device/platform hint, browser language
preferences, then the configured default. Initialization never persists an
automatic choice. `setLang()` persists manual choices, including selection of the
current language; unavailable browser storage does not prevent play. Dictionaries
must already be present in ConfigStore. `getRevision()` and `subscribe()` support
live UI updates; `subscribe()` returns an unsubscribe function. Text-style locale
overrides accept partial maps of supported languages.

`Text.fitTo(width, height?)` shrinks the current font to fit measured local bounds
without changing node transforms. Set the desired font, wrapping and content
before fitting; invoke it again after a language/content change.

### Autoplay and first-interaction recovery

Request music normally with `audio.playMusic(id)` when assets and player preferences
are ready. Do not wait for a scene-specific tap. Engine initialization attaches
native capture listeners to its canvas before scene input is routed. The audio
manager attempts Web Audio context resume automatically; a rejected or pending
attempt is retained for the first trusted pointer/touch interaction or keyboard
interaction while game/body has focus. Gesture retries call `resume()` before any
await, independently of any pending automatic attempt. Synthetic events, secondary
pointers/buttons, repeated/modifier key input, and hidden documents do not activate
recovery. Listeners belong to `AudioManager` and are removed by `audio.dispose()`.

The Howler backend checks the actual context state. HTML media `playerror` preserves
requested music and retries its existing sound id from native activation or Howler's
`unlock` event. Repeated taps cannot create layered music. `isMusicPlaying()` reports
confirmed playback rather than a queued handle. Stale blocked one-shot SFX are
suppressed/dropped, not replayed after unlock. User/channel disabled flags, manual
pause/stop, and platform/background mute remain authoritative.

`AudioBackend` optionally exposes `isHandlePlaying(handle)` and `isPlaybackReady()`
for precise state and one-shot suppression; existing custom backends remain compatible.
The default backend implements both. `AudioManager.attachInteractionTarget(element)`
is idempotent and is called by Engine; standalone AudioManager hosts should attach
it to their own game canvas and dispose the manager on teardown.

All authored levels belong in a manually editable JSON file selected by
`system.audio.volumeConfigId`, including `channel.music`, `channel.sfx`, and per-asset
levels. The SDK validates finite values in `[0, 1]` and rejects unknown channel keys.
Do not duplicate these values in consumer playback calls. Per-play volume options
remain available for deliberate runtime envelopes/custom backend integrations.

Run `node scripts/verify-audio-activation.mjs` from the SDK workspace to exercise the
real audio classes with simulated browser contexts/media events. These are deterministic
unit checks; they do not replace Safari/iOS/Android and embedded-portal device checks.

### Music request idempotency

Repeated `playMusic()` requests for the same active or loading track preserve its
handle and seek position. The backend independently deduplicates pending/playing
music and limits its music channel to one source. Music is engine-scoped and does
not restart when changing scenes. Source-wide stops must not be queued ahead of
an undecoded play: Howler can reuse a sound id and later stop the newer request.
Cancelling undecoded music unloads the old Howl queue and recreates a clean source.

Run `node scripts/verify-music-single-instance.mjs` to check the actual bundled
Howler queue/events against a simulated HTML media device, including cold load,
boot/main duplicates, unlock races, preserved seek, mute/unmute during decoding,
and cancellation. This supplements `verify-audio-activation.mjs`.
