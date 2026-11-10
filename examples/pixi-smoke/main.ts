import { Engine } from '@gamedevland/engine';
import { PixiRendererModule } from '@gamedevland/engine/renderers/pixi';
import { SmokeDi } from './SmokeDi';
import { SmokeScene } from './SmokeScene';
await Engine.run('#app', {
  system: {renderer: new PixiRendererModule(), canvasBackground: '#142b39', screen: {
    land: {width: 960, height: 540}, port: {width: 540, height: 960}, dpr: 'native', maxDpr: 2,
  }},
  assets: {bundles: [{name: 'layouts', assets: [{id: 'layout', type: 'json', importedUrl: './layout.json'}]}], preload: ['layouts']},
  scenes: {initial: 'main', map: {main: {key: 'main', useClass: SmokeScene, layout: 'layout', fsm: {initial: 'ready', states: {ready: {on: {SMOKE_TAP: {actions: ['Pulse']}}}}}}}},
  di: new SmokeDi(),
});
