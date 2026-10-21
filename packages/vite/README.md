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

This package is public but not open source. See [LICENSE](./LICENSE).
