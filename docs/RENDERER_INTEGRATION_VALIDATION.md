# Renderer SDK integration validation

Date: 2026-11-10. Baseline: main `7148966`.
Candidate: engine `0.0.13-hybrid.2`, tooling `0.2.2-hybrid.2`.

## Scope and result

Combined uncommitted sdk-three work with the current engine implementation from
Hole Islands (`three-game/packages/engine`), including hybrid composition,
nine-slice UI, warmup, focus pause and runtime profiling. Game content and the
Cannon extension remain consumer-owned.

The candidate passes the checks below. This is evidence for those scenarios,
not a guarantee for every device or consumer. Original game repositories were
left intact. Real game validation used disposable copies of current game sources
and assets with the candidate SDK. AI Defender and Cyber UI required the explicit
source migration supplied in `migrations/`. An unchanged Pixi source tree is not
drop-in compatible with this new API.

## Corrections made during review

- Roll back partial scene-service entry in reverse order, including the failing
  partial entry; retain context while an in-flight hook settles during disposal.
- Run every component/action cleanup hook and report collected errors.
- Observe async EventBus rejection, return FSM dispatch promises to the bus, and
  report detached-command failures without abandoned rejected promises.
- Invalidate singleton override caches while preserving protected system providers.
- Reject concurrent engine init/start; stop frames and wait for lifecycle work
  before releasing resources. A stopped frame cannot render disposed resources.
- Retain prefab text-style catalogs and real parent property context; support
  prefabs under either native parent type in hybrid mode.
- Prevent stale scene cleanup from clearing another scene's Three camera.
- Release cached Pixi textures and directional shadow maps; continue cleanup when
  one hybrid backend fails.
- Treat prototype-like layout ids as authored keys during inheritance resolution.
- Support local packing from main and align distribution, templates and docs with
  explicit renderer selection and source migration.

## Automated verification

| Check | Result |
| --- | --- |
| SDK typecheck, build and local pack | Passed |
| Engine hybrid/nine-slice/pause/warmup/profiling tests | 14 passed |
| Renderer contract scenarios | 17 passed |
| Failure, rollback and concurrency scenarios | 8 passed; failures reproduced before fixes |
| Audio activation and music single-instance checks | Passed, including 18 activation scenarios |
| Locales/text fitting, CrazyGames, Playgama | Passed; portal SDKs simulated |
| Screen DPR, canvas budget, resize and pointer mapping | Passed |
| Audio/filter resource cleanup | Passed, including 300 filter cycles |
| Packed core, Three, Pixi and hybrid consumers | Strict declarations and module graphs passed |
| Packed empty template | Install, typecheck, lint, web/CrazyGames builds passed |
| Tooling CLI tests | 14 passed |
| Actual Poki archive dependency | Glob, exclusions and ZIP contents passed |
| Hole Islands typecheck, lint and build | Passed |
| Hole Islands game and engine suites | 120 game and 14 engine tests passed |
| AI Defender typecheck, lint and build | Passed after migration |
| AI Defender boot/debug/hub/onboarding/boss/plasma checks | 1/4/19/4/11/7 tests passed |
| npm audit, including development dependencies | 0 known advisories in SDK lockfile |

No SDK lint script existed. Both consumer lints and template lint were run.
The root/template glob override fixes the upstream Poki dependency chain;
root overrides are not inherited by arbitrary existing consumer packages.

## Real-browser observations

Desktop Google Chrome, controlled headlessly, with actual WebGL and game physics.
Consumer Pixi was 8.22.0 and Three was 0.187.0. No mocked renderer was used.

AI Defender:

- Fresh boot, trusted click, agent selection and a normal four-wave battle with boss.
- Natural victory, result UI, return to command center and 180-credit reward.
- Reload restored battle 2 and its reward, with no active battle checkpoint.
- Music reported playing and AudioContext running after interaction.
- Resize exercised 640x360, 390x844 and 844x390.
- No application exception or unhandled rejection was observed. An initial polling
  predicate in the diagnostic harness accessed a null scene during transition;
  correcting the predicate resolved that harness error.
- Nonfatal Pixi BindGroup warnings remained during game-owned atlas disposal after
  battle. They were not suppressed. Retaining the temporary atlas texture until
  owner disposal removed the earlier atlas-construction warnings.

Hole Islands:

- Hybrid startup produced ordered world/UI canvases.
- Normal keyboard movement collected an item with untouched physics and scoring.
- Settings opened, music toggled and the overlay closed through normal UI input.
- Debug completion exercised result UI and the next-level button. It was not a
  natural full-level win.
- Levels 2–10 entered playing state through the actual SceneManager; each retained
  exactly two canvases. Level 1 was exercised interactively.
- Portrait 390x844 resized both native layers and the HUD.
- Built-in destroy/remount completed twice. Its check required zero canvases after
  destroy; exactly two remained after each remount.
- No application JS errors were observed. A loading-image preload warning occurred.
  Temporary-copy asset 403s were caused by the Vite symlink allowlist and corrected
  only in the validation configuration. A clean QA entry recorded no console
  errors or failed requests.

## Limits

No real mobile device, long GPU/memory soak, live portal ad flow, full manual
campaign completion or every legacy repository was tested. Non-cooperative async
hooks cannot be forcibly cancelled by Promise timeouts; cleanup retains context
until the hook settles. Existing Pixi consumers must migrate before upgrading.
Local merge does not publish packages or push Git changes.
