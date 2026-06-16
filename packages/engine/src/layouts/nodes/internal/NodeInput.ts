/**
 * Node-scoped input helper that subscribes handlers via InputManager.onNode.
 * Tracks unsubscriptions to allow safe teardown.
 *
 * Provides small convenience methods for common gestures and ensures
 * all subscriptions are disposed when the node is destroyed.
 */
import type { InputEventBase, InputType } from '@engine/input/types';

interface EngineInputFacade {
  on(type: InputType, handler: (e: InputEventBase) => void): () => void;
  onNode(
    nodeId: string,
    type: InputType,
    handler: (e: InputEventBase) => void,
    thisArg?: unknown,
  ): () => void;
  offNode(
    nodeId: string,
    type: InputType,
    handler: (e: InputEventBase) => void,
    thisArg?: unknown,
  ): void;
}

interface EngineLike {
  input: EngineInputFacade;
}

export class NodeInput {
  private readonly getEngine: () => EngineLike | undefined;
  private readonly getNodeId: () => string | undefined;
  private disposers = new Set<() => void>();

  constructor(getEngine: () => EngineLike | undefined, getNodeId: () => string | undefined) {
    this.getEngine = getEngine;
    this.getNodeId = getNodeId;
  }

  /** Subscribe to a specific input type for this node; returns unsubscribe. */
  on(type: InputType, handler: (e: InputEventBase) => void, thisArg?: unknown): () => void {
    const id = this.getNodeId();
    const engine = this.getEngine();
    if (!id || !engine) return () => {};
    const off = engine.input.onNode(id, type, handler, thisArg);
    this.disposers.add(off);
    return () => {
      off();
      this.disposers.delete(off);
    };
  }

  /** Convenience wrapper for tap events. */
  onTap(handler: (e: InputEventBase) => void, thisArg?: unknown): () => void {
    return this.on('tap', handler, thisArg);
  }

  /**
   * Convenience wrapper for one-shot tap actions.
   *
   * Use only for interactions that must be processed strictly once
   * (for example, scene transition or destructive confirm actions).
   * For repeatable interactions, use {@link onTap}.
   */
  onTapOnce(handler: (e: InputEventBase) => void, thisArg?: unknown): () => void {
    let off: (() => void) | undefined;
    const onceHandler = (event: InputEventBase): void => {
      const dispose = off;
      off = undefined;
      dispose?.();
      handler(event);
    };
    off = this.on('tap', onceHandler, thisArg);
    return () => {
      const dispose = off;
      off = undefined;
      dispose?.();
    };
  }

  /** Remove a specific handler for this node and type. */
  off(type: InputType, handler: (e: InputEventBase) => void, thisArg?: unknown): void {
    const id = this.getNodeId();
    const engine = this.getEngine();
    if (!id || !engine) return;
    engine.input.offNode(id, type, handler, thisArg);
  }

  /** Remove a tap handler. */
  offTap(handler: (e: InputEventBase) => void, thisArg?: unknown): void {
    this.off('tap', handler, thisArg);
  }

  /** Unsubscribe all previously registered listeners for this node. */
  destroy(): void {
    for (const off of this.disposers)
      try {
        off();
      } catch {
        void 0;
      }
    this.disposers.clear();
  }
}

export default NodeInput;
