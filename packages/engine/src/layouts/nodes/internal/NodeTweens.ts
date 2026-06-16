/**
 * Node-scoped tween facade built on the engine's TweenManager.
 * All methods target the node's native view automatically.
 *
 * Provides sugar helpers (moveTo/scaleTo/etc.) and delegates to TweenManager
 * under the hood. Keeps animation code concise at the node level.
 */
import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { TweenHandle, TweenOptions, TweenPathOptions, TweenPoint } from '@engine/tween/types';
import type { TimelineBuilder, TweenManager, TweenTarget } from '@engine/tween/types';

interface EngineWithTweens {
  tweens: TweenManager;
}

export class NodeTweens {
  private readonly getEngine: () => EngineWithTweens | undefined;
  private readonly getTarget: () => TweenTarget;

  constructor(getEngine: () => EngineWithTweens | undefined, getTarget: () => TweenTarget) {
    this.getEngine = getEngine;
    this.getTarget = getTarget;
  }

  private engine(): EngineWithTweens {
    const engine = this.getEngine();
    if (!engine) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.LayoutMissingRequired,
        subsystem: EngineSubsystem.Layout,
        message: 'Engine is not attached',
        details: { method: 'NodeTweens.engine' },
      });
    }
    return engine;
  }

  /** Create a .to tween for this node's view. */
  to(props: Record<string, number>, opts?: TweenOptions): TweenHandle {
    return this.engine().tweens.to(this.getTarget(), props, opts);
  }
  /** Create a .from tween for this node's view. */
  from(props: Record<string, number>, opts?: TweenOptions): TweenHandle {
    return this.engine().tweens.from(this.getTarget(), props, opts);
  }
  /** Create a .fromTo tween for this node's view. */
  fromTo(f: Record<string, number>, t: Record<string, number>, opts?: TweenOptions): TweenHandle {
    return this.engine().tweens.fromTo(this.getTarget(), f, t, opts);
  }
  /** Build a timeline for this node's view. */
  timeline(setup: (tl: TimelineBuilder) => void, opts?: { groupId?: string }): TweenHandle {
    return this.engine().tweens.timeline(setup, opts);
  }

  /** Convenience helpers mapped to TweenManager sugar API. */
  moveTo(position: { x: number; y: number }, duration: number, opts?: TweenOptions): TweenHandle {
    return this.engine().tweens.moveTo(this.getTarget(), position, duration, opts);
  }
  moveAlongPath(
    points: readonly TweenPoint[],
    duration: number,
    opts?: TweenPathOptions,
  ): TweenHandle {
    return this.engine().tweens.moveAlongPath(this.getTarget(), points, duration, opts);
  }
  moveBy(dx: number, dy: number, opts?: TweenOptions): TweenHandle {
    return this.engine().tweens.moveBy(this.getTarget(), dx, dy, opts);
  }
  scaleTo(
    s: number | { x: number; y: number },
    duration: number,
    opts?: TweenOptions,
  ): TweenHandle {
    return this.engine().tweens.scaleTo(this.getTarget(), s, duration, opts);
  }
  scaleXY(sx: number, sy: number, opts?: TweenOptions): TweenHandle {
    return this.engine().tweens.scaleXY(this.getTarget(), sx, sy, opts);
  }
  alphaTo(alpha: number, duration: number, opts?: TweenOptions): TweenHandle {
    return this.engine().tweens.alphaTo(this.getTarget(), alpha, duration, opts);
  }
  fadeIn(duration: number, opts?: TweenOptions): TweenHandle {
    return this.engine().tweens.fadeIn(this.getTarget(), duration, opts);
  }
  fadeOut(duration: number, opts?: TweenOptions): TweenHandle {
    return this.engine().tweens.fadeOut(this.getTarget(), duration, opts);
  }
  rotateTo(angle: number, duration: number, opts?: TweenOptions): TweenHandle {
    return this.engine().tweens.rotateTo(this.getTarget(), angle, duration, opts);
  }
  rotateBy(dr: number, opts?: TweenOptions): TweenHandle {
    return this.engine().tweens.rotateBy(this.getTarget(), dr, opts);
  }
  /** Animate Pixi's angle (degrees) to an absolute value with explicit duration. */
  angleTo(angle: number, duration: number, opts?: TweenOptions): TweenHandle {
    return this.engine().tweens.angleTo(this.getTarget(), angle, duration, opts);
  }
}

export default NodeTweens;
