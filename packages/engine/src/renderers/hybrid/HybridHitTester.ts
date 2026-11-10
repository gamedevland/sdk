import type { HitTester } from "../../rendering/types";
import type { HitTarget } from "../../input/types";

/** UI is resolved before world hits. Node-first input propagation decides whether a hit consumes the event. */
export class HybridHitTester implements HitTester {
  constructor(
    private readonly ui: HitTester,
    private readonly world: HitTester,
  ) {}
  hitTest(point: { x: number; y: number }): { target?: HitTarget } {
    const hit = this.ui.hitTest(point);
    return hit.target ? hit : this.world.hitTest(point);
  }
  addInteractive(id: string): void {
    this.ui.addInteractive(id);
    this.world.addInteractive(id);
  }
  removeInteractive(id: string): void {
    this.ui.removeInteractive(id);
    this.world.removeInteractive(id);
  }
  clearInteractive(): void {
    this.ui.clearInteractive();
    this.world.clearInteractive();
  }
}
