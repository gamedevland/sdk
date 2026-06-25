# @gamedevland/vite

Vite build tooling for HTML5 games built with `@gamedevland/engine`.

## Install

```bash
npm install @gamedevland/engine @gamedevland/vite
```

Vite 7 or 8 must be installed in the game project.

## Usage

```ts
import { createGameViteConfig } from '@gamedevland/vite';

export default ({ mode }: { readonly mode: string }) =>
  createGameViteConfig({
    mode,
    repoRoot: __dirname,
  });
```

The package provides the shared Gamedev Land platform configuration, development proxy setup,
environment resolution, and platform SDK injection used by engine-based game projects.

## License

This package is public but not open source. See [LICENSE](./LICENSE).
