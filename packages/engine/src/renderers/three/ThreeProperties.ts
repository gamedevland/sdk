import { Camera, DirectionalLight } from 'three';
import { ThreeNode } from './ThreeNode';
import { SchemaDecoder as S } from '../../validation/schema/SchemaDecoder';
import { ThreeSchemas } from './ThreeSchemas';
import type { LayoutProperties } from '../../rendering/types';
import type { NodeBase } from '../../layouts/NodeBase';
import type { ElementConfig } from '../../layouts/types';
export class ThreeProperties implements LayoutProperties {
  apply(node: NodeBase, cfg: ElementConfig): void {
    const owner = node.requireNode(ThreeNode);
    const raw = cfg.props ?? {};
    const transforms = S.decode(raw, S.object({position: S.optional(ThreeSchemas.vector), rotation: S.optional(ThreeSchemas.vector), scale: S.optional(ThreeSchemas.vector), visible: S.optional(S.boolean())}), node.id + '.props');
    if (transforms.position) owner.setPosition(transforms.position);
    if (transforms.rotation) owner.setRotation(transforms.rotation);
    if (transforms.scale) owner.setScale(transforms.scale);
    owner.view.visible = transforms.visible ?? true;
    if (owner.view instanceof Camera) {
      const props = S.decode(raw, ThreeSchemas.camera, node.id + '.props');
      owner.view.lookAt(props.lookAt.x, props.lookAt.y, props.lookAt.z);
    }
    if (owner.view instanceof DirectionalLight) {
      const props = S.decode(raw, ThreeSchemas.light, node.id + '.props');
      if (props.target) owner.view.target.position.set(props.target.x, props.target.y, props.target.z);
      // A target must be part of the light hierarchy so world transforms update.
      owner.view.target.updateMatrixWorld();
    }
    owner.view.name = node.getRequiredId();
  }
}
