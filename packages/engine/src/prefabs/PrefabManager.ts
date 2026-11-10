import { BuildContextFactory } from '../layouts/build/BuildContextFactory';
import { LayoutBuilder } from '../layouts/build/LayoutBuilder';
import { BuiltTreeActivator } from '../layouts/build/BuiltTreeActivator';
import type { NodeBase } from '../layouts/NodeBase';
import type { PrefabRuntime } from '../core/ports/PrefabRuntime';
import type { PrefabRepository } from './PrefabRepository';
import type { PrefabSpawnParams, SpawnedPrefab, EnsuredPrefabChild } from './types';
export class PrefabManager {
  constructor(private readonly engine: PrefabRuntime, private readonly repository: PrefabRepository) {}
  private readonly pending = new WeakMap<NodeBase, Map<string, Promise<SpawnedPrefab>>>();
  spawn(params: PrefabSpawnParams): Promise<SpawnedPrefab> { return this.spawnToContainer(params); }
  async ensure(params: PrefabSpawnParams): Promise<EnsuredPrefabChild> {
    if (params.parent.destroyed) throw new Error('Prefab parent is disposed');
    if (params.parent.hasChild(params.localId)) return {node: params.parent.getChild(params.localId), created: false, dispose: async () => {}};
    let requests = this.pending.get(params.parent);
    if (!requests) { requests = new Map(); this.pending.set(params.parent, requests); }
    const existing = requests.get(params.localId);
    if (existing) { const result = await existing; return {node: result.node, created: false, dispose: async () => {}}; }
    const operation = this.spawnToContainer(params);
    requests.set(params.localId, operation);
    try { return {...await operation, created: true}; }
    finally { requests.delete(params.localId); }
  }
  async spawnToContainer(params: PrefabSpawnParams): Promise<SpawnedPrefab> {
    if (params.parent.destroyed || !params.parent.acceptsChildren || params.parent.hasChild(params.localId)) throw new Error('Invalid prefab parent or duplicate ID: ' + params.localId);
    const scope = this.engine.scenes.getCurrentSceneScopeVersion();
    const base = await this.repository.getElement(params.prefabId);
    if (scope !== this.engine.scenes.getCurrentSceneScopeVersion()) throw new Error('Prefab scene expired');
    const id = params.parent.getRequiredId() + '.' + params.localId;
    const ctx = new BuildContextFactory().create(this.engine.assets, {container: this.engine.di, screen: this.engine.screen});
    ctx.engine = this.engine;
    const textStylesConfigId = this.engine.config.layouts?.textStylesConfigId;
    if (textStylesConfigId !== undefined) ctx.textStylesConfigId = textStylesConfigId;
    const built = await new LayoutBuilder(ctx).build({[id]: {...base, props: {...base.props, ...params.overrides}}}, params.parent);
    const entry = built.elements.get(id);
    if (!entry) { await built.root.destroy(); throw new Error('Prefab root was not built'); }
    const node = entry.object;
    // Detach from temporary build root before transferring ownership.
    built.root.removeChild(id);
    await built.root.destroy();
    try {
      if (params.parent.destroyed || scope !== this.engine.scenes.getCurrentSceneScopeVersion() || params.parent.hasChild(params.localId)) throw new Error('Prefab scene expired or ID already exists');
      params.parent.addChild(params.localId, node);
      params.parent.attach(node);
      new BuiltTreeActivator().activateTree(entry);
    } catch (error) {
      if (params.parent.hasChild(params.localId) && params.parent.getChild(params.localId) === node) params.parent.removeChild(params.localId);
      await node.destroy(); throw error;
    }
    let disposed = false;
    return { node, dispose: async () => {
      if (disposed) return;
      disposed = true;
      if (params.parent.hasChild(params.localId) && params.parent.getChild(params.localId) === node) params.parent.removeChild(params.localId);
      await node.destroy();
    }};
  }
}
