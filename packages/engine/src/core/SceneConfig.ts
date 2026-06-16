/**
 * Declarative configuration used to instantiate a scene and its resources.
 */
import type { FSMConfig } from '../fsm/types';
import type { BaseAction } from '../layouts';
import type { BaseComponent } from '../layouts';
import type { Scene } from '../scenes/SceneManager';

export interface SceneConfig {
  /** Unique key identifying the scene in logs/registries. */
  key: string;
  /** Class constructor for the concrete scene implementation. */
  useClass?: new (config: SceneConfig) => Scene;
  /** Assets to load before scene enters. */
  assets?: {
    /** Optional bundle names to load via AssetManager.loadBundle. */
    bundles?: string[];
    /** Optional asset ids to load via AssetManager.load. */
    ids?: string[];
  };
  /** Layout source name or inline config for components/actions/styles. */
  layout?:
    | string
    | {
        /** Layout file name (without extension) to resolve. */
        name: string;
        /** Component constructors mapped by type name for this scene only. */
        components?: Record<string, new () => BaseComponent>;
        /** Action constructors mapped by type name for this scene only. */
        actions?: Record<string, new () => BaseAction>;
        /** Optional fixed virtual size override; prefer ScreenManager where possible. */
        screen?: { width: number; height: number };
        /** System styles applied initially (e.g., for state-based styling). */
        systemStyles?: string[];
      };
  /** Reserved; system scenes not supported in public API. */
  system?: never;
  /** Optional finite state machine configuration for scene behavior. */
  fsm?: FSMConfig;
}
