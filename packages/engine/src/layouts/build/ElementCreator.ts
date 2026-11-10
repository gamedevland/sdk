import { DiTokens } from '../../di/tokens';
import { ComponentsAttacher } from '../components/ComponentsAttacher';
import { ActionsAttacher } from '../actions/ActionsAttacher';
import type { ElementFactory } from '../../di/ElementFactoriesGroup';
import type { BuildContext, BuiltElement } from './BuildTypes';
import type { BuiltElementsRegistry } from './BuiltElementsRegistry';
import type { LayoutProperties } from '../../rendering/types';
import type { ElementConfig } from '../types';

/** Shared orchestration for both renderers and prefabs. */
export class ElementCreator {
  constructor(private readonly ctx: BuildContext, private readonly registry: BuiltElementsRegistry,
    private readonly properties: LayoutProperties) {}
  create(id: string, cfg: ElementConfig, parent?: BuiltElement): BuiltElement {
    const factory = this.ctx.container.get(DiTokens.element<ElementFactory>(cfg.type));
    const created = factory(id, cfg, {
      assets: this.ctx.assets,
      createChild: (childId, childCfg) => this.create(childId, childCfg),
    });
    const built = this.registry.add(id, cfg, created.object, parent?.id);
    built.object.id = id;
    built.object.engine = this.ctx.engine;
    this.properties.apply(built.object, cfg);
    // Register ownership before init so partial init failures are rolled back.
    new ComponentsAttacher(this.ctx.components).attach(built.object, cfg);
    new ActionsAttacher(this.ctx.actions).attach(built.object, cfg);
    if (cfg.children && !built.object.acceptsChildren) throw new Error(id + ': children require a container node');
    for (const [key, config] of Object.entries(cfg.children ?? {})) {
      const child = this.create(id + '.' + key, config, built);
      built.children.set(key, child);
      built.object.addChild(key, child.object);
      built.object.attach(child.object);
    }
    return built;
  }
}
