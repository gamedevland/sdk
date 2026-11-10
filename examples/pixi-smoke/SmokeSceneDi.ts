import { SceneDiDefinition } from '@gamedevland/engine/di';
export class SmokeSceneDi extends SceneDiDefinition {
  override getSceneKey(): string { return 'main'; }
  protected override registerProviders(): void {}
  protected override registerServices(): void {}
}
