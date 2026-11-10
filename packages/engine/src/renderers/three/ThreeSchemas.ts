import { SchemaDecoder as S } from '../../validation/schema/SchemaDecoder';
export class ThreeSchemas {
  static readonly vector = S.strictObject({x: S.number(), y: S.number(), z: S.number()});
  private static readonly common = {
    position: S.optional(this.vector), rotation: S.optional(this.vector), scale: S.optional(this.vector), visible: S.optional(S.boolean()),
  };
  private static readonly material = S.strictObject({
    type: S.enumOf(['standard', 'basic']), color: S.string({nonEmpty: true}),
    roughness: S.optional(S.number({min: 0, max: 1})), metalness: S.optional(S.number({min: 0, max: 1})),
  });
  static readonly transforms = S.strictObject(this.common);
  static readonly mesh = S.strictObject({...this.common,
    geometry: S.strictObject({type: S.enumOf(['box', 'plane', 'sphere']), size: S.optional(this.vector), radius: S.optional(S.number({min: 0.001}))}),
    material: this.material,
  });
  static readonly model = S.strictObject({...this.common, castShadow: S.optional(S.boolean()), receiveShadow: S.optional(S.boolean()), asset: S.string({nonEmpty: true})});
  static readonly camera = S.strictObject({...this.common,
    lookAt: this.vector, near: S.number({min: 0.001}), far: S.number({min: 0.002}),
    height: S.optional(S.number({min: 0.001})), fov: S.optional(S.number({min: 1, max: 179})),
  });
  static readonly light = S.strictObject({...this.common, color: S.string({nonEmpty: true}), intensity: S.number({min: 0}), target: S.optional(this.vector), castShadow: S.optional(S.boolean()), shadowMapSize: S.optional(S.number({integer: true, min: 256, max: 4096})), shadowBounds: S.optional(S.number({min: 1, max: 100})), shadowBias: S.optional(S.number({min: -.1, max: .1})), shadowNormalBias: S.optional(S.number({min: 0, max: 1}))});
}
