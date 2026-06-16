export type EngineErrorCodeValue =
  | 'CORE_INVALID_ARGUMENT'
  | 'CORE_MISSING_REQUIRED'
  | 'CORE_INVALID_CONFIG'
  | 'CORE_INVARIANT_VIOLATION'
  | 'SCENE_INVALID_ARGUMENT'
  | 'SCENE_INVALID_STATE'
  | 'SCENE_LIFECYCLE_FAILURE'
  | 'DI_INVALID_CONFIG'
  | 'DI_PROVIDER_NOT_FOUND'
  | 'DI_INVALID_PROVIDER'
  | 'DI_DUPLICATE_PROVIDER'
  | 'DI_FORBIDDEN_OVERRIDE'
  | 'DI_UNRESOLVABLE_TOKEN'
  | 'ASSET_MISSING_REQUIRED'
  | 'ASSET_INVALID_CONFIG'
  | 'ASSET_CONFLICT'
  | 'ASSET_LOAD_FAILURE'
  | 'LAYOUT_MISSING_REQUIRED'
  | 'LAYOUT_INVALID_CONFIG'
  | 'LAYOUT_CONFLICT'
  | 'LAYOUT_INVARIANT_VIOLATION'
  | 'AUDIO_MISSING_REQUIRED'
  | 'AUDIO_INVALID_ARGUMENT'
  | 'AUDIO_INVALID_CONFIG'
  | 'AUDIO_CONFLICT'
  | 'PARTICLE_MISSING_REQUIRED'
  | 'PARTICLE_INVALID_ARGUMENT'
  | 'PARTICLE_INVALID_CONFIG'
  | 'PARTICLE_INVARIANT_VIOLATION'
  | 'PARTICLE_RUNTIME_FAILURE'
  | 'PREFAB_MISSING_REQUIRED'
  | 'PREFAB_INVALID_CONFIG'
  | 'PREFAB_CONFLICT'
  | 'PREFAB_INVARIANT_VIOLATION'
  | 'FSM_INVALID_CONFIG'
  | 'FSM_INVALID_STATE'
  | 'COMMAND_MISSING_REQUIRED'
  | 'COMMAND_INVALID_PAYLOAD'
  | 'CONFIG_MISSING_REQUIRED'
  | 'CONFIG_INVALID_ARGUMENT'
  | 'CONFIG_INVALID_SCHEMA';

export class EngineErrorCode {
  static readonly CoreInvalidArgument = 'CORE_INVALID_ARGUMENT';
  static readonly CoreMissingRequired = 'CORE_MISSING_REQUIRED';
  static readonly CoreInvalidConfig = 'CORE_INVALID_CONFIG';
  static readonly CoreInvariantViolation = 'CORE_INVARIANT_VIOLATION';

  static readonly SceneInvalidArgument = 'SCENE_INVALID_ARGUMENT';
  static readonly SceneInvalidState = 'SCENE_INVALID_STATE';
  static readonly SceneLifecycleFailure = 'SCENE_LIFECYCLE_FAILURE';

  static readonly DiInvalidConfig = 'DI_INVALID_CONFIG';
  static readonly DiProviderNotFound = 'DI_PROVIDER_NOT_FOUND';
  static readonly DiInvalidProvider = 'DI_INVALID_PROVIDER';
  static readonly DiDuplicateProvider = 'DI_DUPLICATE_PROVIDER';
  static readonly DiForbiddenOverride = 'DI_FORBIDDEN_OVERRIDE';
  static readonly DiUnresolvableToken = 'DI_UNRESOLVABLE_TOKEN';

  static readonly AssetMissingRequired = 'ASSET_MISSING_REQUIRED';
  static readonly AssetInvalidConfig = 'ASSET_INVALID_CONFIG';
  static readonly AssetConflict = 'ASSET_CONFLICT';
  static readonly AssetLoadFailure = 'ASSET_LOAD_FAILURE';

  static readonly LayoutMissingRequired = 'LAYOUT_MISSING_REQUIRED';
  static readonly LayoutInvalidConfig = 'LAYOUT_INVALID_CONFIG';
  static readonly LayoutConflict = 'LAYOUT_CONFLICT';
  static readonly LayoutInvariantViolation = 'LAYOUT_INVARIANT_VIOLATION';

  static readonly AudioMissingRequired = 'AUDIO_MISSING_REQUIRED';
  static readonly AudioInvalidArgument = 'AUDIO_INVALID_ARGUMENT';
  static readonly AudioInvalidConfig = 'AUDIO_INVALID_CONFIG';
  static readonly AudioConflict = 'AUDIO_CONFLICT';

  static readonly ParticleMissingRequired = 'PARTICLE_MISSING_REQUIRED';
  static readonly ParticleInvalidArgument = 'PARTICLE_INVALID_ARGUMENT';
  static readonly ParticleInvalidConfig = 'PARTICLE_INVALID_CONFIG';
  static readonly ParticleInvariantViolation = 'PARTICLE_INVARIANT_VIOLATION';
  static readonly ParticleRuntimeFailure = 'PARTICLE_RUNTIME_FAILURE';

  static readonly PrefabMissingRequired = 'PREFAB_MISSING_REQUIRED';
  static readonly PrefabInvalidConfig = 'PREFAB_INVALID_CONFIG';
  static readonly PrefabConflict = 'PREFAB_CONFLICT';
  static readonly PrefabInvariantViolation = 'PREFAB_INVARIANT_VIOLATION';

  static readonly FsmInvalidConfig = 'FSM_INVALID_CONFIG';
  static readonly FsmInvalidState = 'FSM_INVALID_STATE';

  static readonly CommandMissingRequired = 'COMMAND_MISSING_REQUIRED';
  static readonly CommandInvalidPayload = 'COMMAND_INVALID_PAYLOAD';

  static readonly ConfigMissingRequired = 'CONFIG_MISSING_REQUIRED';
  static readonly ConfigInvalidArgument = 'CONFIG_INVALID_ARGUMENT';
  static readonly ConfigInvalidSchema = 'CONFIG_INVALID_SCHEMA';

  private static readonly Known = new Set<string>([
    EngineErrorCode.CoreInvalidArgument,
    EngineErrorCode.CoreMissingRequired,
    EngineErrorCode.CoreInvalidConfig,
    EngineErrorCode.CoreInvariantViolation,
    EngineErrorCode.SceneInvalidArgument,
    EngineErrorCode.SceneInvalidState,
    EngineErrorCode.SceneLifecycleFailure,
    EngineErrorCode.DiInvalidConfig,
    EngineErrorCode.DiProviderNotFound,
    EngineErrorCode.DiInvalidProvider,
    EngineErrorCode.DiDuplicateProvider,
    EngineErrorCode.DiForbiddenOverride,
    EngineErrorCode.DiUnresolvableToken,
    EngineErrorCode.AssetMissingRequired,
    EngineErrorCode.AssetInvalidConfig,
    EngineErrorCode.AssetConflict,
    EngineErrorCode.AssetLoadFailure,
    EngineErrorCode.LayoutMissingRequired,
    EngineErrorCode.LayoutInvalidConfig,
    EngineErrorCode.LayoutConflict,
    EngineErrorCode.LayoutInvariantViolation,
    EngineErrorCode.AudioMissingRequired,
    EngineErrorCode.AudioInvalidArgument,
    EngineErrorCode.AudioInvalidConfig,
    EngineErrorCode.AudioConflict,
    EngineErrorCode.ParticleMissingRequired,
    EngineErrorCode.ParticleInvalidArgument,
    EngineErrorCode.ParticleInvalidConfig,
    EngineErrorCode.ParticleInvariantViolation,
    EngineErrorCode.ParticleRuntimeFailure,
    EngineErrorCode.PrefabMissingRequired,
    EngineErrorCode.PrefabInvalidConfig,
    EngineErrorCode.PrefabConflict,
    EngineErrorCode.PrefabInvariantViolation,
    EngineErrorCode.FsmInvalidConfig,
    EngineErrorCode.FsmInvalidState,
    EngineErrorCode.CommandMissingRequired,
    EngineErrorCode.CommandInvalidPayload,
    EngineErrorCode.ConfigMissingRequired,
    EngineErrorCode.ConfigInvalidArgument,
    EngineErrorCode.ConfigInvalidSchema,
  ]);

  static isKnown(code: string): code is EngineErrorCodeValue {
    return EngineErrorCode.Known.has(code);
  }
}
