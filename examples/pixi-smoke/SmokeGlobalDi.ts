import { GlobalDiDefinition, DiTokens } from '@gamedevland/engine/di';
import type { ComponentsGroup, CommandsGroup, ValuesGroupRegistrar } from '@gamedevland/engine/di';
import { SmokeTapComponent } from './SmokeTapComponent';
import { SmokePulseAction } from './SmokePulseAction';
import { SmokePulseCommand } from './SmokePulseCommand';
export class SmokeGlobalDi extends GlobalDiDefinition {
  protected override registerElements(): void {}
  protected override registerComponents(group: ComponentsGroup): void { group.add('Tap', SmokeTapComponent); }
  protected override registerCommands(group: CommandsGroup): void { group.add('Pulse', SmokePulseCommand); }
  protected override registerServices(registrar: ValuesGroupRegistrar): void { registrar.transientClass(DiTokens.action('Pulse'), SmokePulseAction); }
}
