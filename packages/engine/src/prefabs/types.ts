import type { ElementConfig } from '@engine/layouts/types';
import type { NodeBase } from '@engine/layouts';


export interface PrefabDefinition {
  element: ElementConfig;
}

export interface PrefabSpawnParams {
  prefabId: string;
  parent: NodeBase;
  localId: string;
  overrides?: object;
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
