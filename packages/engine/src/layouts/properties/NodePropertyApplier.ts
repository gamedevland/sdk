import { ValidatorRegistry } from '@engine/validation';
import { DisplayValidator } from '../validation/validators/DisplayValidator';
// DimensionParser больше не создаётся здесь; parse приходит из DisplayManager

import { TextStylesConfigDecoder } from '../../configs/common/TextStylesConfigDecoder';
import { SystemServices } from '../../di';

import { AssetProperty } from './AssetProperty';
import { TextProperty } from './TextProperty';
import { AssetTextStyleCatalog, EmptyTextStyleCatalog } from './TextStyleCatalog';
import { TextStyleProperty } from './TextStyleProperty';

import type { NodeProperty } from './NodeProperty';
import type { LocalesService } from '../../configs';
import type { BuildContext } from '../build/BuildTypes';
import type { DisplayPipeline } from '../display/DisplayPipeline';
import type { ElementConfig } from '@engine/renderers/pixi/types';

/**
 * Applies node-level properties (asset/text/textStyle)
 */
export class NodePropertyApplier {
  private readonly props: NodeProperty[];

  constructor(
    private readonly ctx: BuildContext,
    private readonly pipeline: DisplayPipeline,
  ) {
    this.props = [
      new AssetProperty(),
      new TextProperty(),
      new TextStyleProperty(this.resolveTextStyleCatalog()),
    ];
  }

  /**
   * Apply node properties and effective display to a built object's native view.
   * Order of operations:
   * 1) Apply intrinsic node properties (assets, text, textStyle)
   * 2) Apply the effective display props through DisplayPipeline (position/scale/etc.)
   */
  apply(obj: unknown, cfg: ElementConfig): void {
    const validated = new DisplayValidator().validate(cfg.props ?? {}, {path: 'props', registry: new ValidatorRegistry()});
    if (!validated.ok) throw new Error(validated.issues.map(issue => issue.path + ': ' + issue.message).join('; '));
    const view = this.extractView(obj);
    for (const p of this.props)
      p.apply(view, cfg, {
        getAsset: (id: string) => this.ctx.assets.get(id),
        getLocale: this.getLocale.bind(this),
        localize: this.localizeText.bind(this),
        root: this.pipeline.getRoot(),
        screen: this.pipeline.getScreenManager(),
      });
    if (!view) return;

    const base = cfg.props ?? {};
    if (this.pipeline) this.pipeline.apply(view, base);
  }

  private extractView(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null || !('view' in obj)) return undefined;
    return (obj as { view?: unknown }).view;
  }

  private resolveTextStyleCatalog() {
    const configId = this.ctx.textStylesConfigId;
    if (!configId) {
      return new EmptyTextStyleCatalog();
    }
    const raw = this.ctx.assets.get<unknown>(configId);
    if (!raw || typeof raw !== 'object') {
      return new EmptyTextStyleCatalog();
    }
    return new AssetTextStyleCatalog(
      TextStylesConfigDecoder.decode(raw, `NodePropertyApplier('${configId}')`),
    );
  }

  private localizeText(key: string, params?: Readonly<Record<string, string | number>>): string {
    return this.ctx.container.get<LocalesService>(SystemServices.LocalesService).t(key, params);
  }

  private getLocale(): string {
    return this.ctx.container.get<LocalesService>(SystemServices.LocalesService).getLang();
  }
}
