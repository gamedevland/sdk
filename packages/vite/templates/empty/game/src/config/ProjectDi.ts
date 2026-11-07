import { GameDiDefinition } from '@gamedevland/engine/di';
import { MainSceneDi } from '../scenes/main/MainSceneDi';
import { ProjectGlobalDi } from './ProjectGlobalDi';

export class ProjectDi extends GameDiDefinition {
  protected override createGlobalDefinition() { return new ProjectGlobalDi(); }
  protected override createSceneDefinitions() { return [new MainSceneDi()]; }
}
