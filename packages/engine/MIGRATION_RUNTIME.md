# Runtime ownership migration

This local refactor build follows the Three/hybrid integration already in main.
It does not include an editor or change the authored layout/prefab format.

## Persistence belongs to an engine

`PersistentStorageCoordinator.shared()` and implicit global adapters are removed.
Use `engine.storage`, or resolve `SystemServices.PersistentStorage` in a provider:

```ts
registrar.singletonFactory(ProfileToken, di =>
  new ProfileRepository(di.get(SystemServices.PersistentStorage)));
```

For standalone tools/tests, construct a coordinator, configure and bootstrap it,
then pass it to `new PersistentStorageAdapter(coordinator)`. Two engines no longer
redirect each other's storage when they use different backends/namespaces.
Keys and serialized saves are unchanged. Do not change an existing namespace.

Choose `system.persistence.policy` explicitly:

- `platform-exclusive` (new default): a platform backend is authoritative, with no
  browser fallback when present. Missing keys do not inherit a previous browser user.
  Without a platform backend, configured browser storage is used.
- `mirror`: preserves the old browser/platform write-through behavior. Platform
  values win bootstrap conflicts; missing platform keys fall back to browser values.
  After a platform error that backend is disabled for the coordinator session.

Existing games that intentionally relied on mirrored browser saves must set
`policy: 'mirror'` during migration. Moving to platform-exclusive is a separate
product/save-migration decision, not a key rewrite performed by the SDK.
The synchronous state-store API still means IndexedDB persistence is asynchronous;
it does not provide a durable transaction/flush acknowledgement.

## Physics is independent of rendering

`PixiRendererModule` no longer constructs Matter worlds. If the game uses built-in
Matter physics, import `MatterPhysicsModule` and `PhysicsServices` from
`@gamedevland/engine/physics`, and set `system.modules: [new MatterPhysicsModule()]`.
Resolve `PhysicsServices.Manager` in service factories. The deprecated
`PixiServices.PhysicsManager` token alias remains compatible when the module is installed.
Cannon stays a separate consumer module; no common physics abstraction is imposed.

## Owned work and cancellation

Engine init/start remain single-use; concurrent calls fail fast. `destroy()` is
idempotent and aborts pending lifecycle observation. SDK boot and scene boundaries
check lifetime signals before continuing. Late Pixi/platform initialization releases
its resources rather than reinstalling a live renderer/listeners.
`SceneContext.signal` and `SceneServiceContext.signal` expire on failure, timeout,
exit and manager destruction. Hooks must cooperate before performing late effects:

```ts
const result = await prepare();
ctx.signal?.throwIfAborted();
// Apply the result only while this scene still owns it.
```

Timeout cannot forcibly stop arbitrary JavaScript. Custom resources acquired after
cancellation still need a cooperative hook or owner cleanup. Component/action
instances have one attachment lifetime. Use protected `ownDisposer`, `scopeSignal`
and the existing `awaitComponentScopeResource` / `awaitActionScopeResource` helpers.
`DisposalScope` owns synchronous cleanup, reverses release order, continues through
errors and immediately releases registrations made after disposal. Disable does not
end the attachment lifetime; enabled-gated subscriptions can resume after re-enable.
Do not pass async cleanup to a synchronous disposer.

## Required assets and cache ownership

Use `assets.loadRequired(ids, {signal})` or `loadRequiredBundle(name, {signal})`
for navigation/preload. Failures retain asset id/type and the original loader cause.
`load`/`loadBundle` remain best-effort APIs. Concurrency is shared across caller batches;
duplicate ids use one request. Cancelling one waiter does not cancel another caller's
shared load. Asset-manager destruction aborts all work. Loaders must provide `dispose`
for resources that can arrive after an ignored abort/timeout.

`assets.unload(id)` is explicit eviction. It rejects in-flight requests and preserves
cache ownership if disposal refuses (for example, live GLB leases). Release instances
before eviction. No blanket scene eviction occurs: scene/preload/prefab consumers may
share assets, and application policy must decide which caches to retain.

## Presentation and diagnostics

`engine.presentation.subscribe(callback, {phase, order, signal, layout})` runs synchronously
after layout, scene services, physics, particles and tweens. Phases are `camera`,
`world`, `ui`, then finite numeric order and stable subscription order. Return values
are not awaited. Pass the owning scene layout to pause covered/pushed scenes, and scope subscriptions
with a scene signal or a disposer. Omitted layout means an engine-wide subscription. Components
can register protected `onPresentation` from `onReady`; it captures the active layout,
is gated by enabled state and is cleaned on detach.

`engine.diagnostics.subscribe` observes errors, raw/clamped frame deltas and per-system/
render CPU timing. Observer failures do not break runtime; SDK retains no samples.
Timings describe CPU submission/work, not GPU completion or device benchmark results.
Consumers should subscribe instead of replacing renderer/service methods at runtime.

DI overrides invalidate the owner's singleton cache but do not dispose external
instances. Providers own their previous values/resources. Factory cycles fail with
a token chain. Renderer contracts accept `DiContainerInterface`; layout and input
capabilities are separate narrow ports.

## Three rendered into Pixi

Use `PixiThreeTextureRendererModule` for a Pixi game with Three assets rendered into
component-owned `ThreeTextureSurface` objects. This is distinct from
`HybridRendererModule`, which owns two DOM surfaces. Components dispose their Three
scene resources, GLB leases and surfaces. The surface owns only its WebGL renderer
and dynamic Pixi texture, including premultiplied-alpha canvas upload.

`defaultInputConfig` is replaced by `InputDefaults.config`. Internal layout guard
functions/registries were reorganized; consumer deep imports remain unsupported.
