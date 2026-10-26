# Gamedev Land SDK

Open-source TypeScript tools for building HTML5 games with PixiJS and Vite.

| Package | Purpose | Documentation |
| --- | --- | --- |
| [`@gamedevland/engine`](https://www.npmjs.com/package/@gamedevland/engine) | Game runtime: scenes, assets, layouts, input, DI, FSM, audio, physics, particles and platform integration | [Engine README](packages/engine/README.md) |
| [`@gamedevland/vite`](https://www.npmjs.com/package/@gamedevland/vite) | Vite configuration, platform SDK injection and Poki packaging/upload CLI | [Vite README](packages/vite/README.md) |

The engine keeps reusable infrastructure separate from game rules. Scenes coordinate lifecycle,
commands execute use cases, scene services own runtime state, and components/actions own node behavior.
JSON layouts and prefabs describe the visual hierarchy. Public subsystem entry points support imports
such as `@gamedevland/engine/assets` and `@gamedevland/engine/scenes`.

## Install

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
