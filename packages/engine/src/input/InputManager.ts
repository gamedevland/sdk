import { defaultInputConfig, type InputConfig } from './config';
import { InputRouter } from './InputRouter';
import type { HitTester } from '../rendering/types';
import { PointerTracker } from './PointerTracker';
import { DragRecognizer } from './recognizers/DragRecognizer';
import { TapRecognizer } from './recognizers/TapRecognizer';

import type { EngineInputEventInit, HitTarget, InputHandler, InputType, PointerType } from './types';
import type { InputRuntime } from '@engine/core';
import type { SceneLayout } from '@engine/layouts';

/**
 * InputManager is the high-level orchestrator for user input.
 *
 * Responsibilities:
 * - Attaches native DOM listeners to the provided canvas
 * - Tracks pointer positions and converts screen coordinates to virtual space
 * - Performs hit-testing against the active scene layout to resolve event targets
 * - Recognizes basic gestures (tap, drag) using recognizers
 * - Routes normalized input events to local listeners and the engine-wide input channel
 */
export class InputManager {
  private cfg: ReturnType<typeof this.buildConfig>;
  private tracker: PointerTracker;
  private taps: TapRecognizer;
  private drags: DragRecognizer;
  private hits: HitTester;
  private router = new InputRouter();
  private readonly observers = new Map<InputType, Set<(event: Readonly<EngineInputEventInit>) => void>>();
  private attached = false;
  private paused = false;
  private handlePointerDown!: (ev: PointerEvent) => void;
  private handlePointerMove!: (ev: PointerEvent) => void;
  private handlePointerUp!: (ev: PointerEvent) => void;
  private handlePointerCancel!: (ev: PointerEvent) => void;
  private handleLostPointerCapture!: (ev: PointerEvent) => void;
  private handleWheel!: (ev: WheelEvent) => void;
  private canvas: HTMLCanvasElement | undefined;
  private lastMoveTime = 0;

  /**
   * Creates a new InputManager instance bound to a specific engine.
   * @param engine Engine instance used for coordinate conversions and input channel publishing
   * @param config Optional overrides for input behavior (thresholds, timings, etc.)
   */
  constructor(
    private readonly engine: InputRuntime,
    config?: InputConfig,
    deps?: { getActiveLayout?: () => SceneLayout | undefined },
  ) {
    this.cfg = this.buildConfig(config);
    this.tracker = new PointerTracker((x, y) => this.engine.screen.toVirtual(x, y));
    this.taps = new TapRecognizer({
      tapMaxDistance: this.cfg.tapMaxDistance,
      tapMaxDuration: this.cfg.tapMaxDuration,
    });
    this.drags = new DragRecognizer({ dragStartDistance: this.cfg.dragStartDistance });
    const getActiveLayout = deps?.getActiveLayout ?? (() => this.engine.getActiveLayout());
    this.hits = this.engine.rendering.createHitTester(getActiveLayout);
    // Bind DOM listeners once to preserve stable references for add/removeEventListener
    this.handlePointerDown = this.onPointerDown.bind(this);
    this.handlePointerMove = this.onPointerMove.bind(this);
    this.handlePointerUp = this.onPointerUp.bind(this);
    this.handlePointerCancel = this.onPointerCancel.bind(this);
    this.handleLostPointerCapture = (event) => {
      if (this.tracker.get(event.pointerId)?.isDown) this.onPointerCancel(event);
    };
    this.handleWheel = this.onWheel.bind(this);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused && this.canvas) {
      const canvas = this.canvas;
      this.detach(canvas);
      this.attach(canvas);
    }
  }

  /**
   * Replaces current configuration with the provided one.
   * Safe to call at runtime; new thresholds will be used for subsequent events.
   */
  setConfig(next: InputConfig): void {
    this.cfg = this.buildConfig(next);
    this.taps.setConfig({
      tapMaxDistance: this.cfg.tapMaxDistance,
      tapMaxDuration: this.cfg.tapMaxDuration,
    });
    this.drags.setConfig({ dragStartDistance: this.cfg.dragStartDistance });
  }

  /**
   * Attaches native pointer and wheel listeners to the given canvas.
   * No-op if already attached.
   */
  attach(canvas: HTMLCanvasElement): void {
    if (this.attached) return;
    this.attached = true;
    this.canvas = canvas;
    canvas.addEventListener('pointerdown', this.handlePointerDown, { passive: true });
    canvas.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    canvas.addEventListener('pointerup', this.handlePointerUp, { passive: true });
    canvas.addEventListener('pointercancel', this.handlePointerCancel, { passive: true });
    canvas.addEventListener('lostpointercapture', this.handleLostPointerCapture, { passive: true });
    canvas.addEventListener('wheel', this.handleWheel, { passive: true });
  }

  /**
   * Detaches previously attached listeners from the canvas.
   * Calling with a different canvas than used in attach is a no-op.
   */
  detach(canvas: HTMLCanvasElement): void {
    const target = this.canvas ?? canvas;
    target.removeEventListener('pointerdown', this.handlePointerDown);
    target.removeEventListener('pointermove', this.handlePointerMove);
    target.removeEventListener('pointerup', this.handlePointerUp);
    target.removeEventListener('pointercancel', this.handlePointerCancel);
    target.removeEventListener('lostpointercapture', this.handleLostPointerCapture);
    target.removeEventListener('wheel', this.handleWheel);
    this.tracker.clearAll();
    this.drags.end();
    this.canvas = undefined;
    this.attached = false;
  }

  /**
   * Releases attached listeners and clears internal runtime state.
   */
  destroy(): void {
    const canvas = this.canvas;
    if (canvas) this.detach(canvas);
    this.hits.clearInteractive();
    this.observers.clear();
  }

  /** Observe normalized input before routing; UI stopPropagation cannot hide pointer lifecycle events. */
  observe(type: InputType, handler: (event: Readonly<EngineInputEventInit>) => void): () => void {
    let handlers = this.observers.get(type);
    if (!handlers) {
      handlers = new Set();
      this.observers.set(type, handlers);
    }
    handlers.add(handler);
    const captured = handlers;
    return () => {
      captured.delete(handler);
      if (captured.size === 0) this.observers.delete(type);
    };
  }

  /**
   * Subscribes a global input handler for a specific input event type (fires for any target).
   * @returns unsubscribe function
   */
  on(type: InputType, handler: InputHandler, thisArg?: unknown): () => void {
    return this.router.on(type, handler, thisArg);
  }
  /**
   * Unsubscribes a global input handler for a specific input event type.
   */
  off(type: InputType, handler: InputHandler, thisArg?: unknown): void {
    return this.router.off(type, handler, thisArg);
  }
  /**
   * Subscribes a node-scoped handler for a specific node id and input event type.
   * Handlers are invoked only when that node (or its children through bubbling) is targeted.
   * @returns unsubscribe function
   */
  onNode(nodeId: string, type: InputType, handler: InputHandler, thisArg?: unknown): () => void {
    const off = this.router.onNode(nodeId, type, handler, thisArg);
    try {
      this.hits.addInteractive(nodeId);
    } catch {
      /* ignore */
    }
    return off;
  }
  /**
   * Unsubscribes a node-scoped handler.
   */
  offNode(nodeId: string, type: InputType, handler: InputHandler, thisArg?: unknown): void {
    this.router.offNode(nodeId, type, handler, thisArg);
    try {
      if (!this.router.hasAnyNodeListeners(nodeId)) this.hits.removeInteractive(nodeId);
    } catch {
      /* ignore */
    }
  }

  /**
   * Native pointerdown handler: captures pointer state, performs hit-test and emits pointerdown.
   */
  private onPointerDown = (ev: PointerEvent): void => {
    if (this.paused) return;
    this.trySetPointerCapture(ev);
    const time = performance.now();
    const st = this.tracker.down(
      ev.pointerId,
      this.toPointerType(ev.pointerType),
      ev.clientX,
      ev.clientY,
      time,
    );
    const hit = this.hits.hitTest({ x: st.virtualX, y: st.virtualY });
    const base = this.buildPointerBase(ev, time, { x: st.virtualX, y: st.virtualY }, hit.target);
    this.emit({ ...base, type: 'pointerdown' });
  };

  /**
   * Native pointermove handler: updates pointer state and emits dragstart/drag/pointermove depending on thresholds.
   * Unpressed mouse movement emits hover pointermove without allocating tracked pointer state.
   * Drag recognition starts when movement exceeds `dragStartDistance`.
   */
  private onPointerMove = (ev: PointerEvent): void => {
    if (this.paused) return;
    const time = performance.now();
    const throttle = this.cfg.throttleMoveMs;
    if (throttle > 0 && time - this.lastMoveTime < throttle) return;
    this.lastMoveTime = time;
    const st = this.tracker.move(ev.pointerId, ev.clientX, ev.clientY, time);
    if (!st) {
      if (ev.pointerType !== 'mouse' || ev.buttons !== 0) return;
      const virtual = this.engine.screen.toVirtual(ev.clientX, ev.clientY);
      const hit = this.hits.hitTest(virtual);
      this.emit({ ...this.buildPointerBase(ev, time, virtual, hit.target), type: 'pointermove' });
      return;
    }
    const hit = this.hits.hitTest({ x: st.virtualX, y: st.virtualY });
    // If not dragging yet but threshold exceeded -> start dragging
    if (!this.drags.isDragging(ev.pointerId) && this.drags.shouldStart(st)) {
      if (this.drags.hasActiveDrag()) {
        const base = this.buildPointerBase(ev, time, { x: st.virtualX, y: st.virtualY }, hit.target);
        this.emit({ ...base, type: 'pointermove' });
        return;
      }
      this.drags.start(ev.pointerId);
      const base = this.buildPointerBase(ev, time, { x: st.virtualX, y: st.virtualY }, hit.target);
      this.emit({ ...base, type: 'dragstart' });
      // If currently dragging -> emit continuous drag events
    } else if (this.drags.isDragging(ev.pointerId)) {
      const base = this.buildPointerBase(ev, time, { x: st.virtualX, y: st.virtualY }, hit.target);
      this.emit({ ...base, type: 'drag' });
      // Otherwise it's a regular move without dragging
    } else {
      const base = this.buildPointerBase(ev, time, { x: st.virtualX, y: st.virtualY }, hit.target);
      this.emit({ ...base, type: 'pointermove' });
    }
  };

  /**
   * Native pointerup handler: finalizes drag if needed and emits tap if movement and duration were small.
   * Always emits a trailing pointerup event.
   */
  private onPointerUp = (ev: PointerEvent): void => {
    if (this.paused) return;
    const time = performance.now();
    const st = this.tracker.up(ev.pointerId, time);
    if (!st) {
      this.tryReleasePointerCapture(ev.pointerId);
      this.reportUnexpectedTerminalPointerEvent('pointerup', ev.pointerId);
      return;
    }
    const hit = this.hits.hitTest({ x: st.virtualX, y: st.virtualY });
    const base = this.buildPointerBase(ev, time, { x: st.virtualX, y: st.virtualY }, hit.target);
    if (this.drags.isDragging(ev.pointerId)) {
      // Once drag starts, terminal event must always remain dragend.
      this.emit({ ...base, type: 'dragend', dragEndReason: 'pointerup' });
      this.drags.end();
    } else if (this.taps.tryTap(st, st)) {
      // No active drag: evaluate tap purely by durations/distances
      this.emit({ ...base, type: 'tap' });
    }
    this.emit({ ...base, type: 'pointerup' });
    this.finalizePointer(ev.pointerId);
  };

  /**
   * Native pointercancel handler: finalizes active pointer state deterministically.
   */
  private onPointerCancel = (ev: PointerEvent): void => {
    const time = performance.now();
    const st = this.tracker.up(ev.pointerId, time);
    if (!st) {
      this.tryReleasePointerCapture(ev.pointerId);
      this.reportUnexpectedTerminalPointerEvent('pointercancel', ev.pointerId);
      return;
    }
    const hit = this.hits.hitTest({ x: st.virtualX, y: st.virtualY });
    const base = this.buildPointerBase(ev, time, { x: st.virtualX, y: st.virtualY }, hit.target);
    if (this.drags.isDragging(ev.pointerId)) {
      this.emit({ ...base, type: 'dragend', dragEndReason: 'pointercancel' });
      this.drags.end();
    }
    this.emit({ ...base, type: 'pointercancel' });
    this.finalizePointer(ev.pointerId);
  };

  /**
   * Native wheel handler: normalizes delta using configured scale and routes a wheel event.
   */
  private onWheel = (ev: WheelEvent): void => {
    if (this.paused) return;
    const time = performance.now();
    const scale = this.cfg.wheelScale;
    const v = this.engine.screen.toVirtual(ev.clientX, ev.clientY);
    const hit = this.hits.hitTest({ x: v.x, y: v.y });
    const base = this.buildWheelBase(ev, time, v, hit.target, scale);
    this.emit({ ...base, type: 'wheel' });
  };

  /**
   * Emits the event to local router and the engine-wide input channel.
   */
  private emit(e: EngineInputEventInit): void {
    for (const handler of [...(this.observers.get(e.type) ?? [])]) handler(e);
    this.router.emit(e);
    this.engine.inputChannel.publish(e);
  }

  private buildPointerBase(
    ev: PointerEvent,
    time: number,
    virtual: { x: number; y: number },
    target: HitTarget | undefined,
  ): Omit<EngineInputEventInit, 'type'> {
    const base = {
      time,
      pointerId: ev.pointerId,
      button: ev.button,
      buttons: ev.buttons,
      isPrimary: ev.isPrimary,
      pointerType: this.toPointerType(ev.pointerType),
      screen: { x: ev.clientX, y: ev.clientY },
      virtual,
    };
    return target ? { ...base, target } : base;
  }

  private buildWheelBase(
    ev: WheelEvent,
    time: number,
    virtual: { x: number; y: number },
    target: HitTarget | undefined,
    scale: number,
  ): Omit<EngineInputEventInit, 'type'> & {
    delta: { x?: number; y?: number; z?: number };
  } {
    const base = {
      time,
      pointerId: -1,
      pointerType: 'mouse' as const,
      screen: { x: ev.clientX, y: ev.clientY },
      virtual,
      delta: { x: ev.deltaX * scale, y: ev.deltaY * scale, z: ev.deltaZ * scale },
    };
    return target ? { ...base, target } : base;
  }

  /**
   * Builds a normalized configuration by applying defaults and user overrides.
   */
  private buildConfig(cfg?: InputConfig) {
    return { ...defaultInputConfig, ...(cfg ?? {}) };
  }

  private finalizePointer(pointerId: number): void {
    this.tracker.clear(pointerId);
    this.tryReleasePointerCapture(pointerId);
  }

  private trySetPointerCapture(ev: PointerEvent): void {
    const canvas = this.canvas;
    if (!canvas) return;
    if (!canvas.setPointerCapture) return;
    try {
      canvas.setPointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
  }

  private tryReleasePointerCapture(pointerId: number): void {
    const canvas = this.canvas;
    if (!canvas) return;
    if (!canvas.releasePointerCapture) return;
    try {
      if (canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId);
      }
    } catch {
      /* ignore */
    }
  }

  private toPointerType(value: string): PointerType {
    if (value === 'mouse' || value === 'touch' || value === 'pen') {
      return value;
    }
    return 'mouse';
  }

  private reportUnexpectedTerminalPointerEvent(
    type: 'pointerup' | 'pointercancel',
    id: number,
  ): void {
    console.warn(`[InputManager] Ignored ${type} for unknown pointerId=${String(id)}`);
  }
}
