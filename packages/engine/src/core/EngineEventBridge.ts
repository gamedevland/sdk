import { EngineErrorCode, EngineErrorFactory, EngineSubsystem } from '@engine/errors';

import type { EventBus } from '@engine/events/EventBus';
import type { AppEvent } from '@engine/events/types';
import type { SceneFSM } from '@engine/fsm/SceneFSM';
import type { ScreenManager } from '@engine/screen/ScreenManager';
import type { ScreenStateSnapshot } from '@engine/screen/types';

interface EngineEventBridgeOptions {
  events: EventBus;
  screen: ScreenManager;
  resolveActiveSceneFSM: () => SceneFSM | undefined;
}

export class EngineEventBridge {
  private attached = false;
  private disposeAnyEventSubscription: (() => void) | undefined;
  private disposeScreenChangeSubscription: (() => void) | undefined;

  constructor(private readonly options: EngineEventBridgeOptions) {}

  attach(): void {
    if (this.attached) {
      return;
    }
    this.attached = true;
    this.disposeAnyEventSubscription = this.options.events.onAny((event) =>
      this.forwardEventToActiveSceneFSM(event),
    );
    this.emitScreenChanged(this.readInitialScreenSnapshot());
    this.disposeScreenChangeSubscription = this.options.screen.onChange((snapshot) =>
      this.emitScreenChanged(snapshot),
    );
  }

  dispose(): void {
    if (!this.attached) {
      return;
    }
    this.attached = false;
    this.disposeAnyEventSubscription?.();
    this.disposeAnyEventSubscription = undefined;
    this.disposeScreenChangeSubscription?.();
    this.disposeScreenChangeSubscription = undefined;
  }

  private async forwardEventToActiveSceneFSM(event: AppEvent): Promise<void> {
    const fsm = this.options.resolveActiveSceneFSM();
    if (!fsm) {
      return;
    }
    try {
      await fsm.dispatch(event);
    } catch (error) {
      throw EngineErrorFactory.invariant({
        code: EngineErrorCode.CoreInvariantViolation,
        subsystem: EngineSubsystem.Core,
        message: 'Failed to dispatch event to active scene FSM',
        details: {
          method: 'EngineEventBridge.forwardEventToActiveSceneFSM',
          eventType: event.type,
        },
        cause: error,
      });
    }
  }

  private readInitialScreenSnapshot(): ScreenStateSnapshot {
    return {
      orientation: this.options.screen.getOrientation(),
      viewport: this.options.screen.getViewportSize(),
      canvas: this.options.screen.getVirtualSize(),
      scale: this.options.screen.getScale(),
    };
  }

  private emitScreenChanged(snapshot: ScreenStateSnapshot): void {
    this.options.events.emit({
      type: 'SCREEN_CHANGED',
      data: {
        orientation: snapshot.orientation,
        viewport: snapshot.viewport,
        virtual: snapshot.canvas,
        scale: snapshot.scale,
      },
    });
  }
}
