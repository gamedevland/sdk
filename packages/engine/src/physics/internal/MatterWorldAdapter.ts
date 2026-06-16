import { Bodies, Body, Engine, Events, Sleeping, Vertices, World } from 'matter-js';

import { PhysicsErrors } from '../PhysicsErrors';

import { PhysicsBodyRegistry } from './PhysicsBodyRegistry';

import type {
  PhysicsBodyImpulse,
  PhysicsBodyForce,
  PhysicsBodyMotion,
  PhysicsBodySnapshot,
  PhysicsBodyVelocity,
  PhysicsBounds,
  PhysicsCollisionEventType,
  PhysicsCollisionHandler,
  PhysicsCollisionPair,
  PhysicsCompoundPolygonBodyParams,
  PhysicsCircleBodyParams,
  PhysicsPoint,
  PhysicsPolygonBodyParams,
  PhysicsRectangleBodyParams,
  PhysicsWorldConfig,
} from '../types';
import type { IEventCollision, Pair } from 'matter-js';

interface MutablePhysicsBodySnapshot {
  bodyId: string;
  x: number;
  y: number;
  angleRad: number;
  mass: number;
  velocityX: number;
  velocityY: number;
  angularVelocity: number;
  isSleeping: boolean;
}

/**
 * Default physics backend adapter based on Matter.js.
 *
 * NOTE: This class is internal implementation detail of `@gamedevland/engine/physics`.
 */
export class MatterWorldAdapter {
  private readonly engine: Engine;
  private readonly world: World;
  private readonly bodyRegistry = new PhysicsBodyRegistry();
  private readonly boundaryBodies: Body[] = [];
  private readonly snapshotPool: MutablePhysicsBodySnapshot[] = [];
  private readonly snapshotView: MutablePhysicsBodySnapshot[] = [];
  private bounds?: PhysicsBounds;

  constructor(private readonly config: PhysicsWorldConfig) {
    this.engine = Engine.create();
    this.world = this.engine.world;
    this.engine.positionIterations = 4;
    this.engine.velocityIterations = 4;
    this.engine.constraintIterations = 4;
    this.engine.gravity.y = config.gravityY;
    this.engine.enableSleeping = config.enableSleeping;
  }

  setBounds(bounds: PhysicsBounds): void {
    this.assertValidBounds(bounds, 'setBounds');
    this.bounds = bounds;
    this.rebuildBounds();
  }

  getRequiredBounds(source: string): PhysicsBounds {
    if (!this.bounds) {
      throw PhysicsErrors.boundsNotSet(source);
    }
    return this.bounds;
  }

  addRectangleBody(params: PhysicsRectangleBodyParams, source: string): void {
    if (params.width <= 0 || params.height <= 0) {
      throw PhysicsErrors.invalidBodySize(source, params.width, params.height);
    }

    const material = this.resolveMaterial(params.material);

    const body = Bodies.rectangle(params.x, params.y, params.width, params.height, {
      isStatic: params.isStatic ?? false,
      isSensor: params.isSensor ?? false,
      restitution: material.restitution,
      friction: material.friction,
      frictionStatic: material.frictionStatic,
      frictionAir: material.frictionAir,
      density: material.density,
      sleepThreshold: material.sleepThreshold,
      angle: params.angleRad ?? 0,
      label: params.label,
    });

    this.bodyRegistry.add(params.bodyId, body, source);
    World.add(this.world, body);

    this.applyInitialVelocity(body, params, source);
  }

  addCircleBody(params: PhysicsCircleBodyParams, source: string): void {
    if (params.radius <= 0) {
      throw PhysicsErrors.invalidBodyRadius(source, params.radius);
    }

    const material = this.resolveMaterial(params.material);

    const body = Bodies.circle(params.x, params.y, params.radius, {
      isStatic: params.isStatic ?? false,
      isSensor: params.isSensor ?? false,
      restitution: material.restitution,
      friction: material.friction,
      frictionStatic: material.frictionStatic,
      frictionAir: material.frictionAir,
      density: material.density,
      sleepThreshold: material.sleepThreshold,
      label: params.label,
    });

    this.bodyRegistry.add(params.bodyId, body, source);
    World.add(this.world, body);
    this.applyInitialVelocity(body, params, source);
  }

  addPolygonBody(params: PhysicsPolygonBodyParams, source: string): void {
    this.addCompoundPolygonBody(
      {
        ...params,
        parts: [params.vertices],
      },
      source,
    );
  }

  addCompoundPolygonBody(params: PhysicsCompoundPolygonBodyParams, source: string): void {
    if (params.parts.length === 0) {
      throw PhysicsErrors.invalidBodyVertices(source, 0);
    }

    const material = this.resolveMaterial(params.material);
    const parts = params.parts.map((vertices) => this.createPolygonPart(vertices, material, source));
    const body = Body.create({
      parts,
      isStatic: params.isStatic ?? false,
      isSensor: params.isSensor ?? false,
      restitution: material.restitution,
      friction: material.friction,
      frictionStatic: material.frictionStatic,
      frictionAir: material.frictionAir,
      density: material.density,
      sleepThreshold: material.sleepThreshold,
      label: params.label,
    });

    body.label = params.label ?? body.label;
    for (const part of body.parts) {
      part.label = body.label;
      part.isSensor = params.isSensor ?? false;
    }

    if (params.preservePartPositions !== true) {
      Body.setPosition(body, { x: params.x, y: params.y });
    }
    this.bodyRegistry.add(params.bodyId, body, source);
    World.add(this.world, body);
    this.applyInitialVelocity(body, params, source);
  }

  removeBody(bodyId: string, source: string): void {
    const body = this.bodyRegistry.getRequired(bodyId, source);
    this.bodyRegistry.removeOptional(bodyId);
    World.remove(this.world, body);
  }

  sleepBody(bodyId: string, source: string): void {
    const body = this.bodyRegistry.getRequired(bodyId, source);
    Sleeping.set(body, true);
  }

  wakeBody(bodyId: string, source: string): void {
    const body = this.bodyRegistry.getRequired(bodyId, source);
    Sleeping.set(body, false);
    // Restore the world-default frictionAir so that bodies woken after settling
    // (e.g. after a topology change) damp back to rest at the normal rate,
    // regardless of the frictionAir they were created with (e.g. spawn override).
    body.frictionAir = this.config.material.frictionAir;
  }

  setBodyVelocity(bodyId: string, velocity: PhysicsBodyVelocity, source: string): void {
    this.assertValidVelocity(velocity, source);
    const body = this.bodyRegistry.getRequired(bodyId, source);
    Sleeping.set(body, false);
    Body.setVelocity(body, { x: velocity.x, y: velocity.y });
    if (velocity.angular !== undefined) {
      Body.setAngularVelocity(body, velocity.angular);
    }
  }

  applyBodyImpulse(bodyId: string, impulse: PhysicsBodyImpulse, source: string): void {
    if (!Number.isFinite(impulse.x) || !Number.isFinite(impulse.y)) {
      throw PhysicsErrors.invalidBodyImpulse(source, impulse.x, impulse.y);
    }
    const body = this.bodyRegistry.getRequired(bodyId, source);
    Sleeping.set(body, false);
    Body.applyForce(body, body.position, { x: impulse.x, y: impulse.y });
  }

  setBodyForce(bodyId: string, force: PhysicsBodyForce, source: string): void {
    if (
      (force.x !== undefined && !Number.isFinite(force.x)) ||
      (force.y !== undefined && !Number.isFinite(force.y))
    ) {
      throw PhysicsErrors.invalidBodyForce(source, force.x, force.y);
    }
    const body = this.bodyRegistry.getRequired(bodyId, source);
    if (force.x !== undefined) {
      body.force.x = force.x;
    }
    if (force.y !== undefined) {
      body.force.y = force.y;
    }
  }

  setBodyStatic(bodyId: string, isStatic: boolean, source: string): void {
    const body = this.bodyRegistry.getRequired(bodyId, source);
    Body.setStatic(body, isStatic);
  }

  setBodyPosition(bodyId: string, x: number, y: number, source: string): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw PhysicsErrors.invalidBodyVelocity(source, x, y);
    }
    const body = this.bodyRegistry.getRequired(bodyId, source);
    Body.setPosition(body, { x, y });
  }

  setBodyAngle(bodyId: string, angleRad: number, source: string): void {
    if (!Number.isFinite(angleRad)) {
      throw PhysicsErrors.invalidBodyVelocity(source, 0, 0, angleRad);
    }
    const body = this.bodyRegistry.getRequired(bodyId, source);
    Body.setAngle(body, angleRad);
    Body.setAngularVelocity(body, 0);
  }

  getBodyMotion(bodyId: string, source: string): PhysicsBodyMotion {
    const body = this.bodyRegistry.getRequired(bodyId, source);
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    return {
      speed: Math.sqrt(vx * vx + vy * vy),
      angularSpeed: Math.abs(body.angularVelocity),
    };
  }

  step(dtSeconds: number): void {
    Engine.update(this.engine, dtSeconds * 1000);
  }

  listBodySnapshots(): readonly PhysicsBodySnapshot[] {
    let index = 0;
    for (const [bodyId, body] of this.bodyRegistry.entries()) {
      let snapshot = this.snapshotPool[index];
      if (!snapshot) {
        snapshot = {
          bodyId,
          x: body.position.x,
          y: body.position.y,
          angleRad: body.angle,
          mass: body.mass,
          velocityX: body.velocity.x,
          velocityY: body.velocity.y,
          angularVelocity: body.angularVelocity,
          isSleeping: body.isSleeping,
        };
        this.snapshotPool.push(snapshot);
      } else {
        snapshot.bodyId = bodyId;
        snapshot.x = body.position.x;
        snapshot.y = body.position.y;
        snapshot.angleRad = body.angle;
        snapshot.mass = body.mass;
        snapshot.velocityX = body.velocity.x;
        snapshot.velocityY = body.velocity.y;
        snapshot.angularVelocity = body.angularVelocity;
        snapshot.isSleeping = body.isSleeping;
      }
      this.snapshotView[index] = snapshot;
      index += 1;
    }
    this.snapshotView.length = index;
    return this.snapshotView;
  }

  onCollision(
    type: PhysicsCollisionEventType,
    handler: PhysicsCollisionHandler,
    _source: string,
  ): () => void {
    const listener = (event: IEventCollision<Engine>): void => {
      handler(event.pairs.map((pair) => this.toCollisionPair(pair)));
    };
    if (type === 'collisionStart') {
      Events.on(this.engine, 'collisionStart', listener);
    } else {
      Events.on(this.engine, 'collisionActive', listener);
    }
    return () => {
      Events.off(this.engine, type, listener);
    };
  }

  dispose(): void {
    for (const body of this.boundaryBodies) {
      World.remove(this.world, body);
    }
    this.boundaryBodies.length = 0;

    for (const [bodyId] of Array.from(this.bodyRegistry.entries())) {
      this.removeBody(bodyId, 'MatterWorldAdapter.dispose');
    }
    this.bodyRegistry.clear();
  }

  private assertValidBounds(bounds: PhysicsBounds, method: string): void {
    if (
      !Number.isFinite(bounds.x) ||
      !Number.isFinite(bounds.y) ||
      !Number.isFinite(bounds.width) ||
      !Number.isFinite(bounds.height) ||
      bounds.width <= 0 ||
      bounds.height <= 0
    ) {
      throw PhysicsErrors.invalidBounds(
        `MatterWorldAdapter.${method}`,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
      );
    }
  }

  private resolveMaterial(
    material: PhysicsRectangleBodyParams['material'],
  ): Required<PhysicsWorldConfig['material']> {
    return {
      restitution: material?.restitution ?? this.config.material.restitution,
      friction: material?.friction ?? this.config.material.friction,
      frictionStatic: material?.frictionStatic ?? this.config.material.frictionStatic,
      frictionAir: material?.frictionAir ?? this.config.material.frictionAir,
      density: material?.density ?? this.config.material.density,
      sleepThreshold: material?.sleepThreshold ?? this.config.material.sleepThreshold,
    };
  }

  private createPolygonPart(
    vertices: readonly PhysicsPoint[],
    material: Required<PhysicsWorldConfig['material']>,
    source: string,
  ): Body {
    this.assertValidVertices(vertices, source);
    const matterVertices = vertices.map((vertex) => ({ x: vertex.x, y: vertex.y }));
    const centre = Vertices.centre(matterVertices);
    return Bodies.fromVertices(centre.x, centre.y, [matterVertices], {
      restitution: material.restitution,
      friction: material.friction,
      frictionStatic: material.frictionStatic,
      frictionAir: material.frictionAir,
      density: material.density,
      sleepThreshold: material.sleepThreshold,
    });
  }

  private assertValidVertices(vertices: readonly PhysicsPoint[], source: string): void {
    if (vertices.length < 3) {
      throw PhysicsErrors.invalidBodyVertices(source, vertices.length);
    }
    for (const vertex of vertices) {
      if (!Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)) {
        throw PhysicsErrors.invalidBodyVertices(source, vertices.length);
      }
    }
  }

  private applyInitialVelocity(
    body: Body,
    params: Pick<
      PhysicsRectangleBodyParams,
      'initialVelocityX' | 'initialVelocityY' | 'initialAngularVelocity'
    >,
    source: string,
  ): void {
    const velocity: PhysicsBodyVelocity =
      params.initialAngularVelocity === undefined
        ? {
            x: params.initialVelocityX ?? 0,
            y: params.initialVelocityY ?? 0,
          }
        : {
            x: params.initialVelocityX ?? 0,
            y: params.initialVelocityY ?? 0,
            angular: params.initialAngularVelocity,
          };
    this.assertValidVelocity(velocity, source);

    if (velocity.x !== 0 || velocity.y !== 0) {
      Body.setVelocity(body, { x: velocity.x, y: velocity.y });
    }
    if (velocity.angular !== undefined && velocity.angular !== 0) {
      Body.setAngularVelocity(body, velocity.angular);
    }
  }

  private assertValidVelocity(velocity: PhysicsBodyVelocity, source: string): void {
    if (
      !Number.isFinite(velocity.x) ||
      !Number.isFinite(velocity.y) ||
      (velocity.angular !== undefined && !Number.isFinite(velocity.angular))
    ) {
      throw PhysicsErrors.invalidBodyVelocity(source, velocity.x, velocity.y, velocity.angular);
    }
  }

  private resolveCollisionBodyId(body: Body): string | undefined {
    return this.bodyRegistry.findBodyId(body.parent) ?? this.bodyRegistry.findBodyId(body);
  }

  private toCollisionPair(pair: Pair): PhysicsCollisionPair {
    const bodyAId = this.resolveCollisionBodyId(pair.bodyA);
    const bodyBId = this.resolveCollisionBodyId(pair.bodyB);
    return {
      ...(bodyAId === undefined ? {} : { bodyAId }),
      ...(bodyBId === undefined ? {} : { bodyBId }),
      bodyALabel: pair.bodyA.parent.label,
      bodyBLabel: pair.bodyB.parent.label,
      bodyAIsStatic: pair.bodyA.parent.isStatic,
      bodyBIsStatic: pair.bodyB.parent.isStatic,
      bodyAIsSensor: pair.bodyA.isSensor || pair.bodyA.parent.isSensor,
      bodyBIsSensor: pair.bodyB.isSensor || pair.bodyB.parent.isSensor,
      normalX: pair.collision.normal.x,
      normalY: pair.collision.normal.y,
    };
  }

  private rebuildBounds(): void {
    for (const body of this.boundaryBodies) {
      World.remove(this.world, body);
    }
    this.boundaryBodies.length = 0;

    const bounds = this.bounds;
    if (!bounds) {
      return;
    }

    const thickness = this.config.wallThickness;
    const half = thickness / 2;
    const worldTopY = bounds.y - this.config.topPadding;
    const worldHeight = bounds.height + this.config.topPadding;

    // High friction and zero restitution on boundary walls so dynamic bodies lose energy
    // on contact and settle without bouncing.
    const wallMaterial = { isStatic: true, friction: 2.5, frictionStatic: 2.0, restitution: 0 };

    const left = Bodies.rectangle(
      bounds.x - half,
      worldTopY + worldHeight / 2,
      thickness,
      worldHeight + thickness * 2,
      wallMaterial,
    );
    const right = Bodies.rectangle(
      bounds.x + bounds.width + half,
      worldTopY + worldHeight / 2,
      thickness,
      worldHeight + thickness * 2,
      wallMaterial,
    );
    const floor = Bodies.rectangle(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height + half,
      bounds.width + thickness * 2,
      thickness,
      wallMaterial,
    );
    const ceiling = Bodies.rectangle(
      bounds.x + bounds.width / 2,
      worldTopY - half,
      bounds.width + thickness * 2,
      thickness,
      wallMaterial,
    );

    this.boundaryBodies.push(left, right, floor, ceiling);
    World.add(this.world, this.boundaryBodies);
  }
}
