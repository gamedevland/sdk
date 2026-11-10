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
   Particle, physics and texture lookup tokens moved to `PixiServices`.
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
- Concurrent init/start calls fail immediately. Destroy waits for a pending
  lifecycle operation before releasing its resources.
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
