# @gamedevland/vite

## Changelog

**0.2.1 — 2026-11-07**

- Add Playgama Bridge v2 script injection and use engine 0.0.12.
- Keep `gamedevland create` for blank projects, with dependency installation and web/CrazyGames builds.

[Full changelog](https://github.com/gamedevland/sdk/blob/main/packages/vite/CHANGELOG.md).

## Create a blank game

```sh
npx --yes --package @gamedevland/vite@0.2.1 gamedevland create my-game
cd my-game
npm run dev
```

When installed locally, run `npx gamedevland create my-game`. The CLI generates a
strict TypeScript/PixiJS project with an empty FSM scene, scene/global DI, JSON
layout and audio config, and web/CrazyGames build scripts. Dependencies are installed
by default. `--no-install` skips installation; `--name my-game` sets the npm name
when the destination directory has a different name. New or empty directories only;
nonempty directories and symlink destinations are rejected without overwriting files.

Vite build tooling for HTML5 games built with `@gamedevland/engine`.

## Install

```bash
npm install @gamedevland/engine @gamedevland/vite
```

Vite 7 or 8 must be installed in the game project.

## Usage

```ts
import { fileURLToPath } from 'node:url';
import { createGameViteConfig } from '@gamedevland/vite';

export default ({ mode }: { readonly mode: string }) =>
  createGameViteConfig({
    mode,
    repoRoot: fileURLToPath(new URL('.', import.meta.url)),
  });
```

The package provides the shared Gamedev Land platform configuration, development proxy setup,
environment resolution, and platform SDK injection used by engine-based game projects.

## Playgama builds

```bash
VITE_PLATFORM=playgama vite build --outDir ../dist/playgama
```

Put `playgama-bridge-config.json` in `game/public/` (minimal config: `{}`). Vite
copies it next to `index.html` and injects the official Bridge v2 script before the
game. Bridge detects the host portal; existing direct portal targets remain available.
See [Bridge setup](https://wiki.playgama.com/playgama/bridge-sdk/setup) and the
[engine integration guide](../engine/README.md#playgama-bridge-v2).

## Shared Poki tools (Node.js 20.19+)

The package also installs the `gamedevland` executable. No game-local upload or ZIP script is needed.
The CLI uses the project's `poki.json`; it never assumes a particular game name, asset format, font or directory layout.

```json
{
  "game_id": "your-poki-game-uuid",
  "build_dir": "dist/poki",
  "tooling": {
    "checks": ["typecheck", "lint", "test:poki"],
    "buildScript": "compile:poki",
    "archive": "dist/my-game-poki.zip"
  }
}
```

```json
{
  "scripts": {
    "compile:poki": "VITE_PLATFORM=poki vite build --outDir ../dist/poki",
    "build:poki": "npm run compile:poki && gamedevland poki pack",
    "poki:upload": "gamedevland poki upload"
  }
}
```

```bash
npm run build:poki
npm run poki:upload -- --name "Production v1" --notes "Release notes"
npx gamedevland poki pack --root /path/to/another-game
```

`pack` validates an existing build and creates a ZIP with `index.html` at the root. It checks the
official SDK script and local HTML dependencies. Hidden/private files, source maps, TypeScript sources,
symlinks and nested archives are rejected. PNG, WAV, SVG, WebP and other game asset formats are allowed.
Game-specific asset/license budgets remain project tests. ZIP metadata uses a fixed timestamp for reproducibility.

`upload` validates all configured npm scripts, resolves authentication, runs checks followed by a fresh build,
packages it, and invokes `@poki/cli`. It preserves optimized images and does not request public release/review.
Only a confirmed success response for the configured game and matching Preview/Inspector version counts as success;
the official CLI's zero exit code alone is insufficient. Temporary upload archives are kept outside the project and cleaned.
A receipt `poki-upload.json` next to the local ZIP records game/version IDs, URLs, source revision/dirty state and local ZIP SHA-256.

Defaults: `checks` is `["typecheck", "lint"]`, `buildScript` is `build:poki`, and `archive` is
`artifacts/poki/<package-name>.zip`. Add the output directory to `.gitignore`. For projects without these checks,
explicitly configure the appropriate list (including `[]` when intentional). Paths must stay inside the project,
and the ZIP must be outside `build_dir` to prevent recursive uploads. `--root` defaults to the current directory.
Version names default to the git revision plus UTC timestamp; git is optional.

### Authentication

CI can set `POKI_UPLOAD_TOKEN`. For local repeated uploads, store the game's token (plain text, no shell command)
in `$XDG_CONFIG_HOME/poki/game-upload-tokens/<game_id>` or `~/.config/poki/game-upload-tokens/<game_id>`.
On POSIX systems, the token file must have permissions `0600`.
Never put credentials in `poki.json`, package metadata or the build. Tokens are passed only to the upload process,
removed from check/build environments, masked in CLI output and checked against all files being packaged.

See the [official Poki CLI](https://github.com/poki/poki-cli). The browser runtime SDK remains separate from these Node.js tools.

## License

MIT. See [LICENSE](./LICENSE). Source code and contributions: [gamedevland/sdk](https://github.com/gamedevland/sdk).

Earlier npm releases retain the license included in their respective archives. Third-party dependencies retain their own licenses.


## Renderer SDK compatibility

Tooling `0.2.2` uses engine `0.0.13` as a peer dependency. The packaged project
selects PixiRendererModule explicitly and uses the public renderer entry point.

The upstream Poki CLI currently depends on an older glob chain. Keep this
root-package override when installing this tooling into an existing project
(the generated template already includes it):

```json
{"overrides": {"archiver-utils": {"glob": "14.0.2"}}}
```

SDK validation exercises archive generation with that override. Overrides belong
to the consuming root package; dependency package overrides are not inherited.
