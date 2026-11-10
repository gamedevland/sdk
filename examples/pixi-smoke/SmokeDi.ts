import { GameDiDefinition } from '@gamedevland/engine/di';
import { SmokeGlobalDi } from './SmokeGlobalDi';
import { SmokeSceneDi } from './SmokeSceneDi';
export class SmokeDi extends GameDiDefinition {
  protected override createGlobalDefinition() { return new SmokeGlobalDi(); }
  protected override createSceneDefinitions() { return [new SmokeSceneDi()]; }
}
