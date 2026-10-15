# @gamedevland/engine

Compiled HTML5 game engine SDK for Gamedev Land projects.

The npm package intentionally ships a compact public distribution:

- `dist/sdk.js` - bundled and minified ESM runtime
- `dist/sdk.d.ts` - bundled TypeScript declarations
- `README.md`, `LICENSE`, and `package.json`

Source files are not included in the published package.

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

## TypeScript

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

This package is public but not open source. See [LICENSE](./LICENSE).
