# Changelog

## 0.0.8 — 2026-11-04

- Publish the SDK source and package under MIT with public repository metadata.
- Preserve the consumer Vite platform define in the compiled runtime.
- Signal loading completion after initial scene entry; support explicit completion for loading scenes.
- Add `AssetManager.loadRequiredBundle()` for mandatory bundle validation.
- Route unpressed mouse hover through the public input events.
- Release audio listeners and owned displacement filters on terminal lifecycle paths.
- Make particle component cleanup tolerate earlier scene subtree disposal.
- Keep GameDistribution video pause/resume under engine ownership and stop the loading watchdog
  after a video starts; ignore stale request continuations.

## 0.0.7

- Dispose spawned prefab logical children idempotently and release their registry entries.
