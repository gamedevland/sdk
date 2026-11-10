# Validated consumer migrations

These patches target the AI Defender and Cyber UI SDK adapter snapshots reviewed
on 2026-11-10. They are reference migrations, not a generic codemod. Original
game/toolkit repositories were not modified during SDK validation.

- `cyber-ui-sdk-renderer-api.patch`: move Pixi types to the renderer entry and
  declare the action owner class. Build against the candidate engine, update the
  engine peer range to `>=0.0.13-0`, and pack a new local adapter version.
- `ai-defender-renderer-api.patch`: explicit Pixi module, renderer-owned factories,
  typed behavior owners, texture generation port, lint allowlist and updated test
  fixtures. Its atlas retains the temporary code texture until owner disposal.

Install the engine/tooling tarballs from `npm run pack:local` and the rebuilt
adapter tarball into a disposable consumer checkout. Update its package lock and
run its checks. Do not link an adapter folder containing another engine or Pixi
installation. Verify `npm ls @gamedevland/engine pixi.js` has a single runtime.
Keep the root `archiver-utils.glob` override documented by tooling.

First check with `git apply --check`. Apply the adapter patch from `packages/sdk`
and the game patch from its repository root. The three-game consumer already uses
the new renderer API; it needs the candidate engine and matching tooling.
