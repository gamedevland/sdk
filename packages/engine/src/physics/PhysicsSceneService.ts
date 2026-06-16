import { PhysicsErrors } from './PhysicsErrors';

import type { PhysicsManager } from './PhysicsManager';
import type { PhysicsWorld } from './PhysicsWorld';
import type { PhysicsBodySnapshot } from './types';
import type { PhysicsSceneServiceConfig } from './types';
import type {
  SceneService,
  SceneServiceContext,
  SceneServiceTickContext,
  SceneServiceTickPhase,
} from '@engine/scenes';

export class PhysicsSceneService implements SceneService {
  private static readonly SOURCE_NAME = 'PhysicsSceneService';
  private static readonly FIXED_STEP_DT_SECONDS = 1 / 60;
  private static readonly MAX_FRAME_DT_SECONDS = 0.12;
  private static readonly MAX_STEPS_PER_TICK = 6;
  private static readonly STEP_EPSILON_SECONDS = 1e-6;
  readonly tickPhase: SceneServiceTickPhase = 'physics';

  private world: PhysicsWorld | undefined;
  private activeSceneKey: string | undefined;
  private accumulatedDtSeconds = 0;

  constructor(
    private readonly manager: PhysicsManager,
    private readonly config: PhysicsSceneServiceConfig,
  ) {}

  async onSceneEnter(ctx: SceneServiceContext): Promise<void> {
    if (this.world) {
      throw PhysicsErrors.sceneServiceAlreadyInitialized(
        this.composeSource('onSceneEnter', ctx.sceneKey),
        this.config.worldId,
      );
    }

    this.assertSingleConfigSource(ctx.sceneKey);
    const worldConfig = await this.resolveWorldConfig(ctx);
    const world = this.manager.createWorld({
      worldId: this.config.worldId,
      config: worldConfig,
    });
    try {
      const bounds = this.config.resolveBounds(ctx);
      world.setBounds(bounds);
      if (this.config.onWorldReady) {
        await this.config.onWorldReady({ world, ctx });
      }
      this.world = world;
      this.activeSceneKey = ctx.sceneKey;
      this.accumulatedDtSeconds = 0;
    } catch (cause) {
      this.manager.disposeWorld(world.getId());
      throw this.createLifecycleError(ctx.sceneKey, 'onSceneEnter', cause);
    }
  }

  onSceneTick(ctx: SceneServiceTickContext): void {
    if (ctx.dt <= 0) {
      return;
    }
    const world = this.getRequiredWorld();
    const snapshots = this.stepWorldWithFixedDt(world, ctx.dt);
    if (snapshots === undefined) {
      return;
    }
    if (this.config.onWorldStep) {
      this.config.onWorldStep({ world, ctx, snapshots });
    }
  }

  onSceneExit(ctx: SceneServiceContext): void {
    const activeSceneKey = this.activeSceneKey;
    if (activeSceneKey && activeSceneKey !== ctx.sceneKey) {
      throw PhysicsErrors.sceneServiceSceneMismatch(
        this.composeSource('onSceneExit', activeSceneKey),
        activeSceneKey,
        ctx.sceneKey,
      );
    }
    const world = this.getRequiredWorld();
    this.world = undefined;
    this.activeSceneKey = undefined;
    this.accumulatedDtSeconds = 0;
    this.manager.disposeWorld(world.getId());
  }

  getRequiredWorld(): PhysicsWorld {
    const world = this.world;
    if (!world) {
      throw PhysicsErrors.worldNotFound(this.composeSource('getRequiredWorld'), this.config.worldId);
    }
    return world;
  }

  private createLifecycleError(sceneKey: string, operation: string, cause: unknown): Error {
    const message = this.buildMessage(sceneKey, operation, String(cause));
    if (cause instanceof Error) {
      return new Error(message, { cause });
    }
    return new Error(message);
  }

  private async resolveWorldConfig(ctx: SceneServiceContext): Promise<unknown> {
    if (this.config.resolveWorldConfig) {
      return this.config.resolveWorldConfig(ctx);
    }
    if (this.config.worldConfig !== undefined) {
      return this.config.worldConfig;
    }
    return undefined;
  }

  private assertSingleConfigSource(sceneKey: string): void {
    if (this.config.resolveWorldConfig && this.config.worldConfig !== undefined) {
      throw PhysicsErrors.sceneServiceConfigSourceConflict(
        this.composeSource('onSceneEnter', sceneKey),
      );
    }
  }

  private composeSource(operation: string, sceneKey?: string): string {
    const resolvedSceneKey = sceneKey ?? this.activeSceneKey ?? 'unknown';
    return `${PhysicsSceneService.SOURCE_NAME}.${operation}[scene=${resolvedSceneKey}]`;
  }

  private buildMessage(sceneKey: string, operation: string, details: string): string {
    return `${this.composeSource(operation, sceneKey)}: ${details}`;
  }

  private stepWorldWithFixedDt(
    world: PhysicsWorld,
    dtSeconds: number,
  ): readonly PhysicsBodySnapshot[] | undefined {
    const clampedFrameDt = Math.min(dtSeconds, PhysicsSceneService.MAX_FRAME_DT_SECONDS);
    this.accumulatedDtSeconds = Math.min(
      this.accumulatedDtSeconds + clampedFrameDt,
      PhysicsSceneService.MAX_FRAME_DT_SECONDS,
    );

    if (this.accumulatedDtSeconds + PhysicsSceneService.STEP_EPSILON_SECONDS <
      PhysicsSceneService.FIXED_STEP_DT_SECONDS) {
      return undefined;
    }

    let snapshots: readonly PhysicsBodySnapshot[] = [];
    let steps = 0;
    while (
      this.accumulatedDtSeconds + PhysicsSceneService.STEP_EPSILON_SECONDS >=
        PhysicsSceneService.FIXED_STEP_DT_SECONDS &&
      steps < PhysicsSceneService.MAX_STEPS_PER_TICK
    ) {
      snapshots = world.step(PhysicsSceneService.FIXED_STEP_DT_SECONDS);
      this.accumulatedDtSeconds -= PhysicsSceneService.FIXED_STEP_DT_SECONDS;
      steps += 1;
    }

    if (
      steps === PhysicsSceneService.MAX_STEPS_PER_TICK &&
      this.accumulatedDtSeconds > PhysicsSceneService.FIXED_STEP_DT_SECONDS
    ) {
      this.accumulatedDtSeconds = PhysicsSceneService.FIXED_STEP_DT_SECONDS * 0.5;
    }

    if (this.accumulatedDtSeconds < 0) {
      this.accumulatedDtSeconds = 0;
    }

    return snapshots;
  }
}
