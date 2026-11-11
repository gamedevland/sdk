# Rings 3D: declarative Three viewport validation

Checked on 2026-11-11 with engine 0.0.14 and tooling 0.2.3.
Consumer source: `bolotnikov/rings-3d`, commit `93fcd0b55e875707a52d1e9d86f5879f6ffc8cae`.

## Migration

The boot display and game board now use `ThreeViewport` elements. Their isolated
Three layouts declare cameras, lights and content groups. Game components retain
ownership of dynamic ring transforms, model leases, materials, raycasting and
camera framing; they invalidate the viewport after visual changes. The SDK owns
embedded layout preparation, the offscreen surface, presentation and cleanup.

The consumer also resolves persistence through `SystemServices.PersistentStorage`.
The release carries forward the passive pointer observations and lost-capture
cleanup already required by Rings' previous integration tarball.

## Validation

- Consumer typecheck, lint, domain tests, web production build and Poki build/archive passed.
  Poki upload was not performed; the deployment workflow now requires an explicit
  manual `deploy_poki: true` input and defaults to false.
- All 100 campaign certificates passed physical replay and assisted release, with
  every level executed instead of using cached receipts.
- Real Chrome WebGL checks covered the boot animation, desktop and portrait layouts,
  actual pointer orbit and ring dragging, settings, two-touch cleanup, checkpoint
  reload and rendering levels 1, 10, 50 and 100.
- The same gameplay checks passed against the minified production web build.
  Completing level 1 showed the result, awarded 20 coins and advanced to level 2
  while reusing the same viewport.
  Test instrumentation exposed an engine handle only in intercepted browser
  responses; no testing globals were added to shipped source.
- A stationary board caused no texture upload. Engine disposal removed the visible
  canvas and all presentation subscriptions. No JavaScript errors were recorded.
- The real GPU canvas-upload regression measured zero RGB overshoot for opaque and
  faded edges, at sprite alpha 1 and 0.35.
- SDK validation included build/typecheck, architecture lint, engine/tooling tests,
  embedded texture/viewport and pointer lifecycle scenarios, renderer contracts,
  stability, cleanup, screen sizing, audio, locales, platform integrations,
  archive dependencies and a packed blank-project installation/build.

The browser scope is Chrome on the local machine, rather than all browsers/devices.
Rings stores its detailed evidence in `docs/qa/3d/declarative-viewport.json`.

## Public deployment

The Rings validation and web deployment workflow succeeded. Its Poki deployment job
was skipped. The public Pages deployment succeeded, and an anonymous check verified
all 230 files against `build-info.json`, including source revision
`93fcd0b55e875707a52d1e9d86f5879f6ffc8cae`. The GameDev.Land game page embeds this build.
