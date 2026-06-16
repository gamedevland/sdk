import type { NodeBase } from '@engine/layouts';
import type { Container } from '@engine/layouts';
import type { DisplayConfig, ElementConfig } from '@engine/layouts/types';

export interface PrefabDefinition {
  element: ElementConfig;
}

export interface PrefabSpawnParams {
  prefabId: string;
  parent: Container;
  localId: string;
  overrides?: Partial<DisplayConfig>;
}

export interface SpawnedPrefab<TNode extends NodeBase = NodeBase> {
  node: TNode;
  dispose(): Promise<void>;
}

export interface EnsuredPrefabChild<TNode extends NodeBase = NodeBase> {
  node: TNode;
  readonly created: boolean;
  dispose(): Promise<void>;
}
