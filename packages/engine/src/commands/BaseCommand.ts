/**
 * Base abstract command providing access to execution context.
 */
import { CommandEventPayloadReader } from './CommandEventPayloadReader';
import { CommandSceneScopeInvalidatedError } from './CommandSceneScopeInvalidatedError';

import type { CommandPointerPayload } from './CommandEventPayloadReader';
import type { AppCommandContext } from './types';
import type { AssetManager } from '../assets/AssetManager';
import type { DiContainerInterface, Token } from '../di/types';
import type { SceneLayout } from '@engine/layouts';
import type { SceneRuntime } from '@engine/scenes/SceneRuntime';
import type { Decoder } from '@engine/validation';

export abstract class BaseCommand {
  protected ctx!: AppCommandContext;

  /** Attach execution context (called by CommandBus prior to run). */
  attachContext(ctx: AppCommandContext): void {
    this.ctx = ctx;
  }

  private get activeCtx(): AppCommandContext {
    this.assertSceneScopeActive();
    return this.ctx;
  }

  /** Shortcut to the engine instance. */
  protected get engine(): SceneRuntime {
    return this.activeCtx.engine;
  }
  /** Shortcut to the active scene layout. */
  protected get layout(): SceneLayout {
    return this.activeCtx.layout;
  }
  /** Shortcut to the asset manager. */
  protected get assets(): AssetManager {
    return this.activeCtx.assets;
  }
  /** Shortcut to the active scene DI scope. */
  protected get sceneDi(): DiContainerInterface {
    return this.activeCtx.sceneDi;
  }
  /** Params passed when the active scene was started/replaced. */
  protected get sceneParams(): Readonly<Record<string, unknown>> {
    return this.activeCtx.params;
  }

  /** Resolve a scene-scoped service, failing fast if missing. */
  protected getSceneService<T>(token: Token<T>): T {
    return this.sceneDi.get<T>(token);
  }

  protected getCommandName(): string {
    return this.constructor.name;
  }

  protected isSceneScopeActive(): boolean {
    return this.ctx.sceneScopeVersion === this.ctx.engine.scenes.getCurrentSceneScopeVersion();
  }

  protected assertSceneScopeActive(): void {
    const currentSceneScopeVersion = this.ctx.engine.scenes.getCurrentSceneScopeVersion();
    if (this.ctx.sceneScopeVersion === currentSceneScopeVersion) {
      return;
    }
    throw new CommandSceneScopeInvalidatedError({
      commandName: this.getCommandName(),
      commandSceneScopeVersion: this.ctx.sceneScopeVersion,
      currentSceneScopeVersion,
    });
  }

  protected async awaitSceneScope<T>(operation: Promise<T> | PromiseLike<T>): Promise<T> {
    const result = await operation;
    this.assertSceneScopeActive();
    return result;
  }

  /**
   * Run an async operation as fire-and-forget with automatic scene scope guard.
   *
   * While the operation runs it may freely use `this.engine`, `this.layout`, etc.
   * If the scene scope becomes invalid mid-flight, the `activeCtx` getter throws
   * `CommandSceneScopeInvalidatedError` which acts as a cancellation signal.
   *
   * Any error (scope-related or collateral, e.g. missing assets during teardown)
   * is silently swallowed when the scene scope is no longer active — there is
   * nothing to report to since the scene is already gone.
   * Errors that occur while the scope is still active are reported to the console.
   */
  protected runDetached(operation: () => Promise<void>): void {
    void this.executeDetached(operation);
  }

  private async executeDetached(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error: unknown) {
      if (this.isSceneScopeActive()) {
        const diagnostics = this.ctx.engine.diagnostics;
        if (diagnostics) diagnostics.report({ kind: 'error', source: this.getCommandName(), error });
        else console.error(`Detached command failed: ${this.getCommandName()}`, error);
      }
    }
  }

  private readPayload(data?: Record<string, unknown>): CommandEventPayloadReader {
    return new CommandEventPayloadReader(data, this.getCommandName());
  }

  protected decodePayload<T>(
    data: Record<string, unknown> | undefined,
    decoder: Decoder<T>,
    sourceName?: string,
  ): T {
    return this.readPayload(data).decodePayload(decoder, sourceName);
  }

  protected requirePayloadFiniteNumber(key: string, data?: Record<string, unknown>): number {
    return this.readPayload(data).requireFiniteNumber(key);
  }

  protected requirePayloadNonEmptyString(key: string, data?: Record<string, unknown>): string {
    return this.readPayload(data).requireNonEmptyString(key);
  }

  protected readPayloadNonEmptyString(key: string, data?: Record<string, unknown>): string | undefined {
    return this.readPayload(data).readNonEmptyString(key);
  }

  protected requirePayloadPointer(data?: Record<string, unknown>): CommandPointerPayload {
    return this.readPayload(data).requirePointer();
  }

  protected readPayloadUnknown(key: string, data?: Record<string, unknown>): unknown {
    return this.readPayload(data).readUnknown(key);
  }

  /** Decode scene start params through a schema-first boundary contract. */
  protected decodeSceneParams<T>(decoder: Decoder<T>, sourceName?: string): T {
    const source = sourceName ?? `${this.constructor.name}.sceneParams`;
    return this.decodePayload(this.sceneParams, decoder, source);
  }

  /** Execute command logic with optional payload data. */
  abstract run(data?: Record<string, unknown>): Promise<void> | void;
}

export default BaseCommand;
