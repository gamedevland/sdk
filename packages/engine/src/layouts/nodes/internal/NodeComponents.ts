/**
 * Manages node components and their enabled state; drives lifecycle calls.
 *
 * This collection is responsible for enabling/disabling components and invoking
 * their update loop. It also ensures proper teardown in destroy().
 */
import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { BaseComponent } from '../../components/BaseComponent';

type RuntimeClass<T> = abstract new (...args: never[]) => T;

export class NodeComponents {
  private readonly components = new Map<string, BaseComponent>();
  private readonly enabled = new Set<string>();
  private readonly initialEnabled = new Set<string>();

  /** Add a component and mark desired initial enabled state (default true). */
  addComponent(id: string, comp: BaseComponent, autoEnable = true): void {
    this.components.set(id, comp);
    if (autoEnable) {
      this.initialEnabled.add(id);
    } else {
      this.initialEnabled.delete(id);
    }
  }

  /** Get a component by id or throw if missing. */
  getComponentById(id: string): BaseComponent {
    const component = this.components.get(id);
    if (!component) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.LayoutMissingRequired,
        subsystem: EngineSubsystem.Layout,
        message: 'Component is not attached',
        details: { id, method: 'NodeComponents.getComponentById' },
      });
    }
    return component;
  }

  /** Get the first component by class or throw if missing. */
  getFirstComponentByType<TComponent extends BaseComponent>(
    expectedType: RuntimeClass<TComponent>,
  ): TComponent {
    for (const component of this.components.values()) {
      if (component instanceof expectedType) {
        return component;
      }
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.LayoutMissingRequired,
      subsystem: EngineSubsystem.Layout,
      message: 'Component type is not attached',
      details: { type: expectedType.name, method: 'NodeComponents.getFirstComponentByType' },
    });
  }

  /** Get all components by class in deterministic attachment order. */
  getComponentsByType<TComponent extends BaseComponent>(
    expectedType: RuntimeClass<TComponent>,
  ): readonly TComponent[] {
    const matches: TComponent[] = [];
    for (const component of this.components.values()) {
      if (component instanceof expectedType) {
        matches.push(component);
      }
    }
    return matches;
  }

  /** Enable component by id (idempotent). */
  enableComponent(id: string): void {
    const c = this.getComponentById(id);
    if (!this.enabled.has(id)) {
      this.enabled.add(id);
      c.enable();
    }
  }

  /** Disable component by id (idempotent). */
  disableComponent(id: string): void {
    const c = this.getComponentById(id);
    if (this.enabled.has(id)) {
      this.enabled.delete(id);
      c.disable();
    }
  }

  /** Update all enabled components. */
  update(dt: number): void {
    for (const id of this.enabled) {
      const c = this.components.get(id);
      if (c) c.update(dt);
    }
  }

  /** Notify all components that the node is fully assembled and children are available. */
  runReadyHooks(): void {
    for (const c of this.components.values()) {
      c.ready();
    }
    for (const id of this.initialEnabled) {
      this.enableComponent(id);
    }
    this.initialEnabled.clear();
  }

  /** Disable all enabled components and detach all. */
  async destroy(): Promise<void> {
    const errors: unknown[] = [];
    for (const id of this.enabled) {
      try { this.components.get(id)?.disable(); } catch (error) { errors.push(error); }
    }
    this.enabled.clear();
    this.initialEnabled.clear();
    for (const component of this.components.values()) {
      try { await component.onDetach(); } catch (error) { errors.push(error); }
      try { await component.completeDetach(); } catch (error) { errors.push(error); }
    }
    this.components.clear();
    if (errors.length) throw new AggregateError(errors, 'Component cleanup failed');
  }
}
