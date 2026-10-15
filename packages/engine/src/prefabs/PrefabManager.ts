import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import { BuildContextFactory } from '@engine/layouts/build/BuildContextFactory';
import { BuiltElementsRegistry } from '@engine/layouts/build/BuiltElementsRegistry';
import { BuiltTreeActivator } from '@engine/layouts/build/BuiltTreeActivator';
import { ElementCreator } from '@engine/layouts/build/ElementCreator';
import { DisplayPipeline } from '@engine/layouts/display/DisplayPipeline';

import type { PrefabRepository } from './PrefabRepository';
import type { PrefabSpawnParams, SpawnedPrefab } from './types';
import type { PrefabRuntime } from '@engine/core';
import type { Container, NodeBase } from '@engine/layouts';
import type { BuiltElement } from '@engine/layouts/build/BuildTypes';
import type { ElementConfig } from '@engine/layouts/types';

export class PrefabManager {
  private readonly activator = new BuiltTreeActivator();

  constructor(
    private readonly engine: PrefabRuntime,
    private readonly repository: PrefabRepository,
  ) {}

  async spawn<TNode extends NodeBase = NodeBase>(
    params: PrefabSpawnParams,
  ): Promise<SpawnedPrefab<TNode>> {
    return this.spawnToContainer<TNode>(params);
  }

  async spawnToContainer<TNode extends NodeBase = NodeBase>(
    params: PrefabSpawnParams,
  ): Promise<SpawnedPrefab<TNode>> {
    this.assertChildDoesNotExist(params.parent, params.localId);
    const base = await this.repository.getElement(params.prefabId);
    const element = this.applyOverrides(base, params.overrides);

    const buildCtx = new BuildContextFactory().create(this.engine.assets, {
      container: this.engine.di,
      screen: this.engine.screen,
    });
    const textStylesConfigId = this.engine.config.layouts?.textStylesConfigId;
    const ctx = {
      ...buildCtx,
      engine: this.engine,
      ...(textStylesConfigId === undefined ? {} : { textStylesConfigId }),
    };
    const registry = new BuiltElementsRegistry();
    const pipeline = new DisplayPipeline({
      root: params.parent.view,
      screen: this.engine.screen,
    });
    const creator = new ElementCreator(ctx, registry, pipeline);

    const parentId = params.parent.id;
    if (!parentId) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.PrefabMissingRequired,
        subsystem: EngineSubsystem.Prefab,
        message: 'Parent node id is missing',
        details: { method: 'PrefabManager.spawnToContainer', prefabId: params.prefabId },
      });
    }
    const fullId = `${parentId}.${params.localId}`;
    const parentBuilt = this.createParentBuilt(parentId, params.parent);
    const built = creator.create(fullId, element, parentBuilt);
    if (!built) {
      throw EngineErrorFactory.invariant({
        code: EngineErrorCode.PrefabInvariantViolation,
        subsystem: EngineSubsystem.Prefab,
        message: 'Failed to build prefab',
        details: { method: 'PrefabManager.spawnToContainer', prefabId: params.prefabId, fullId },
      });
    }
    this.activator.activateTree(built);

    const node = built.object as TNode;
    params.parent.addChild(params.localId, node);
    params.parent.view.addChild(node.view);

    let disposed = false;
    return {
      node,
      dispose: async () => {
        if (disposed) return;
        disposed = true;
        if (params.parent.hasChild(params.localId) && params.parent.getChild(params.localId) === node) {
          params.parent.removeChild(params.localId);
        }
        const parent = node.view.parent;
        if (parent) {
          parent.removeChild(node.view);
        }
        await node.destroy();
      },
    };
  }

  private createParentBuilt(parentId: string, parent: Container): BuiltElement {
    return {
      id: parentId,
      object: parent,
      children: new Map<string, BuiltElement>(),
      cfg: { type: 'Container' },
    };
  }

  private applyOverrides(element: ElementConfig, overrides?: PrefabSpawnParams['overrides']): ElementConfig {
    if (!overrides) return element;
    return {
      ...element,
      props: {
        ...(element.props ?? {}),
        ...overrides,
      },
    };
  }

  private assertChildDoesNotExist(parent: Container, localId: string): void {
    if (!parent.hasChild(localId)) return;
    throw EngineErrorFactory.conflict({
      code: EngineErrorCode.PrefabConflict,
      subsystem: EngineSubsystem.Prefab,
      message: 'Child already exists under parent container',
      details: {
        method: 'PrefabManager.assertChildDoesNotExist',
        localId,
        parentId: String(parent.id),
      },
    });
  }
}
