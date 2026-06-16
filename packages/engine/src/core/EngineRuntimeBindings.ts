import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import { RuntimeSlot } from './runtime/RuntimeSlot';

import type { DiContainerInterface } from '@engine/di/types';
import type { SceneFSM } from '@engine/fsm/SceneFSM';
import type { SceneLayout } from '@engine/layouts/scene/SceneLayout';

export class EngineRuntimeBindings {
  private readonly activeLayoutSlot = new RuntimeSlot<SceneLayout>();
  private readonly activeSceneFSMSlot = new RuntimeSlot<SceneFSM>();
  private readonly activeSceneDiSlot = new RuntimeSlot<DiContainerInterface>();

  constructor(private readonly resolveLayoutFromActiveScene: () => SceneLayout | undefined) {}

  setActiveLayout(layout: SceneLayout | undefined): void {
    this.activeLayoutSlot.set(layout);
  }

  clearActiveLayout(layout: SceneLayout | undefined): void {
    this.activeLayoutSlot.clear(layout);
  }

  getActiveLayout(): SceneLayout | undefined {
    return this.activeLayoutSlot.get() ?? this.resolveLayoutFromActiveScene();
  }

  getRequiredActiveLayout(): SceneLayout {
    const layout = this.getActiveLayout();
    if (layout) {
      return layout;
    }
    throw EngineErrorFactory.missingRequired({
      code: EngineErrorCode.CoreMissingRequired,
      subsystem: EngineSubsystem.Core,
      message: 'Active scene layout is not available',
      details: { method: 'EngineRuntimeBindings.getRequiredActiveLayout' },
    });
  }

  setActiveSceneFSM(fsm: SceneFSM | undefined): void {
    this.activeSceneFSMSlot.set(fsm);
  }

  clearActiveSceneFSM(fsm: SceneFSM | undefined): void {
    this.activeSceneFSMSlot.clear(fsm);
  }

  getActiveSceneFSM(): SceneFSM | undefined {
    return this.activeSceneFSMSlot.get();
  }

  setActiveSceneDi(sceneDi: DiContainerInterface | undefined): void {
    this.activeSceneDiSlot.set(sceneDi);
  }

  clearActiveSceneDi(sceneDi: DiContainerInterface | undefined): void {
    this.activeSceneDiSlot.clear(sceneDi);
  }

  getActiveSceneDi(): DiContainerInterface | undefined {
    return this.activeSceneDiSlot.get();
  }

  getRequiredActiveSceneDi(): DiContainerInterface {
    return this.activeSceneDiSlot.getRequired(() =>
      EngineErrorFactory.missingRequired({
        code: EngineErrorCode.CoreMissingRequired,
        subsystem: EngineSubsystem.Core,
        message: 'Active scene DI scope is not available',
        details: { method: 'EngineRuntimeBindings.getRequiredActiveSceneDi' },
      }),
    );
  }
}
