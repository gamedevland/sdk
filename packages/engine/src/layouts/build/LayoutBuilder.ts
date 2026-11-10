import { LayoutInheritanceResolver } from '../core/LayoutInheritanceResolver';
import { BuiltElementsRegistry } from './BuiltElementsRegistry';
import { ElementCreator } from './ElementCreator';
import type { BuildContext, BuildResult } from './BuildTypes';
import type { LayoutFile } from '../types';
import type { NodeBase } from '../NodeBase';
export class LayoutBuilder {
  constructor(private readonly ctx: BuildContext) {}
  async build(layout: LayoutFile, propertiesRoot?: NodeBase): Promise<BuildResult> {
    if (!this.ctx.engine) throw new Error('Layout build requires an engine');
    const renderer = this.ctx.engine.rendering;
    const root = renderer.createRoot();
    const elements = new BuiltElementsRegistry();
    const creator = new ElementCreator(this.ctx, elements, renderer.createProperties(this.ctx, propertiesRoot ?? root));
    try {
      for (const [id, config] of Object.entries(new LayoutInheritanceResolver().resolve(layout))) {
        const built = creator.create(id, config);
        root.addChild(id, built.object);
        root.attach(built.object);
      }
      return {root, elements: elements.toMap()};
    } catch (cause) {
      const cleanup = await Promise.allSettled([...Array.from(elements.entries(), el => el.object.destroy()), root.destroy()]);
      const errors = cleanup.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
      if (errors.length) throw new AggregateError([cause, ...errors], 'Layout construction and rollback failed');
      throw cause;
    }
  }
}
