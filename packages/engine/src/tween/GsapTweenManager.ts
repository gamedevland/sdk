import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import GsapTimelineBuilder from './GsapTimelineBuilder';
import GsapTweenHandle from './GsapTweenHandle';

import type {
  TimelineBuilder,
  TweenManager,
  TweenOptions,
  TweenPathOptions,
  TweenPoint,
  TweenTarget,
} from './types';
import type * as PIXI from 'pixi.js';

interface DestroyableTweenTarget {
  readonly destroyed: boolean;
}

interface TweenDiagnostics {
  readonly groupId?: string;
  readonly operation: string;
  readonly props?: string;
  readonly targetDestroyed?: boolean;
  readonly targetSummary?: string;
}

export class GsapTweenManager implements TweenManager {
  private static readonly GsapRootUpdater = gsap.updateRoot;
  private static manualClockOwners = 0;
  private static motionPathPluginRegistered = false;
  private readonly handlesByAnimation = new WeakMap<gsap.core.Animation, GsapTweenHandle>();
  private readonly diagnosticsByAnimation = new WeakMap<gsap.core.Animation, TweenDiagnostics>();

  /**
   * Tracks active tweens by their target object for selective cancellation.
   */
  private targetToTweens = new Map<object, Set<gsap.core.Animation>>();
  /**
   * Tracks active tweens by an optional logical group identifier.
   */
  private groupToTweens = new Map<string, Set<gsap.core.Animation>>();
  /**
   * Tracks tweens that have no explicit target/group mapping (for example delay tweens).
   */
  private unscopedTweens = new Set<gsap.core.Animation>();
  /**
   * Defaults applied to every tween when options omit them.
   */
  private defaults: { duration: number; ease: string } = { duration: 0.4, ease: 'none' };
  private runtimePaused = false;
  private timelineTimeSeconds = 0;

  constructor() {
    this.ensureMotionPathPluginRegistered();
    this.attachManualClockControl();
    this.timelineTimeSeconds = gsap.globalTimeline.time();
  }

  /**
   * Register a tween in tracking maps for later bulk management.
   * If a target is provided, we associate the tween with it.
   * If a groupId is provided, we also index the tween under that group.
   */
  private track(tw: gsap.core.Animation, target?: object, groupId?: string): void {
    let targetSet: Set<gsap.core.Animation> | undefined;
    if (target && typeof target === 'object') {
      targetSet = this.targetToTweens.get(target);
      if (!targetSet) {
        targetSet = new Set();
        this.targetToTweens.set(target, targetSet);
      }
      targetSet.add(tw);
    }
    let groupSet: Set<gsap.core.Animation> | undefined;
    if (groupId) {
      groupSet = this.groupToTweens.get(groupId);
      if (!groupSet) {
        groupSet = new Set();
        this.groupToTweens.set(groupId, groupSet);
      }
      groupSet.add(tw);
    }
    if (!targetSet && !groupSet) {
      this.unscopedTweens.add(tw);
    }
    this.attachAutoUntrack(tw, {
      target,
      targetSet,
      groupId,
      groupSet,
      unscoped: !targetSet && !groupSet,
    });
    if (this.runtimePaused) {
      tw.pause();
    }
  }

  private attachAutoUntrack(
    tw: gsap.core.Animation,
    scoped: {
      target: object | undefined;
      targetSet: Set<gsap.core.Animation> | undefined;
      groupId: string | undefined;
      groupSet: Set<gsap.core.Animation> | undefined;
      unscoped: boolean;
    },
  ): void {
    const detach = (): void => {
      if (scoped.unscoped) {
        this.unscopedTweens.delete(tw);
      }
      if (scoped.targetSet) {
        scoped.targetSet.delete(tw);
        if (scoped.targetSet.size === 0 && scoped.target) {
          this.targetToTweens.delete(scoped.target);
        }
      }
      if (scoped.groupSet) {
        scoped.groupSet.delete(tw);
        if (scoped.groupSet.size === 0 && scoped.groupId) {
          this.groupToTweens.delete(scoped.groupId);
        }
      }
    };

    const prevComplete = tw.eventCallback('onComplete');
    tw.eventCallback('onComplete', () => {
      try {
        if (prevComplete) prevComplete();
      } finally {
        detach();
      }
    });

    const prevInterrupt = tw.eventCallback('onInterrupt');
    tw.eventCallback('onInterrupt', () => {
      try {
        if (prevInterrupt) prevInterrupt();
      } finally {
        detach();
      }
    });

  }

  private clearUnscopedTweens(): void {
    this.unscopedTweens.forEach((tw) => this.killTrackedAnimation(tw));
    this.unscopedTweens.clear();
  }

  private rememberDiagnostics(animation: gsap.core.Animation, diagnostics: TweenDiagnostics): void {
    this.diagnosticsByAnimation.set(animation, diagnostics);
  }

  private killInvalidAnimations(): void {
    const animations = this.collectTrackedAnimations();
    for (const animation of animations) {
      if (this.hasDestroyedTargets(animation)) {
        this.killTrackedAnimation(animation);
      }
    }
  }

  private hasDestroyedTargets(animation: gsap.core.Animation): boolean {
    if (animation instanceof gsap.core.Tween) {
      return this.hasDestroyedTweenTargets(animation);
    }
    if (animation instanceof gsap.core.Timeline) {
      return animation
        .getChildren(true, true, false)
        .some((child) => child instanceof gsap.core.Tween && this.hasDestroyedTweenTargets(child));
    }
    return false;
  }

  private hasDestroyedTweenTargets(tween: gsap.core.Tween): boolean {
    return tween.targets<object>().some((target) => this.isDestroyedPixiTarget(target));
  }

  private isDestroyedPixiTarget(target: object): boolean {
    return this.isDestroyableTweenTarget(target) && target.destroyed;
  }

  private isDestroyableTweenTarget(target: object): target is DestroyableTweenTarget {
    if (!('destroyed' in target)) {
      return false;
    }
    return typeof (target as DestroyableTweenTarget).destroyed === 'boolean';
  }

  private collectTrackedAnimations(): Set<gsap.core.Animation> {
    const animations = new Set<gsap.core.Animation>();
    this.targetToTweens.forEach((set) => {
      set.forEach((animation) => {
        animations.add(animation);
      });
    });
    this.groupToTweens.forEach((set) => {
      set.forEach((animation) => {
        animations.add(animation);
      });
    });
    this.unscopedTweens.forEach((animation) => {
      animations.add(animation);
    });
    return animations;
  }

  /** Kill every tween and clear all tracking maps. */
  killAll(): void {
    this.targetToTweens.forEach((set: Set<gsap.core.Animation>) => {
      set.forEach((tw: gsap.core.Animation) => this.killTrackedAnimation(tw));
      set.clear();
    });
    this.groupToTweens.forEach((set: Set<gsap.core.Animation>) => {
      set.forEach((tw: gsap.core.Animation) => this.killTrackedAnimation(tw));
      set.clear();
    });
    this.clearUnscopedTweens();
  }

  /**
   * Kill tweens by a specific target or by a group identifier.
   * This method handles both shapes transparently by checking
   * for a `groupId` field on the argument.
   */
  kill(targetOrGroup?: TweenTarget | { groupId?: string }): void {
    if (!targetOrGroup) return;
    const groupId = this.tryGetGroupId(targetOrGroup);
    if (groupId) {
      const set = this.groupToTweens.get(groupId);
      if (!set) return;
      set.forEach((tw) => this.killTrackedAnimation(tw));
      set.clear();
      this.groupToTweens.delete(groupId);
      return;
    }
    const t = this.unwrap(targetOrGroup as TweenTarget);
    const set = this.targetToTweens.get(t);
    if (!set) return;
    set.forEach((tw) => this.killTrackedAnimation(tw));
    set.clear();
    this.targetToTweens.delete(t);
  }

  /**
   * Override default duration/ease that are applied implicitly.
   */
  setDefaults(defaults: { duration: number; ease: string }): void {
    this.defaults = { ...this.defaults, ...defaults };
  }

  setRuntimePaused(paused: boolean): void {
    if (this.runtimePaused === paused) {
      return;
    }
    this.runtimePaused = paused;
    const animations = this.collectTrackedAnimations();
    for (const animation of animations) {
      if (paused) {
        animation.pause();
      } else {
        animation.resume();
      }
    }
  }

  tick(dt: number): void {
    if (this.runtimePaused || dt <= 0) {
      return;
    }
    try {
      this.killInvalidAnimations();
      this.timelineTimeSeconds += dt;
      gsap.updateRoot(this.timelineTimeSeconds);
    } catch (cause) {
      throw this.createTickFailureError(dt, cause);
    }
  }

  /** Create a `to` tween for the given target and properties. */
  to(target: TweenTarget, props: Record<string, number>, opts?: TweenOptions) {
    const unwrappedTarget = this.unwrap(target);
    const tw = gsap.to(unwrappedTarget, { ...props, ...this.mapOpts(opts) });
    const handle = new GsapTweenHandle(tw);
    this.track(tw, unwrappedTarget, opts?.groupId);
    this.handlesByAnimation.set(tw, handle);
    this.rememberDiagnostics(tw, this.createTweenDiagnostics('to', target, unwrappedTarget, props, opts?.groupId));
    return handle;
  }
  /** Create a `from` tween that animates from provided values to current. */
  from(target: TweenTarget, props: Record<string, number>, opts?: TweenOptions) {
    const unwrappedTarget = this.unwrap(target);
    const tw = gsap.from(unwrappedTarget, { ...props, ...this.mapOpts(opts) });
    const handle = new GsapTweenHandle(tw);
    this.track(tw, unwrappedTarget, opts?.groupId);
    this.handlesByAnimation.set(tw, handle);
    this.rememberDiagnostics(tw, this.createTweenDiagnostics('from', target, unwrappedTarget, props, opts?.groupId));
    return handle;
  }
  /** Create a `fromTo` tween with explicit start and end values. */
  fromTo(
    target: TweenTarget,
    f: Record<string, number>,
    t: Record<string, number>,
    opts?: TweenOptions,
  ) {
    const unwrappedTarget = this.unwrap(target);
    const tw = gsap.fromTo(unwrappedTarget, f, { ...t, ...this.mapOpts(opts) });
    const handle = new GsapTweenHandle(tw);
    this.track(tw, unwrappedTarget, opts?.groupId);
    this.handlesByAnimation.set(tw, handle);
    this.rememberDiagnostics(
      tw,
      this.createTweenDiagnostics(
        'fromTo',
        target,
        unwrappedTarget,
        { ...f, ...t },
        opts?.groupId,
      ),
    );
    return handle;
  }

  /** Create a timeline via a callback builder and optionally assign a group. */
  timeline(setup: (tl: TimelineBuilder) => void, opts?: { groupId?: string }) {
    const tl = gsap.timeline();
    setup(new GsapTimelineBuilder(tl));
    if (opts?.groupId) this.track(tl, undefined, opts.groupId);
    const handle = new GsapTweenHandle(tl);
    this.handlesByAnimation.set(tl, handle);
    this.rememberDiagnostics(tl, {
      operation: 'timeline',
      ...(opts?.groupId === undefined ? {} : { groupId: opts.groupId }),
    });
    return handle;
  }

  /** Convenience: tween absolute position to a point (pixels). */
  moveTo(
    target: TweenTarget,
    position: { x: number; y: number },
    duration: number,
    opts?: TweenOptions,
  ) {
    const t = this.unwrap(target);
    const tw = gsap.to(t, {
      x: position.x,
      y: position.y,
      ...this.mapOpts({ duration, ...(opts ?? {}) }),
    });
    const handle = new GsapTweenHandle(tw);
    this.track(tw, t, opts?.groupId);
    this.handlesByAnimation.set(tw, handle);
    this.rememberDiagnostics(tw, this.createTweenDiagnostics('moveTo', target, t, position, opts?.groupId));
    return handle;
  }

  /** Convenience: tween absolute position along a curved path. */
  moveAlongPath(
    target: TweenTarget,
    points: readonly TweenPoint[],
    duration: number,
    opts?: TweenPathOptions,
  ) {
    this.assertPathPoints(points);
    const t = this.unwrap(target);
    const {
      autoRotate,
      curviness,
      resolution,
      ...tweenOptions
    } = opts ?? {};
    const tw = gsap.to(t, {
      motionPath: {
        path: points.map((point) => ({ x: point.x, y: point.y })),
        ...(autoRotate === undefined ? {} : { autoRotate }),
        ...(curviness === undefined ? {} : { curviness }),
        ...(resolution === undefined ? {} : { resolution }),
        type: 'thru',
      },
      ...this.mapOpts({ duration, ...tweenOptions }),
    });
    const handle = new GsapTweenHandle(tw);
    this.track(tw, t, opts?.groupId);
    this.handlesByAnimation.set(tw, handle);
    this.rememberDiagnostics(tw, {
      operation: 'moveAlongPath',
      props: `points:${points.length}`,
      targetDestroyed: this.isDestroyedPixiTarget(t),
      targetSummary: this.describeTweenTarget(target, t),
      ...(opts?.groupId === undefined ? {} : { groupId: opts.groupId }),
    });
    return handle;
  }

  /** Convenience: tween by delta (dx, dy) relative to current position. */
  moveBy(target: TweenTarget, dx: number, dy: number, opts?: TweenOptions) {
    const t = this.unwrap(target);
    return this.to(t, { x: (t.x ?? 0) + dx, y: (t.y ?? 0) + dy }, opts);
  }
  /** Convenience: uniform or non-uniform scale. Number applies to both axes. */
  scaleTo(
    target: TweenTarget,
    s: number | { x: number; y: number },
    duration: number,
    opts?: TweenOptions,
  ) {
    const t = this.unwrap(target);
    const sx = typeof s === 'number' ? s : s.x;
    const sy = typeof s === 'number' ? s : s.y;
    const tw = gsap.to(t.scale, { x: sx, y: sy, ...this.mapOpts({ duration, ...(opts ?? {}) }) });
    const handle = new GsapTweenHandle(tw);
    this.track(tw, t, opts?.groupId);
    this.handlesByAnimation.set(tw, handle);
    this.rememberDiagnostics(
      tw,
      this.createTweenDiagnostics('scaleTo', target, t.scale, { x: sx, y: sy }, opts?.groupId),
    );
    return handle;
  }
  /** Convenience: non-uniform scale with separate X and Y. */
  scaleXY(target: TweenTarget, sx: number, sy: number, opts?: TweenOptions) {
    const t = this.unwrap(target);
    const tw = gsap.to(t.scale, { x: sx, y: sy, ...this.mapOpts(opts) });
    const handle = new GsapTweenHandle(tw);
    this.track(tw, t, opts?.groupId);
    this.handlesByAnimation.set(tw, handle);
    this.rememberDiagnostics(
      tw,
      this.createTweenDiagnostics('scaleXY', target, t.scale, { x: sx, y: sy }, opts?.groupId),
    );
    return handle;
  }
  /** Set alpha to a specific value. */
  alphaTo(target: TweenTarget, alpha: number, duration: number, opts?: TweenOptions) {
    return this.to(this.unwrap(target), { alpha }, { duration, ...(opts ?? {}) });
  }
  /** Quick fade-in helper (alpha -> 1). */
  fadeIn(target: TweenTarget, duration: number, opts?: TweenOptions) {
    return this.alphaTo(target, 1, duration, opts);
  }
  /** Quick fade-out helper (alpha -> 0). */
  fadeOut(target: TweenTarget, duration: number, opts?: TweenOptions) {
    return this.alphaTo(target, 0, duration, opts);
  }
  /** Rotate to an absolute angle (degrees) with explicit duration. */
  rotateTo(target: TweenTarget, angle: number, duration: number, opts?: TweenOptions) {
    const t = this.unwrap(target);
    const tw = gsap.to(t, { angle, ...this.mapOpts({ duration, ...(opts ?? {}) }) });
    const handle = new GsapTweenHandle(tw);
    this.track(tw, t, opts?.groupId);
    this.handlesByAnimation.set(tw, handle);
    this.rememberDiagnostics(
      tw,
      this.createTweenDiagnostics('rotateTo', target, t, { angle }, opts?.groupId),
    );
    return handle;
  }
  /** Rotate by a delta angle (radians). */
  rotateBy(target: TweenTarget, dr: number, opts?: TweenOptions) {
    const t = this.unwrap(target);
    return this.to(t, { rotation: (t.rotation ?? 0) + dr }, opts);
  }

  /** Animate Pixi's angle (degrees) to an absolute value with explicit duration. */
  angleTo(target: TweenTarget, angle: number, duration: number, opts?: TweenOptions) {
    const t = this.unwrap(target);
    const tw = gsap.to(t, { angle, ...this.mapOpts({ duration, ...(opts ?? {}) }) });
    const handle = new GsapTweenHandle(tw);
    this.track(tw, t, opts?.groupId);
    this.handlesByAnimation.set(tw, handle);
    this.rememberDiagnostics(
      tw,
      this.createTweenDiagnostics('angleTo', target, t, { angle }, opts?.groupId),
    );
    return handle;
  }

  /**
   * Returns a handle that resolves after `ms` milliseconds of game time.
   * Implemented as a zero-property GSAP tween so it participates in the
   * managed timeline: pauses with the runtime and resumes with it.
   */
  delayMs(ms: number, opts?: { groupId?: string }): GsapTweenHandle {
    const tw = gsap.to({}, { duration: ms / 1000, ease: 'none' });
    const handle = new GsapTweenHandle(tw);
    this.track(tw, undefined, opts?.groupId);
    this.handlesByAnimation.set(tw, handle);
    this.rememberDiagnostics(tw, {
      operation: 'delayMs',
      props: `durationMs:${ms}`,
      ...(opts?.groupId === undefined ? {} : { groupId: opts?.groupId }),
    });
    return handle;
  }

  private createTickFailureError(dt: number, cause: unknown) {
    const diagnostics = this.findMostRelevantDiagnostics();
    return EngineErrorFactory.create({
      code: EngineErrorCode.CoreInvariantViolation,
      subsystem: EngineSubsystem.Core,
      message: 'Tween runtime update failed',
      details: {
        method: 'GsapTweenManager.tick',
        dt,
        timelineTimeSeconds: this.timelineTimeSeconds,
        activeTweens: this.collectTrackedAnimations().size,
        activeGroups: this.describeActiveGroups(),
        operation: diagnostics?.operation,
        groupId: diagnostics?.groupId,
        props: diagnostics?.props,
        target: diagnostics?.targetSummary,
        targetDestroyed: diagnostics?.targetDestroyed,
      },
      cause,
    });
  }

  private findMostRelevantDiagnostics(): TweenDiagnostics | undefined {
    const animations = this.collectTrackedAnimations();
    for (const animation of animations) {
      const diagnostics = this.findDestroyedAnimationDiagnostics(animation);
      if (diagnostics) {
        return diagnostics;
      }
    }
    for (const animation of animations) {
      const diagnostics = this.diagnosticsByAnimation.get(animation);
      if (diagnostics) {
        return diagnostics;
      }
    }
    return undefined;
  }

  private findDestroyedAnimationDiagnostics(animation: gsap.core.Animation): TweenDiagnostics | undefined {
    if (animation instanceof gsap.core.Tween) {
      if (!this.hasDestroyedTweenTargets(animation)) {
        return undefined;
      }
      return this.diagnosticsByAnimation.get(animation);
    }
    if (animation instanceof gsap.core.Timeline) {
      for (const child of animation.getChildren(true, true, false)) {
        if (!(child instanceof gsap.core.Tween)) {
          continue;
        }
        if (!this.hasDestroyedTweenTargets(child)) {
          continue;
        }
        return this.diagnosticsByAnimation.get(child) ?? this.diagnosticsByAnimation.get(animation);
      }
      return undefined;
    }
    return undefined;
  }

  private describeActiveGroups(): string | undefined {
    const groups = Array.from(this.groupToTweens.keys()).slice(0, 5);
    if (groups.length === 0) {
      return undefined;
    }
    return groups.join('|');
  }

  private createTweenDiagnostics(
    operation: string,
    originalTarget: TweenTarget,
    rawTarget: object,
    props: Record<string, number>,
    groupId?: string,
  ): TweenDiagnostics {
    return {
      operation,
      props: Object.keys(props).sort().join('|'),
      targetDestroyed: this.isDestroyedPixiTarget(rawTarget),
      targetSummary: this.describeTweenTarget(originalTarget, rawTarget),
      ...(groupId === undefined ? {} : { groupId }),
    };
  }

  private describeTweenTarget(originalTarget: TweenTarget, rawTarget: object): string {
    const rawTargetName = this.describeTargetConstructor(rawTarget);
    const nodeId = this.tryGetNodeId(originalTarget);
    if (nodeId) {
      return `${nodeId}:${rawTargetName}`;
    }
    return rawTargetName;
  }

  private describeTargetConstructor(target: object): string {
    const ctor = target.constructor;
    if (!ctor || typeof ctor.name !== 'string' || ctor.name.length === 0) {
      return 'Object';
    }
    return ctor.name;
  }

  private tryGetNodeId(target: TweenTarget): string | undefined {
    if (!this.isViewWrapper(target)) {
      return undefined;
    }
    if (!('id' in target)) {
      return undefined;
    }
    const id = (target as { id?: unknown }).id;
    return typeof id === 'string' && id.length > 0 ? id : undefined;
  }

  private killTrackedAnimation(animation: gsap.core.Animation): void {
    const handle = this.handlesByAnimation.get(animation);
    if (handle) {
      handle.kill();
      return;
    }
    animation.kill();
  }

  /**
   * If a higher-level Node wrapper is passed in (with `view` field),
   * return its underlying render object; otherwise return as-is.
   */
  private unwrap(target: TweenTarget): PIXI.ContainerChild {
    if (this.isViewWrapper(target)) return target.view;
    return target;
  }

  private isViewWrapper(target: TweenTarget): target is { view: PIXI.ContainerChild } {
    return typeof target === 'object' && target !== null && 'view' in target;
  }

  private tryGetGroupId(targetOrGroup: TweenTarget | { groupId?: string }): string | undefined {
    if (typeof targetOrGroup !== 'object' || targetOrGroup === null) return undefined;
    if (!('groupId' in targetOrGroup)) return undefined;
    const v = (targetOrGroup as { groupId?: unknown }).groupId;
    return typeof v === 'string' && v.length > 0 ? v : undefined;
  }

  private ensureMotionPathPluginRegistered(): void {
    if (GsapTweenManager.motionPathPluginRegistered) {
      return;
    }
    gsap.registerPlugin(MotionPathPlugin);
    GsapTweenManager.motionPathPluginRegistered = true;
  }

  private assertPathPoints(points: readonly TweenPoint[]): void {
    if (points.length < 2) {
      throw EngineErrorFactory.create({
        code: EngineErrorCode.CoreInvariantViolation,
        subsystem: EngineSubsystem.Core,
        message: 'Path tween requires at least two points',
        details: {
          method: 'GsapTweenManager.moveAlongPath',
          pointCount: points.length,
        },
      });
    }
  }

  /** Merge provided options with global defaults. */
  private mapOpts(opts?: TweenOptions): gsap.TweenVars {
    // Exclude engine-only options (e.g., groupId) from GSAP to avoid "Invalid property" warnings
    const { groupId: _groupId, ...rest } = opts ?? {};
    return { duration: this.defaults.duration, ease: this.defaults.ease, ...rest };
  }

  private attachManualClockControl(): void {
    if (GsapTweenManager.manualClockOwners === 0) {
      gsap.ticker.remove(GsapTweenManager.GsapRootUpdater);
    }
    GsapTweenManager.manualClockOwners += 1;
  }
}

export default GsapTweenManager;
