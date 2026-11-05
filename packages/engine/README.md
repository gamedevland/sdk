# @gamedevland/engine

Open-source TypeScript HTML5 game engine SDK for Gamedev Land projects.

The npm package intentionally ships a compact public distribution:

- `dist/sdk.js` - bundled and minified ESM runtime
- `dist/sdk.d.ts` - bundled TypeScript declarations
- `README.md`, `LICENSE`, and `package.json`

Source files are available in [the SDK repository](https://github.com/gamedevland/sdk/tree/main/packages/engine/src); the npm archive contains the compiled distribution.

## Changelog

**0.0.9** adds opt-in viewport-native rendering and a configurable canvas pixel
budget. Existing DPR defaults stay the same.
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
