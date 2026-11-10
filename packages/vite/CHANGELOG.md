# Changelog

## 0.2.2 — 2026-11-10

- Generate projects with explicit Pixi renderer setup and public renderer imports.
- Declare engine 0.0.13 as a peer to avoid duplicate engine copies.
- Resolve scaffold engine versions from that peer contract; fix template regression checks.
- Update template archive dependencies to remove the vulnerable legacy glob chain.

## 0.2.1 — 2026-11-07

- Support `VITE_PLATFORM=playgama` and inject the official Playgama Bridge v2 script.
- Use engine 0.0.12 for generated projects; verify SDK ordering and Bridge config copying.

## 0.2.0 — 2026-11-07

- Add `gamedevland create <directory>` to generate a blank SDK consumer project and install
  its dependencies, with `--no-install` for offline/custom installation and `--name` for
  an explicit npm package name.
- Ship the template inside the npm package: strict TypeScript, Vite, ESLint, an empty
  FSM scene with DI/layout registration, manifest-based JSON assets, and audio volume config.
- Include web and CrazyGames development/build scripts with relative asset paths.
- Reject nonempty destinations, symlink destinations and invalid names; never overwrite
  existing project files. Invoke dependency installation without interpolating user paths.
- Update the engine dependency to 0.0.11 and test generated project structure and CLI behavior.

## 0.1.2 — 2026-11-04

- Release the package and its source under MIT.
- Add public source, issue tracker and package-directory metadata.
- Depend on the MIT-licensed engine 0.0.8 release.
- Make the README configuration example work in native ESM.

## 0.1.1 (withdrawn)

- Publication withdrawn; this version must not be reused.

## 0.1.0

- Add the `gamedevland poki pack` and `gamedevland poki upload` CLI commands.
- Configure game ID, build directory, npm checks/build task and archive path in `poki.json`.
- Package deterministic ZIPs without platform-specific shell utilities or game-specific asset assumptions.
- Use the official pinned Poki CLI, per-game private credentials or `POKI_UPLOAD_TOKEN`, and verified upload receipts.
- Keep authentication out of check/build subprocesses and reject source maps, private files, symlinks and leaked upload tokens in build output.
- Preserve existing Vite configuration exports and browser SDK injection.

## 0.0.4

- Update the engine dependency to 0.0.5.

## 0.0.3

- Update package links and the engine dependency to 0.0.4.

## 0.0.2

- Update repository metadata and the engine dependency to 0.0.3.

## 0.0.1

- First npm release of the Vite tooling.
