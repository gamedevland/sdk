import type { NodeBase as LayoutNode } from '../NodeBase';
import { PixiServices } from '@engine/renderers/pixi/PixiServices';
/**
 * Display node wrapping a Pixi Container. Acts as a generic parent/group node.
 *
 * Used for grouping other nodes and applying transforms without rendering content itself.
 */
import * as PIXI from 'pixi.js';

import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { NodeBase } from './NodeBase';
import { Sprite } from './Sprite';
import { TilingSprite } from './TilingSprite';

import type { ContainerNode, DisplayNode } from './types';
import type { AssetManager } from '../../assets/AssetManager';
import type { EnsuredPrefabChild, SpawnedPrefab } from '../../prefabs/types';
import type { DisplayConfig, ElementConfig } from '@engine/renderers/pixi/types';
import type { AssetId } from '@engine/assets';
import type { ParticlePreset, ParticleVec2 } from '@engine/particles';

export class Container extends NodeBase implements ContainerNode {
  override readonly acceptsChildren = true;
  constructor(private readonly container: PIXI.Container) {
    super(container);
    this.setKind('container');
  }
  /** Factory for layout element of type 'Container'. */
  static create(_id: string, _cfg: ElementConfig, _ctx: { assets: AssetManager }): DisplayNode {
    return new Container(new PIXI.Container());
  }

  override get view(): PIXI.Container {
    return this.container;
  }

  async spawnPrefab(params: {
    prefabId: string;
    localId: string;
    overrides?: Partial<DisplayConfig>;
  }): Promise<SpawnedPrefab<LayoutNode>> {
    const request = {
      prefabId: params.prefabId,
      parent: this,
      localId: params.localId,
      ...(params.overrides ? { overrides: params.overrides } : {}),
    };
    return this.engine.prefabs.spawnToContainer(request);
  }

  async ensureChildFromPrefab(params: {
    prefabId: string;
    localId: string;
    overrides?: Partial<DisplayConfig>;
  }): Promise<EnsuredPrefabChild<LayoutNode>> {
    return this.engine.prefabs.ensure({parent: this, ...params});
  }

  emitBurst(params: { preset: ParticlePreset; position: ParticleVec2 }): void {
    this.engine.di.get(PixiServices.ParticlesManager).emitBurst({
      preset: params.preset,
      parent: this,
      position: params.position,
    });
  }

  async emitBurstFromAsset(params: {
    presetAssetId: AssetId;
    position: ParticleVec2;
    source?: string;
  }): Promise<void> {
    await this.engine.di.get(PixiServices.ParticlesManager).emitBurstFromAsset({
      presetAssetId: params.presetAssetId,
      parent: this,
      position: params.position,
      ...(params.source === undefined ? {} : { source: params.source }),
    });
  }

  /**
   * Runtime helper: create a Container node as a child of this container.
   *
   * @param {string} localId - Local child id under this container.
   * @param {ElementConfig['props']} [props] - Optional display properties for the container.
   * @returns {Container} Newly created container node already attached to this container.
   */
  addContainerChild(localId: string, props?: ElementConfig['props']): Container {
    const parentId = this.id;
    if (!parentId) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.LayoutMissingRequired,
        subsystem: EngineSubsystem.Layout,
        message: 'Container has no id',
        details: { method: 'Container.addContainerChild', localId },
      });
    }
    const engine = this.engine;

    const fullId = `${parentId}.${localId}`;
    const cfg: ElementConfig = {
      type: 'Container',
      props: props ?? {},
    };

    const containerNode = Container.create(fullId, cfg, { assets: engine.assets });
    if (!(containerNode instanceof Container)) {
      throw EngineErrorFactory.invariant({
        code: EngineErrorCode.LayoutInvariantViolation,
        subsystem: EngineSubsystem.Layout,
        message: 'Container factory returned invalid node type',
        details: { method: 'Container.addContainerChild', fullId },
      });
    }

    containerNode.engine = engine;
    containerNode.id = fullId;

    this.addChild(localId, containerNode);
    this.view.addChild(containerNode.view);
    this.applyRuntimeContainerProps(containerNode, props);

    return containerNode;
  }

  /**
   * Runtime helper: create a Sprite node as a child of this container.
   *
   * @param {string} localId - Local child id under this container (e.g. 'sticker01').
   * @param {string} [assetId] - Asset id; when omitted, falls back to `localId`.
   * @param {ElementConfig['props']} [props] - Optional display properties for the sprite.
   * @returns {Sprite} Newly created sprite node already attached to this container.
   */
  addSpriteChild(localId: string, assetId?: string, props?: ElementConfig['props']): Sprite {
    const parentId = this.id;
    if (!parentId) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.LayoutMissingRequired,
        subsystem: EngineSubsystem.Layout,
        message: 'Container has no id',
        details: { method: 'Container.addSpriteChild', localId },
      });
    }
    const engine = this.engine;

    const fullId = `${parentId}.${localId}`;
    const resolvedAssetId = assetId ?? localId;

    const cfg: ElementConfig = {
      type: 'Sprite',
      props: {
        asset: resolvedAssetId,
        ...(props ?? {}),
      },
    };

    const spriteNode = Sprite.create(fullId, cfg, { assets: engine.assets });
    if (!(spriteNode instanceof Sprite)) {
      throw EngineErrorFactory.invariant({
        code: EngineErrorCode.LayoutInvariantViolation,
        subsystem: EngineSubsystem.Layout,
        message: 'Sprite factory returned invalid node type',
        details: { method: 'Container.addSpriteChild', fullId },
      });
    }

    spriteNode.engine = engine;
    spriteNode.id = fullId;

    this.addChild(localId, spriteNode);
    this.view.addChild(spriteNode.view);
    this.applyRuntimeSpriteProps(spriteNode, props);

    return spriteNode;
  }

  addTilingSpriteChild(
    localId: string,
    assetId?: string,
    props?: ElementConfig['props'],
  ): TilingSprite {
    const parentId = this.id;
    if (!parentId) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.LayoutMissingRequired,
        subsystem: EngineSubsystem.Layout,
        message: 'Container has no id',
        details: { method: 'Container.addTilingSpriteChild', localId },
      });
    }
    const engine = this.engine;

    const fullId = `${parentId}.${localId}`;
    const cfg: ElementConfig = {
      type: 'TilingSprite',
      props: {
        ...(assetId === undefined ? {} : { asset: assetId }),
        ...(props ?? {}),
      },
    };

    const tilingSpriteNode = TilingSprite.create(fullId, cfg, { assets: engine.assets });
    if (!(tilingSpriteNode instanceof TilingSprite)) {
      throw EngineErrorFactory.invariant({
        code: EngineErrorCode.LayoutInvariantViolation,
        subsystem: EngineSubsystem.Layout,
        message: 'TilingSprite factory returned invalid node type',
        details: { method: 'Container.addTilingSpriteChild', fullId },
      });
    }

    tilingSpriteNode.engine = engine;
    tilingSpriteNode.id = fullId;

    this.addChild(localId, tilingSpriteNode);
    this.view.addChild(tilingSpriteNode.view);
    this.applyRuntimeSpriteProps(tilingSpriteNode, props);

    return tilingSpriteNode;
  }

  private applyRuntimeSpriteProps(
    spriteNode: Sprite | TilingSprite,
    props: ElementConfig['props'] | undefined,
  ): void {
    this.applyRuntimeContainerProps(spriteNode, props);
    if (props?.anchor !== undefined) {
      if (typeof props.anchor === 'number') {
        spriteNode.setAnchor(props.anchor);
      } else {
        spriteNode.setAnchor({
          x: props.anchor.x ?? 0.5,
          y: props.anchor.y ?? 0.5,
        });
      }
    }
  }

  private applyRuntimeContainerProps(
    containerNode: Container | Sprite | TilingSprite,
    props: ElementConfig['props'] | undefined,
  ): void {
    if (typeof props?.x === 'number') {
      containerNode.setX(props.x);
    }
    if (typeof props?.y === 'number') {
      containerNode.setY(props.y);
    }
    if (props?.scale !== undefined) {
      if (typeof props.scale === 'number') {
        containerNode.setScale(props.scale);
      } else {
        containerNode.setScale({
          x: props.scale.x ?? 1,
          y: props.scale.y ?? 1,
        });
      }
    }
    if (props?.rotation !== undefined) {
      containerNode.setRotation(props.rotation);
    }
    if (props?.angle !== undefined) {
      containerNode.setAngle(props.angle);
    }
    if (props?.alpha !== undefined) {
      containerNode.setAlpha(props.alpha);
    }
    if (props?.visible !== undefined) {
      containerNode.setVisible(props.visible);
    }
    if (props?.zIndex !== undefined) {
      containerNode.setZIndex(props.zIndex);
    }
  }
}
