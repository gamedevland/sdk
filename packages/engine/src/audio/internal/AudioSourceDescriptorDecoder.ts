import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import { SchemaDecoder } from '@engine/validation';

import type { AudioId, AudioSourceDescriptor } from '../types';
import type { Decoder } from '@engine/validation';

/**
 * Decodes and validates unknown audio asset payload into a normalized descriptor.
 */
interface AudioSourceDescriptorPayload {
  readonly id: string;
  readonly url: string;
}

export class AudioSourceDescriptorDecoder {
  private static readonly DESCRIPTOR_DECODER: Decoder<AudioSourceDescriptorPayload> = SchemaDecoder.object({
    id: SchemaDecoder.string({ nonEmpty: true }),
    url: SchemaDecoder.string({ nonEmpty: true }),
  });

  static decode(raw: unknown, expectedId: AudioId): AudioSourceDescriptor {
    const descriptor = SchemaDecoder.decode(
      raw,
      AudioSourceDescriptorDecoder.DESCRIPTOR_DECODER,
      `AudioManager.asset('${expectedId}')`,
    );
    const id = descriptor.id;
    if (id !== expectedId) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.AudioInvalidConfig,
        subsystem: EngineSubsystem.Audio,
        message: 'Audio descriptor id mismatch',
        details: { expectedId, actualId: id, method: 'AudioSourceDescriptorDecoder.decode' },
      });
    }
    return descriptor;
  }
}
