import { Object3D } from 'three';
import { NodeBase } from '../../layouts/NodeBase';
import { SchemaDecoder } from '../../validation/schema/SchemaDecoder';
import { ThreeSchemas } from './ThreeSchemas';
import type { TweenHandle } from '../../tween/types';
export class ThreeNode extends NodeBase {
  constructor(readonly view: Object3D, private readonly release?: () => void) { super(); }
  attach(child: NodeBase): void {
    if (!this.acceptsChildren) throw new Error('Cannot attach children to a leaf node');
    this.view.add(child.requireNode(ThreeNode).view);
  }
  detach(): void { this.view.removeFromParent(); }
  setPosition(value: {x: number; y: number; z: number}): this {
    const position = SchemaDecoder.decode(value, ThreeSchemas.vector, 'ThreeNode.setPosition');
    this.view.position.set(position.x, position.y, position.z); return this;
  }
  setRotation(value: {x: number; y: number; z: number}): this {
    const rotation = SchemaDecoder.decode(value, ThreeSchemas.vector, 'ThreeNode.setRotation');
    this.view.rotation.set(rotation.x, rotation.y, rotation.z, 'XYZ'); return this;
  }
  setScale(value: {x: number; y: number; z: number}): this {
    const scale = SchemaDecoder.decode(value, ThreeSchemas.vector, 'ThreeNode.setScale');
    this.view.scale.set(scale.x, scale.y, scale.z); return this;
  }
  moveTo(value: {x: number; y: number; z: number}, durationSeconds: number): TweenHandle {
    const position = SchemaDecoder.decode(value, ThreeSchemas.vector, 'ThreeNode.moveTo');
    return this.engine.tweens.to(this.view.position, position, {duration: durationSeconds});
  }
  protected destroyView(): void {
    this._engine?.tweens.kill(this.view.position);
    this._engine?.tweens.kill(this.view.rotation);
    this._engine?.tweens.kill(this.view.scale);
    this.detach(); this.release?.(); this.view.clear();
  }
}
