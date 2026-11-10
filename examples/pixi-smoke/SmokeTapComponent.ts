import { BaseComponent } from '@gamedevland/engine/layouts';
import { NodeBase } from '@gamedevland/engine/renderers/pixi';
export class SmokeTapComponent extends BaseComponent<NodeBase> {
  protected readonly nodeType = NodeBase;
  private off: (() => void) | undefined;
  override onEnable(): void { this.off = this.node.input.onTap(() => this.node.events.emit({type: 'SMOKE_TAP', data: {}})); }
  override onDisable(): void { this.off?.(); this.off = undefined; }
}
