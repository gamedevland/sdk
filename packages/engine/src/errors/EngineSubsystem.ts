export type EngineSubsystemValue =
  | 'asset'
  | 'audio'
  | 'command'
  | 'config'
  | 'core'
  | 'fsm'
  | 'layout'
  | 'particle'
  | 'prefab'
  | 'scene'
  | 'di'
  | 'unknown';

export class EngineSubsystem {
  static readonly Asset = 'asset';
  static readonly Audio = 'audio';
  static readonly Command = 'command';
  static readonly Config = 'config';
  static readonly Core = 'core';
  static readonly Fsm = 'fsm';
  static readonly Layout = 'layout';
  static readonly Particle = 'particle';
  static readonly Prefab = 'prefab';
  static readonly Scene = 'scene';
  static readonly Di = 'di';
  static readonly Unknown = 'unknown';

  private static readonly Known = new Set<string>([
    EngineSubsystem.Asset,
    EngineSubsystem.Audio,
    EngineSubsystem.Command,
    EngineSubsystem.Config,
    EngineSubsystem.Core,
    EngineSubsystem.Fsm,
    EngineSubsystem.Layout,
    EngineSubsystem.Particle,
    EngineSubsystem.Prefab,
    EngineSubsystem.Scene,
    EngineSubsystem.Di,
    EngineSubsystem.Unknown,
  ]);

  static isKnown(subsystem: string): subsystem is EngineSubsystemValue {
    return EngineSubsystem.Known.has(subsystem);
  }
}
