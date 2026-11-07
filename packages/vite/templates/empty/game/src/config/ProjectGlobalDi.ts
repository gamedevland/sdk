import { GlobalDiDefinition } from '@gamedevland/engine/di';
import type { ElementFactoriesGroup } from '@gamedevland/engine/di';
import { Container, Graphics, Text } from '@gamedevland/engine/layouts';

export class ProjectGlobalDi extends GlobalDiDefinition {
  protected override registerElements(group: ElementFactoriesGroup): void {
    group.add('Container', Container).add('Graphics', Graphics).add('Text', Text);
  }
  protected override registerComponents(): void {}
  protected override registerCommands(): void {}
  protected override registerServices(): void {}
}
