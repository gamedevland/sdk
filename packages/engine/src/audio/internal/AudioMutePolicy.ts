import type { AudioBackend } from '../types';

interface AudioMutePolicyOptions {
  onRuntimeResumed?: () => void;
}

/**
 * Computes effective global mute from user preference and runtime pause signals.
 */
export class AudioMutePolicy {
  private userGlobalMuted = false;
  private runtimeMuted = false;
  private platformMuted = false;
  private disposed = false;

  constructor(
    private readonly backend: AudioBackend,
    private readonly options: AudioMutePolicyOptions,
  ) {
    this.applyEffectiveGlobalMute();
  }

  setGlobalMuted(muted: boolean): void {
    this.userGlobalMuted = muted;
    this.applyEffectiveGlobalMute();
  }

  setRuntimeMuted(muted: boolean): void {
    if (this.disposed) {
      return;
    }
    this.runtimeMuted = muted;
    this.applyEffectiveGlobalMute();
    if (!muted) {
      this.options.onRuntimeResumed?.();
    }
  }

  setPlatformMuted(muted: boolean): void {
    if (this.disposed) {
      return;
    }
    this.platformMuted = muted;
    this.applyEffectiveGlobalMute();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
  }

  private applyEffectiveGlobalMute(): void {
    this.backend.setMuted(this.userGlobalMuted || this.runtimeMuted || this.platformMuted);
  }
}
