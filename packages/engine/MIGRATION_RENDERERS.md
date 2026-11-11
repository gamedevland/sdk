# Migrating a Pixi consumer to renderer modules

This is an explicit public API migration from the Pixi-only SDK. Do not replace
an old tarball without updating its consumer and any SDK adapter libraries.

1. Keep shared behavior imports (`BaseComponent`, `BaseTypedComponent`,
   `BaseAction`, `BaseTypedAction`, `SceneLayout`) under `/layouts`.
2. Import concrete `Container`, `Sprite`, `Text`, `Graphics`, `NineSliceSprite`,
   Pixi `NodeBase`, responsive/filter/particle behaviors from `/renderers/pixi`.
   `/layouts.NodeBase` is now renderer-neutral and has no native `view`.
3. Set `system.renderer: new PixiRendererModule()` in `GameConfig`.
   The module registers built-in element factories; remove duplicate registrations
   of the standard Pixi element names from game DI.
4. Components/actions declare the runtime node class, for example:

   ```ts
   import { BaseComponent } from '@gamedevland/engine/layouts';
   import { Container } from '@gamedevland/engine/renderers/pixi';

   export class ButtonComponent extends BaseComponent<Container> {
     protected readonly nodeType = Container;
   }
   ```

5. Use `layout.requireNode(id, Container)` for typed lookup. `getNode` returns a
   neutral node. Pixi child helpers still return concrete Pixi nodes.
6. Replace `engine.app` dependencies with a narrow renderer capability. For
   node-owned atlas baking, use `engine.di.get(PixiServices.TextureGenerator)`;
   it exposes `generateTexture` only. Texture lifetime belongs to its component.
   Particle and texture lookup tokens live in `PixiServices`. Matter is opt-in
   through `MatterPhysicsModule` and `PhysicsServices.Manager`; see MIGRATION_RUNTIME.md.
7. Rebuild SDK adapter libraries against this API; do not allow a second engine
   or Pixi copy in their dependency tree. Both libraries should be peers.
8. Update lint allowlists to permit the public `/renderers/pixi` entry point.
9. Run consumer typecheck, lint, builds and real gameplay checks, including saved
   progress, scene transitions, resize and disposal. Static checks are insufficient.

## Three and hybrid

Choose `ThreeRendererModule` or `HybridRendererModule` explicitly. Three scenes
name their active camera with `render: { camera: 'world.camera' }`. Three node
properties use strict decoded vectors in meters and radians. Only Group owns
Three children; Container owns Pixi children. Hybrid roots route the native trees
independently, share the clock and route UI hits before world hits.

## Lifecycle and behavior changes

- `Engine.run` returns an engine handle; `destroy` is asynchronous and idempotent.
- Concurrent init/start calls fail immediately. Destroy aborts pending
  lifecycle observation before releasing resources; SDK continuations check cancellation.
- Scene service entry rolls back in reverse order, including the partially entered
  service. `onSceneExit` must tolerate partial initialization and release ownership.
- Async service hooks must settle. An arbitrary non-cooperative user promise cannot
  be forcibly cancelled; lifecycle timeouts bound transition waiting, while cleanup
  retains its context until that hook settles.
- Async event errors are observed and reported without stopping event delivery.
- Component/action cleanup runs every hook and reports collected errors.
- `ScreenManager.toVirtual` requires a measured, nonzero canvas rectangle.
- Required renderer choice, moved exports and typed node declarations are source
  compatibility changes; behavioral validation does not imply drop-in binary compatibility.

See the repository validation report for the tested games and browser scope.

## Three content embedded in a Pixi layout

### Declarative ThreeViewport

`PixiThreeTextureRendererModule` registers the Pixi leaf element `ThreeViewport`.
It renders a separate Three layout into its texture; it cannot declare `children`
or `props.asset`. No custom surface-owning component is required.

```json
{
  "itemPreview": {
    "type": "ThreeViewport",
    "props": {
      "x": 320,
      "y": 240,
      "width": 400,
      "height": 400,
      "resolution": 1,
      "sceneLayout": "json/layouts/previews/item.json",
      "camera": "world.camera",
      "renderMode": "on-demand"
    }
  }
}
```

`sceneLayout` is a JSON asset ID, resolved through the regular layout loader,
including validation, `$include` and inheritance. Use `Group`, `Mesh`, `Model`,
camera and light elements in that file. The `camera` path is local to that Three
layout and must name a perspective or orthographic camera. Each viewport builds
an independent graph, so the same IDs can be reused across previews. These IDs
are absent from the enclosing Pixi layout. GLB assets referenced by `Model` must
be loaded before building the viewport, as in other Three layouts.

`width` and `height` are required positive numbers (at least 1). Optional
`resolution` is 0.25–2 (default 1); `exposure` is 0.01–10 (default 1).
Standard Pixi position, anchor, scale, alpha and input behavior apply.
`renderMode` defaults to `on-demand`: the initial image is rendered on readiness,
then only after invalidation or texture resize. Use `always` for animated Three
components or tweens. Both modes use the engine presentation phase and pause
with the enclosing layout; no separate animation loop is created.

Import `ThreeViewport` from `@gamedevland/engine/renderers/hybrid`. From an owning
component/action, use `viewport.world.requireNode(id, ThreeNode)` to access its
Three nodes and `viewport.invalidate()` after visual changes in on-demand mode.
The `world` facade is available in component `onReady`, after asynchronous layout
preparation. Embedded components/actions use normal DI registrations and lifecycle.

`viewport.resize(width, height, resolution?)` resizes the offscreen target,
updates the camera projection and schedules a redraw, preserving Pixi transforms.
Call it from the owning responsive component when the required texture dimensions
change. Ordinary Pixi scaling changes display size without reallocating the target.
The internal component ID `$threeViewport` is reserved.

Destruction releases the embedded graph, model leases, native renderer, texture
and presentation subscription. Build failures roll back prepared viewports too.
Pointer routing stays on the Pixi leaf; the embedded graph has no automatic
Three raycasting. Each viewport owns a WebGL context and copies pixels into Pixi,
so use these targets for bounded embedded content.

See `examples/three-viewport/layout.json` and `preview.json` in the SDK repository
for a complete pair of JSON layouts. Place `preview.json` at the authored asset
ID in your game. Dynamic Pixi prefabs can also contain a `ThreeViewport`.

### Programmatic surfaces

Use `PixiThreeTextureRendererModule` from `/renderers/hybrid` to retain Pixi as the
primary renderer and enable SDK-loaded GLB assets. A node component owns a
`ThreeTextureSurface({width, height, resolution})`, assigns its `texture` to a
Pixi Sprite, and calls `render(scene, camera)` after camera/scene changes. Idle
scenes need no upload. The canvas stays off DOM; pointer routing stays on Pixi.
Call `resize` on screen changes and `dispose` when the component detaches.
The owner also releases acquired `ModelAsset` leases and its own Three resources.
The adapter owns only the renderer and its Pixi texture, never scene resources.
Resolution is capped at 2. Rendering across independent WebGL contexts copies
pixels; this is a compatibility path for embedded content, not a zero-copy target.

Vite tooling 0.2.2 declares engine 0.0.13 as a peer, so the project uses one engine
copy for runtime and build tooling.

Canvas texture coverage edges require `premultiply-alpha-on-upload` when Pixi
uploads the browser canvas. Labeling the source as already premultiplied skips
the upload conversion and produces bright fringes. The browser GPU regression
in Rings 3D verifies bounded composited edge colors at opaque and faded sprite
alpha; the SDK surface contract also checks this upload mode.
