import { DiTokens } from "../../di/tokens";
import { ThreeElements } from "./ThreeElements";
import { GlbLoader } from "./GlbLoader";
import type { DiContainer } from "../../di/DiContainer";
import type { AssetManager } from "../../assets/AssetManager";

/** Registers Three-specific capabilities independently of the selected render surface. */
export class ThreeRendererServices {
  register(container: DiContainer, assets: AssetManager): void {
    assets.registerLoader("model", new GlbLoader());
    const factory = new ThreeElements().factory();
    for (const type of [
      "Group",
      "Mesh",
      "Model",
      "OrthographicCamera",
      "PerspectiveCamera",
      "AmbientLight",
      "DirectionalLight",
    ]) {
      container.register({
        token: DiTokens.element(type),
        useValue: factory,
        source: "system",
      });
    }
  }
}
