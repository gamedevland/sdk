import type { PhysicsWorld } from './PhysicsWorld';
import type { SceneServiceContext, SceneServiceTickContext } from '@engine/scenes';

export type PhysicsBodyHandle = string;

export interface PhysicsBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PhysicsBodyMaterial {
  readonly restitution?: number;
  readonly friction?: number;
  readonly frictionStatic?: number;
  readonly frictionAir?: number;
  readonly density?: number;
  readonly sleepThreshold?: number;
}

export interface PhysicsWorldConfig {
  readonly gravityY: number;
  readonly wallThickness: number;
  readonly topPadding: number;
  readonly enableSleeping: boolean;
  readonly material: Required<PhysicsBodyMaterial>;
}

export interface PhysicsRectangleBodyParams {
  readonly bodyId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly isStatic?: boolean;
  readonly isSensor?: boolean;
  readonly label?: string;
  readonly angleRad?: number;
  readonly material?: PhysicsBodyMaterial;
  /** Initial horizontal velocity applied at the moment of body creation (pixels/step). */
  readonly initialVelocityX?: number;
  /** Initial vertical velocity applied at the moment of body creation (pixels/step). */
  readonly initialVelocityY?: number;
  /** Initial angular velocity applied at the moment of body creation (radians/step). */
  readonly initialAngularVelocity?: number;
}

export interface PhysicsCircleBodyParams {
  readonly bodyId: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly isStatic?: boolean;
  readonly isSensor?: boolean;
  readonly label?: string;
  readonly material?: PhysicsBodyMaterial;
  readonly initialVelocityX?: number;
  readonly initialVelocityY?: number;
  readonly initialAngularVelocity?: number;
}

export interface PhysicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface PhysicsPolygonBodyParams {
  readonly bodyId: string;
  readonly x: number;
  readonly y: number;
  readonly vertices: readonly PhysicsPoint[];
  readonly isStatic?: boolean;
  readonly isSensor?: boolean;
  readonly label?: string;
  readonly material?: PhysicsBodyMaterial;
  readonly initialVelocityX?: number;
  readonly initialVelocityY?: number;
  readonly initialAngularVelocity?: number;
}

export interface PhysicsCompoundPolygonBodyParams {
  readonly bodyId: string;
  readonly x: number;
  readonly y: number;
  readonly parts: readonly (readonly PhysicsPoint[])[];
  readonly preservePartPositions?: boolean;
  readonly isStatic?: boolean;
  readonly isSensor?: boolean;
  readonly label?: string;
  readonly material?: PhysicsBodyMaterial;
  readonly initialVelocityX?: number;
  readonly initialVelocityY?: number;
  readonly initialAngularVelocity?: number;
}

export interface PhysicsBodyVelocity {
  readonly x: number;
  readonly y: number;
  readonly angular?: number;
}

export interface PhysicsBodyImpulse {
  readonly x: number;
  readonly y: number;
}

export interface PhysicsBodyForce {
  readonly x?: number;
  readonly y?: number;
}

export interface PhysicsCollisionPair {
  readonly bodyAId?: string;
  readonly bodyBId?: string;
  readonly bodyALabel: string;
  readonly bodyBLabel: string;
  readonly bodyAIsStatic: boolean;
  readonly bodyBIsStatic: boolean;
  readonly bodyAIsSensor: boolean;
  readonly bodyBIsSensor: boolean;
  readonly normalX: number;
  readonly normalY: number;
}

export type PhysicsCollisionEventType = 'collisionStart' | 'collisionActive';

export type PhysicsCollisionHandler = (pairs: readonly PhysicsCollisionPair[]) => void;

export interface PhysicsBodyMotion {
  readonly speed: number;
  readonly angularSpeed: number;
}

export interface PhysicsBodySnapshot {
  readonly bodyId: string;
  readonly x: number;
  readonly y: number;
  readonly angleRad: number;
  readonly mass: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly angularVelocity: number;
  readonly isSleeping: boolean;
}

export interface PhysicsCreateWorldParams {
  readonly worldId: string;
  readonly config?: unknown;
}

export interface PhysicsSceneServiceConfig {
  readonly worldId: string;
  readonly worldConfig?: unknown;
  readonly resolveWorldConfig?: (ctx: SceneServiceContext) => Promise<unknown> | unknown;
  readonly resolveBounds: (ctx: SceneServiceContext) => PhysicsBounds;
  readonly onWorldReady?: (params: {
    readonly world: PhysicsWorld;
    readonly ctx: SceneServiceContext;
  }) => Promise<void> | void;
  readonly onWorldStep?: (params: {
    readonly world: PhysicsWorld;
    readonly ctx: SceneServiceTickContext;
    readonly snapshots: readonly PhysicsBodySnapshot[];
  }) => void;
}
