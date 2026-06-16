import { LayoutIntegrator } from '../core/LayoutIntegrator';

import { SceneLayout } from './SceneLayout';

import type { BuildOptions } from '../build/BuildTypes';
import type { LayoutRuntime } from '@engine/core';

/**
 * Internal factory that resolves and builds a SceneLayout instance.
 * Keeps build pipeline concerns out of SceneLayout runtime facade.
 */
export class SceneLayoutFactory {
  static async load(engine: LayoutRuntime, name: string, options?: BuildOptions): Promise<SceneLayout> {
    const built = await new LayoutIntegrator().loadAndBuild(engine, name, options);
    return SceneLayout.fromBuildResult(engine, built);
  }
}
