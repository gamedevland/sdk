import { PixiServices } from "./PixiServices";
import { PixiRuntime } from './PixiRuntime';
import { PixiTextureGenerator } from './PixiTextureGenerator';
import { ParticlesFactory } from "../../particles/ParticlesFactory";
import { PhysicsManager } from "../../physics/PhysicsManager";
import { TextureAssetResolver } from "../../layouts/assets/TextureAssetResolver";
import { ElementFactoriesGroup } from "../../di/ElementFactoriesGroup";
import { Container } from "../../layouts/nodes/Container";
import { Sprite } from "../../layouts/nodes/Sprite";
import { NineSliceSprite } from "../../layouts/nodes/NineSliceSprite";
import { Graphics } from "../../layouts/nodes/Graphics";
import { Text } from "../../layouts/nodes/Text";
import { Empty } from "../../layouts/nodes/Empty";
import { TilingSprite } from "../../layouts/nodes/TilingSprite";
import { TexturedRope } from "../../layouts/nodes/TexturedRope";
import type { DiContainer } from "../../di/DiContainer";
import type { AssetManager } from "../../assets/AssetManager";
import type { ParticlesManager } from "../../particles/ParticlesManager";
import type { ScreenConfig } from '../../screen/types';

/** Shared registration for Pixi-only and transparent-overlay compositions. */
export class PixiRendererServices {
  createRuntime(container: DiContainer, assets: AssetManager, screen: ScreenConfig, transparent = false): PixiRuntime {
    const runtime = new PixiRuntime(screen, this.register(container, assets), transparent, container.get(PixiServices.TextureAssetResolver));
    container.register({
      token: PixiServices.TextureGenerator,
      useValue: new PixiTextureGenerator(() => runtime.app.renderer),
      source: 'system',
    });
    return runtime;
  }
  register(container: DiContainer, assets: AssetManager): ParticlesManager {
    const particles = ParticlesFactory.createDefault(assets);
    container.register({
      token: PixiServices.ParticlesManager,
      useValue: particles,
      source: "system",
    });
    container.register({
      token: PixiServices.PhysicsManager,
      useValue: new PhysicsManager(),
      source: "system",
    });
    container.register({
      token: PixiServices.TextureAssetResolver,
      useValue: new TextureAssetResolver(assets),
      source: "system",
    });
    const nodes = new ElementFactoriesGroup()
      .add("Container", Container)
      .add("Sprite", Sprite)
      .add("NineSliceSprite", NineSliceSprite)
      .add("Graphics", Graphics)
      .add("Text", Text)
      .add("Empty", Empty)
      .add("TilingSprite", TilingSprite)
      .add("TexturedRope", TexturedRope);
    for (const provider of nodes.toProviders())
      container.register({ ...provider, source: "system" });
    return particles;
  }
}
