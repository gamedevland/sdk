import type { InputChannel } from '@engine/input/InputChannel';
import type { SceneLayout } from '@engine/layouts';
import type { ScreenManager } from '@engine/screen';

export interface InputRuntime {
  readonly screen: ScreenManager;
  readonly inputChannel: InputChannel;

  getActiveLayout(): SceneLayout | undefined;
}
