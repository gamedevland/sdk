# @gamedevland/engine

## Renderer modules

The main SDK supports Pixi, Three and a Three world with a Pixi UI overlay.
Engine `0.0.13` and tooling `0.2.2` publish these renderer modules.
Run `npm run pack:local` in the SDK workspace for compiled tarballs, checksums
and installation instructions.

This version changes renderer-facing public APIs. Existing Pixi games need the
migration in [MIGRATION_RENDERERS.md](MIGRATION_RENDERERS.md) before upgrading.
Runtime ownership, storage and optional physics changes are described in
[MIGRATION_RUNTIME.md](MIGRATION_RUNTIME.md).
Pinned older SDK packages continue to work independently of this source checkout.

A game selects one renderer composition:

```ts
import { ThreeRendererModule } from '@gamedevland/engine/renderers/three';
// Or PixiRendererModule from /renderers/pixi.
// Or HybridRendererModule from /renderers/hybrid for a Three world and Pixi UI.
// Or PixiThreeTextureRendererModule from /renderers/hybrid for component-owned Three textures in Pixi.
```

The Three module accepts a decoded quality profile, for example
`new ThreeRendererModule({shadows: true, toneMapping: 'neutral', exposure: 1})`.
Keep those authored values in consumer JSON. Model props opt into `castShadow` /
`receiveShadow`; directional lights opt into `castShadow` and may configure
`shadowMapSize`, `shadowBounds`, `shadowBias` and `shadowNormalBias`. Shadows are
off by default, preserving the original lab behavior. The profile never exposes
the native renderer to game services.

Set `system.renderer: new ThreeRendererModule()` in its `GameConfig`. The module
registers backend providers and standard node factories in the existing DI
container before rendering starts. `system` and its renderer selection are
required. There is no implicit Pixi fallback or runtime backend switching.

Common subsystem entry points have separate JS and declaration files. `pixi.js`
and `three` are optional peers: install only the selected graphics library (and
`@types/three` for TypeScript Three consumers). Particle-emitter and Matter runtime
code is bundled only into Pixi-specific chunks, rather than installed as a shared
mandatory dependency. The build tooling uses the same local engine version. Particle presets expose the
engine-owned decoded JSON contract rather than third-party emitter types.

### Node and layout APIs

- `/layouts` exports the neutral `NodeBase`, `BaseComponent<TNode>`,
  `BaseTypedComponent<TConfig, TNode>`, `BaseAction<TNode>`, and
  `BaseTypedAction<TConfig, TInput, TNode>`.
- Concrete Pixi node imports move to `/renderers/pixi`. Pixi components declare
  `protected readonly nodeType = PixiNode` (or a narrower concrete class).
- Three components use `ThreeNode` / `ThreeGroup` from `/renderers/three` and
  declare the corresponding `nodeType`. Binding validates that class before
  calling user initialization hooks. Native view changes belong in these
  components/actions, not domain services.
- `layout.getNode(id)` returns a neutral node. Use
  `layout.requireNode(id, ThreeNode)` for checked typed access. IDs use dots,
  for example `root.camera` and `root.spawnArea.ore`.
- Three layouts retain `type`, `props`, `children`, `components`, and `actions`.
  The common envelope has generic props; the selected renderer decodes its own
  properties. Three props are strict and reject unknown fields.
- Standard Three types: `Group`, `Mesh`, `Model`, `OrthographicCamera`,
  `PerspectiveCamera`, `AmbientLight`, `DirectionalLight`. Only `Group` owns
  authored children. Imported model descendants remain inside their owner node.
- Scene config must name the active Three camera with
  `render: { camera: 'root.camera' }`. Camera props include `lookAt`, `near`,
  `far`, plus orthographic `height` or perspective `fov`.
- Three transforms use `{x, y, z}`, Y-up, XZ ground, XYZ Euler radians, and metres.
  Pixi keeps its existing 2D pixel/percentage properties.
- Sibling `extends` merges props and behavior maps before creation, rejects
  cycles/type changes, and recursively resolves children. Existing `$include`
  expansion runs before layout construction.
- `Group`/`Container.spawnPrefab()` creates strictly;
  `ensureChildFromPrefab()` shares concurrent work and returns `created: false`
  to subsequent callers. A disposed parent's pending spawn cannot attach later.
- `ThreeNode.moveTo(position, seconds)` targets the native position vector.
  Components/actions should own the returned tween with `ownTween()`.

### Assets and lifecycle

Pixi includes the leaf `NineSliceSprite` node. Its required props are `asset`,
`leftWidth`, `rightWidth`, `topHeight` and `bottomHeight`; the borders must leave
an interior region. Standard `width`, `height`, `scale` and `anchor` props apply.

After component readiness, `BaseScene` awaits renderer shader/texture warmup
before starting its FSM. Disposal releases scene services, node behavior, native
views, renderer caches and assets, collecting cleanup errors without skipping peers.


Add model URLs with `AssetManifestBuilder({ ..., models: modelUrls })` and preload
`models` before constructing `Model` nodes. A Model's `props.asset` names its
path-relative GLB ID. MVP accepts self-contained static GLB 2.0 without required
extensions, animation, or skinning. Each instance gets an independent hierarchy;
geometry/materials/textures remain asset-owned until all instances release them.

`Engine.run()` returns the engine handle. `await engine.destroy()` stops frame
updates, exits scenes, detaches input/audio/platform listeners, disposes assets,
releases the backend and removes its canvas. Repeated destruction is safe.
There is one engine-owned frame driver; update deltas and tween durations use
seconds. JSON actions may expose explicit millisecond fields and convert them
at their boundary. Layouts update each component once per frame.

Three input raycasts the nearest visible registered interactive node using the
active camera. Native descendants resolve to their owning Model node. Equal
distances keep registration order; non-interactive geometry does not block
interactive targets. Runtime pause invalidates gestures and gates input.

Hybrid mode owns two independent WebGL canvases, ordered world then UI, one
frame driver and UI-first hit testing. Author Three and Pixi subtrees as separate
layout roots; native children cannot cross renderer boundaries. The input canvas
is the transparent Pixi overlay. There is no runtime renderer replacement.

3D physics/particles, skeletal animation, compression and postprocessing remain
outside this package. Games can supply scene-owned physics extensions. See `examples/pixi-smoke` in the SDK workspace and the
`three-game` consumer for working examples.

Run `npm run test:stability`, `npm test -w @gamedevland/engine` and `npm run test:renderers` for deterministic boundary/lifecycle checks and
`npm run test:local-package` after packaging for clean core/Three/Pixi consumers.
Those do not replace real browser or device QA.


Open-source TypeScript HTML5 game engine SDK for Gamedev Land projects.

The npm package intentionally ships a compact public distribution:

- `dist/sdk.js` and subsystem/renderer entries - split ESM runtime
- `dist/types/**` - declarations with independent renderer import graphs
- `README.md`, `LICENSE`, and `package.json`

Source files are available in [the SDK repository](https://github.com/gamedevland/sdk/tree/main/packages/engine/src); the npm archive contains the compiled distribution.

## Changelog

**0.0.12 — 2026-11-07**

- Add Playgama Bridge v2: lifecycle, ads, language, host pause/audio and saved progress.
- Keep existing platform APIs; select the adapter with `VITE_PLATFORM=playgama`.

[Full engine changelog](https://github.com/gamedevland/sdk/blob/main/packages/engine/CHANGELOG.md).

## Install

```bash
npm install ./vendor/gamedevland-engine-<local-build>.tgz
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

Public entry points resolve to independent compiled entries. Renderer-specific exports stay in their renderer module.

For `dragend` input events, `InputEventBase.dragEndReason` distinguishes a normal pointer release
(`pointerup`) from a system cancellation (`pointercancel`).

Pixi nodes expose `getLocalBounds()` for local 2D geometry queries. Three uses world transforms and camera raycasting.

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

`audio.stopByHandle(handle)` is idempotent: it stops active playback and does nothing
for a naturally completed, failed, muted, stopped or disposed playback. Other
handle operations remain strict. Stopping remembered music also cancels its recovery request.

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

The package provides `dist/types/index.d.ts` and is designed for TypeScript consumers using modern ESM tooling.

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

The experimental package is also checked with `skipLibCheck: false` in clean core, Pixi-only and Three-only consumers.

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

Visible embedded games do not pause on keyboard focus loss. Runtime page inactivity follows
`visibilitychange` and `pagehide`/`pageshow`; manual, platform and ad pause reasons remain independent.

Scene hook deadlines count visible-page time. Pixi prepares hidden resources in bounded timer batches,
without relying on animation frames; renderer warmup rejects on cleanup or WebGL context loss.
Lifecycle diagnostics include the current backend preparation stage.
