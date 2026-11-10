import { ProviderGroup } from './ProviderGroup';
import { DiTokens } from './tokens';

import type { Provider } from './types';
import type { AssetManager } from '@engine/assets/AssetManager';
import type { CreatedElement, ElementFactoryContext } from '@engine/layouts/build/BuildTypes';
import type { NodeBase as DisplayNode } from '@engine/layouts/NodeBase';
import type { ElementConfig } from '@engine/layouts/types';

/**
 * Class-like factory contract for layout nodes.
 *
 * @remarks
 * Implemented by node classes via a static `create` method.
 *
 * @example
 * class MyNode {
 *   static create(id, cfg, ctx) {
 *     return { view: new PIXI.Container() };
 *   }
 * }
 */
export interface ElementNodeClass {
  /**
   * Create a display node for a layout element.
   *
   * @param {string} id - Element id from layout.
   * @param {ElementConfig} cfg - Element config payload.
   * @param {{ assets: AssetManager }} ctx - Asset access for node creation.
   * @returns {DisplayNode} Created node instance.
   * @example
   * const node = MyNode.create('root', cfg, { assets });
   */
  create(id: string, cfg: ElementConfig, ctx: { assets: AssetManager }): DisplayNode;
}

/**
 * Element factory function resolved by the layout builder.
 *
 * @example
 * const factory: ElementFactory = (id, cfg, ctx) => ({
 *   id,
 *   object: MyNode.create(id, cfg, { assets: ctx.assets }),
 * });
 */
export type ElementFactory = (
  id: string,
  cfg: ElementConfig,
  ctx: ElementFactoryContext,
) => CreatedElement;

/**
 * Provider group for layout element factories.
 *
 * @remarks
 * Stores a map of element name → node class and produces `element:*` providers.
 *
 * @example
 * const elements = new ElementFactoriesGroup()
 *   .add('Container', ContainerNode)
 *   .add('Sprite', SpriteNode);
 */
export class ElementFactoriesGroup extends ProviderGroup {
  private readonly elements = new Map<string, ElementNodeClass>();

  /**
   * Register a node class under a layout element name.
   *
   * @param {string} name - Layout element type name.
   * @param {ElementNodeClass} nodeClass - Node class with static `create`.
   * @returns {this} Fluent API for chaining.
   * @example
   * elements.add('Text', TextNode);
   */
  add(name: string, nodeClass: ElementNodeClass): this {
    this.elements.set(name, nodeClass);
    return this;
  }

  /**
   * Convert all element registrations into DI providers.
   *
   * @returns {Provider[]} Providers for element factories.
   * @example
   * const providers = elements.toProviders();
   */
  toProviders(): Provider[] {
    const providers: Provider[] = [];
    for (const [name, nodeClass] of this.elements.entries()) {
      providers.push(this.createProvider(name, nodeClass));
    }
    return providers;
  }

  private createProvider(name: string, nodeClass: ElementNodeClass): Provider {
    return {
      token: DiTokens.element(name),
      useFactory: () => this.createFactory(nodeClass),
      lifetime: 'transient',
    };
  }

  private createFactory(nodeClass: ElementNodeClass): ElementFactory {
    return (id: string, cfg: ElementConfig, ctx: ElementFactoryContext) => ({
      id,
      object: nodeClass.create(id, cfg, { assets: ctx.assets }),
    });
  }
}
