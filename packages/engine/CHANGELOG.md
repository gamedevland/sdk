# Changelog

## 0.0.9 — 2026-11-05

- Add opt-in `screen.dpr: 'native'` to target the viewport's physical pixels.
- Add `screen.render.maxCanvasPixels` to limit the backing canvas area.
- Apply size and resolution in one renderer resize. Existing numeric and `'auto'` DPR defaults stay the same.

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

- Expose runtime activity and native pointer metadata.
- Dispose spawned prefab logical children idempotently and release their registry entries.

## 0.0.5

- Prepare automated npm publishing.

## 0.0.4

- Update package homepage and issue-tracker metadata.

## 0.0.3

- Update repository metadata.

## 0.0.2

- Add drag-end reasons and renderer-independent local node bounds.
