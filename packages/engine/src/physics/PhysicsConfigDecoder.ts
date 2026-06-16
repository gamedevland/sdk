import { SchemaDecoder } from '@engine/validation';

import type { PhysicsWorldConfig } from './types';
import type { Decoder } from '@engine/validation';

export class PhysicsConfigDecoder {
  private static readonly MATERIAL_DECODER: Decoder<Required<PhysicsWorldConfig['material']>> =
    SchemaDecoder.object({
      restitution: SchemaDecoder.number({ defaultValue: 0.12, min: 0, max: 1 }),
      friction: SchemaDecoder.number({ defaultValue: 0.4, min: 0 }),
      frictionStatic: SchemaDecoder.number({ defaultValue: 0.5, min: 0 }),
      frictionAir: SchemaDecoder.number({ defaultValue: 0.08, min: 0 }),
      density: SchemaDecoder.number({ defaultValue: 0.001, min: 0 }),
      sleepThreshold: SchemaDecoder.number({ defaultValue: 60, min: 0 }),
    });

  private static readonly WORLD_CONFIG_DECODER: Decoder<PhysicsWorldConfig> = SchemaDecoder.object({
    gravityY: SchemaDecoder.number({ defaultValue: 1.2, min: 0 }),
    wallThickness: SchemaDecoder.number({ defaultValue: 80, min: 1 }),
    topPadding: SchemaDecoder.number({ defaultValue: 0, min: 0 }),
    enableSleeping: SchemaDecoder.boolean({ defaultValue: false }),
    material: PhysicsConfigDecoder.MATERIAL_DECODER,
  });

  static decodeWorldConfig(input: unknown, source: string): PhysicsWorldConfig {
    return SchemaDecoder.decode(input, PhysicsConfigDecoder.WORLD_CONFIG_DECODER, source);
  }
}
