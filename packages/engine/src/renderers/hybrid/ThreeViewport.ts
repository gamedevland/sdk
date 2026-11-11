import { Sprite as NativeSprite } from 'pixi.js';
import { Sprite } from '../../layouts/nodes/Sprite';
import { ThreeViewportComponent } from './ThreeViewportComponent';
import type { ElementFactory } from '../../di/ElementFactoriesGroup';
import type { SceneLayout } from '../../layouts/scene/SceneLayout';

/** A Pixi leaf displaying its own isolated, declarative Three scene. */
export class ThreeViewport extends Sprite {
  private static readonly ownerId = '$threeViewport';
  private readonly content: ThreeViewportComponent;

  constructor(options: unknown) {
    const content = new ThreeViewportComponent(options);
    super(new NativeSprite(content.surface.texture));
    this.content = content;
    this.addComponent(ThreeViewport.ownerId, content);
    content.init(this);
  }

  /** Renderer module registration; asynchronous preparation participates in layout rollback. */
  static factory(): ElementFactory {
    return (id, config) => {
      if (config.props?.asset !== undefined) throw new Error(id + ': ThreeViewport cannot use props.asset');
      if (config.components?.[ThreeViewport.ownerId]) throw new Error(id + ': reserved ThreeViewport component id');
      const node = new ThreeViewport(config.props);
      return { id, object: node, prepare: () => node.content.prepare() };
    };
  }

  /** Available in component onReady; IDs are local to this viewport's Three layout. */
  get world(): SceneLayout { return this.content.world; }

  /** Schedule one texture upload in the next presentation phase. */
  invalidate(): void { this.content.invalidate(); }

  /** Resize the texture and camera projection, preserving the Pixi transform. */
  resize(width: number, height: number, resolution?: number): void {
    this.content.resize(width, height, resolution);
  }
}
