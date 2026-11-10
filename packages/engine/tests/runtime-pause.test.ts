import test from 'node:test';
import assert from 'node:assert/strict';
import { EnginePauseController } from '../src/core/runtime/EnginePauseController';
import type { RuntimePauseReason } from '../src/core/runtime/RuntimeActivity';

class ActivityDocument extends EventTarget {
  visibilityState = 'visible';
  focused = true;
  hasFocus(): boolean { return this.focused; }
}

test('focus loss silently pauses runtime and cannot override other pause reasons', () => {
  const document = new ActivityDocument(), window = new EventTarget();
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window });
  const pauses: boolean[] = [];
  let reasons: readonly RuntimePauseReason[] = [];
  const controller = new EnginePauseController({
    onPausedChanged: paused => pauses.push(paused),
    onActivityChanged: current => { reasons = current; },
  });
  try {
    controller.attach(); controller.attach();
    assert.equal(controller.isPaused(), false);
    document.focused = false; window.dispatchEvent(new Event('blur'));
    assert.equal(controller.isPaused(), true);
    assert.deepEqual(reasons, ['pageInactive']);
    controller.setManualPaused(true);
    document.focused = true; window.dispatchEvent(new Event('focus'));
    assert.equal(controller.isPaused(), true);
    assert.deepEqual(reasons, ['manual']);
    controller.setManualPaused(false);
    assert.equal(controller.isPaused(), false);
    document.visibilityState = 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    assert.equal(controller.isPaused(), true, 'Focus must not resume a hidden page');
    document.visibilityState = 'visible'; document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(controller.isPaused(), false);
    assert.deepEqual(pauses, [true, false, true, false]);
    controller.dispose(); controller.dispose();
    window.dispatchEvent(new Event('blur'));
    assert.equal(controller.isPaused(), false, 'Disposed monitors release their listeners');
  } finally {
    controller.dispose();
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
