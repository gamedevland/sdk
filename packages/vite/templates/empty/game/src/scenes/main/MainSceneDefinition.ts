import type { SceneConfig } from '@gamedevland/engine/core';
import { MainScene } from './MainScene';

export class MainSceneDefinition {
  static readonly config: SceneConfig = {
    key: 'main', useClass: MainScene,
    layout: 'json/layouts/scenes/main/layout.json',
    fsm: { initial: 'ready', states: { ready: {} } },
  };
}
