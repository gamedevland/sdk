/**
 * Factory that constructs a BuildContext from engine subsystems and optional registries.
 *
 * This provides a single place to assemble everything needed to build a layout tree:
 * assets, DI container, component/action registries and the screen manager.
 * Registries can be supplied explicitly or discovered via DI tokens.
 */
import { DiTokens } from '@engine/di/tokens';
import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';
import { ActionRegistry } from '@engine/layouts/actions/ActionRegistry';
import { ComponentRegistry } from '@engine/layouts/components/ComponentRegistry';

import type { AssetManager } from '@engine/assets';
import type { DiContainerInterface } from '@engine/di/types';
import type { BaseAction } from '@engine/layouts/actions/BaseAction';
import type { BuildOptions, BuildContext } from '@engine/layouts/build/BuildTypes';
import type { BaseComponent } from '@engine/layouts/components/BaseComponent';

export class BuildContextFactory {
  /**
   * Priority of registry sources:
   * 1) Explicitly passed via options: components/actions maps or registries
   * 2) (Deprecated) LayoutGlobals — removed from production path
   * 3) Empty registries (for components/actions). Element factories come from DI only.
   */
  create(
    assets: AssetManager,
    options?: BuildOptions & { container?: DiContainerInterface },
  ): BuildContext {
    const container = options?.container;
    if (!container) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.LayoutMissingRequired,
        subsystem: EngineSubsystem.Layout,
        message: 'DI container is required to build layout context',
        details: { method: 'BuildContextFactory.create' },
      });
    }
    const compRaw = options?.components;
    const actRaw = options?.actions;

    // Build or resolve component registry
    const components = compRaw
      ? compRaw instanceof ComponentRegistry
        ? compRaw
        : this.fromComponentMap(compRaw)
      : this.componentsFromContainer(container);
    // Build or resolve action registry
    const actions = actRaw
      ? actRaw instanceof ActionRegistry
        ? actRaw
        : this.fromActionMap(actRaw)
      : this.actionsFromContainer(container);

    const screen = options?.screen; // must be provided by caller
    if (!screen) {
      throw EngineErrorFactory.missingRequired({
        code: EngineErrorCode.LayoutMissingRequired,
        subsystem: EngineSubsystem.Layout,
        message: 'ScreenManager is required to build layout context',
        details: { method: 'BuildContextFactory.create' },
      });
    }

    return {
      assets,
      container,
      components,
      actions,
      screen,
    };
  }

  /**
   * Build a ComponentRegistry from a plain map {type: Ctor}.
   * Each factory returns a fresh component instance when requested.
   */
  private fromComponentMap(map: Record<string, new () => BaseComponent>): ComponentRegistry {
    const reg = new ComponentRegistry();
    if (map && typeof map === 'object') {
      for (const [type, Ctor] of Object.entries(map)) reg.register(type, () => new Ctor());
    }
    return reg;
  }

  /**
   * Build an ActionRegistry from a plain map {type: Ctor}.
   * Each factory returns a fresh action instance when requested.
   */
  private fromActionMap(map: Record<string, new () => BaseAction>): ActionRegistry {
    const reg = new ActionRegistry();
    if (map && typeof map === 'object') {
      for (const [type, Ctor] of Object.entries(map)) reg.register(type, () => new Ctor());
    }
    return reg;
  }

  // no more element registry construction: element factories are resolved directly from DI

  /**
   * Create a ComponentRegistry backed by DI tokens `component:<name>`.
   * Component names are discovered via the container's prefix listing API.
   */
  private componentsFromContainer(container?: DiContainerInterface): ComponentRegistry {
    const reg = new ComponentRegistry();
    if (!container) return reg;
    const names = container.listTokensByKind?.('component') ?? [];
    for (const name of names) {
      reg.register(name, () => container.get(DiTokens.component<BaseComponent>(name)));
    }
    return reg;
  }

  /**
   * Create an ActionRegistry backed by DI tokens `action:<name>`.
   * Action names are discovered via the container's prefix listing API.
   */
  private actionsFromContainer(container?: DiContainerInterface): ActionRegistry {
    const reg = new ActionRegistry();
    if (!container) return reg;
    const names = container.listTokensByKind?.('action') ?? [];
    for (const name of names) {
      reg.register(name, () => container.get(DiTokens.action<BaseAction>(name)));
    }
    return reg;
  }
}
