import { NodeBase } from "../../layouts/NodeBase";
import { NodeBase as PixiNode } from "../../layouts/nodes/NodeBase";
import { Container } from "../../layouts/nodes/Container";
import { ThreeNode } from "../three/ThreeNode";
import { ThreeGroup } from "../three/ThreeGroup";

/** Logical ownership spans both render trees; renderer-specific children never cross their native parent. */
export class HybridRoot extends NodeBase {
  override readonly acceptsChildren = true;
  constructor(
    readonly world: ThreeGroup,
    readonly ui: Container,
    private readonly ownsViews = true,
  ) {
    super();
  }
  attach(child: NodeBase): void {
    if (child instanceof HybridRoot) {
      this.world.attach(child.world);
      this.ui.attach(child.ui);
    } else if (child instanceof ThreeNode) this.world.attach(child);
    else if (child instanceof PixiNode) this.ui.attach(child);
    else
      throw new Error("Hybrid roots only accept Three, Pixi or hybrid nodes");
  }
  detach(): void {
    this.world.detach();
    this.ui.detach();
  }
  protected destroyView(): void {
    this.detach();
    if (this.ownsViews) {
      this.world.view.clear();
      this.ui.view.destroy({ children: false });
    }
  }
}
