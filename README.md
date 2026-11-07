# Gamedev Land SDK

Open-source TypeScript tools for building HTML5 games with PixiJS and Vite.

Read the [GameDevLand SDK documentation](https://gamedev.land/academy/sdk/).

| Package | Purpose | Documentation |
| --- | --- | --- |
| [`@gamedevland/engine`](https://www.npmjs.com/package/@gamedevland/engine) | Game runtime: scenes, assets, layouts, input, DI, FSM, audio, physics, particles and platform integration | [Engine README](packages/engine/README.md) |
| [`@gamedevland/vite`](https://www.npmjs.com/package/@gamedevland/vite) | Vite configuration, platform SDK injection and Poki packaging/upload CLI | [Vite README](packages/vite/README.md) |

The engine keeps reusable infrastructure separate from game rules. Scenes coordinate lifecycle,
commands execute use cases, scene services own runtime state, and components/actions own node behavior.
JSON layouts and prefabs describe the visual hierarchy. Public subsystem entry points support imports
such as `@gamedevland/engine/assets` and `@gamedevland/engine/scenes`.

## Changelog

| Date | Package | Version | Summary |
| --- | --- | --- | --- |
| 2026-11-07 | Engine | [0.0.12](packages/engine/CHANGELOG.md#0012--2026-11-07) | Add Playgama Bridge v2: ads, saves, lifecycle and host pause/audio. |
| 2026-11-07 | Vite | [0.2.1](packages/vite/CHANGELOG.md#021--2026-11-07) | Add Playgama builds; generated projects use engine 0.0.12. |
| 2026-11-07 | Engine | [0.0.11](packages/engine/CHANGELOG.md#0011--2026-11-07) | Complete CrazyGames data and lifecycle integration. |
| 2026-11-07 | Vite | [0.2.0](packages/vite/CHANGELOG.md#020--2026-11-07) | Add `gamedevland create` for blank SDK games. |
| 2026-11-07 | Engine | [0.0.10](packages/engine/CHANGELOG.md#0010--2026-11-07) | Add language preferences and text fitting; recover blocked autoplay and prevent duplicate music. |
| 2026-11-05 | Engine | [0.0.9](packages/engine/CHANGELOG.md#009--2026-11-05) | Add opt-in viewport-native rendering and a canvas pixel budget. Existing DPR defaults stay the same. |
| 2026-11-04 | Engine | [0.0.8](packages/engine/CHANGELOG.md#008--2026-11-04) | Publish under MIT and improve startup, input, and resource cleanup. |
| — | Engine | [0.0.7](packages/engine/CHANGELOG.md#007) | Add runtime activity and pointer metadata, and make prefab cleanup idempotent. |
| — | Engine | [0.0.5](packages/engine/CHANGELOG.md#005) | Prepare automated npm publishing. |
| — | Engine | [0.0.4](packages/engine/CHANGELOG.md#004) | Update package links. |
| — | Engine | [0.0.3](packages/engine/CHANGELOG.md#003) | Update repository metadata. |
| — | Engine | [0.0.2](packages/engine/CHANGELOG.md#002) | Add drag-end reasons and local node bounds. |
| 2026-11-04 | Vite | [0.1.2](packages/vite/CHANGELOG.md#012--2026-11-04) | Publish under MIT with public source links and a native ESM configuration example. |
| — | Vite | [0.1.1](packages/vite/CHANGELOG.md#011-withdrawn) | Withdrawn from npm. |
| — | Vite | [0.1.0](packages/vite/CHANGELOG.md#010) | Add the Poki packaging and upload CLI. |
| — | Vite | [0.0.4](packages/vite/CHANGELOG.md#004) | Update the engine dependency to 0.0.5. |
| — | Vite | [0.0.3](packages/vite/CHANGELOG.md#003) | Update package links and the engine dependency. |
| — | Vite | [0.0.2](packages/vite/CHANGELOG.md#002) | Update repository metadata and the engine dependency. |
| — | Vite | [0.0.1](packages/vite/CHANGELOG.md#001) | First npm release of the Vite tooling. |

See the full [engine changelog](packages/engine/CHANGELOG.md),
[Vite changelog](packages/vite/CHANGELOG.md), and [GitHub releases](https://github.com/gamedevland/sdk/releases).

## Install

To create a blank game with dependencies installed:

```bash
npx --yes --package @gamedevland/vite@0.2.1 gamedevland create my-game
cd my-game
npm run dev
```

Use `--no-install` to generate files without installing dependencies. Existing files
are never overwritten. The template contains one empty scene, not a demo game.

Use Node.js 22.12+ or 24 and npm. Game projects use Vite 7 or 8 and modern ESM/TypeScript tooling.

```bash
npm install @gamedevland/engine @gamedevland/vite
npm install --save-dev vite typescript
```

See the package READMEs for API usage and the expected game project structure.
The SDK is pre-1.0; review release changes before updating an existing game.

## Work on the SDK

```bash
git clone https://github.com/gamedevland/sdk.git
cd sdk
npm ci
npm run build
npm run typecheck
npm test --workspace @gamedevland/vite
```

`packages/engine/src` contains the runtime and public subsystem barrels.
`packages/vite/src` contains build integration and the Node.js CLI.
The engine's npm archive includes a bundled ESM runtime and TypeScript declarations;
the complete editable source is maintained here.

## Contributing and support

Bug reports and focused pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md)
for checks and architecture conventions. Use [GitHub Issues](https://github.com/gamedevland/sdk/issues)
for reproducible bugs and feature proposals. See [SECURITY.md](SECURITY.md) for private vulnerability reports.

## License

[MIT](LICENSE), copyright 2026 Gamedev Land. The package-local LICENSE files cover each package.
Earlier npm versions retain the license included in their respective archives.
Third-party dependencies retain their own licenses.
