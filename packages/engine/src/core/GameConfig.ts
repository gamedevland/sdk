/**
 * Configuration object used to bootstrap the game engine and initial scene.
 * @remarks
 * - Asset bundles must be registered before use; preload controls eager loading.
 * - DI providers are registered into the engine container before scene start.
 */
import type { SceneConfig } from './SceneConfig';
import type { BundleDescriptor } from '../assets/types';
import type { AudioManagerOptions } from '../audio/types';
import type { ScreenConfig } from '../screen/types';
import type { GameDiDefinition } from '@engine/di';
import type { BrowserInputGuardConfig } from '@engine/input';

export interface GameConfig {
  /**
   * System-level runtime parameters (render canvas, screen profiles, etc.).
   * @remarks
   * New format groups system settings under `system`; legacy top-level fields are still accepted.
   */
  system: {
    renderer: import('../rendering/types').RendererModule;
    modules?: readonly import('./EngineModule').EngineModule[];
    /** Background color for the canvas. */
    canvasBackground?: string;
    /** Screen scaling and DPR configuration. */
    screen?: ScreenConfig;
    /** Scene lifecycle transition timeouts in milliseconds. */
    lifecycle?: {
      /** Timeout for each scene lifecycle hook (`preload`, `onEnter`, `onExit`). */
      transitionTimeoutMs?: number;
    };
    /** Deterministic engine boot preload plan for JSON configs. */
    boot?: {
      /** Defaults to true. Set false for a loading scene; signal platform.loadingFinished() when gameplay is ready. */
      autoLoadingFinished?: boolean;
      configs?: {
        /** Bundle names preloaded into ConfigStore once at engine start. */
        engineStartBundles?: readonly string[];
        /** Bundle names preloaded into ConfigStore on scene enter before scene services init. */
        sceneEnterBundles?: Readonly<Record<string, readonly string[]>>;
      };
    };
    /** Browser default behavior suppression for game canvas input. */
    browserGuard?: Partial<BrowserInputGuardConfig>;
    /** Optional audio bootstrap options forwarded to engine. */
    audio?: AudioManagerOptions;
    /** Optional persistence bootstrap settings for engine-level dual storage sync. */
    persistence?: {
      /** Shared namespace prefix used by persistent state stores (`<namespace>:<key>`). */
      namespace: string;
      /** Platform identity owns saves by default. Mirror must be selected deliberately. */
      policy?: import('../configs').PersistencePolicy;
      /** localStorage backend config. Enabled by default. */
      localStorage?: {
        readonly enabled?: boolean;
      };
      /** IndexedDB backend config. Enabled by default. */
      indexedDB?: {
        readonly enabled?: boolean;
        /** IndexedDB database name used by the engine persistence subsystem. */
        readonly databaseName?: string;
      };
    };
  };
  /** Asset bundle configuration and optional preload list. */
  assets: {
    /** List of bundles to register. */
    bundles: BundleDescriptor[];
    /** Optional bundle names to preload before starting the first scene. */
    preload?: string[];
  };
  /** Optional layout subsystem configuration. */
  layouts?: {
    /** Base path for loading layout JSON files (if not using asset manager). */
    basePath?: string;
    /**
     * Asset ID of the text styles config JSON file.
     * When provided, text node style names are resolved from this asset.
     * If omitted, text style lookup is skipped and nodes rely on inline styles only.
     */
    textStylesConfigId?: string;
  };
  /** Scene configurations container with initial key and map. */
  scenes: {
    /** Key of the starting scene within the scenes map. */
    initial: string;
    /** Scene configurations indexed by key. */
    map: Record<string, SceneConfig>;
  };
  /** Dependency injection setup via strict game DI definition. */
  di: GameDiDefinition;
  /** Arbitrary user data accessible at runtime via engine.config.data. */
  data?: Record<string, unknown>;
}
