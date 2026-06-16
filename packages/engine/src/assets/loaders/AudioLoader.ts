import { BaseLoader } from './BaseLoader';

import type { AssetDescriptor, Loader } from '../types';

/**
 * Lightweight runtime representation of an audio source.
 * Playback backends can use this data to create low-level sound instances lazily.
 */
interface AudioAssetResource {
  id: string;
  url: string;
}

/**
 * Loads audio assets into normalized URL descriptors.
 *
 * @remarks
 * The loader intentionally does not decode audio bytes. Decoding/instantiation is delegated
 * to the audio backend used by the engine audio subsystem.
 */
export class AudioLoader extends BaseLoader implements Loader {
  async load(
    desc: AssetDescriptor,
    _signal: AbortSignal,
    baseURL?: string,
  ): Promise<AudioAssetResource> {
    const url = this.resolveUrl(desc, baseURL, 'Audio');
    return { id: desc.id, url };
  }
}
