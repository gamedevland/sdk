import * as PIXI from 'pixi.js';

import { BuiltElementsRegistry } from '@engine/layouts/build/BuiltElementsRegistry';
import { ElementCreator } from '@engine/layouts/build/ElementCreator';
import { DisplayPipeline } from '@engine/layouts/display/DisplayPipeline';

import type { BuildContext, BuildResult } from '@engine/layouts/build/BuildTypes';
import type { LayoutFile } from '@engine/layouts/types';
import type { ScreenManager } from '@engine/screen/ScreenManager';

/**
 * High-level entry to build a layout file into a PIXI scene graph plus index.
 *
 * It sets up the DisplayPipeline, initializes system styles (e.g., screen orientation),
 * and delegates element creation to ElementCreator. The build result contains the
 * PIXI root container and a map of built elements for later lookups.
 */
export class LayoutBuilder {
  constructor(private readonly ctx: BuildContext) {}

  build(layout: LayoutFile): BuildResult {
    const root = new PIXI.Container();
    const elements = new BuiltElementsRegistry();
    const screen = <ScreenManager>this.ctx.screen;
    const pipeline = new DisplayPipeline({
      root,
      screen,
    });

    const creator = new ElementCreator(this.ctx, elements, pipeline);

    for (const [id, node] of Object.entries(layout)) {
      const built = creator.create(id, node);
      if (built) {
        const native = this.getView(built.object);
        if (native) root.addChild(native);
      }
    }

    return { root, elements: elements.toMap() };
  }

  private getView(node: unknown): PIXI.Container | undefined {
    if (typeof node !== 'object' || node === null || !('view' in node)) return undefined;
    return (node as { view?: PIXI.Container }).view;
  }
}
