// Creates a single element: resolves element factory, applies properties, attaches behavior
// and then assembles its children. Acts as the central orchestrator for node creation.
import { DiTokens } from '@engine/di/tokens';
import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import { ActionsAttacher } from '@engine/layouts/actions/ActionsAttacher';
import { ChildrenAssembler } from '@engine/layouts/build/ChildrenAssembler';
import { NodeBuildLifecycle } from '@engine/layouts/build/NodeBuildLifecycle';
import { ComponentsAttacher } from '@engine/layouts/components/ComponentsAttacher';
import { NodePropertyApplier } from '@engine/layouts/properties/NodePropertyApplier';

import { DefaultMetaLayer, type NodeMetaHooks } from './MetaLayer';

import type { CreatedElement } from '@engine/layouts/build/BuildTypes';
import type { BuildContext, BuiltElement } from '@engine/layouts/build/BuildTypes';
import type { ElementFactoryContext } from '@engine/layouts/build/BuildTypes';
import type { BuiltElementsRegistry } from '@engine/layouts/build/BuiltElementsRegistry';
import type { DisplayPipeline } from '@engine/layouts/display/DisplayPipeline';
import type { ElementConfig } from '@engine/layouts/types';

type ElementFactory = (
  id: string,
  cfg: ElementConfig,
  ctx: ElementFactoryContext,
) => CreatedElement;

export class ElementCreator {
  constructor(
    private readonly ctx: BuildContext,
    private readonly registry: BuiltElementsRegistry,
    private readonly pipeline: DisplayPipeline,
    private readonly meta: NodeMetaHooks = new DefaultMetaLayer(),
    private readonly lifecycle = new NodeBuildLifecycle(),
  ) {}

  create(id: string, cfg: ElementConfig, parent?: BuiltElement): BuiltElement | null {
    // Resolve element factory by its declarative type via DI
    const factory = this.ctx.container.get(DiTokens.element<ElementFactory>(cfg.type));
    if (!factory) return null;

    // provisional built to provide correct parent for factory-created children
    const built = this.registry.createProvisional(id, cfg, parent?.id);

    // phase 1: create native/domain object via factory
    const created: CreatedElement = factory(id, cfg, {
      createChild: (childId: string, childCfg: ElementConfig) => {
        const child = this.create(childId, childCfg, built);
        if (!child) {
          throw EngineErrorFactory.invariant({
            code: EngineErrorCode.LayoutInvariantViolation,
            subsystem: EngineSubsystem.Layout,
            message: 'Failed to create child node',
            details: { parentId: id, childId, method: 'ElementCreator.create' },
          });
        }
        return { id: child.id, object: child.object };
      },
      assets: this.ctx.assets,
    });

    // phase 2: set created object and inject engine early (before components/actions)
    built.object = created.object;
    this.lifecycle.bindEngine(built.object, this.ctx.engine);

    // phase 3: apply display properties (position, size, styles, etc.)
    new NodePropertyApplier(this.ctx, this.pipeline).apply(built.object, cfg);

    // styles system removed — nothing to attach here

    // metadata hooks
    this.meta.onCreated(built.object, {
      id,
      ...(this.ctx.engine ? { engine: this.ctx.engine } : {}),
    });

    // phase 4b: attach components/actions declared in config (engine is already set)
    if (this.ctx.components)
      new ComponentsAttacher(this.ctx.components).attach(created.object as never, cfg);
    if (this.ctx.actions)
      new ActionsAttacher(this.ctx.actions).attach(created.object as never, cfg);

    // phase 5: assemble and attach children recursively
    new ChildrenAssembler(this).assemble(id, cfg, built);

    return built;
  }
}
