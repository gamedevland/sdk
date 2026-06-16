import { MatterWorldAdapter } from './internal/MatterWorldAdapter';
import { PhysicsStepExecutor } from './internal/PhysicsStepExecutor';
import { PhysicsErrors } from './PhysicsErrors';

import type {
  PhysicsBodyImpulse,
  PhysicsBodyForce,
  PhysicsBodyHandle,
  PhysicsBodyMotion,
  PhysicsBodySnapshot,
  PhysicsBodyVelocity,
  PhysicsBounds,
  PhysicsCollisionEventType,
  PhysicsCollisionHandler,
  PhysicsCompoundPolygonBodyParams,
  PhysicsCircleBodyParams,
  PhysicsPolygonBodyParams,
  PhysicsRectangleBodyParams,
  PhysicsWorldConfig,
} from './types';

export class PhysicsWorld {
  private static readonly SOURCE_NAME = 'PhysicsWorld';

  private readonly adapter: MatterWorldAdapter;
  private readonly stepExecutor = new PhysicsStepExecutor();
  private disposed = false;

  constructor(
    private readonly worldId: string,
    config: PhysicsWorldConfig,
  ) {
    this.adapter = new MatterWorldAdapter(config);
  }

  getId(): string {
    return this.worldId;
  }

  setBounds(bounds: PhysicsBounds): void {
    this.assertNotDisposed('setBounds');
    this.adapter.setBounds(bounds);
  }

  getRequiredBounds(): PhysicsBounds {
    this.assertNotDisposed('getRequiredBounds');
    return this.adapter.getRequiredBounds(this.scopedSource('getRequiredBounds'));
  }

  addRectangleBody(params: PhysicsRectangleBodyParams): PhysicsBodyHandle {
    this.assertNotDisposed('addRectangleBody');
    this.adapter.addRectangleBody(params, this.scopedSource('addRectangleBody'));
    return params.bodyId;
  }

  addCircleBody(params: PhysicsCircleBodyParams): PhysicsBodyHandle {
    this.assertNotDisposed('addCircleBody');
    this.adapter.addCircleBody(params, this.scopedSource('addCircleBody'));
    return params.bodyId;
  }

  addPolygonBody(params: PhysicsPolygonBodyParams): PhysicsBodyHandle {
    this.assertNotDisposed('addPolygonBody');
    this.adapter.addPolygonBody(params, this.scopedSource('addPolygonBody'));
    return params.bodyId;
  }

  addCompoundPolygonBody(params: PhysicsCompoundPolygonBodyParams): PhysicsBodyHandle {
    this.assertNotDisposed('addCompoundPolygonBody');
    this.adapter.addCompoundPolygonBody(params, this.scopedSource('addCompoundPolygonBody'));
    return params.bodyId;
  }

  removeBody(handle: PhysicsBodyHandle): void {
    this.assertNotDisposed('removeBody');
    this.adapter.removeBody(this.handleToId(handle, 'removeBody'), this.scopedSource('removeBody'));
  }

  sleepBody(handle: PhysicsBodyHandle): void {
    this.assertNotDisposed('sleepBody');
    this.adapter.sleepBody(this.handleToId(handle, 'sleepBody'), this.scopedSource('sleepBody'));
  }

  wakeBody(handle: PhysicsBodyHandle): void {
    this.assertNotDisposed('wakeBody');
    this.adapter.wakeBody(this.handleToId(handle, 'wakeBody'), this.scopedSource('wakeBody'));
  }

  setBodyVelocity(handle: PhysicsBodyHandle, velocity: PhysicsBodyVelocity): void {
    this.assertNotDisposed('setBodyVelocity');
    this.adapter.setBodyVelocity(
      this.handleToId(handle, 'setBodyVelocity'),
      velocity,
      this.scopedSource('setBodyVelocity'),
    );
  }

  setBodyForce(handle: PhysicsBodyHandle, force: PhysicsBodyForce): void {
    this.assertNotDisposed('setBodyForce');
    this.adapter.setBodyForce(
      this.handleToId(handle, 'setBodyForce'),
      force,
      this.scopedSource('setBodyForce'),
    );
  }

  setBodyStatic(handle: PhysicsBodyHandle, isStatic: boolean): void {
    this.assertNotDisposed('setBodyStatic');
    this.adapter.setBodyStatic(
      this.handleToId(handle, 'setBodyStatic'),
      isStatic,
      this.scopedSource('setBodyStatic'),
    );
  }

  setBodyPosition(handle: PhysicsBodyHandle, x: number, y: number): void {
    this.assertNotDisposed('setBodyPosition');
    this.adapter.setBodyPosition(
      this.handleToId(handle, 'setBodyPosition'),
      x,
      y,
      this.scopedSource('setBodyPosition'),
    );
  }

  setBodyAngle(handle: PhysicsBodyHandle, angleRad: number): void {
    this.assertNotDisposed('setBodyAngle');
    this.adapter.setBodyAngle(
      this.handleToId(handle, 'setBodyAngle'),
      angleRad,
      this.scopedSource('setBodyAngle'),
    );
  }

  applyBodyImpulse(handle: PhysicsBodyHandle, impulse: PhysicsBodyImpulse): void {
    this.assertNotDisposed('applyBodyImpulse');
    this.adapter.applyBodyImpulse(
      this.handleToId(handle, 'applyBodyImpulse'),
      impulse,
      this.scopedSource('applyBodyImpulse'),
    );
  }

  getBodyMotion(handle: PhysicsBodyHandle): PhysicsBodyMotion {
    this.assertNotDisposed('getBodyMotion');
    return this.adapter.getBodyMotion(
      this.handleToId(handle, 'getBodyMotion'),
      this.scopedSource('getBodyMotion'),
    );
  }

  getBodySnapshots(): readonly PhysicsBodySnapshot[] {
    this.assertNotDisposed('getBodySnapshots');
    return this.adapter.listBodySnapshots();
  }

  onCollision(type: PhysicsCollisionEventType, handler: PhysicsCollisionHandler): () => void {
    this.assertNotDisposed('onCollision');
    return this.adapter.onCollision(type, handler, this.scopedSource('onCollision'));
  }

  step(dtSeconds: number): readonly PhysicsBodySnapshot[] {
    this.assertNotDisposed('step');
    return this.stepExecutor.executeStep({
      adapter: this.adapter,
      dtSeconds,
      source: this.scopedSource('step'),
    });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.adapter.dispose();
  }

  private handleToId(handle: PhysicsBodyHandle, method: string): string {
    if (handle.length === 0) {
      throw PhysicsErrors.bodyIdRequired(this.scopedSource(method));
    }
    return handle;
  }

  private assertNotDisposed(method: string): void {
    if (this.disposed) {
      throw PhysicsErrors.worldDisposed(this.scopedSource(method), this.worldId);
    }
  }

  private scopedSource(method: string): string {
    return `${PhysicsWorld.SOURCE_NAME}.${method}`;
  }
}
