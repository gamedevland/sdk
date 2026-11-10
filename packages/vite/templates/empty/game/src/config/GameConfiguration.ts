import { PixiRendererModule } from '@gamedevland/engine/renderers/pixi';
import { AssetManifestBuilder } from '@gamedevland/engine/assets';
import type { GameConfig } from '@gamedevland/engine/core';
import { MainSceneDefinition } from '../scenes/main/MainSceneDefinition';
import { ProjectDi } from './ProjectDi';

export class GameConfiguration {
  static readonly config: GameConfig = {
    system: {
      renderer: new PixiRendererModule(),
      canvasBackground: '#07111f',
      screen: {
        land: { width: 960, height: 540, fit: 'height' },
        port: { width: 540, height: 960, fit: 'height' },
        dpr: 'native', maxDpr: 2, render: { maxCanvasPixels: 1500000 },
      },
      boot: { configs: { engineStartBundles: ['configs'] } },
      audio: { volumeConfigId: 'json/configs/audio/sounds-volumes.json' },
    },
    assets: {
      bundles: new AssetManifestBuilder({
        configsJson: import.meta.glob<string>('../../assets/json/configs/**/*.json', { eager: true, query: '?url', import: 'default' }),
        layoutsJson: import.meta.glob<string>('../../assets/json/layouts/**/*.json', { eager: true, query: '?url', import: 'default' }),
        audio: {}, fonts: {}, images: {}, localesJson: {}, prefabsJson: {},
      }).build(),
      preload: ['layouts'],
    },
    scenes: { initial: 'main', map: { main: MainSceneDefinition.config } },
    di: new ProjectDi(),
  };
}
