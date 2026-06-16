export class PhysicsErrors {
  static worldIdRequired(source: string): Error {
    return new Error(`${source}: worldId must be a non-empty string`);
  }

  static worldAlreadyExists(source: string, worldId: string): Error {
    return new Error(`${source}: world '${worldId}' is already registered`);
  }

  static worldNotFound(source: string, worldId: string): Error {
    return new Error(`${source}: world '${worldId}' is not registered`);
  }

  static worldDisposed(source: string, worldId: string): Error {
    return new Error(`${source}: world '${worldId}' is disposed`);
  }

  static bodyIdRequired(source: string): Error {
    return new Error(`${source}: bodyId must be a non-empty string`);
  }

  static duplicateBodyId(source: string, bodyId: string): Error {
    return new Error(`${source}: body '${bodyId}' is already registered`);
  }

  static bodyNotFound(source: string, bodyId: string): Error {
    return new Error(`${source}: body '${bodyId}' is not registered`);
  }

  static invalidBodySize(source: string, width: number, height: number): Error {
    return new Error(`${source}: body size must be positive, got width=${String(width)} height=${String(height)}`);
  }

  static invalidBodyRadius(source: string, radius: number): Error {
    return new Error(`${source}: body radius must be positive, got radius=${String(radius)}`);
  }

  static invalidBodyVertices(source: string, count: number): Error {
    return new Error(`${source}: polygon body requires at least 3 finite vertices, got count=${String(count)}`);
  }

  static invalidBodyVelocity(source: string, x: number, y: number, angular?: number): Error {
    return new Error(
      `${source}: body velocity must be finite, got x=${String(x)} y=${String(y)} angular=${String(angular)}`,
    );
  }

  static invalidBodyImpulse(source: string, x: number, y: number): Error {
    return new Error(`${source}: body impulse must be finite, got x=${String(x)} y=${String(y)}`);
  }

  static invalidBodyForce(source: string, x?: number, y?: number): Error {
    return new Error(`${source}: body force must be finite when provided, got x=${String(x)} y=${String(y)}`);
  }

  static invalidStep(source: string, dtSeconds: number): Error {
    return new Error(`${source}: dtSeconds must be within (0, 0.1], got '${String(dtSeconds)}'`);
  }

  static boundsNotSet(source: string): Error {
    return new Error(`${source}: bounds are not set`);
  }

  static invalidBounds(source: string, x: number, y: number, width: number, height: number): Error {
    return new Error(
      `${source}: bounds must be finite and positive, got x=${String(x)} y=${String(y)} width=${String(width)} height=${String(height)}`,
    );
  }

  static sceneServiceAlreadyInitialized(source: string, worldId: string): Error {
    return new Error(`${source}: world '${worldId}' is already initialized`);
  }

  static sceneServiceConfigSourceConflict(source: string): Error {
    return new Error(
      `${source}: exactly one world config source is allowed: provide either 'worldConfig' or 'resolveWorldConfig'`,
    );
  }

  static sceneServiceSceneMismatch(source: string, activeSceneKey: string, incomingSceneKey: string): Error {
    return new Error(
      `${source}: scene key mismatch, active='${activeSceneKey}' incoming='${incomingSceneKey}'`,
    );
  }
}
