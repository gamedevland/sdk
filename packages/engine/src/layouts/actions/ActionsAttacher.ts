/**
 * Attaches declared actions from layout node config to the node's action set.
 *
 * Reads the `actions` section from an element config, resolves action factories
 * from the registry and instantiates them. Each action is initialized via `init`
 * with the owner node and its `data`, then registered under its id, if the owner
 * exposes an `actions.add` API. Unknown action types are ignored to allow
 * partial registries during bootstrap.
 */
import type { ActionRegistry } from '@engine/layouts/actions/ActionRegistry';
import type { BaseAction } from '@engine/layouts/actions/BaseAction';
import type { NodeBase } from '@engine/layouts/nodes/NodeBase';
import type { ActionConfig, ElementConfig } from '@engine/layouts/types';

type ActionOwner = NodeBase & { addAction: (id: string, action: BaseAction) => void };

export class ActionsAttacher {
  constructor(private readonly actionsMap: ActionRegistry) {}

  /**
   * For each action entry in cfg.actions, create and initialize an instance.
   * Skips any action types silently to allow partial registries.
   */
  attach(owner: ActionOwner, cfg: ElementConfig): void {
    if (!cfg.actions) return;
    for (const [actionId, actionCfg] of Object.entries(cfg.actions)) {
      const typedCfg = actionCfg as ActionConfig;
      const factory = this.actionsMap.get(typedCfg.type);
      if (!factory) continue;
      const action = factory();
      action.init(owner, typedCfg.data);
      owner.addAction(actionId, action);
    }
  }
}
