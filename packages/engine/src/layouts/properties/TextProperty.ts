/**
 * Applies text content to views exposing a `text` field (e.g., Pixi.Text).
 */
import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import { SchemaDecoder } from '@engine/validation';

import type { NodeProperty, NodePropertyContext } from './NodeProperty';

export class TextProperty implements NodeProperty {
  private static readonly NON_EMPTY_STRING = SchemaDecoder.string({ nonEmpty: true });

  apply(view: unknown, cfg: unknown, ctx: NodePropertyContext): void {
    const cfgObj = cfg as { props?: Record<string, unknown> } | undefined;
    const data = cfgObj?.props ?? {};
    const textKey = SchemaDecoder.decode(
      data['textKey'],
      SchemaDecoder.optional(TextProperty.NON_EMPTY_STRING),
      'TextProperty.apply',
      '$.textKey',
    );
    const textParams = this.decodeTextParams(data['textParams']);
    const text = SchemaDecoder.decode(
      data['text'],
      SchemaDecoder.optional(SchemaDecoder.unknown()),
      'TextProperty.apply',
      '$.text',
    );
    const resolvedText = this.resolveTextValue(textKey, textParams, text, ctx);
    if (resolvedText === undefined) return;
    if (view && typeof view === 'object' && 'text' in view) {
      (view as { text?: unknown }).text = resolvedText;
    }
  }

  private resolveTextValue(
    textKey: string | undefined,
    textParams: Readonly<Record<string, string | number>> | undefined,
    text: unknown,
    ctx: NodePropertyContext,
  ): unknown {
    if (textKey !== undefined) {
      const localize = ctx.localize;
      if (!localize) {
        throw EngineErrorFactory.missingRequired({
          code: EngineErrorCode.LayoutMissingRequired,
          subsystem: EngineSubsystem.Layout,
          message: 'Text localization hook is required when props.textKey is used',
          details: { method: 'TextProperty.resolveTextValue', textKey },
        });
      }
      return localize(textKey, textParams);
    }
    return text;
  }

  private decodeTextParams(
    input: unknown,
  ): Readonly<Record<string, string | number>> | undefined {
    const params = SchemaDecoder.decode(
      input,
      SchemaDecoder.optional(SchemaDecoder.record()),
      'TextProperty.apply',
      '$.textParams',
    );
    if (params === undefined) {
      return undefined;
    }
    const result: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' || typeof value === 'number') {
        result[key] = value;
        continue;
      }
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.LayoutInvalidConfig,
        subsystem: EngineSubsystem.Layout,
        message: 'Text params must contain only string or number values',
        details: { method: 'TextProperty.decodeTextParams', key, valueType: typeof value },
      });
    }
    return result;
  }
}
