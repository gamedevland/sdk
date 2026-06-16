import { SchemaDecoder } from '@engine/validation';

import type { LocaleDictionary } from './Locales';

export class LocaleDictionaryConfigDecoder {
  private static readonly NON_EMPTY_STRING = SchemaDecoder.string({ nonEmpty: true });

  static decode(input: unknown, source: string): LocaleDictionary {
    const dict = SchemaDecoder.decode(input, SchemaDecoder.record(), source);
    const normalizedDict: Record<string, string> = {};

    for (const [key, value] of Object.entries(dict)) {
      normalizedDict[key] = SchemaDecoder.decode(
        value,
        LocaleDictionaryConfigDecoder.NON_EMPTY_STRING,
        source,
        `$.${key}`,
      );
    }

    return normalizedDict;
  }
}
