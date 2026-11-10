import { RenderTokens } from "../../rendering/RenderTokens";
import { ThreeRuntime } from "./ThreeRuntime";
import { ThreeRendererServices } from "./ThreeRendererServices";
import type { RendererModule } from "../../rendering/types";
import type { DiContainer } from "../../di/DiContainer";
import type { AssetManager } from "../../assets/AssetManager";
export class ThreeRendererModule implements RendererModule {
  constructor(private readonly options: unknown = {}) {}
  register(container: DiContainer, assets: AssetManager): void {
    new ThreeRendererServices().register(container, assets);
    container.register({
      token: RenderTokens.Runtime,
      useFactory: () => new ThreeRuntime(this.options),
      lifetime: "singleton",
      source: "system",
    });
  }
}
