import { SchemaDecoder as S } from '../../validation/schema/SchemaDecoder';

/** Decode game-authored render quality without exposing the native renderer. */
export class ThreeRendererSettings {
  private static readonly decoder = S.strictObject({
    shadows: S.optional(S.boolean()),
    toneMapping: S.optional(S.enumOf(['none', 'neutral', 'aces'])),
    exposure: S.optional(S.number({min: 0.1, max: 4})),
  });
  readonly values;

  constructor(input: unknown = {}) {
    this.values = S.decode(input, ThreeRendererSettings.decoder, 'ThreeRendererModule.settings');
  }
}
