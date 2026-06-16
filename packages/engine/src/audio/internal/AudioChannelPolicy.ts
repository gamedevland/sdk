import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { AudioChannel } from '../types';

/**
 * Stores channel-enabled policy and provides deterministic access/mutation methods.
 */
export class AudioChannelPolicy {
  private readonly enabledByChannel = new Map<AudioChannel, boolean>([
    ['music', true],
    ['sfx', true],
  ]);

  constructor(defaults?: Partial<Record<AudioChannel, boolean>>) {
    if (!defaults) {
      return;
    }
    const musicEnabled = defaults['music'];
    if (musicEnabled !== undefined) {
      this.enabledByChannel.set('music', musicEnabled);
    }
    const sfxEnabled = defaults['sfx'];
    if (sfxEnabled !== undefined) {
      this.enabledByChannel.set('sfx', sfxEnabled);
    }
  }

  isEnabled(channel: AudioChannel): boolean {
    const enabled = this.enabledByChannel.get(channel);
    if (enabled !== undefined) {
      return enabled;
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.AudioMissingRequired,
      subsystem: EngineSubsystem.Audio,
      message: 'Channel enabled state is not configured',
      details: { channel, method: 'AudioChannelPolicy.isEnabled' },
    });
  }

  setEnabled(channel: AudioChannel, enabled: boolean): void {
    this.enabledByChannel.set(channel, enabled);
  }
}
