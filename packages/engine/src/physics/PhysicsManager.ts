import { PhysicsConfigDecoder } from './PhysicsConfigDecoder';
import { PhysicsErrors } from './PhysicsErrors';
import { PhysicsWorld } from './PhysicsWorld';

import type { PhysicsCreateWorldParams } from './types';

export class PhysicsManager {
  private static readonly SOURCE_NAME = 'PhysicsManager';

  private readonly worlds = new Map<string, PhysicsWorld>();

  createWorld(params: PhysicsCreateWorldParams): PhysicsWorld {
    const worldId = this.requireWorldId(params.worldId, 'createWorld');
    if (this.worlds.has(worldId)) {
      throw PhysicsErrors.worldAlreadyExists(PhysicsManager.SOURCE_NAME + '.createWorld', worldId);
    }

    const config = PhysicsConfigDecoder.decodeWorldConfig(
      params.config,
      `${PhysicsManager.SOURCE_NAME}.createWorld`,
    );

    const world = new PhysicsWorld(worldId, config);
    this.worlds.set(worldId, world);
    return world;
  }

  getRequiredWorld(worldId: string, source: string = PhysicsManager.SOURCE_NAME): PhysicsWorld {
    const requiredWorldId = this.requireWorldId(worldId, 'getRequiredWorld', source);
    const world = this.worlds.get(requiredWorldId);
    if (!world) {
      throw PhysicsErrors.worldNotFound(`${source}.getRequiredWorld`, requiredWorldId);
    }
    return world;
  }

  disposeWorld(worldId: string): void {
    const requiredWorldId = this.requireWorldId(worldId, 'disposeWorld');
    const world = this.worlds.get(requiredWorldId);
    if (!world) {
      throw PhysicsErrors.worldNotFound(`${PhysicsManager.SOURCE_NAME}.disposeWorld`, requiredWorldId);
    }
    this.worlds.delete(requiredWorldId);
    world.dispose();
  }

  disposeAll(): void {
    for (const [worldId, world] of this.worlds) {
      this.worlds.delete(worldId);
      world.dispose();
    }
  }

  private requireWorldId(worldId: string, method: string, source: string = PhysicsManager.SOURCE_NAME): string {
    if (worldId.length === 0) {
      throw PhysicsErrors.worldIdRequired(`${source}.${method}`);
    }
    return worldId;
  }
}
