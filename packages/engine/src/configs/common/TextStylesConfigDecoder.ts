import { LocaleCatalog } from '@engine/configs/common/LocaleCatalog';
import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import { SchemaDecoder } from '@engine/validation';

import type { SupportedLocaleCode } from './LocaleCatalog';
import type { TextStyleDef, TextStylesConfig } from './TextStyles';
import type { Decoder } from '@engine/validation';

type TextStyleAlign = 'left' | 'center' | 'right';
type MutableTextStyleDef = { -readonly [K in keyof TextStyleDef]: TextStyleDef[K] };
type MutableDropShadowDef = {
  -readonly [K in keyof NonNullable<TextStyleDef['dropShadow']>]: NonNullable<TextStyleDef['dropShadow']>[K];
};
type DecodedStroke = {
  readonly color: string;
  readonly width: number;
};
type DecodedDropShadow = {
  readonly color: string | undefined;
  readonly alpha: number | undefined;
  readonly blur: number | undefined;
  readonly angle: number | undefined;
  readonly distance: number | undefined;
};
type DecodedTextStyle = {
  readonly fontFamily: string | undefined;
  readonly fontSize: number | undefined;
  readonly fontWeight: string | undefined;
  readonly fill: readonly string[] | undefined;
  readonly align: TextStyleAlign | undefined;
  readonly stroke: DecodedStroke | undefined;
  readonly dropShadow: DecodedDropShadow | undefined;
  readonly wordWrap: boolean | undefined;
  readonly wordWrapWidth: number | undefined;
  readonly byLocale: Readonly<Record<string, unknown>> | undefined;
};

export class TextStylesConfigDecoder {
  private static readonly LEGACY_STYLE_KEYS = [
    'strokeThickness',
    'dropShadowColor',
    'dropShadowBlur',
    'dropShadowAngle',
    'dropShadowDistance',
  ] as const;

  private static readonly STROKE_DECODER: Decoder<DecodedStroke> = SchemaDecoder.object({
    color: SchemaDecoder.string({ nonEmpty: true }),
    width: SchemaDecoder.number(),
  });

  private static readonly DROP_SHADOW_DECODER: Decoder<DecodedDropShadow> = SchemaDecoder.object({
    color: SchemaDecoder.optional(SchemaDecoder.string({ nonEmpty: true })),
    alpha: SchemaDecoder.optional(SchemaDecoder.number()),
    blur: SchemaDecoder.optional(SchemaDecoder.number()),
    angle: SchemaDecoder.optional(SchemaDecoder.number()),
    distance: SchemaDecoder.optional(SchemaDecoder.number()),
  });

  private static readonly STYLE_DECODER: Decoder<DecodedTextStyle> = SchemaDecoder.object({
    fontFamily: SchemaDecoder.optional(SchemaDecoder.string({ nonEmpty: true })),
    fontSize: SchemaDecoder.optional(SchemaDecoder.number()),
    fontWeight: SchemaDecoder.optional(SchemaDecoder.string({ nonEmpty: true })),
    fill: SchemaDecoder.optional(SchemaDecoder.array(SchemaDecoder.string({ nonEmpty: true }))),
    align: SchemaDecoder.optional(SchemaDecoder.enumOf<TextStyleAlign>(['left', 'center', 'right'])),
    stroke: SchemaDecoder.optional(TextStylesConfigDecoder.STROKE_DECODER),
    dropShadow: SchemaDecoder.optional(TextStylesConfigDecoder.DROP_SHADOW_DECODER),
    wordWrap: SchemaDecoder.optional(SchemaDecoder.boolean()),
    wordWrapWidth: SchemaDecoder.optional(SchemaDecoder.number()),
    byLocale: SchemaDecoder.optional(SchemaDecoder.record()),
  });

  static decode(input: unknown, source: string): TextStylesConfig {
    const stylesUnknown = SchemaDecoder.decode(input, SchemaDecoder.record(), source);
    const result: Record<string, TextStyleDef> = {};

    for (const [styleId, styleUnknown] of Object.entries(stylesUnknown)) {
      const styleRecord = SchemaDecoder.decode(styleUnknown, SchemaDecoder.record(), source, `$.${styleId}`);
      TextStylesConfigDecoder.ensureNoLegacyKeys(styleRecord, source, `$.${styleId}`);
      const decoded = SchemaDecoder.decode(
        styleRecord,
        TextStylesConfigDecoder.STYLE_DECODER,
        source,
        `$.${styleId}`,
      );
      result[styleId] = TextStylesConfigDecoder.normalizeStyle(decoded);
    }

    return result;
  }

  private static normalizeStyle(style: DecodedTextStyle): TextStyleDef {
    const normalized: Partial<MutableTextStyleDef> = {};
    if (style.fontFamily !== undefined) normalized.fontFamily = style.fontFamily;
    if (style.fontSize !== undefined) normalized.fontSize = style.fontSize;
    if (style.fontWeight !== undefined) normalized.fontWeight = style.fontWeight;
    if (style.fill !== undefined) normalized.fill = style.fill;
    if (style.align !== undefined) normalized.align = style.align;
    if (style.stroke !== undefined) normalized.stroke = style.stroke;
    if (style.dropShadow !== undefined) {
      normalized.dropShadow = TextStylesConfigDecoder.normalizeDropShadow(style.dropShadow);
    }
    if (style.wordWrap !== undefined) normalized.wordWrap = style.wordWrap;
    if (style.wordWrapWidth !== undefined) normalized.wordWrapWidth = style.wordWrapWidth;
    if (style.byLocale !== undefined) {
      normalized.byLocale = TextStylesConfigDecoder.normalizeLocalizedStyles(style.byLocale);
    }
    return normalized;
  }

  private static normalizeLocalizedStyles(
    localizedStyles: Readonly<Record<string, unknown>>,
  ): Readonly<Record<SupportedLocaleCode, TextStyleDef>> {
    const normalized = {} as Record<SupportedLocaleCode, TextStyleDef>;
    for (const [locale, styleUnknown] of Object.entries(localizedStyles)) {
      if (!LocaleCatalog.isSupported(locale)) {
        throw EngineErrorFactory.invalidInput({
          code: EngineErrorCode.ConfigInvalidSchema,
          subsystem: EngineSubsystem.Config,
          message: `Unsupported text style locale override '${locale}'`,
          details: { locale, method: 'TextStylesConfigDecoder.normalizeLocalizedStyles' },
        });
      }
      const styleRecord = SchemaDecoder.decode(
        styleUnknown,
        SchemaDecoder.record(),
        'TextStylesConfigDecoder.byLocale',
        `$.${locale}`,
      );
      TextStylesConfigDecoder.ensureNoLegacyKeys(
        styleRecord,
        'TextStylesConfigDecoder.byLocale',
        `$.${locale}`,
      );
      const decoded = SchemaDecoder.decode(
        styleRecord,
        TextStylesConfigDecoder.STYLE_DECODER,
        'TextStylesConfigDecoder.byLocale',
        `$.${locale}`,
      );
      normalized[locale] = TextStylesConfigDecoder.normalizeStyle({
        ...decoded,
        byLocale: undefined,
      });
    }
    return normalized;
  }

  private static normalizeDropShadow(
    dropShadow: DecodedDropShadow,
  ): NonNullable<TextStyleDef['dropShadow']> {
    const normalized: Partial<MutableDropShadowDef> = {};
    if (dropShadow.color !== undefined) normalized.color = dropShadow.color;
    if (dropShadow.alpha !== undefined) normalized.alpha = dropShadow.alpha;
    if (dropShadow.blur !== undefined) normalized.blur = dropShadow.blur;
    if (dropShadow.angle !== undefined) normalized.angle = dropShadow.angle;
    if (dropShadow.distance !== undefined) normalized.distance = dropShadow.distance;
    return normalized;
  }

  private static ensureNoLegacyKeys(style: Record<string, unknown>, source: string, path: string): void {
    for (const legacyKey of TextStylesConfigDecoder.LEGACY_STYLE_KEYS) {
      if (!(legacyKey in style)) {
        continue;
      }
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.ConfigInvalidSchema,
        subsystem: EngineSubsystem.Config,
        message: `${source} legacy text style key '${legacyKey}' is not supported at '${path}'`,
        details: { source, path, key: legacyKey },
      });
    }
  }
}
