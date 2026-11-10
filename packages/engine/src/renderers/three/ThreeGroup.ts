import { Group } from 'three';
import { ThreeNode } from './ThreeNode';
import type { ElementConfig } from '../../layouts/types';
export class ThreeGroup extends ThreeNode {
  override readonly acceptsChildren = true;
  constructor() { super(new Group()); }
  spawnPrefab(params: {prefabId: string; localId: string; overrides?: NonNullable<ElementConfig['props']>}) {
    return this.engine.prefabs.spawnToContainer({parent: this, ...params});
  }
  async ensureChildFromPrefab(params: {prefabId: string; localId: string; overrides?: NonNullable<ElementConfig['props']>}) {
    return this.engine.prefabs.ensure({parent: this, ...params});
  }
}
