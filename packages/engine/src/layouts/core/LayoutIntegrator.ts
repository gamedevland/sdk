import { AssetManagerLayoutAssetReader } from './AssetManagerLayoutAssetReader';
/**
 * High-level helper that resolves a layout by name and builds a display tree.
 *
 * Bridges LayoutResolver (validation + injection), BuildContextFactory (wiring
 * of registries and subsystems), and LayoutBuilder (actual PIXI tree creation).
 */
import { BuildContextFactory } from '../build/BuildContextFactory';
import { LayoutBuilder } from '../build/LayoutBuilder';

import { LayoutLoader } from './LayoutLoader';
import { LayoutResolver } from './LayoutResolver';

import type { BuildOptions, BuildResult } from '../build/BuildTypes';
import type { LayoutRuntime } from '@engine/core';
import type { LayoutRenderCapabilities } from '../../rendering/types';

type BuildContextWithEngine = ReturnType<BuildContextFactory['create']> & { engine?: LayoutRuntime };

export class LayoutIntegrator {
  /**
   * Resolve a layout JSON and build it using the engine's subsystems.
   * @param {Engine} engine — Engine instance providing assets, DI, and screen.
   * @param {string} layoutName — Name of the layout file to resolve.
   * @param {BuildOptions} options — Optional build options including custom components/actions.
   * @returns {Promise<BuildResult>} Root container and built element index.
   * @throws {Error} If resolve/validation fails.
   */
  async loadAndBuild(
    engine: LayoutRuntime,
    layoutName: string,
    options?: BuildOptions,
    capabilities?: LayoutRenderCapabilities,
  ): Promise<BuildResult> {
    const loader = new LayoutLoader(new AssetManagerLayoutAssetReader(engine));
    const resolved = await new LayoutResolver(loader).resolveByName(layoutName);
    const incomingOptions = options ?? {};
    const components = incomingOptions.components;
    const actions = incomingOptions.actions;

    const ctxOptions: BuildOptions & { container: typeof engine.di } = {
      ...incomingOptions,
      container: engine.di,
      screen: engine.screen,
      ...(components ? { components } : {}),
      ...(actions ? { actions } : {}),
    };

    const ctx: BuildContextWithEngine = new BuildContextFactory().create(engine.assets, ctxOptions);
    ctx.engine = engine;
    const textStylesConfigId = engine.config.layouts?.textStylesConfigId;
    if (textStylesConfigId !== undefined) {
      ctx.textStylesConfigId = textStylesConfigId;
    }
    return new LayoutBuilder(ctx, capabilities).build(resolved);
  }
}
