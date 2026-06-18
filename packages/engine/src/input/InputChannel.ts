import type { EngineInputEventInit } from './types';
import type { IEventBus } from '../events/types';

/**
 * InputChannel bridges input events to the engine-wide EventBus.
 * It converts an InputEventBase to a domain bus event with type `INPUT_<UPPERCASE>`
 * and attaches the original input payload under `data`.
 */
export class InputChannel {
  constructor(private readonly bus: IEventBus) {}

  /**
   * Publishes the input event to the bus using a standardized type name.
   */
  publish(e: EngineInputEventInit): void {
    this.bus.emit({ type: `INPUT_${e.type.toUpperCase()}`, data: e });
  }
}
