import type { ConfigEntry, JsonConfigPath } from './ConfigEntry';
import type { ConfigStore } from '../core/ConfigStore';
import type { Decoder } from '@engine/validation';

export type ConfigDecoderResolver<TConfigById extends object> = <
  TId extends keyof TConfigById & string,
>(
  id: TId,
) => Decoder<TConfigById[TId]>;

export class DecodedConfigStore<TConfigById extends object> {
  constructor(
    private readonly configStore: ConfigStore,
    private readonly resolveDecoder: ConfigDecoderResolver<TConfigById>,
  ) {}

  get<TId extends keyof TConfigById & string>(id: TId): TConfigById[TId] {
    return this.configStore.get(id, this.resolveDecoder(id));
  }

  getByEntry<TId extends keyof TConfigById & JsonConfigPath>(
    entry: ConfigEntry<TId, TConfigById[TId]>,
  ): TConfigById[TId] {
    return this.configStore.get(entry.fileId, entry.decoder);
  }
}
