/**
 * Commands module runtime executor.
 *
 * The CommandBus resolves command instances from the DI container and executes them
 * with a unified execution context (engine, active layout, assets). This keeps
 * individual command classes simple and decoupled from the application wiring.
 */
import { EngineErrorCode } from '@engine/errors';

import type { BaseCommand } from './BaseCommand';
import type { AppCommandContext } from './types';
import type { CommandRuntime } from '@engine/core';
import type { SceneRuntime } from '@engine/scenes/SceneRuntime';

/**
 * Facade responsible for locating and executing commands by name.
 *
 * Typical lifecycle:
 * - resolve a command instance from DI by token derived from its name
 * - attach current execution context (engine, active layout, assets)
 * - invoke the command's run method with optional payload data
 */
export class CommandBus {
  /**
   * Create a CommandBus bound to a specific engine instance.
   *
   * @param engine Engine used to resolve dependencies and provide context
   */
  constructor(private readonly engine: CommandRuntime & SceneRuntime) {}

  /**
   * Resolve and execute a command by its registered name.
   *
   * Notes for consumers:
   * - The command instance is obtained through `engine.di.getCommand(name)`.
   * - Prior to execution, the bus attaches an execution context so the command can access the engine,
   *   the currently active scene layout (if any), and the asset manager via getters.
   * - Errors are logged and rethrown so upstream callers can handle failures if needed.
   *
   * @param name Unique command name used during DI registration
   * @param data Optional data payload passed to the command's run method
   */
  async run<TData extends Record<string, unknown> = Record<string, unknown>>(
    name: string,
    data?: TData,
  ): Promise<void> {
    try {
      // Resolve a concrete command implementation from the DI container by its token.
      const cmd = this.engine.di.getCommand<BaseCommand>(name);

      const sceneScopeVersion = this.engine.scenes.getCurrentSceneScopeVersion();
      // Get the currently active scene layout.
      const layout = this.engine.getRequiredActiveLayout();
      const sceneDi = this.engine.getRequiredActiveSceneDi();
      const params = this.engine.getRequiredActiveSceneParams();

      // Provide the execution context so the command can access engine, layout and assets.
      const ctx: AppCommandContext = {
        engine: this.engine,
        layout,
        assets: this.engine.assets,
        sceneDi,
        params,
        sceneScopeVersion,
      };
      cmd.attachContext(ctx);

      // Execute the command's logic. Await to allow async commands.
      await cmd.run(data);
    } catch (e) {
      if (this.isSceneScopeInvalidatedError(e)) {
        return;
      }
      // Log diagnostic information including the command name and payload for easier troubleshooting
      // and rethrow to let higher layers decide on failure handling (retry, user notification, etc.).
      console.error('CommandBus.run error:', name, data, this.describeError(e));
      throw e;
    }
  }

  private isSceneScopeInvalidatedError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    if (!('code' in error)) {
      return false;
    }
    const code = error.code;
    if (code !== EngineErrorCode.SceneInvalidState) {
      return false;
    }
    if (!('details' in error)) {
      return false;
    }
    const details = error.details;
    if (typeof details !== 'object' || details === null) {
      return false;
    }
    const method = (details as { method?: unknown }).method;
    return method === 'BaseCommand.assertSceneScopeActive';
  }

  private describeError(error: unknown, depth = 0): unknown {
    if (!(error instanceof Error)) {
      return error;
    }

    const described: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };

    const errorWithCode = error as Error & {
      code?: unknown;
      subsystem?: unknown;
      details?: unknown;
      cause?: unknown;
    };
    if (errorWithCode.code !== undefined) {
      described.code = errorWithCode.code;
    }
    if (errorWithCode.subsystem !== undefined) {
      described.subsystem = errorWithCode.subsystem;
    }
    if (errorWithCode.details !== undefined) {
      described.details = errorWithCode.details;
    }
    if (typeof error.stack === 'string' && error.stack.length > 0) {
      described.stack = error.stack;
    }
    if (depth < 2 && errorWithCode.cause !== undefined) {
      described.cause = this.describeError(errorWithCode.cause, depth + 1);
    }

    return described;
  }
}
