import { BaseTypedComponent } from '@engine/layouts';
import { SchemaDecoder } from '@engine/validation';

import type { DragInputPhase } from '../drag/types';
import type { InputEventBase } from '@engine/input';
import type { Container } from '@engine/layouts';
import type { Decoder } from '@engine/validation';

interface DragInputBridgeComponentConfig {
  readonly eventType: string;
}

export class DragInputBridgeComponent extends BaseTypedComponent<DragInputBridgeComponentConfig, Container> {
  private static readonly CONFIG: Decoder<DragInputBridgeComponentConfig> = SchemaDecoder.object({
    eventType: SchemaDecoder.string({ nonEmpty: true }),
  });

  protected override readonly configDecoder = DragInputBridgeComponent.CONFIG;

  private readonly globalOffs: Array<() => void> = [];

  protected override onEnable(): void {
    this.teardownBindings();

    const engine = this.node.engine;

    this.globalOffs.push(
      engine.input.on('dragstart', (event: InputEventBase) => this.emit(this.config.eventType, 'start', event)),
      engine.input.on('drag', (event: InputEventBase) => this.emit(this.config.eventType, 'move', event)),
      engine.input.on('dragend', (event: InputEventBase) =>
        this.emit(
          this.config.eventType,
          event.dragEndReason === 'pointercancel' ? 'cancel' : 'end',
          event,
        ),
      ),
    );
  }

  protected override onDisable(): void {
    this.teardownBindings();
  }

  private emit(eventType: string, phase: DragInputPhase, event: InputEventBase): void {
    this.node.events.emit({
      type: eventType,
      data: {
        phase,
        pointerId: event.pointerId,
        virtualX: event.virtual.x,
        virtualY: event.virtual.y,
      },
    });
  }

  private teardownBindings(): void {
    for (const off of this.globalOffs) {
      off();
    }
    this.globalOffs.length = 0;
  }
}
