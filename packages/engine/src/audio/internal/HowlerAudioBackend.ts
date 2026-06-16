import { Howl, Howler } from 'howler';

import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type {
  AudioBackend,
  AudioChannel,
  AudioHandle,
  AudioId,
  AudioSourceDescriptor,
  PlayAudioOptions,
} from '../types';

export class HowlerAudioBackend implements AudioBackend {
  private static readonly DEFAULT_HANDLE_VOLUME = 1;
  private static readonly DEFAULT_HANDLE_RATE = 1;
  private static readonly MIN_VOLUME = 0;
  private static readonly MAX_VOLUME = 1;
  private static readonly MIN_RATE = 0.5;
  private static readonly MAX_RATE = 4;

  private readonly channelVolumes = new Map<AudioChannel, number>([
    ['music', 1],
    ['sfx', 1],
  ]);
  private readonly sourceVolumes = new Map<AudioId, number>();
  private masterVolume = 1;
  private globalMuted = false;
  private readonly channelMuted = new Map<AudioChannel, boolean>([
    ['music', false],
    ['sfx', false],
  ]);
  private readonly musicSourceIds = new Set<AudioId>();
  private readonly sourcesById = new Map<AudioId, Howl>();
  private readonly handles = new Map<AudioHandle, HandleRecord>();
  private handleCounter = 0;
  private unlockPromise: Promise<void> | undefined;

  createSource(source: AudioSourceDescriptor): void {
    if (this.sourcesById.has(source.id)) {
      throw EngineErrorFactory.conflict({
        code: EngineErrorCode.AudioConflict,
        subsystem: EngineSubsystem.Audio,
        message: 'Audio source is already registered',
        details: { id: source.id, method: 'HowlerAudioBackend.createSource' },
      });
    }
    const howl = new Howl({
      src: [source.url],
      preload: true,
    });
    this.sourcesById.set(source.id, howl);
  }

  hasSource(id: AudioId): boolean {
    return this.sourcesById.has(id);
  }

  isHandleActive(handle: AudioHandle): boolean {
    return this.handles.has(handle);
  }

  play(id: AudioId, options?: PlayAudioOptions): AudioHandle {
    const howl = this.getRequiredSource(id);
    const channel = options?.channel ?? 'sfx';
    const loop = options?.loop ?? false;
    const requestedVolume =
      options?.volume ?? this.sourceVolumes.get(id) ?? HowlerAudioBackend.DEFAULT_HANDLE_VOLUME;
    const requestedRate = options?.rate ?? HowlerAudioBackend.DEFAULT_HANDLE_RATE;
    this.assertVolume(requestedVolume, 'HowlerAudioBackend.play');
    this.assertRate(requestedRate, 'HowlerAudioBackend.play');
    this.assertOptionalSeek(options?.seekSeconds, 'HowlerAudioBackend.play');

    if (channel === 'music') {
      this.musicSourceIds.add(id);
      this.stopMusicSourcePlayback(id);
    }

    const soundId = howl.play();
    const handle = this.createHandle(id);
    const record: HandleRecord = {
      sourceId: id,
      channel,
      loop,
      howl,
      soundId,
      requestedVolume,
      requestedRate,
    };
    this.handles.set(handle, record);

    howl.loop(loop, soundId);
    howl.rate(requestedRate, soundId);
    howl.volume(this.resolveEffectiveVolume(record), soundId);
    howl.mute(this.isHandleMuted(record), soundId);
    if (options?.seekSeconds !== undefined) {
      howl.seek(options.seekSeconds, soundId);
    }

    howl.once('end', () => {
      if (record.loop) {
        return;
      }
      this.removeHandle(handle);
    }, soundId);
    howl.once('stop', () => this.removeHandle(handle), soundId);
    howl.once('playerror', () => this.removeHandle(handle), soundId);

    return handle;
  }

  pause(handle: AudioHandle): void {
    const record = this.getRequiredHandle(handle, 'HowlerAudioBackend.pause');
    record.howl.pause(record.soundId);
  }

  stop(handle: AudioHandle): void {
    const record = this.getRequiredHandle(handle, 'HowlerAudioBackend.stop');
    record.howl.stop(record.soundId);
    this.removeHandle(handle);
  }

  stopAll(channel?: AudioChannel): void {
    if (channel === undefined) {
      for (const [handle, record] of this.handles) {
        record.howl.stop(record.soundId);
        this.handles.delete(handle);
      }
      for (const sourceId of this.musicSourceIds) {
        this.stopMusicSourcePlayback(sourceId);
      }
      return;
    }

    for (const [handle, record] of this.handles) {
      if (record.channel !== channel) {
        continue;
      }
      record.howl.stop(record.soundId);
      this.handles.delete(handle);
    }

    if (channel === 'music') {
      for (const sourceId of this.musicSourceIds) {
        this.stopMusicSourcePlayback(sourceId);
      }
    }
  }

  setHandleVolume(handle: AudioHandle, volume: number): void {
    this.assertVolume(volume, 'HowlerAudioBackend.setHandleVolume');
    const record = this.getRequiredHandle(handle, 'HowlerAudioBackend.setHandleVolume');
    record.requestedVolume = volume;
    record.howl.volume(this.resolveEffectiveVolume(record), record.soundId);
  }

  setHandleRate(handle: AudioHandle, rate: number): void {
    this.assertRate(rate, 'HowlerAudioBackend.setHandleRate');
    const record = this.getRequiredHandle(handle, 'HowlerAudioBackend.setHandleRate');
    record.requestedRate = rate;
    record.howl.rate(rate, record.soundId);
  }

  seekHandle(handle: AudioHandle, seconds: number): void {
    this.assertSeek(seconds, 'HowlerAudioBackend.seekHandle');
    const record = this.getRequiredHandle(handle, 'HowlerAudioBackend.seekHandle');
    record.howl.seek(seconds, record.soundId);
  }

  setMasterVolume(volume: number): void {
    this.assertVolume(volume, 'HowlerAudioBackend.setMasterVolume');
    this.masterVolume = volume;
    this.syncAllHandles();
  }

  setChannelVolume(channel: AudioChannel, volume: number): void {
    this.assertVolume(volume, 'HowlerAudioBackend.setChannelVolume');
    this.channelVolumes.set(channel, volume);
    this.syncChannelHandles(channel);
  }

  setMuted(muted: boolean, channel?: AudioChannel): void {
    if (channel === undefined) {
      this.globalMuted = muted;
      Howler.mute(muted);
      this.syncAllHandles();
      return;
    }
    this.channelMuted.set(channel, muted);
    this.syncChannelHandles(channel);
  }

  async unlock(): Promise<void> {
    if (this.unlockPromise) {
      return await this.unlockPromise;
    }
    this.unlockPromise = this.resumeAudioContextIfNeeded().finally(() => {
      this.unlockPromise = undefined;
    });
    return await this.unlockPromise;
  }

  unloadSource(id: AudioId): void {
    const howl = this.getRequiredSource(id);
    this.stopHandlesForSource(id);
    howl.unload();
    this.sourcesById.delete(id);
    this.musicSourceIds.delete(id);
  }

  setSourceVolume(id: AudioId, volume: number): void {
    this.assertVolume(volume, 'HowlerAudioBackend.setSourceVolume');
    this.sourceVolumes.set(id, volume);
    // update active handles for this source
    for (const record of this.handles.values()) {
      if (record.sourceId !== id) continue;
      record.howl.volume(this.resolveEffectiveVolume(record), record.soundId);
    }
  }

  dispose(): void {
    this.stopAll();
    for (const howl of this.sourcesById.values()) {
      howl.unload();
    }
    this.sourcesById.clear();
    this.musicSourceIds.clear();
    this.handles.clear();
    this.unlockPromise = undefined;
  }

  private createHandle(id: AudioId): AudioHandle {
    this.handleCounter += 1;
    return `${id}#${String(this.handleCounter)}`;
  }

  private getRequiredSource(id: AudioId): Howl {
    const howl = this.sourcesById.get(id);
    if (howl) {
      return howl;
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.AudioMissingRequired,
      subsystem: EngineSubsystem.Audio,
      message: 'Audio source is not registered',
      details: { id, method: 'HowlerAudioBackend.getRequiredSource' },
    });
  }

  private getRequiredHandle(handle: AudioHandle, source: string): HandleRecord {
    const record = this.handles.get(handle);
    if (record) {
      return record;
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.AudioMissingRequired,
      subsystem: EngineSubsystem.Audio,
      message: 'Audio handle is not active',
      details: { handle, source, method: 'HowlerAudioBackend.getRequiredHandle' },
    });
  }

  private removeHandle(handle: AudioHandle): void {
    this.handles.delete(handle);
  }

  private stopHandlesForSource(sourceId: AudioId): void {
    for (const [handle, record] of this.handles) {
      if (record.sourceId !== sourceId) {
        continue;
      }
      record.howl.stop(record.soundId);
      this.handles.delete(handle);
    }
  }

  private stopMusicSourcePlayback(sourceId: AudioId): void {
    const howl = this.sourcesById.get(sourceId);
    if (!howl) {
      return;
    }
    howl.stop();
    for (const [handle, record] of this.handles) {
      if (record.sourceId !== sourceId || record.channel !== 'music') {
        continue;
      }
      this.handles.delete(handle);
    }
  }

  private resolveEffectiveVolume(record: HandleRecord): number {
    const channelVolume = this.getRequiredChannelVolume(record.channel);
    return record.requestedVolume * channelVolume * this.masterVolume;
  }

  private isHandleMuted(record: HandleRecord): boolean {
    return this.globalMuted || this.getRequiredChannelMuted(record.channel);
  }

  private syncChannelHandles(channel: AudioChannel): void {
    for (const record of this.handles.values()) {
      if (record.channel !== channel) {
        continue;
      }
      record.howl.volume(this.resolveEffectiveVolume(record), record.soundId);
      record.howl.mute(this.isHandleMuted(record), record.soundId);
    }
  }

  private getRequiredChannelVolume(channel: AudioChannel): number {
    const value = this.channelVolumes.get(channel);
    if (value !== undefined) {
      return value;
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.AudioMissingRequired,
      subsystem: EngineSubsystem.Audio,
      message: 'Channel volume is not configured',
      details: { channel, method: 'HowlerAudioBackend.getRequiredChannelVolume' },
    });
  }

  private getRequiredChannelMuted(channel: AudioChannel): boolean {
    const value = this.channelMuted.get(channel);
    if (value !== undefined) {
      return value;
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.AudioMissingRequired,
      subsystem: EngineSubsystem.Audio,
      message: 'Channel mute state is not configured',
      details: { channel, method: 'HowlerAudioBackend.getRequiredChannelMuted' },
    });
  }

  private syncAllHandles(): void {
    for (const record of this.handles.values()) {
      record.howl.volume(this.resolveEffectiveVolume(record), record.soundId);
      record.howl.mute(this.isHandleMuted(record), record.soundId);
    }
  }

  private assertVolume(value: number, source: string): void {
    if (!Number.isFinite(value) || value < HowlerAudioBackend.MIN_VOLUME || value > HowlerAudioBackend.MAX_VOLUME) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.AudioInvalidArgument,
        subsystem: EngineSubsystem.Audio,
        message: 'Volume must be within allowed range',
        details: {
          source,
          min: HowlerAudioBackend.MIN_VOLUME,
          max: HowlerAudioBackend.MAX_VOLUME,
          value: String(value),
        },
      });
    }
  }

  private assertRate(value: number, source: string): void {
    if (!Number.isFinite(value) || value < HowlerAudioBackend.MIN_RATE || value > HowlerAudioBackend.MAX_RATE) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.AudioInvalidArgument,
        subsystem: EngineSubsystem.Audio,
        message: 'Rate must be within allowed range',
        details: {
          source,
          min: HowlerAudioBackend.MIN_RATE,
          max: HowlerAudioBackend.MAX_RATE,
          value: String(value),
        },
      });
    }
  }

  private assertOptionalSeek(value: number | undefined, source: string): void {
    if (value === undefined) {
      return;
    }
    this.assertSeek(value, source);
  }

  private assertSeek(value: number, source: string): void {
    if (!Number.isFinite(value) || value < 0) {
      throw EngineErrorFactory.invalidInput({
        code: EngineErrorCode.AudioInvalidArgument,
        subsystem: EngineSubsystem.Audio,
        message: 'seekSeconds must be a finite non-negative number',
        details: { source, value: String(value) },
      });
    }
  }

  private async resumeAudioContextIfNeeded(): Promise<void> {
    if (!Howler.usingWebAudio) {
      return;
    }
    if (Howler.ctx.state === 'running') {
      return;
    }
    await Howler.ctx.resume();
  }
}

interface HandleRecord {
  sourceId: AudioId;
  channel: AudioChannel;
  loop: boolean;
  howl: Howl;
  soundId: number;
  requestedVolume: number;
  requestedRate: number;
}
