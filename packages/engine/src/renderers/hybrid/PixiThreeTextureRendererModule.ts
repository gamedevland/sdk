import { PixiRendererModule } from '../pixi/PixiRendererModule';
import { ThreeRendererServices } from '../three/ThreeRendererServices';
import type { RendererModule } from '../../rendering/types';
import type { DiContainerInterface } from '../../di/types';
import type { AssetManager } from '../../assets/AssetManager';
import type { ScreenConfig } from '../../screen/types';

/** Pixi remains the primary renderer; Three model assets and offscreen surfaces are available. */
export class PixiThreeTextureRendererModule implements RendererModule {
  register(container: DiContainerInterface, assets: AssetManager, screen: ScreenConfig): void {
    new ThreeRendererServices().register(container, assets);
    new PixiRendererModule().register(container, assets, screen);
  }
}
