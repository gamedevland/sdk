import { SchemaDecoder } from '@engine/validation';

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
      decoded[decodedKey] = decodedValue;
    }
    return decoded;
  }
}
