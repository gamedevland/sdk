/**
 * Instantiates and attaches components declared in the layout node config.
 *
 * Reads cfg.components, resolves each component by type, calls init(owner, data)
 * and registers the instance in the owner's component collection if available.
 * Initial enabled state defaults to true unless explicitly set to false.
 */
import type { BaseComponent } from './BaseComponent';
import type { ComponentRegistry } from './ComponentRegistry';
import type { NodeBase } from '@engine/layouts/nodes/NodeBase';
import type { ComponentConfig, ElementConfig } from '@engine/layouts/types';

type ComponentOwner = NodeBase & {
  addComponent: (id: string, component: BaseComponent, autoEnable?: boolean) => void;
};

export class ComponentsAttacher {
  constructor(private readonly componentsMap: ComponentRegistry) {}

  /**
   * For each config entry in cfg.components, create the component, init and optionally enable.
   */
  attach(owner: ComponentOwner, cfg: ElementConfig): void {
    if (!cfg.components) return;
    for (const [compId, compCfg] of Object.entries(cfg.components)) {
      const typedCfg = compCfg as ComponentConfig;
      const factory = this.componentsMap.get(typedCfg.type);
      if (!factory) continue;
      const instance = factory();
      instance.init(owner, typedCfg.data);
      owner.addComponent(compId, instance, typedCfg.enabled !== false);
    }
  }
}
