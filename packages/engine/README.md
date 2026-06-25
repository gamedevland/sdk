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
