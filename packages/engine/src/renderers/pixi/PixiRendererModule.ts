import { PixiRendererServices } from './PixiRendererServices';
import { RenderTokens } from '../../rendering/RenderTokens';
import type { DiContainerInterface } from '../../di/types';
import type { AssetManager } from '../../assets/AssetManager';
import type { ScreenConfig } from '../../screen/types';
import type { RendererModule } from '../../rendering/types';
export class PixiRendererModule implements RendererModule {
  register(container: DiContainerInterface, assets: AssetManager, config: ScreenConfig): void {
    const runtime = new PixiRendererServices().createRuntime(container, assets, config);
    container.register({
      token: RenderTokens.Runtime,
      useValue: runtime,
      lifetime: 'singleton',
      source: 'system',
    });
  }
}
