# AGENTS (sdk engine)

Rules for implementing and evolving `sdk/packages/engine/src/**`.

## Mission

- Keep `@gamedevland/engine` reusable, deterministic, and stable for SDK consumer games.
- Current important consumers include `slide-merge`, `block-puzzle`, `asmr`, and future course/demo games.
- Keep engine contracts domain-agnostic.
- Improve engine APIs when consumer code would otherwise duplicate generic lifecycle, lookup, input, layout,
  tween, asset, config, prefab, audio, physics, platform, scheduler, runtime pause, or diagnostics behavior.
- Do not add public APIs without an immediate real call site.

## Public API

- Public surface is defined only by:
  - `src/index.ts`;
  - `src/<subsystem>/index.ts` subsystem barrels;
  - package exports exposed by `@gamedevland/engine`.
- Internal folders/files are implementation details, including:
  - `src/**/internal/**`;
  - `src/layouts/build/**`;
  - `src/layouts/properties/internal/**`;
  - `src/layouts/nodes/internal/**`.
- Before changing public exports:
  - treat it as a public API change;
  - update SDK docs when behavior or usage changes;
  - verify known consumer usage impact.
- Internal refactors must not require consumer changes when consumers use only public barrels.

## Design Rules

- Follow workspace `/AGENTS.md` architecture rules.
- Keep boundaries between `assets`, `audio`, `commands`, `configs`, `core`, `di`, `errors`, `events`,
  `fsm`, `input`, `interactions`, `layouts`, `particles`, `physics`, `platforms`, `prefabs`, `scenes`,
  `screen`, `tween`, and `validation`.
- Prefer narrow public contracts over wide concrete classes.
- Keep lifecycle order explicit and deterministic:
  - engine init/mount/start;
  - scene preload/enter/update/exit;
  - layout activate/update/destroy;
  - component enable/disable/detach.
- Fail fast with clear diagnostics at the owner method that detects the invariant violation.
- Do not require callers to pass debug strings only for error-message formatting.
- Avoid silent success for invalid states unless the contract explicitly allows it.
- Remove dead public/internal API surface promptly.

## Engine Responsibilities

- Shared runtime decoding is engine-owned:
  - `SchemaDecoder`;
  - `InferDecoded`;
  - `ConfigEntry`;
  - `SettingsEntry`;
  - command payload/scene-param decoding;
  - typed component/action config/input decoding.
- Scene-scoped DI and scene services are engine-owned contracts.
- Event emit/command payload normalization belongs to engine commands/events.
- Asset loading, descriptor validation, single-flight behavior, and asset-to-texture resolution belong to engine assets/layout facades.
- Prefab creation/ensure semantics belong to engine prefabs/layout containers:
  - `spawnPrefab(...)` is strict create-only;
  - `ensureChildFromPrefab(...)` is idempotent guarantee;
  - avoid ambiguous `getOr*` names for create/query APIs.
- Responsive/adaptive layout primitives belong to `engine/layouts` when reusable across scenes.
- Physics world lifecycle and scheduler integration belong to engine physics/runtime services.
- Runtime pause and audio gates belong to engine core/audio.
- Platform SDK integration belongs to engine platforms.
- Tween ownership, async continuation safety, and cleanup ergonomics must be easy for components/actions.

## Node, Layout, Input, Tween Contracts

- Enforce layout hierarchy deterministically: only `Container` nodes may declare `children`.
- Sprite/Text/Graphics nodes are leaf render nodes.
- Preserve node-driven ownership: game-level visual mutations should stay in `BaseComponent`/`BaseAction`.
- Provide typed fail-fast node child/component/action getters so consumers do not write local `getRequired*` wrappers.
- Do not require game code to use PIXI input flags (`eventMode`, `interactive`) or cursor styling.
- Input routing order should remain deterministic and documented.
- EventBus emit path must remain safe; handlers should not break emitters.
- Tween cleanup must follow owner lifecycle and must not rely on global best-effort cancellation.

## Type Safety and OOP

- Use strict TypeScript.
- Avoid `any`, unsafe casts, double-casts, and non-null assertions in runtime code.
- Fix source typings/contracts instead of masking type gaps.
- New/modified runtime behavior must be class-based.
- Keep one runtime class per file by default.
- Top-level exports are allowed for type-only declarations and barrel re-exports.
- Module-private decoder constants are allowed for schema-first boundary contracts.
- Do not introduce decorators, reflection metadata, transformers, codegen, or dynamic discovery for runtime contracts
  unless an explicit architecture decision adds that capability.

## Validation

- Required checks after engine source changes:
  - run the SDK/workspace typecheck command available in `sdk/package.json`;
  - run the SDK/workspace lint command if available.
- If editing from a consumer project, also run that consumer's `npm run typecheck` and `npm run lint` when the change affects it.
- Do not launch browsers, browser automation, GUI apps, or local dev servers unless explicitly requested.
