import { RenderTokens } from "../../rendering/RenderTokens";
import { HybridRuntime } from "./HybridRuntime";
import { ThreeRuntime } from "../three/ThreeRuntime";
import { ThreeRendererServices } from "../three/ThreeRendererServices";
import { PixiRendererServices } from "../pixi/PixiRendererServices";
import type { RendererModule } from "../../rendering/types";
import type { DiContainer } from "../../di/DiContainer";
import type { AssetManager } from "../../assets/AssetManager";
import type { ScreenConfig } from "../../screen/types";

export class HybridRendererModule implements RendererModule {
  constructor(private readonly threeOptions: unknown = {}) {}
  register(
    container: DiContainer,
    assets: AssetManager,
    screen: ScreenConfig,
  ): void {
    new ThreeRendererServices().register(container, assets);
    const ui = new PixiRendererServices().createRuntime(container, assets, screen, true);
    container.register({
      token: RenderTokens.Runtime,
      useFactory: () =>
        new HybridRuntime(
          new ThreeRuntime(this.threeOptions),
          ui,
        ),
      lifetime: "singleton",
      source: "system",
    });
  }
}
