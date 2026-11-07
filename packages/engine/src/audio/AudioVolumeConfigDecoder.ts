import { SchemaDecoder } from '@engine/validation';
import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

export class AudioVolumeConfigDecoder {
  private static readonly NON_EMPTY_STRING = SchemaDecoder.string({ nonEmpty: true });
  private static readonly VOLUME_VALUE = SchemaDecoder.number({ min: 0, max: 1 });

  static decode(input: unknown, source: string): Readonly<Record<string, number>> {
    const raw = SchemaDecoder.decode(input, SchemaDecoder.record(), source);
    const decoded: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw)) {
      const decodedKey = SchemaDecoder.decode(
        key,
        AudioVolumeConfigDecoder.NON_EMPTY_STRING,
        source,
        `$.${key}`,
      );
      const decodedValue = SchemaDecoder.decode(
        value,
        AudioVolumeConfigDecoder.VOLUME_VALUE,
        source,
        `$.${key}`,
      );
      if (decodedKey.startsWith('channel.') && decodedKey !== 'channel.music' && decodedKey !== 'channel.sfx') {
        throw EngineErrorFactory.invalidInput({
          code: EngineErrorCode.AudioInvalidConfig, subsystem: EngineSubsystem.Audio,
          message: 'Unknown audio channel in volume config', details: { source, key: decodedKey },
        });
      }
      decoded[decodedKey] = decodedValue;
    }
    return decoded;
  }
}
