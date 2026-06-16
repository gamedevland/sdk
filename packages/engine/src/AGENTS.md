# AGENTS (engine)

Rules for implementing and evolving `engine/**`.

## Mission

- Keep engine reusable, deterministic, and stable for game consumers.
- Evolve internals without breaking public contracts unless change is intentional and documented.
- Current consumers are `game/**` (Slide Merge working project), `examples/fish-sort/**` (archived Fish Sort example), and `game-example/**` (reference project on the same engine, if present).
  Treat `game-example/**` as integration evidence for engine ergonomics, but keep engine contracts domain-agnostic.
- `game-example/**` and `references/**` are read-only reference materials. Engine work may inspect them
  for integration evidence, but must never modify, format, refactor, delete, move, or generate files there.

## Testing Policy

- Automated tests are currently not used in this repository.
- Do not treat test-suite execution as a required engine delivery gate unless policy is explicitly revised.
- Required Codex validation gate for engine changes: `npm run typecheck` and `npm run lint`.
- Codex must not launch browsers, browser automation, GUI apps, or local dev servers for manual/runtime
  verification unless the user explicitly requests that exact action. Manual browser/runtime checks belong to the user.

## Public API Governance

- Public surface is defined only by subsystem barrels:
  - `engine/index.ts`
  - `engine/*/index.ts`
- Before changing exports in any barrel:
  - Treat as public API change.
  - Update `docs/ENGINE.md`.
  - Verify game usage impact.
- Compatibility rule:
  - Internal refactors must not require game changes when game uses only public barrels.

## Internal vs Public

- Internal folders/files are implementation details (examples):
  - `engine/**/internal/**`
  - `engine/layouts/build/**`
  - `engine/layouts/properties/internal/**`
- Internal changes are allowed, but must preserve behavior promised by public API.

## Deterministic Contracts (Required)

- Lifecycle order must be explicit and stable:
  - engine init/mount/start
  - scene preload/enter/update/exit
  - layout activate/update/destroy
  - component enable/disable/detach
- APIs that are expected to succeed in normal flow should fail fast on invariant breakage.
- Avoid "silent success" for invalid states unless contract explicitly allows it.
- Do not rely on silent catches in critical runtime paths; keep diagnostics with context.
- Diagnostics context must be assembled where exceptions are raised (final owner method).
- Do not require callers to pass debug/source strings only for error-message formatting.

## Engine Responsibilities (What to Improve Here, Not in Game)

- If game needs repetitive guards around engine interactions, improve engine API contract.
- Prefer typed helper methods over forcing casts in game code.
- Expose capabilities via stable facades instead of leaking internals.
- If a game feature exposes any missing reusable infrastructure capability, treat it as an engine
  capability candidate before accepting a game-side approximation. This applies across all engine
  subsystems: assets, DI, events, FSM, input, layouts, scenes, screen, tween/animation, prefabs,
  validation/configs, audio, physics, platform, runtime scheduling, diagnostics, lifecycle ownership,
  and similar cross-cutting contracts. Add the narrow engine API needed by the immediate call site,
  keep it domain-agnostic, and expose it through the correct public barrel when it is intended for
  game consumption.
- Keep engine domain-agnostic. Do not introduce generic `DomainModel`/`GameRules`/`LevelState`
  framework abstractions only to host feature-specific gameplay rules. Add engine infrastructure
  around domain code only when the need is reusable across consumers, such as lifecycle ownership,
  scene-scoped DI, config loading, snapshots/history plumbing, validation tooling, input routing,
  layout scaling/resizing, or tween scope management.
- If game repeatedly needs runtime `Texture` objects from asset ids, provide/extend an engine-owned
  public resolver with fail-fast retrieval and caching semantics (for example, `TextureAssetResolver`)
  instead of requiring consumer-side `AssetManager.getRequired(...)` + `Texture.from(...)` assembly.

## Runtime Decoding Contract

- Shared runtime decoding must be centralized in engine-level APIs, not reimplemented in game features.
- `engine/validation/schema/SchemaDecoder.ts` is the canonical schema-based decoder for unknown data.
- `InferDecoded` (`@engine/validation`) is the canonical type helper for deriving TypeScript
  types from decoder contracts. New or modified runtime boundary schemas must be schema-first:
  decoder is the single source of truth, and duplicated shape declarations in interfaces/types
  are forbidden.
- Do not introduce decorators, reflection metadata, transformers, or codegen to generate runtime
  schemas from TypeScript types.
- `SettingsService.read(entry)` is the required path for typed settings access (`entry` is a `SettingsEntry` descriptor).
- `ConfigEntry` (`@engine/configs`) is the required descriptor for non-settings JSON config contracts
  loaded through `DecodedConfigStore` (`fileId + decoder`).
- `SettingsEntry` (`@engine/configs`) is the required descriptor for settings JSON contracts
  loaded through `SettingsService.read(...)` (`fileId + key + decoder`).
- For internal runtime contracts, avoid duck-typing checks (`typeof obj.method === 'function'`).
  Prefer explicit typed contracts and direct typed resolution (DI token/class) with fail-fast behavior.
- Command event payload parsing contract belongs to `@engine/commands` (`CommandEventPayloadReader`).
- Event emitters should use the public `EventBus` shorthand `{ type, data }`; command payload decoders
  for FSM-triggered commands must model the unwrapped `event.payload`, because `CommandEventPayloadReader`
  strips the FSM event envelope before `BaseTypedCommand` runs.
- Command scene params parsing belongs to `@engine/commands` (`BaseCommand.decodeSceneParams(...)`).
- New or modified commands with payloads must prefer `BaseTypedCommand` and a schema-first `inputDecoder`
  instead of manual `readPayload(...)` field guards. Payload-less commands may extend `BaseCommand`.
- `BaseCommand.readPayload(...)` is an engine-internal implementation detail. Command subclasses must not
  compose `readPayload(...).decodePayload(...)`; use `BaseTypedCommand` for event payloads or
  `BaseCommand.decodeSceneParams(...)` for scene params.
- Layout behavior parsing contract belongs to `@engine/layouts` base abstractions:
  - `BaseTypedComponent` (`configDecoder`) for component config decoding
  - `BaseTypedAction` (`configDecoder/inputDecoder/execute`) as preferred typed path for new actions
  - `BaseAction.decodeConfig(...)` / `BaseAction.decodeInput(...)` as backward-compatible legacy path
- New or modified components/actions with runtime config or input must use typed base classes and decoders.
  Method-level component/action boundaries that receive runtime data must use shared schema decoders for parsing,
  keeping only post-decode invariant checks as explicit logic.
- Element props decoding must stay centralized and OOP-friendly in layouts internals
  (e.g. `ElementPropsDecoder`), not duplicated in node/property implementations.
- Avoid introducing parallel parsing helpers in `game/**` for engine-owned contracts.
- Do not normalize type gaps with double-cast `as unknown as T`.
  Engine typings must be corrected at the contract level so game code does not need unsafe force-casts.

## Design and Architecture

- Keep clean boundaries between subsystems (`assets`, `di`, `events`, `fsm`, `input`, `layouts`, `scenes`, `screen`, `tween`, `prefabs`).
- Follow repository `/AGENTS.md` § "Architecture Principles"; do not duplicate that list here.
- Engine-specific emphasis: narrow public contracts, centralized shared runtime behavior,
  idempotent lifecycle, deterministic diagnostics, and prompt removal of dead API surface.
- Use OOP where lifecycle/state ownership is important.
- Use patterns pragmatically: Command, FSM, Factory, Strategy, Adapter, Composite.
- Preserve the node-driven ownership model in engine APIs:
  - game-level visual mutations should stay in `BaseComponent`/`BaseAction` implementations;
  - engine should provide facades/hooks that make this path straightforward.
  - repeated lookup guards for node component/action resolution must be solved in engine API
    with fail-fast helpers, not copied in game feature code.
  - typed node child/component/action getters are the preferred consumer contract; game code must not need
    local `getRequired*` wrappers to repeat engine fail-fast behavior.
- Prefab API semantics must stay precise and minimal:
  - `spawnPrefab(...)` means create a new child from prefab; duplicate child ids must fail fast.
  - `ensureChildFromPrefab(...)` means idempotently guarantee a child exists at `localId`,
    returning whether it was created.
  - after prefab expansion, API results expose runtime child nodes; avoid terminology that treats
    created nodes as persistent "prefab instances".
  - Do not add ambiguous `getOr*` prefab APIs that blur lookup and creation semantics.
  - Component/action wiring for prefab-spawned nodes belongs to prefab JSON and layout builders,
    not post-spawn consumer helper methods.
  - Do not add public runtime component/action attachment helpers unless there is a current
    engine-owned lifecycle use case; consumers should normally express reusable runtime node
    behavior in prefab JSON.
- When a consumer needs a small helper for lifecycle, node lookup, prefab child creation,
  DI resolution, assets, layout, tween, or input, first evaluate whether the engine API is missing
  a reusable contract. Prefer extending the engine cleanly over normalizing copy-pasted consumer helpers.
- When a consumer need cannot be expressed cleanly through the current engine public API, do not
  default to lower-quality game code or duplicated local helpers. First design the minimal
  engine-level primitive that captures the reusable part of the need, then consume that public
  primitive from the game feature.
- Remove engine APIs that no longer have real runtime call sites after a refactor; do not preserve
  public surface area for speculative future use.
- Responsive/adaptive layout primitives are engine responsibilities:
  - `ResponsiveLayoutComponent` is the single built-in responsive/adaptive layout component contract.
  - Keep it owner-only: it may position, scale, resize, or report the layout area for the node it is attached to,
    but it must not manage arbitrary child/sibling nodes by path.
  - Keep its public JSON contract small and deterministic: `area`, `position`, `scale`, `resize`, `areaOnly`,
    and `orientation` partial overrides.
    Do not add legacy aliases, parallel config styles, path-based `target`, `attach`, `resize.targets`,
    or speculative modes without an immediate runtime call site.
  - Enforce layout hierarchy deterministically: only `Container` nodes may declare `children`.
    Sprite/Text/Graphics nodes are leaf render nodes; composed visual controls must use a
    `Container` owner with explicit child render nodes.
  - If multiple scenes/features need the same screen-relative positioning, scaling, or resizing behavior, implement it in `engine/layouts`
    through this owner-only contract or a documented replacement that supersedes it.
  - Reusable position/scale/resize math must not live permanently in `game/**` as a transitional helper once the pattern is proven.
  - Engine layout primitives should expose narrow, deterministic contracts and leave scene-specific composition rules to game components.
- OOP-first module style is mandatory for new/modified engine runtime code:
  - do not add top-level exported runtime `const`/`function` declarations;
  - encapsulate runtime behavior (decoders, validators, helpers) in classes;
  - keep one runtime class per file (`1 class = 1 file`);
  - top-level exports are allowed for type-only declarations and barrel re-exports.
  - module-private decoder constants are allowed only for new or modified schema-first boundary
    contracts when their decoded types are derived with `InferDecoded`; they must not be exported
    or contain behavior beyond schema declaration.
- Keep runtime wiring explicit and statically analyzable:
  - do not introduce dynamic `import()` or `Reflect`-based dispatch/discovery for DI, configs,
    commands, scenes, layouts, or assets unless an explicit architecture decision adds that capability;
  - prefer typed registries, explicit imports, factories, and DI providers so bundling,
    static checks, and fail-fast diagnostics remain deterministic.

## Audio Subsystem Contract

- `engine/audio` public surface is backend-agnostic (`AudioManager`, `types`) and is consumed via `@engine/audio`.
- Concrete backend adapters (for example Howler) must stay in `engine/audio/internal/**`.
- Runtime decoding of unknown audio payloads must use shared schema decoders (`SchemaDecoder`) instead of ad-hoc guards.
- Channel policy (`music`/`sfx` enable flags), runtime mute policy, and effective mute computation are engine responsibilities.
- Runtime pause signal source must be engine-core owned (`EnginePauseController`), not duplicated via subsystem-local page monitors.

## Platform Subsystem Contract

- `engine/platforms` is the only integration boundary for external distribution SDKs (Poki, CrazyGames, etc.).
- SDK adapters must implement `PlatformAdapter`; game code must not call platform SDK globals directly.
- Ad-break and platform-originated pause/resume orchestration are engine-owned and wired in `Engine`.
- `PlatformManager` lifecycle (`init`, `loadingFinished`, ad-break delegation) must stay deterministic and fail-safe.
- Build-time platform selection via `VITE_PLATFORM` is resolved in engine internals (`PlatformAdapterResolver`), not in game flow code.

## Runtime Pause Contract

- Effective runtime pause state is composed in `engine/core/runtime/EnginePauseController`.
- Pause application to runtime subsystems (`scenes`, `tweens`, `audio`) must be deterministic and centralized in `Engine`.
- `ENGINE__RUNTIME_PAUSED_CHANGED` is an observer event; critical pause application flow must not rely solely on EventBus handlers.

## Runtime Scheduler Contract

- Runtime subsystem ticking order is owned by `engine/runtime/RuntimeScheduler`.
- Built-in static order must remain deterministic: `layout -> scene-services (non-physics) -> physics -> particles -> tweens`.
- Scene lifecycle propagation to runtime systems (`onSceneEnter`/`onSceneExit`) must remain centralized in scheduler hooks.
- Leaked dynamic runtime system registrations after scene exit must be treated as invariant violations.
- Physics warmup/step helper paths must go through scheduler-owned execution (`tickSystem(...)`) rather than bypassing subsystem order.
- Layout responsiveness must remain scheduler-friendly:
  - engine layout components may react to `SCREEN_CHANGED` and internal layout lifecycle hooks;
  - avoid pushing browser scheduling primitives (`window.requestAnimationFrame`, manual resize polling) into `game/**` for responsive layout recovery;
  - if deferred re-application is required generically, it belongs in engine-owned layout components/contracts.

## DI and Composition Root

- System services must be registered through engine DI providers.
- Avoid hidden global state outside DI/runtime context.
- Provider sources (`system`, `module:*`, `game`) must remain diagnostics-friendly.
- Provider shape must declare exactly one source:
  - `useClass` xor `useFactory` xor `useValue`.
- Duplicate providers are forbidden by default unless explicit `override: true`.
- Overriding `SystemServices.*` is forbidden.
- Keep shared DI registration ergonomics in engine-level helpers (e.g. `ValuesGroupRegistrar`) instead of ad-hoc game-local DSLs.
- Prefer class-based registration in helpers when constructor has no dependencies; keep factory-based registration for explicit wiring.
- Scene-scoped DI/lifecycle is part of engine contract:
  - DI contract is `GameConfig.di` with strict `GameDiDefinition` aggregate root.
  - Source of truth for scene providers/services is scene definitions (`SceneDiDefinition`)
    returned by `GameDiDefinition`.
  - `SceneConfig` must stay declarative for scene identity/layout/FSM, not DI composition.
  - Engine must create scene DI scope on enter and clear it on exit deterministically.
  - Scene lifecycle services (`SceneService`) must run in deterministic order:
    1. init in declaration order
    2. per-frame tick while scene is active
    3. dispose in reverse order
  - Lifecycle hook invocation must preserve method context (`this`) and fail with explicit diagnostics (`scene`, `token`, `hook`).
  - Command execution context must expose required scene DI access; optional resolver-by-error-parsing is forbidden.

## Input/Event/Tween Reliability

- EventBus emit path must remain safe (handlers cannot break emitters).
- Event handlers should not intentionally throw.
- Input routing order should remain deterministic and documented.
- Game runtime interaction contract does not use cursor styling:
  - do not require or recommend `node.view.cursor` mutations in game-facing guidance/examples.
- Game runtime interaction contract is engine input routing (`node.input` / InputManager + NodeHitTester):
  - do not require or recommend PIXI input flags (`eventMode`, `interactive`) in game-facing guidance/examples.
- Tween lifecycle must be predictable; cleanup hooks must be reliable.
- Engine tween safety contract is mandatory:
  - engine APIs must make safe ownership the easiest path for game consumers;
  - `BaseComponent` / `BaseAction` lifecycle helpers are the preferred owner contract for node-local tweens;
  - if a component/action starts tween handles that may outlive the current call stack, engine APIs must support deterministic owner-side interruption on `onDisable` / `onDetach`;
  - if async work in components/actions crosses an `await`, engine APIs should provide scoped continuation helpers so game code does not hand-roll lifecycle flags;
  - engine-level tween registries may support diagnostics and targeted cancellation, but must not be the primary correctness mechanism for scene teardown;
  - do not solve scene transition races by introducing global "kill all tweens on transition" behavior;
  - if a tween or async visual operation is started after owner invalidation, engine helpers should cancel or neutralize it immediately when possible.

## Performance and Resource Management

- No avoidable allocations in hot loops.
- Ensure listener/tween/disposable cleanup on scene/layout/node teardown.
- Prefer fail-fast lifecycle safety over silent survival:
  - post-detach visual continuations should stop instead of trying to "finish gracefully";
  - engine helpers should make it obvious when the caller must dispose a spawned runtime resource after scope invalidation;
  - diagnostics for lifecycle/tween failures must preserve owner context (`scene`, `node`, `component`, `action`, `phase`) at the final throw site.
- Keep startup and scene transitions predictable (timeouts, fail-fast diagnostics).
- Keep per-frame and high-frequency handlers allocation-light.

## Quality Gate

- Preserve strict typing and lint constraints defined in repo configs.
- Add/update docs for behavior changes in public API.
- Do not add speculative abstractions.

## Transitional Constraint

- Scene transition queue, timeout guards, and fail-fast errors are part of the active runtime contract.
- Any transition-related changes must preserve deterministic queuing semantics and lifecycle timeout diagnostics.
- Scene transitions requested during scene lifecycle hooks (`preload`, `onEnter`, `create`, `onExit`
  through FSM/commands) must not execute reentrantly inside that hook. `SceneManager` must defer them
  to a safe point after the current transition action completes, preserve deterministic ordering, and
  include diagnostics that identify the lifecycle hook that requested the deferred transition.
- Consumer code should be allowed to express direct flows such as `SCENE_READY -> OpenSceneCommand`;
  engine lifecycle safety must prevent deadlocks/timeouts rather than forcing game-local microtask
  workarounds.
