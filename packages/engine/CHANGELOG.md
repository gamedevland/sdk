# Changelog

## 0.0.13-rings-texture.3 — 2026-11-10

- Make `AudioManager.stopByHandle` idempotent for completed and inactive playback handles.
- Cover natural completion, playback/load failures, SFX mute, stop-all, disposal and stale handles beside a new playback.

## 0.0.13-hybrid.2 — 2026-11-10

- Add explicit Pixi, Three and hybrid modules with separate runtime/declaration graphs.
- Add static GLB leases, strict Three props, nine-slice Pixi UI, renderer warmup and one frame clock.
- Fix partial service entry rollback, failure-tolerant node cleanup, observed async events,
  singleton override caching, concurrent engine lifecycle, prefab property context and stale camera cleanup.
- Release renderer-owned texture/shadow resources during teardown.
- Breaking renderer-facing API migration: see MIGRATION_RENDERERS.md.


## 0.0.12 — 2026-11-07

- Add Playgama Bridge v2: lifecycle signals, locale, host pause/audio, interstitial and rewarded ads.
- Restore validated Bridge saves before initialization completes and serialize cached writes.
- Guard concurrent ads, loading timeouts and disposal; add lifecycle, storage and ad regression checks.

## 0.0.11 — 2026-11-07

- Complete the existing CrazyGames v3 integration with system locale hints,
  game completion percentage and feedback context through optional platform capabilities.
- Add `PlatformStorageAdapter` for exclusive platform-owned data access, with lazy browser
  storage only when no platform backend exists. Cloud misses/errors never resurrect local saves.
- Separate ad request pause from audio muting: CrazyGames keeps music playing during the
  auction and mutes on `adStarted`, preserving portal/user/background mute gates on completion.
- Guard concurrent requests, resolve pending ads on disposal, ignore late callbacks,
  clean up settings listeners, and prevent post-disposal asynchronous initialization.
- Expose advertising availability and validate completion percentages. Existing adapters
  retain their previous request-time mute behavior and remain source compatible.
- Add deterministic CrazyGames lifecycle, Data Module, locale, ad and disposal checks.

## 0.0.10 — 2026-11-07

### Localization and text

- Expand `LocaleCatalog` with Spanish, Brazilian Portuguese, German, French, Italian,
  Turkish, Simplified Chinese, Japanese, and Korean, including regional-code normalization.
- Add `LocalesService.initialize()` with an explicit supported subset and default language.
  Resolve saved manual preferences before device/platform hints, browser preferences, and
  the configured default. Automatic detection does not write a manual preference.
- Persist explicit `setLang()` choices when storage is configured, tolerate unavailable
  browser storage, and expose locale revisions and disposable change subscriptions.
- Preserve the English/Russian default subset for existing consumers and support partial
  locale-specific text-style maps.
- Add measured `Text.fitTo(width, height?)` font fitting without changing node transforms,
  including proportional line-height adjustment and validation of fitting bounds.

### Audio

- Attempt music autoplay and recover blocked playback on the first trusted canvas
  pointer/touch interaction or eligible keyboard interaction. Engine-owned capture listeners
  run before scene input, work during boot, and are removed on audio disposal.
- Retry Web Audio resume on each user gesture even if an earlier automatic attempt remains
  pending. Verify context state and handle rejected resume attempts and unavailable audio.
- Retain blocked HTML media music requests and reuse their sound IDs on native activation
  or Howler unlock. Report confirmed playback separately from pending handles.
- Deduplicate active/loading music in both `AudioManager` and the default backend. Repeated
  requests and scene changes preserve the handle and playback position; replacing a pending
  track cancels its old Howler queue to prevent stale stops and orphaned playback.
- Preserve manual pause/stop, music/SFX preferences, channel/platform/background mute gates,
  and terminal listener cleanup. Drop blocked one-shot SFX rather than replaying a backlog.
- Add optional `AudioBackend.isHandlePlaying()` and `isPlaybackReady()` hooks; existing
  custom backends remain compatible.
- Reject unknown `channel.*` keys in the existing `system.audio.volumeConfigId` JSON contract.
  Document centrally editable music/SFX channel and per-asset volumes in engine guidelines.

### Verification

- Add deterministic locale preference/text fitting and browser audio activation regressions,
  plus tests using real Howler queue/event code with a simulated HTML media device.
- Run these checks in the npm publishing workflow. Simulated browser/media tests do not
  constitute physical iOS/Android or portal-device verification.

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
