import { ListenerRegistry } from './ListenerRegistry';

import type { EngineInputEventInit, InputEventBase, InputHandler, InputType } from './types';

/**
 * InputRouter manages input listeners and event delivery.
 *
 * It supports two listener scopes:
 * - Global (by event type): listeners receive events regardless of target
 * - Node-scoped (by nodeId + event type): listeners receive events only when the target is that node
 */
export class InputRouter {
  private byType = new Map<string, Set<InputHandler>>();
  private byNode = new Map<string, Map<string, Set<InputHandler>>>();
  private regType = new ListenerRegistry();
  private regNode = new Map<string, Map<string, ListenerRegistry>>();

  /**
   * Subscribes a global listener for a specific event type.
   * @returns unsubscribe function
   */
  on(type: InputType, handler: InputHandler, thisArg?: unknown): () => void {
    let set = this.byType.get(type);
    if (!set) {
      set = new Set();
      this.byType.set(type, set);
    }
    const bound = this.regType.bind(handler, thisArg);
    set.add(bound);
    return () => {
      set!.delete(bound);
      this.regType.unbind(handler, thisArg);
      if (set && set.size === 0) this.byType.delete(type);
    };
  }

  /**
   * Unsubscribes a previously registered global listener.
   */
  off(type: InputType, handler: InputHandler, thisArg?: unknown): void {
    const set = this.byType.get(type);
    const bound = this.regType.peek(handler, thisArg);
    if (set && bound) set.delete(bound);
    this.regType.unbind(handler, thisArg);
    if (set && set.size === 0) this.byType.delete(type);
  }

  /**
   * Subscribes a node-scoped listener for a particular node id and event type.
   * @returns unsubscribe function
   */
  onNode(nodeId: string, type: InputType, handler: InputHandler, thisArg?: unknown): () => void {
    let map = this.byNode.get(nodeId);
    if (!map) {
      map = new Map();
      this.byNode.set(nodeId, map);
    }
    let set = map.get(type);
    if (!set) {
      set = new Set();
      map.set(type, set);
    }
    let regMap = this.regNode.get(nodeId);
    if (!regMap) {
      regMap = new Map();
      this.regNode.set(nodeId, regMap);
    }
    let reg = regMap.get(type);
    if (!reg) {
      reg = new ListenerRegistry();
      regMap.set(type, reg);
    }
    const bound = reg.bind(handler, thisArg);
    set.add(bound);
    return () => {
      set!.delete(bound);
      reg!.unbind(handler, thisArg);
      if (set && set.size === 0) {
        map!.delete(type);
        regMap!.delete(type);
      }
      if (map && map.size === 0) this.byNode.delete(nodeId);
      if (regMap && regMap.size === 0) this.regNode.delete(nodeId);
    };
  }

  /**
   * Unsubscribes a node-scoped listener.
   */
  offNode(nodeId: string, type: InputType, handler: InputHandler, thisArg?: unknown): void {
    const map = this.byNode.get(nodeId);
    if (!map) return;
    const set = map.get(type);
    const regMap = this.regNode.get(nodeId);
    const reg = regMap?.get(type);
    const bound = reg?.peek(handler, thisArg);
    if (set && bound) set.delete(bound);
    reg?.unbind(handler, thisArg);
    if (set && set.size === 0) {
      map.delete(type);
      if (regMap) regMap.delete(type);
    }
    if (map.size === 0) this.byNode.delete(nodeId);
    if (regMap && regMap.size === 0) this.regNode.delete(nodeId);
  }

  /**
   * Emits an event to node-scoped listeners of the target first, then to global listeners.
   * Propagation can be stopped by calling e.stopPropagation().
   */
  emit(e0: EngineInputEventInit): void {
    const stop = { v: false };
    const e = {
      ...e0,
      stopPropagation: () => {
        stop.v = true;
      },
      isPropagationStopped: () => stop.v,
    } as InputEventBase;
    // node listeners first
    const id = e.target?.id;
    if (id) {
      for (const nodeId of this.buildPropagationPath(id)) {
        const map = this.byNode.get(nodeId);
        const set = map?.get(e.type);
        if (set)
          for (const h of [...set]) {
            h(e);
            if (stop.v) return;
          }
      }
    }
    const global = this.byType.get(e.type);
    if (global)
      for (const h of [...global]) {
        h(e);
        if (stop.v) return;
      }
  }

  /** Returns true when there is at least one listener registered for the node (any type). */
  hasAnyNodeListeners(nodeId: string): boolean {
    const map = this.byNode.get(nodeId);
    if (!map) return false;
    for (const set of map.values()) if (set.size > 0) return true;
    return false;
  }

  private buildPropagationPath(nodeId: string): readonly string[] {
    const path: string[] = [];
    let cursor = nodeId;
    while (cursor.length > 0) {
      path.push(cursor);
      const cutIndex = cursor.lastIndexOf('.');
      if (cutIndex <= 0) {
        break;
      }
      cursor = cursor.slice(0, cutIndex);
    }
    return path;
  }
}
