import type { Decoder } from '@engine/validation';

/**
 * Typed descriptor for a single settings value: the config file asset id,
 * the key within that file, and the schema to decode it with.
 * Declare as a static readonly field in the consuming class
 * and pass to `SettingsService.read(entry)` at runtime.
 */
export class SettingsEntry<T> {
  constructor(
    readonly fileId: string,
    readonly key: string,
    readonly decoder: Decoder<T>,
  ) {}
}
