/**
 * Shared types and base abstractions for the commands subsystem.
 *
 * A command is a small, targeted piece of application logic that can be invoked
 * by name. Commands are instantiated by the DI container and executed by the
 * `CommandBus`, which also injects a runtime execution context so commands can
 * interact with the engine, the active scene layout, and the asset manager
 * without tight coupling to the environment in which they run.
 */
/** Context provided to commands resolved by CommandBus before execution. */
import type { AssetManager } from '../assets/AssetManager';
import type { DiContainerInterface } from '@engine/di/types';
import type { SceneLayout } from '@engine/layouts';
import type { SceneRuntime } from '@engine/scenes/SceneRuntime';

export interface AppCommandContext {
  /** Engine instance to access subsystems (events, input, screen) and DI container. */
  engine: SceneRuntime;
  /** Active scene layout. Commands execute only with an active scene/layout. */
  layout: SceneLayout;
  /** Asset manager for resource lookup during command execution. */
  assets: AssetManager;
  /** Active scene-local DI scope. */
  sceneDi: DiContainerInterface;
  /** Active scene params passed by SceneManager transition options. */
  params: Readonly<Record<string, unknown>>;
  /** Captured active scene scope version at command dispatch time. */
  sceneScopeVersion: number;
}
