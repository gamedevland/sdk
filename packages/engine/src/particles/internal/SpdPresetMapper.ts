import type { ParticleEmitterOptions } from '../types';
import type { EmitterConfigV3 } from '@spd789562/particle-emitter';

export class SpdPresetMapper {
  static toEmitterConfig(params: ParticleEmitterOptions): EmitterConfigV3 {
    const base = params.preset;
    const resolvedPos = params.position ?? base.pos;

    return {
      ...base,
      pos: {
        x: resolvedPos.x,
        y: resolvedPos.y,
      },
      autoUpdate: false,
      ...(params.autoStart === undefined ? {} : { emit: params.autoStart }),
    };
  }
}
