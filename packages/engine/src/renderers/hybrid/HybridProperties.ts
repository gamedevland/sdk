import { ThreeNode } from "../three/ThreeNode";
import { NodeBase as PixiNode } from "../../layouts/nodes/NodeBase";
import type { NodeBase } from "../../layouts/NodeBase";
import type { LayoutProperties } from "../../rendering/types";
import type { ElementConfig } from "../../layouts/types";

export class HybridProperties implements LayoutProperties {
  constructor(
    private readonly world: LayoutProperties,
    private readonly ui: LayoutProperties,
  ) {}
  apply(node: NodeBase, config: ElementConfig): void {
    if (node instanceof ThreeNode) this.world.apply(node, config);
    else if (node instanceof PixiNode) this.ui.apply(node, config);
    else throw new Error("Properties require a renderer-owned node");
  }
}
